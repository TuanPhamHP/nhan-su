<script setup lang="ts">
	import { sanitizeTaskDescription } from '~/utils/task-html';
	import { splitAgentMark } from '~/utils/agent-source';
	import { vnCalendarDate } from '~/utils/date';
	import { storeToRefs } from 'pinia';
	import AgentSourceLabel from '~/components/modules/agent/AgentSourceLabel.vue';
	import EmployeePicker, { type PickablePerson } from '~/components/modules/general-request/EmployeePicker.vue';
	import TaskActivity from '~/components/modules/tasks/TaskActivity.vue';
	import TaskCardMenu from '~/components/modules/tasks/TaskCardMenu.vue';
	import TaskPriorityBadge from '~/components/modules/tasks/TaskPriorityBadge.vue';
	import TaskQuickCreate from '~/components/modules/tasks/TaskQuickCreate.vue';
	import TaskStatusBadge from '~/components/modules/tasks/TaskStatusBadge.vue';
	import { TASK_PROJECT_CONTEXT, useTaskDetailCache } from '~/composables/useTaskDetailCache';
	import type { TaskProjectBits } from '~/composables/useTaskDetailCache';
	import { useAuthStore } from '~/stores/auth';
	import { useDirectoryStore } from '~/stores/directory';
	import { taskPickablePeople } from '~/utils/people-picker';
	import { useTasksService } from '~/services/tasks.service';
	import type { TaskActionResult } from '~/composables/useTaskActions';
	import type {
		TaskAction,
		TaskAttachment,
		TaskDependency,
		TaskDetail,
		TaskGroup,
		TaskListItem,
		TaskPriority,
		TaskSprint,
		TaskStatus,
	} from '~/types/tasks.types';
	import {
		ACTION_LABELS,
		CHECKLIST_ITEM_MAX,
		DUE_TONE_CLASS,
		POINT_SCALE,
		PRIORITY_LABELS,
		PRIORITY_TONE,
		TASK_FILE_ACCEPT,
		TASK_FILE_MAX_MB,
		dueTone,
		isBlankHtml,
		primaryActions,
		lateBlockerText,
		shortDate,
		TASK_HINTS,
		taskDueText,
		taskErrorInfo,
		taskFileSize,
		vnToday,
	} from '~/utils/tasks.utils';

	/**
	 * Nội dung chi tiết một việc, dùng chung cho khung trượt và trang đầy đủ (UI-02, mục 9.2).
	 *
	 * Đầu khung có số hiệu, tiêu đề sửa tại chỗ, trạng thái và một đến hai nút chính theo
	 * `allowedActions`. Bên trái mô tả, việc phụ, danh sách kiểm tra, file, hoạt động; bên phải cột
	 * thông tin, hạn kèm "hạn ban đầu …, đã đổi n lần". Màn hẹp thì cột thông tin lên trên.
	 * Người không xem được việc thấy "Bạn không xem được việc này" kèm tên người giao.
	 */
	const props = withDefaults(defineProps<{ code: string; mode: 'panel' | 'page' }>(), {});
	const emit = defineEmits<{ changed: [task: TaskDetail]; close: []; loaded: [task: TaskDetail]; openTask: [code: string] }>();

	const service = useTasksService();
	const actions = useTaskActions();
	const toast = useToast();
	const authStore = useAuthStore();
	const directoryStore = useDirectoryStore();
	const { employees, departments } = storeToRefs(directoryStore);
	const { canWrite } = useModuleAccess();
	const readOnly = computed(() => !canWrite('TASKS'));
	const today = vnToday();

	const task = ref<TaskDetail | null>(null);
	const loading = ref(true);
	const error = ref<{ code?: string; message: string; assignerName: string | null } | null>(null);
	const activityRef = ref<InstanceType<typeof TaskActivity> | null>(null);
	const cache = useTaskDetailCache();

	/**
	 * Chi tiết tải một lần khi mở rồi giữ trong khung; thao tác sau đó thay bản trả về tại chỗ. Việc vừa xem
	 * thì hiện ngay bản đang giữ và tải bản mới ngầm, không hiện khung xám.
	 */
	async function load(silent = false) {
		if (!silent) loading.value = true;
		error.value = null;
		try {
			const t = await service.get(props.code);
			task.value = t;
			cache.setDetail(t, props.code);
			emit('loaded', t);
		} catch (err) {
			const info = taskErrorInfo(err, 'Chưa tải được việc này.');
			if (!silent || !task.value) error.value = { code: info.code, message: info.message, assignerName: info.assignerName };
		} finally {
			loading.value = false;
		}
	}

	watch(
		() => props.code,
		code => {
			const cached = cache.getDetail(code);
			task.value = cached;
			loading.value = !cached;
			load(!!cached);
		},
		{ immediate: true },
	);

	function setTask(t: TaskDetail) {
		task.value = t;
		cache.setDetail(t, props.code);
		emit('changed', t);
	}

	function handle(result: TaskActionResult) {
		if (result.ok) {
			setTask(result.task);
			activityRef.value?.historyChanged();
		} else if (result.conflict) {
			load(true);
		}
	}

	async function run(action: TaskAction) {
		if (!task.value) return;
		handle(await actions.runAction(task.value, action));
	}

	async function onMenuStatus(status: TaskStatus) {
		const t = task.value;
		const action = t?.columnRules[status]?.action;
		if (t && action) handle(await actions.runAction(t, action));
	}

	const primary = computed(() => (task.value && !readOnly.value ? primaryActions(task.value.allowedActions) : []));

	// ─── Realtime ────────────────────────────────────────────────────────────
	const { subscribe } = useTaskRealtime();
	let unsubscribe: (() => void) | null = null;
	/**
	 * Danh sách kiểm tra, người theo dõi, file không tăng phiên bản việc nên sự kiện của chúng luôn kéo tải
	 * lại. Thao tác của chính mình thì khung đã cập nhật tại chỗ: bỏ tiếng vọng trong vài giây sau đó.
	 */
	let selfChangeAt = 0;
	const markSelfChange = () => (selfChangeAt = Date.now());
	onMounted(() => {
		unsubscribe = subscribe({
			onTaskChanged: e => {
				const t = task.value;
				if (!t || e.id !== t.id) return;
				if (e.version > t.version) load(true);
				else if (['checklist', 'watchers', 'attachment'].includes(e.kind) && Date.now() - selfChangeAt > 3000) load(true);
			},
			onComment: e => {
				if (task.value && e.taskId === task.value.id) activityRef.value?.onRemoteComment();
			},
		});
	});
	onBeforeUnmount(() => unsubscribe?.());

	// ─── Sửa tại chỗ ─────────────────────────────────────────────────────────
	const editingTitle = ref(false);
	const titleDraft = ref('');
	function startTitle() {
		if (!task.value?.permissions.edit || readOnly.value) return;
		titleDraft.value = task.value.title;
		editingTitle.value = true;
	}
	async function saveTitle() {
		const t = task.value;
		editingTitle.value = false;
		if (!t || !titleDraft.value.trim() || titleDraft.value.trim() === t.title) return;
		handle(await actions.updateFields(t, { title: titleDraft.value.trim() }));
	}

	/**
	 * Mô tả sửa tại chỗ: bấm thẳng vào ô là sửa. Lưu bằng nút Lưu, Ctrl+Enter, hoặc bấm ra ngoài ô (rời ô
	 * bằng Tab cũng vậy); Esc hay Huỷ bỏ thay đổi. Enter để xuống dòng vì mô tả có nhiều dòng, danh sách.
	 */
	const canEditDesc = computed(() => !!task.value?.permissions.edit && !readOnly.value);
	const editingDesc = ref(false);
	const savingDesc = ref(false);
	const descDraft = ref('');
	const descBox = ref<HTMLElement | null>(null);
	function startDesc(e?: Event) {
		if (!canEditDesc.value || editingDesc.value) return;
		// Bấm vào liên kết, nút trong mô tả thì làm việc của nó, không vào chế độ sửa.
		if ((e?.target as HTMLElement | null)?.closest('a, button')) return;
		descDraft.value = task.value?.description ?? '';
		editingDesc.value = true;
		document.addEventListener('pointerdown', onPointerOutsideDesc, true);
	}
	function stopDesc() {
		editingDesc.value = false;
		document.removeEventListener('pointerdown', onPointerOutsideDesc, true);
	}
	function onPointerOutsideDesc(e: PointerEvent) {
		if (descBox.value && !descBox.value.contains(e.target as Node)) saveDesc();
	}
	function onDescFocusOut(e: FocusEvent) {
		const next = e.relatedTarget as Node | null;
		// Chỉ tính khi con trỏ sang một ô khác ngoài khung sửa (Tab); bấm chuột đã có `pointerdown` lo.
		if (next && descBox.value && !descBox.value.contains(next)) saveDesc();
	}
	async function saveDesc() {
		const t = task.value;
		if (!t || savingDesc.value || !editingDesc.value) return;
		const next = isBlankHtml(descDraft.value) ? '' : descDraft.value;
		const prev = isBlankHtml(t.description ?? '') ? '' : (t.description ?? '');
		if (next === prev) {
			stopDesc();
			return;
		}
		savingDesc.value = true;
		try {
			const result = await actions.updateFields(t, { description: next });
			if (result.ok) stopDesc();
			handle(result);
		} finally {
			savingDesc.value = false;
		}
	}
	onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerOutsideDesc, true));
	/** Mô tả do trợ lý soạn có đuôi `⟦Trợ lý AI⟧ …`: cắt khi hiện, thay bằng nhãn (dữ liệu giữ nguyên, sửa mô tả vẫn thấy đủ). */
	const descMark = computed(() => splitAgentMark(task.value?.description));
	const descHtml = computed(() => sanitizeTaskDescription(descMark.value.text));

	async function onPriority(value: string) {
		const t = task.value;
		if (!t || value === t.priority) return;
		handle(await actions.updateFields(t, { priority: value as TaskPriority }));
	}
	async function onPoints(value: string) {
		const t = task.value;
		// Ô trống là bỏ điểm (chưa có điểm, tính 0).
		const next = value ? Number(value) : null;
		if (!t || next === t.points) return;
		handle(await actions.updateFields(t, { points: next }));
	}
	async function changeDue() {
		if (task.value) handle(await actions.changeDue(task.value));
	}
	// Phiếu xin dời hạn (bridge mục 25).
	async function requestDue() {
		if (task.value) handle(await actions.requestDue(task.value));
	}
	async function approveDue() {
		if (task.value) handle(await actions.approveDueRequest(task.value));
	}
	async function rejectDue() {
		if (task.value) handle(await actions.rejectDueRequest(task.value));
	}
	async function cancelDue() {
		if (task.value) handle(await actions.cancelDueRequest(task.value));
	}
	// Bấm Hoàn tác trong toast sau Báo xong: thay bản mới nếu là việc đang mở ở đây.
	watch(
		() => actions.externalChange.value,
		t => {
			if (t && task.value && t.id === task.value.id) {
				setTask(t);
				activityRef.value?.historyChanged();
			}
		},
	);
	async function reassign() {
		if (task.value) handle(await actions.reassign(task.value));
	}

	// ─── Danh sách kiểm tra ─────────────────────────────────────────────────
	const newItem = ref('');
	const canChecklist = computed(() => !!task.value?.permissions.manageChecklist && !readOnly.value);
	async function addItem() {
		const t = task.value;
		const content = newItem.value.trim();
		if (!t || !content) return;
		markSelfChange();
		try {
			const item = await service.addChecklistItem(t.id, content);
			t.checklistItems.push(item);
			t.checklist = { total: t.checklist.total + 1, done: t.checklist.done };
			newItem.value = '';
			emit('changed', t);
		} catch (err) {
			toast.error(taskErrorInfo(err).message);
		}
	}
	async function toggleItem(id: number, isDone: boolean) {
		const t = task.value;
		const item = t?.checklistItems.find(i => i.id === id);
		if (!t || !item) return;
		item.isDone = isDone;
		t.checklist = { ...t.checklist, done: t.checklistItems.filter(i => i.isDone).length };
		markSelfChange();
		try {
			Object.assign(item, await service.updateChecklistItem(t.id, id, { isDone }));
			emit('changed', t);
		} catch (err) {
			item.isDone = !isDone;
			t.checklist = { ...t.checklist, done: t.checklistItems.filter(i => i.isDone).length };
			toast.error(taskErrorInfo(err).message);
		}
	}
	async function removeItem(id: number) {
		const t = task.value;
		if (!t) return;
		markSelfChange();
		try {
			await service.removeChecklistItem(t.id, id);
			t.checklistItems = t.checklistItems.filter(i => i.id !== id);
			t.checklist = { total: t.checklistItems.length, done: t.checklistItems.filter(i => i.isDone).length };
			emit('changed', t);
		} catch (err) {
			toast.error(taskErrorInfo(err).message);
		}
	}

	// ─── Việc phụ ───────────────────────────────────────────────────────────
	const showSubtaskForm = ref(false);
	function onSubtaskCreated() {
		load(true);
	}

	// ─── File ───────────────────────────────────────────────────────────────
	const taskFiles = computed(() => task.value?.attachments.filter(a => a.commentId == null) ?? []);
	const fileModel = ref<File | File[] | null>(null);
	const uploading = ref(false);
	const showUpload = ref(false);
	const dropzone = ref<{ openPicker: () => void } | null>(null);
	/** Một lần bấm "Tải file lên" là mở ngay hộp chọn file; vùng thả vẫn hiện để kéo thả trên máy tính. */
	async function startUpload() {
		showUpload.value = true;
		await nextTick();
		dropzone.value?.openPicker();
	}
	watch(fileModel, async v => {
		const t = task.value;
		const files = Array.isArray(v) ? v : v ? [v] : [];
		if (!t || !files.length) return;
		fileModel.value = null;
		uploading.value = true;
		markSelfChange();
		for (const f of files) {
			try {
				const a = await service.uploadAttachment(t.id, f);
				t.attachments.push(a);
				toast.success(`Đã tải lên ${a.fileName}`);
			} catch (err) {
				toast.error(taskErrorInfo(err).message);
			}
		}
		uploading.value = false;
		showUpload.value = false;
	});
	async function openFile(a: TaskAttachment) {
		const t = task.value;
		if (!t) return;
		// Mở cửa sổ trước khi chờ mạng, kẻo trình duyệt chặn cửa sổ bật lên.
		const win = window.open('', '_blank');
		try {
			const { url } = await service.attachmentUrl(t.id, a.id);
			if (win) win.location.href = url;
			else window.location.href = url;
		} catch (err) {
			win?.close();
			toast.error(taskErrorInfo(err).message);
		}
	}

	// ─── Người theo dõi ─────────────────────────────────────────────────────
	const me = computed(() => authStore.user?.id ?? 0);
	const iWatch = computed(() => !!task.value?.watchers.some(w => w.id === me.value));
	const addingWatchers = ref(false);
	const watcherPick = ref<number[]>([]);
	const people = computed<PickablePerson[]>(() =>
		taskPickablePeople(
			employees.value.filter(e => !task.value?.watchers.some(w => w.id === e.id)),
			departments.value,
		),
	);
	async function addWatchers() {
		const t = task.value;
		if (!t || !watcherPick.value.length) return;
		markSelfChange();
		try {
			setTask(await service.addWatchers(t.id, watcherPick.value));
			watcherPick.value = [];
			addingWatchers.value = false;
		} catch (err) {
			toast.error(taskErrorInfo(err).message);
		}
	}
	async function toggleWatch() {
		const t = task.value;
		if (!t) return;
		markSelfChange();
		try {
			if (iWatch.value) {
				await service.removeWatcher(t.id, me.value);
				t.watchers = t.watchers.filter(w => w.id !== me.value);
				toast.success('Đã bỏ theo dõi');
			} else {
				setTask(await service.addWatchers(t.id, [me.value]));
				toast.success('Đã theo dõi việc này');
			}
		} catch (err) {
			toast.error(taskErrorInfo(err).message);
		}
	}
	async function removeWatcher(id: number) {
		const t = task.value;
		if (!t) return;
		markSelfChange();
		try {
			await service.removeWatcher(t.id, id);
			t.watchers = t.watchers.filter(w => w.id !== id);
		} catch (err) {
			toast.error(taskErrorInfo(err).message);
		}
	}
	function openWatcherPicker() {
		addingWatchers.value = !addingWatchers.value;
		if (addingWatchers.value) directoryStore.load().catch(() => toast.error('Chưa tải được danh sách nhân viên.'));
	}

	function openChild(child: TaskListItem) {
		emit('openTask', child.code);
	}

	// ─── Lô 2: nhóm việc, đợt ────────────────────────────────────────────────
	// Ai đổi được nhóm, đợt: thành viên dự án vai Quản lý, Thành viên và ADMIN (bridge mục 12.3). Máy chủ
	// không trả cờ riêng cho việc này nên khung hỏi vai của người xem trong dự án; người không là thành
	// viên (trưởng phòng xem qua Việc của phòng) nhận 404 và chỉ thấy chữ.
	// Mở từ trang dự án thì dùng nhóm, đợt trang đã tải (`TaskWorkspace` chia qua `provide`), không gọi lại;
	// mở từ nơi khác thì hỏi qua bộ nhớ đệm, các việc cùng dự án mở liền nhau chỉ hỏi một lần.
	const projectCtx = inject(TASK_PROJECT_CONTEXT, null);
	const projectId = computed(() => (task.value?.project && !task.value.parent ? task.value.project.id : null));
	const sharedProject = computed(() => {
		const ctx = projectCtx?.value;
		return ctx && ctx.projectId === projectId.value ? ctx : null;
	});
	const fetchedProject = ref<TaskProjectBits | null>(null);
	watch(
		projectId,
		async pid => {
			fetchedProject.value = null;
			if (!pid || sharedProject.value) return;
			try {
				const bits = await cache.projectBits(pid);
				if (projectId.value === pid) fetchedProject.value = bits;
			} catch {
				// Không là thành viên dự án: giữ chữ, không cho chọn.
			}
		},
		{ immediate: true },
	);
	const projectGroups = computed<TaskGroup[]>(() => sharedProject.value?.groups ?? fetchedProject.value?.groups ?? []);
	const projectSprints = computed<TaskSprint[]>(() => (sharedProject.value ? (sharedProject.value.sprints ?? []) : (fetchedProject.value?.sprints ?? [])));
	const useSprints = computed(() => (sharedProject.value ? sharedProject.value.sprints !== null : !!fetchedProject.value?.useSprints));
	const isAdmin = computed(() => authStore.user?.role === 'ADMIN');
	const canContribute = computed(() => {
		if (sharedProject.value) return sharedProject.value.canContribute;
		const role = fetchedProject.value?.myRole;
		return !readOnly.value && (isAdmin.value || role === 'MANAGER' || role === 'MEMBER');
	});
	const editableGroups = computed(() => projectGroups.value.filter(g => !g.archived));
	const openSprints = computed(() => projectSprints.value.filter(s => s.status !== 'CLOSED'));
	const canEditPlacement = computed(() => canContribute.value && !!task.value && task.value.status !== 'CANCELLED');

	async function onGroup(value: string) {
		const t = task.value;
		const groupId = value ? Number(value) : null;
		if (!t || (t.group?.id ?? null) === groupId) return;
		handle(await actions.updateFields(t, { groupId }));
	}
	async function onSprint(value: string) {
		const t = task.value;
		const sprintId = value ? Number(value) : null;
		if (!t || (t.sprint?.id ?? null) === sprintId) return;
		handle(await actions.updateFields(t, { sprintId }));
	}

	// ─── Lô 2: phụ thuộc ─────────────────────────────────────────────────────
	// Ai nối: người giao, người thực hiện, quản lý dự án, trưởng phòng của người giao (gần đúng cờ
	// `addSubtask`), hoặc thành viên dự án vai Quản lý, Thành viên. Máy chủ vẫn kiểm từng lần.
	const canLinkDeps = computed(
		() => !readOnly.value && !!task.value && task.value.status !== 'CANCELLED' && (task.value.permissions.addSubtask || canContribute.value),
	);
	const addingDep = ref(false);
	const depQuery = ref('');
	const depResults = ref<TaskListItem[]>([]);
	const depSearching = ref(false);
	let depTimer: ReturnType<typeof setTimeout> | null = null;
	watch(depQuery, q => {
		if (depTimer) clearTimeout(depTimer);
		depTimer = setTimeout(() => searchDeps(q), 300);
	});
	async function searchDeps(q: string) {
		const t = task.value;
		if (!t) return;
		depSearching.value = true;
		try {
			const res = await service.list({
				q: q.trim() || undefined,
				projectId: t.project?.id,
				status: 'TODO,IN_PROGRESS,IN_REVIEW,DONE',
				sort: 'dueDate',
				limit: 8,
			});
			const taken = new Set([t.id, ...t.blockers.map(b => b.id)]);
			depResults.value = res.data.filter(x => !taken.has(x.id));
		} catch {
			depResults.value = [];
		} finally {
			depSearching.value = false;
		}
	}
	function openDepPicker() {
		addingDep.value = !addingDep.value;
		if (addingDep.value) {
			depQuery.value = '';
			searchDeps('');
		}
	}
	async function addBlocker(b: TaskListItem) {
		const t = task.value;
		if (!t) return;
		try {
			setTask(await service.addDependency(t.id, b.id));
			toast.success(`Việc này chờ ${b.code}`);
			addingDep.value = false;
			activityRef.value?.historyChanged();
		} catch (err) {
			toast.error(taskErrorInfo(err).message);
		}
	}
	async function removeDep(dep: TaskDependency, side: 'blocker' | 'blocking') {
		const t = task.value;
		if (!t) return;
		try {
			if (side === 'blocker') await service.removeDependency(t.id, dep.id);
			else await service.removeDependency(dep.id, t.id);
			toast.success('Đã gỡ nối');
			await load(true);
			if (task.value) emit('changed', task.value);
			activityRef.value?.historyChanged();
		} catch (err) {
			toast.error(taskErrorInfo(err).message);
		}
	}

	const composerId = `task-composer-${Math.random().toString(36).slice(2, 10)}`;
	const subtaskDone = computed(() => task.value?.subtasks ?? { total: 0, done: 0, points: 0 });
	defineExpose({ reload: () => load(true) });
</script>

<template>
	<div class="relative flex min-h-0 flex-1 flex-col" data-testid="task-detail">
		<div v-if="loading || error" class="absolute right-3 top-3 z-10 flex items-center gap-1">
			<slot name="header-tools" />
		</div>
		<!-- Đang tải -->
		<div v-if="loading" class="space-y-3 p-5" aria-busy="true">
			<div class="h-5 w-24 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
			<div class="h-7 w-3/4 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
			<div v-for="i in 4" :key="i" class="h-14 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
		</div>

		<!-- Không xem được / lỗi -->
		<div v-else-if="error" class="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center" data-testid="task-detail-error">
			<Icon
				:name="error.code === 'TASK_NOT_VISIBLE' ? 'heroicons:lock-closed' : 'heroicons:exclamation-triangle'"
				class="h-10 w-10 text-gray-400"
			/>
			<template v-if="error.code === 'TASK_NOT_VISIBLE'">
				<h2 class="text-base font-semibold text-gray-900 dark:text-white">Bạn không xem được việc này</h2>
				<p class="max-w-sm text-sm text-gray-600 dark:text-gray-300">
					<template v-if="error.assignerName">Người giao việc là {{ error.assignerName }}. Bạn hỏi người đó nếu cần xem.</template>
					<template v-else>Bạn hỏi người giao việc nếu cần xem.</template>
				</p>
			</template>
			<template v-else-if="error.code === 'TASK_NOT_FOUND'">
				<h2 class="text-base font-semibold text-gray-900 dark:text-white">Không có việc {{ code }}</h2>
				<p class="text-sm text-gray-600 dark:text-gray-300">Số hiệu này không có hoặc đã gõ nhầm.</p>
			</template>
			<template v-else>
				<p class="max-w-sm text-sm text-gray-600 dark:text-gray-300">{{ error.message }}</p>
				<CommonAppButton variant="secondary" size="sm" @click="load()">Thử lại</CommonAppButton>
			</template>
			<NuxtLink to="/cong-viec" class="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">Về Việc của tôi</NuxtLink>
		</div>

		<template v-else-if="task">
			<!-- Đầu khung -->
			<header class="border-b border-gray-200 px-4 py-3 sm:px-5 dark:border-gray-700">
				<div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
					<span class="font-semibold">{{ task.code }}</span>
					<template v-if="task.project">
						<span aria-hidden="true">·</span>
						<NuxtLink :to="`/cong-viec/du-an/${task.project.code}`" class="truncate hover:underline">{{ task.project.name }}</NuxtLink>
					</template>
					<template v-if="task.parent">
						<span aria-hidden="true">·</span>
						<button type="button" class="truncate hover:underline" @click="emit('openTask', task.parent.code)">
							Việc phụ của {{ task.parent.title ?? task.parent.code }}
						</button>
					</template>
					<div class="ml-auto flex items-center gap-1">
						<slot name="header-tools" />
					</div>
				</div>
				<div class="mt-1.5">
					<input
						v-if="editingTitle"
						v-model="titleDraft"
						class="w-full rounded-md border border-brand-500 bg-white px-2 py-1 text-lg font-semibold text-gray-900 focus:outline-none dark:bg-gray-800 dark:text-white"
						aria-label="Tiêu đề việc"
						maxlength="500"
						@keydown.enter.prevent="saveTitle"
						@keydown.esc.stop="editingTitle = false"
						@blur="saveTitle"
					/>
					<h2
						v-else
						class="text-lg font-semibold leading-snug text-gray-900 dark:text-white"
						:class="task.permissions.edit && !readOnly ? 'cursor-text rounded hover:bg-gray-50 dark:hover:bg-gray-800' : ''"
						:tabindex="task.permissions.edit && !readOnly ? 0 : undefined"
						:title="task.permissions.edit && !readOnly ? 'Bấm để sửa tiêu đề' : undefined"
						@click="startTitle"
						@keydown.enter.prevent="startTitle"
					>
						{{ task.title }}
					</h2>
				</div>
				<div class="mt-2 flex flex-wrap items-center gap-2">
					<TaskStatusBadge :status="task.status" :label="task.statusLabel" />
					<span v-if="task.overdue" class="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">Quá hạn</span>
					<span v-if="task.returnCount" class="text-xs text-gray-500 dark:text-gray-400">đã trả lại {{ task.returnCount }} lần</span>
					<span v-if="task.recurrenceId" class="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">Việc định kỳ</span>
					<span v-if="task.group" class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">{{ task.group.name }}</span>
					<span v-if="task.sprint" class="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">{{ task.sprint.name }}</span>
					<span v-if="task.dependencies?.late" class="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" data-testid="task-late-blocker">{{ lateBlockerText(task, task.blockers, today) ?? 'Phải chờ việc khác đang trễ hạn.' }}</span>
					<div class="ml-auto flex flex-wrap items-center gap-2" data-tour="task-primary">
						<CommonAppButton
							v-for="(a, i) in primary"
							:key="a"
							size="sm"
							:variant="a === 'return' ? 'danger_outline' : i === 0 ? 'primary' : 'outline'"
							:loading="actions.busy.value"
							:data-testid="`task-action-${a}`"
							@click="run(a)"
						>
							{{ ACTION_LABELS[a] }}
						</CommonAppButton>
						<TaskCardMenu
							v-if="!readOnly"
							:task="task"
							in-detail
							:primary-shown="primary.length"
							@open="() => {}"
							@status="onMenuStatus"
							@change-due="changeDue"
							@due-requested="t => handle({ ok: true, task: t })"
							@reassign="reassign"
						/>
					</div>
				</div>

				<!-- Phiếu xin dời hạn đang chờ (bridge mục 25): người xin huỷ được, người có quyền đổi hạn duyệt ngay ở đây. -->
				<div
					v-if="task.pendingDueRequest"
					class="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-100"
					data-testid="task-due-request"
				>
					<p>
						<span class="font-medium">{{ task.pendingDueRequest.requestedBy.fullName }}</span>
						đang xin dời hạn sang <span class="font-medium">{{ shortDate(task.pendingDueRequest.proposedDueDate, today) }}</span>,
						lý do: {{ splitAgentMark(task.pendingDueRequest.reason).text }}
					</p>
					<div v-if="!readOnly" class="mt-2 flex flex-wrap gap-2">
						<template v-if="task.permissions.changeDue">
							<CommonAppButton size="sm" :loading="actions.busy.value" data-testid="task-due-request-approve" @click="approveDue">Duyệt</CommonAppButton>
							<CommonAppButton size="sm" variant="danger_outline" data-testid="task-due-request-reject" @click="rejectDue">Không duyệt</CommonAppButton>
						</template>
						<CommonAppButton
							v-if="task.pendingDueRequest.requestedBy.id === authStore.user?.id"
							size="sm"
							variant="secondary"
							data-testid="task-due-request-cancel"
							@click="cancelDue"
						>
							Huỷ phiếu
						</CommonAppButton>
					</div>
				</div>

				<!-- Lý do trả lại hay mở lại gần nhất, khi việc đang làm lại (bridge mục 28). -->
				<div
					v-if="task.lastReturn && task.status === 'IN_PROGRESS'"
					class="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100"
					data-testid="task-last-return"
				>
					<span class="font-medium">{{ task.lastReturn.reopened ? 'Được mở lại' : 'Bị trả lại' }}:</span>
					{{ splitAgentMark(task.lastReturn.reason).text }}
					<span class="text-xs text-amber-700 dark:text-amber-300">
						({{ task.lastReturn.by?.fullName ?? 'không rõ người' }}, {{ shortDate(vnCalendarDate(task.lastReturn.at), today) }})
					</span>
				</div>
			</header>

			<!-- Thân khung: cuộn riêng, ô bình luận dính đáy -->
			<div class="min-h-0 flex-1 overflow-y-auto px-4 sm:px-5" data-testid="task-detail-body">
				<div class="grid gap-5 py-4" :class="mode === 'page' ? 'lg:grid-cols-[minmax(0,1fr)_16rem]' : 'sm:grid-cols-[minmax(0,1fr)_13rem]'">
					<!-- Cột thông tin: màn hẹp lên trên -->
					<aside class="space-y-3 text-sm sm:order-2" aria-label="Thông tin việc">
						<dl class="space-y-3">
							<div>
								<dt class="text-xs text-gray-500 dark:text-gray-400">Người thực hiện</dt>
								<dd class="mt-1 flex items-center gap-2">
									<CommonAppAvatar :src="task.assignee.avatarUrl" :name="task.assignee.fullName" size="xs" />
									<span class="text-gray-900 dark:text-gray-100">{{ task.assignee.fullName }}</span>
									<button v-if="task.permissions.reassign && !readOnly" type="button" class="ml-auto text-xs text-brand-600 hover:underline dark:text-brand-400" @click="reassign">Đổi</button>
								</dd>
							</div>
							<div>
								<dt class="text-xs text-gray-500 dark:text-gray-400">Người giao</dt>
								<dd class="mt-1 flex items-center gap-2">
									<CommonAppAvatar :src="task.assigner.avatarUrl" :name="task.assigner.fullName" size="xs" />
									<span class="text-gray-900 dark:text-gray-100">{{ task.assigner.fullName }}</span>
								</dd>
							</div>
							<div>
								<dt class="text-xs text-gray-500 dark:text-gray-400">Người nghiệm thu</dt>
								<dd class="mt-1 flex items-center gap-2">
									<CommonAppAvatar :src="task.reviewer.avatarUrl" :name="task.reviewer.fullName" size="xs" />
									<span class="text-gray-900 dark:text-gray-100">{{ task.reviewer.fullName }}</span>
								</dd>
							</div>
							<div>
								<dt class="text-xs text-gray-500 dark:text-gray-400">Hạn</dt>
								<dd class="mt-1" data-testid="task-due">
									<span :class="DUE_TONE_CLASS[dueTone(task, today)]">
										<template v-if="!task.dueDate">{{ taskDueText(task, today) }}</template>
									<template v-else>
										{{ shortDate(task.dueDate, today) }}<template v-if="taskDueText(task, today) !== shortDate(task.dueDate, today)"> · {{ taskDueText(task, today) }}</template>
									</template>
									</span>
									<button
										v-if="task.permissions.changeDue && !readOnly"
										type="button"
										class="ml-2 text-xs text-brand-600 hover:underline dark:text-brand-400"
										data-testid="task-change-due"
										@click="changeDue"
									>
										{{ task.dueDate ? 'Đổi hạn' : 'Đặt hạn' }}
									</button>
									<button
										v-else-if="task.permissions.requestDue && !readOnly && !task.pendingDueRequest"
										type="button"
										class="ml-2 text-xs text-brand-600 hover:underline dark:text-brand-400"
										data-testid="task-request-due"
										@click="requestDue"
									>
										Xin dời hạn
									</button>
									<p v-if="task.dueChangeCount" class="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
										hạn ban đầu {{ shortDate(task.originalDueDate, today) }}, đã đổi {{ task.dueChangeCount }} lần
									</p>
									<ul v-if="task.dueChanges.length" class="mt-1 space-y-0.5 text-xs text-gray-500 dark:text-gray-400">
										<li v-for="(d, i) in task.dueChanges" :key="i">
											{{ shortDate(d.oldDueDate, today) }} sang {{ shortDate(d.newDueDate, today) }}: {{ d.reason }} ({{ d.changedBy.fullName }})
										</li>
									</ul>
								</dd>
							</div>
							<div v-if="task.startDate">
								<dt class="text-xs text-gray-500 dark:text-gray-400">Ngày bắt đầu</dt>
								<dd class="mt-1 text-gray-900 dark:text-gray-100">{{ shortDate(task.startDate, today) }}</dd>
							</div>
							<div class="grid grid-cols-2 gap-3">
								<div>
									<dt class="text-xs text-gray-500 dark:text-gray-400">Ưu tiên</dt>
									<dd class="mt-1">
										<select
											v-if="task.permissions.edit && !readOnly"
											:value="task.priority"
											aria-label="Ưu tiên"
											class="w-full cursor-pointer rounded-md border-0 py-1 pl-2 pr-7 text-xs font-medium ring-1 ring-inset focus:outline-none focus:ring-2 focus:ring-brand-500 [&>option]:bg-white [&>option]:text-gray-900 dark:[&>option]:bg-gray-800 dark:[&>option]:text-gray-100"
											:class="PRIORITY_TONE[task.priority].badge"
											@change="e => onPriority((e.target as HTMLSelectElement).value)"
										>
											<option v-for="(label, key) in PRIORITY_LABELS" :key="key" :value="key">{{ label }}</option>
										</select>
										<TaskPriorityBadge v-else :priority="task.priority" />
									</dd>
								</div>
								<div>
									<dt class="text-xs text-gray-500 dark:text-gray-400" title="Điểm khối lượng: việc càng nặng điểm càng cao">Điểm</dt>
									<dd class="mt-1">
										<select
											v-if="task.permissions.edit && !readOnly"
											:value="task.points ?? ''"
											aria-label="Điểm khối lượng"
											class="w-full rounded-md border border-gray-200 bg-white px-1.5 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
											@change="e => onPoints((e.target as HTMLSelectElement).value)"
										>
											<option value="">Chưa có</option>
											<option v-for="p in POINT_SCALE" :key="p" :value="p">{{ p }}</option>
										</select>
										<span v-else class="text-gray-900 dark:text-gray-100">{{ task.points ?? 'Chưa có' }}</span>
										<span v-if="subtaskDone.total" class="mt-0.5 block text-[11px] text-gray-500">việc phụ {{ subtaskDone.points }} điểm</span>
									</dd>
								</div>
							</div>
							<div v-if="task.qualityScore">
								<dt class="text-xs text-gray-500 dark:text-gray-400">Chất lượng</dt>
								<dd class="mt-1 text-amber-500" :aria-label="`${task.qualityScore} sao`">
									<Icon v-for="n in task.qualityScore" :key="n" name="heroicons:star-solid" class="h-4 w-4" />
								</dd>
							</div>
							<div>
								<dt class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
									Người theo dõi
									<button v-if="task.permissions.manageWatchers && !readOnly" type="button" class="text-brand-600 hover:underline dark:text-brand-400" @click="openWatcherPicker">Thêm</button>
								</dt>
								<dd class="mt-1 space-y-1">
									<p v-if="!task.watchers.length" class="text-xs text-gray-400">Chưa có ai</p>
									<div v-for="w in task.watchers" :key="w.id" class="flex items-center gap-2">
										<CommonAppAvatar :src="w.avatarUrl" :name="w.fullName" size="xs" />
										<span class="min-w-0 flex-1 truncate text-gray-800 dark:text-gray-200">{{ w.fullName }}</span>
										<button
											v-if="task.permissions.manageWatchers && !readOnly"
											type="button"
											class="text-gray-400 hover:text-rose-600"
											:aria-label="`Bỏ ${w.fullName} khỏi người theo dõi`"
											@click="removeWatcher(w.id)"
										>
											<Icon name="heroicons:x-mark" class="h-4 w-4" />
										</button>
									</div>
									<div v-if="addingWatchers" class="space-y-1.5">
										<EmployeePicker v-model="watcherPick" :people="people" />
										<CommonAppButton size="sm" :disabled="!watcherPick.length" @click="addWatchers">Thêm người theo dõi</CommonAppButton>
									</div>
									<button
										v-if="!readOnly && task.assignee.id !== me && task.assigner.id !== me"
										type="button"
										class="text-xs text-brand-600 hover:underline dark:text-brand-400"
										@click="toggleWatch"
									>
										{{ iWatch ? 'Bỏ theo dõi' : 'Theo dõi việc này' }}
									</button>
								</dd>
							</div>
							<div v-if="task.project">
								<dt class="text-xs text-gray-500 dark:text-gray-400">Dự án</dt>
								<dd class="mt-1 text-gray-900 dark:text-gray-100">{{ task.project.name }}</dd>
							</div>
							<div v-if="task.project && !task.parent && (task.group || projectGroups.length)">
								<dt class="text-xs text-gray-500 dark:text-gray-400" :title="TASK_HINTS.group">Nhóm việc</dt>
								<dd class="mt-1">
									<select
										v-if="canEditPlacement && projectGroups.length"
										:value="task.group?.id ?? ''"
										aria-label="Nhóm việc"
										data-testid="task-detail-group"
										class="w-full rounded-md border border-gray-200 bg-white px-1.5 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
										@change="e => onGroup((e.target as HTMLSelectElement).value)"
									>
										<option value="">Chưa có nhóm</option>
										<option v-if="task.group && !editableGroups.some(g => g.id === task!.group!.id)" :value="task.group.id" disabled>
											{{ task.group.name }} (đã cất)
										</option>
										<option v-for="g in editableGroups" :key="g.id" :value="g.id">{{ g.name }}</option>
									</select>
									<span v-else class="text-gray-900 dark:text-gray-100" data-testid="task-detail-group-text">{{ task.group?.name ?? 'Chưa có nhóm' }}</span>
								</dd>
							</div>
							<div v-if="task.project && !task.parent && (task.sprint || useSprints)">
								<dt class="text-xs text-gray-500 dark:text-gray-400" :title="TASK_HINTS.sprint">Đợt</dt>
								<dd class="mt-1">
									<select
										v-if="canEditPlacement && useSprints"
										:value="task.sprint?.id ?? ''"
										aria-label="Đợt"
										data-testid="task-detail-sprint"
										class="w-full rounded-md border border-gray-200 bg-white px-1.5 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
										@change="e => onSprint((e.target as HTMLSelectElement).value)"
									>
										<option value="">Việc chờ xếp</option>
										<option v-if="task.sprint && task.sprint.status === 'CLOSED'" :value="task.sprint.id" disabled>{{ task.sprint.name }} (đã đóng)</option>
										<option v-for="sp in openSprints" :key="sp.id" :value="sp.id">{{ sp.name }} ({{ sp.statusLabel.toLowerCase() }})</option>
									</select>
									<span v-else class="text-gray-900 dark:text-gray-100">{{ task.sprint ? `${task.sprint.name} (${task.sprint.statusLabel.toLowerCase()})` : 'Việc chờ xếp' }}</span>
									<span v-if="task.sprintMoveCount" class="mt-0.5 block text-[11px] text-orange-700 dark:text-orange-400">chuyển đợt {{ task.sprintMoveCount }} lần</span>
									<span v-if="task.addedAfterSprintStart" class="mt-0.5 block text-[11px] text-gray-500">thêm vào khi đợt đã chạy</span>
								</dd>
							</div>
							<div>
								<dt class="text-xs text-gray-500 dark:text-gray-400">Nguồn</dt>
								<dd class="mt-1 text-gray-700 dark:text-gray-300">
									<NuxtLink
										v-if="task.recurrenceId"
										:to="`/cong-viec/dinh-ky?id=${task.recurrenceId}`"
										class="inline-flex items-center gap-1 rounded bg-teal-50 px-1.5 py-0.5 text-xs text-teal-700 hover:underline dark:bg-teal-900/30 dark:text-teal-300"
										data-testid="task-detail-recurring"
									>
										<Icon name="heroicons:arrow-path" class="h-3.5 w-3.5" />{{ task.sourceLabel }}
									</NuxtLink>
									<template v-else>{{ task.sourceLabel }}</template>
								</dd>
							</div>
						</dl>
					</aside>

					<div class="min-w-0 space-y-6 sm:order-1">
						<!-- Mô tả -->
						<section aria-label="Mô tả">
							<h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Mô tả</h3>
							<div
								v-if="editingDesc"
								ref="descBox"
								class="mt-2 space-y-2"
								data-testid="task-description-editor"
								@focusout="onDescFocusOut"
								@keydown.esc.stop.prevent="stopDesc"
							>
								<CommonTiptapEditor
									v-model="descDraft"
									placeholder="Mô tả việc cần làm, kết quả mong đợi"
									no-headings
									autofocus
									submit-on-mod-enter
									@submit="saveDesc"
								/>
								<div class="flex items-center justify-end gap-2">
									<span class="mr-auto hidden text-xs text-gray-400 sm:inline">Ctrl+Enter hoặc bấm ra ngoài để lưu, Esc để huỷ</span>
									<CommonAppButton size="sm" variant="secondary" @click="stopDesc">Huỷ</CommonAppButton>
									<CommonAppButton size="sm" :loading="savingDesc" @click="saveDesc">Lưu</CommonAppButton>
								</div>
							</div>
							<div
								v-else
								class="-mx-2 mt-1 rounded-md px-2 py-1.5"
								:class="canEditDesc ? 'cursor-text hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:hover:bg-gray-800/60' : ''"
								:role="canEditDesc ? 'button' : undefined"
								:tabindex="canEditDesc ? 0 : undefined"
								:title="canEditDesc ? 'Bấm để sửa mô tả' : undefined"
								:aria-label="canEditDesc ? 'Sửa mô tả' : undefined"
								data-testid="task-description"
								@click="startDesc"
								@keydown.enter.self.prevent="startDesc()"
							>
								<template v-if="task.description">
									<!-- eslint-disable-next-line vue/no-v-html -- đã lọc bằng sanitizeTaskDescription -->
									<div v-if="descHtml" class="tt-prose break-words text-sm text-gray-800 dark:text-gray-200" v-html="descHtml" />
									<AgentSourceLabel v-if="descMark.viaAgent" class="mt-1.5" :trace="descMark.trace" />
								</template>
								<p v-else class="text-sm text-gray-400">{{ canEditDesc ? 'Bấm để thêm mô tả' : 'Chưa có mô tả.' }}</p>
							</div>
						</section>

						<!-- Việc phụ -->
						<section v-if="!task.parent" aria-label="Việc phụ">
							<div class="flex items-center justify-between">
								<h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
									Việc phụ
									<span v-if="subtaskDone.total" class="font-normal text-gray-500">{{ subtaskDone.done }}/{{ subtaskDone.total }}</span>
								</h3>
								<button
									v-if="task.permissions.addSubtask && !readOnly"
									type="button"
									class="text-xs text-brand-600 hover:underline dark:text-brand-400"
									@click="showSubtaskForm = !showSubtaskForm"
								>
									Thêm việc phụ
								</button>
							</div>
							<ul v-if="task.children.length" class="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-700">
								<li v-for="c in task.children" :key="c.id" class="flex items-center gap-2 px-3 py-2">
									<TaskStatusBadge :status="c.status" :label="c.statusLabel" />
									<button type="button" class="min-w-0 flex-1 truncate text-left text-sm text-gray-800 hover:underline dark:text-gray-200" @click="openChild(c)">
										<span class="text-xs text-gray-500">{{ c.code }}</span> {{ c.title }}
									</button>
									<CommonAppAvatar :src="c.assignee.avatarUrl" :name="c.assignee.fullName" size="xs" :title="c.assignee.fullName" />
									<span class="text-xs" :class="DUE_TONE_CLASS[dueTone(c, today)]">{{ taskDueText(c, today) }}</span>
								</li>
							</ul>
							<p v-if="subtaskDone.total > task.children.length" class="mt-1 text-xs text-gray-500">
								Có {{ subtaskDone.total - task.children.length }} việc phụ bạn không xem được.
							</p>
							<div v-if="showSubtaskForm" class="mt-2">
								<TaskQuickCreate
									:parent-id="task.id"
									:default-assignee-id="task.assignee.id"
									:default-due-date="task.dueDate"
									placeholder="Tiêu đề việc phụ"
									@created="onSubtaskCreated"
								/>
							</div>
						</section>

						<!-- Phụ thuộc (lô 2) -->
						<section v-if="!task.parent" aria-label="Phụ thuộc" data-testid="task-dependencies">
							<div class="flex items-center justify-between">
								<h3 class="flex items-center gap-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
									Phụ thuộc
									<span class="cursor-help text-xs font-normal text-gray-400" :title="TASK_HINTS.dependency" aria-label="Phụ thuộc là gì">ⓘ</span>
								</h3>
								<button
									v-if="canLinkDeps"
									type="button"
									class="text-xs text-brand-600 hover:underline dark:text-brand-400"
									data-testid="task-dep-add"
									@click="openDepPicker"
								>
									Thêm việc phải chờ
								</button>
							</div>
							<div v-if="addingDep" class="mt-2 space-y-1.5 rounded-lg border border-gray-200 p-2 dark:border-gray-700">
								<input
									v-model="depQuery"
									type="search"
									placeholder="Tìm theo tiêu đề hoặc số hiệu"
									aria-label="Tìm việc phải chờ"
									class="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
								/>
								<p v-if="depSearching" class="text-xs text-gray-500">Đang tìm…</p>
								<p v-else-if="!depResults.length" class="text-xs text-gray-500">Không có việc nào khớp.</p>
								<ul v-else class="max-h-56 overflow-y-auto">
									<li v-for="r in depResults" :key="r.id">
										<button
											type="button"
											class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:hover:bg-gray-800"
											:data-testid="`task-dep-option-${r.code}`"
											@click="addBlocker(r)"
										>
											<span class="text-xs font-semibold text-gray-500">{{ r.code }}</span>
											<span class="min-w-0 flex-1 truncate text-gray-800 dark:text-gray-200">{{ r.title }}</span>
											<span class="text-xs text-gray-500">{{ r.dueDate ? `hạn ${shortDate(r.dueDate, today)}` : 'chưa có hạn' }}</span>
										</button>
									</li>
								</ul>
							</div>
							<p v-if="!task.blockers.length && !task.blocking.length && !addingDep" class="mt-2 text-sm text-gray-400">Việc này không chờ việc nào.</p>
							<ul v-if="task.blockers.length" class="mt-2 space-y-1" data-testid="task-blockers">
								<li v-for="d in task.blockers" :key="`b${d.id}`" class="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm" :class="d.late ? 'border-rose-200 bg-rose-50/60 dark:border-rose-800 dark:bg-rose-900/10' : 'border-gray-200 dark:border-gray-700'">
									<span v-if="d.late" class="h-2 w-2 shrink-0 rounded-full bg-rose-500" title="Việc trước đang trễ" />
									<span class="shrink-0 text-gray-500 dark:text-gray-400">Chờ việc</span>
									<button
										v-if="d.visible"
										type="button"
										class="min-w-0 flex-1 truncate text-left text-gray-900 hover:underline dark:text-gray-100"
										@click="emit('openTask', d.code)"
									>
										<span class="font-semibold">{{ d.code }}</span> {{ d.title }}
									</button>
									<span v-else class="min-w-0 flex-1 truncate text-gray-500" title="Bạn không xem được việc này">{{ d.code }}</span>
									<TaskStatusBadge :status="d.status" :label="d.statusLabel" />
									<button v-if="canLinkDeps" type="button" class="text-gray-400 hover:text-rose-600" :aria-label="`Gỡ nối với ${d.code}`" @click="removeDep(d, 'blocker')">
										<Icon name="heroicons:x-mark" class="h-4 w-4" />
									</button>
								</li>
							</ul>
							<p v-if="task.blockers.some(b => b.late)" class="mt-1 text-xs text-rose-600 dark:text-rose-400">
								Việc phải chờ đang trễ hoặc có hạn muộn hơn ngày bắt đầu của việc này. Hệ thống chỉ cảnh báo, không tự dời ngày.
							</p>
							<ul v-if="task.blocking.length" class="mt-2 space-y-1" data-testid="task-blocking">
								<li v-for="d in task.blocking" :key="`a${d.id}`" class="flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm dark:border-gray-700">
									<span v-if="d.late" class="h-2 w-2 shrink-0 rounded-full bg-rose-500" title="Việc này đang làm trễ việc sau" />
									<span class="shrink-0 text-gray-500 dark:text-gray-400">Việc</span>
									<button
										v-if="d.visible"
										type="button"
										class="min-w-0 flex-1 truncate text-left text-gray-900 hover:underline dark:text-gray-100"
										@click="emit('openTask', d.code)"
									>
										<span class="font-semibold">{{ d.code }}</span> {{ d.title }}
									</button>
									<span v-else class="min-w-0 flex-1 truncate text-gray-500" title="Bạn không xem được việc này">{{ d.code }}</span>
									<span class="shrink-0 text-gray-500 dark:text-gray-400">đang chờ việc này</span>
									<button v-if="canLinkDeps" type="button" class="text-gray-400 hover:text-rose-600" :aria-label="`Gỡ nối với ${d.code}`" @click="removeDep(d, 'blocking')">
										<Icon name="heroicons:x-mark" class="h-4 w-4" />
									</button>
								</li>
							</ul>
						</section>

						<!-- Danh sách kiểm tra -->
						<section aria-label="Danh sách kiểm tra" data-testid="task-checklist">
							<h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
								Danh sách kiểm tra
								<span v-if="task.checklist.total" class="font-normal text-gray-500">{{ task.checklist.done }}/{{ task.checklist.total }}</span>
							</h3>
							<ul class="mt-2 space-y-1">
								<li v-for="item in task.checklistItems" :key="item.id" class="group flex items-center gap-2">
									<input
										:id="`chk-${item.id}`"
										type="checkbox"
										:checked="item.isDone"
										:disabled="!canChecklist"
										class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
										@change="e => toggleItem(item.id, (e.target as HTMLInputElement).checked)"
									/>
									<label :for="`chk-${item.id}`" class="flex-1 text-sm" :class="item.isDone ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-200'">
										{{ item.content }}
									</label>
									<button
										v-if="canChecklist"
										type="button"
										class="text-gray-300 hover:text-rose-600 focus:text-rose-600"
										:aria-label="`Xoá mục ${item.content}`"
										@click="removeItem(item.id)"
									>
										<Icon name="heroicons:x-mark" class="h-4 w-4" />
									</button>
								</li>
							</ul>
							<form v-if="canChecklist" class="mt-2 flex gap-2" @submit.prevent="addItem">
								<input
									v-model="newItem"
									type="text"
									:maxlength="CHECKLIST_ITEM_MAX"
									placeholder="Thêm mục kiểm tra"
									aria-label="Thêm mục kiểm tra"
									class="flex-1 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
								/>
								<CommonAppButton type="submit" size="sm" variant="secondary" :disabled="!newItem.trim()">Thêm</CommonAppButton>
							</form>
						</section>

						<!-- File -->
						<section aria-label="File đính kèm">
							<div class="flex items-center justify-between">
								<h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">File</h3>
								<button
									v-if="task.permissions.comment && !readOnly"
									type="button"
									class="text-xs text-brand-600 hover:underline dark:text-brand-400"
									data-testid="task-file-upload"
									@click="startUpload"
								>
									Tải file lên
								</button>
							</div>
							<div v-if="showUpload" class="mt-2">
								<UiFileDropzone ref="dropzone" v-model="fileModel" :accept="TASK_FILE_ACCEPT" :max-size-mb="TASK_FILE_MAX_MB" multiple :disabled="uploading" />
							</div>
							<ul v-if="taskFiles.length" class="mt-2 space-y-1">
								<li v-for="a in taskFiles" :key="a.id">
									<button
										type="button"
										class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:hover:bg-gray-800"
										:data-testid="`task-file-${a.id}`"
										@click="openFile(a)"
									>
										<Icon name="heroicons:paper-clip" class="h-4 w-4 text-gray-400" />
										<span class="min-w-0 flex-1 truncate text-gray-800 dark:text-gray-200">{{ a.fileName }}</span>
										<span class="text-xs text-gray-500">{{ taskFileSize(a.size) }}</span>
									</button>
								</li>
							</ul>
							<p v-else-if="!showUpload" class="mt-2 text-sm text-gray-400">Chưa có file.</p>
						</section>

						<TaskActivity
							ref="activityRef"
							:task="task"
							:disabled="readOnly"
							:composer-to="`#${composerId}`"
							@task-changed="setTask" @open-file="openFile" />
					</div>
				</div>
			</div>
			<footer
				v-if="task.permissions.comment && !readOnly"
				:id="composerId"
				class="max-h-[50vh] shrink-0 overflow-y-auto border-t border-gray-200 bg-white px-4 py-2 sm:px-5 dark:border-gray-700 dark:bg-gray-900"
			/>
		</template>
	</div>
</template>
