<script setup lang="ts">
	import RecruitConfirmModal from '~/components/modules/recruitment/RecruitConfirmModal.vue';
	import TaskActionDialogHost from '~/components/modules/tasks/TaskActionDialogHost.vue';
	import TaskCreateModal from '~/components/modules/tasks/TaskCreateModal.vue';
	import TaskEmptyState from '~/components/modules/tasks/TaskEmptyState.vue';
	import TaskProjectFormModal from '~/components/modules/tasks/TaskProjectFormModal.vue';
	import TaskProjectMembers from '~/components/modules/tasks/TaskProjectMembers.vue';
	import TaskProjectOverview from '~/components/modules/tasks/TaskProjectOverview.vue';
	import TaskProjectSettings from '~/components/modules/tasks/TaskProjectSettings.vue';
	import TaskSprintPlanner from '~/components/modules/tasks/TaskSprintPlanner.vue';
	import TaskWorkspace from '~/components/modules/tasks/TaskWorkspace.vue';
	import { useAuthStore } from '~/stores/auth';
	import { useTasksService } from '~/services/tasks.service';
	import { tasksBoardTour, tasksSprintTour, tasksTimelineTour } from '~/tours/tasks';
	import type { TaskDetail, TaskGroup, TaskProjectDetail, TaskSprint } from '~/types/tasks.types';
	import { taskErrorInfo } from '~/utils/tasks.utils';

	/**
	 * UI-04 Một dự án. Thẻ Việc có bốn chế độ xem Danh sách, Bảng việc, Tiến độ, Lịch dùng chung thanh
	 * lọc; thẻ Việc chờ xếp và Đợt khi dự án bật đợt; Tổng quan; Thành viên; Cài đặt cho quản lý dự án.
	 * Đường dẫn mang MÃ dự án (`/cong-viec/du-an/HQ`); `GET /task-projects/:id` nhận cả mã, còn route con
	 * của dự án chỉ nhận id số nên trang dùng `project.id` cho chúng.
	 *
	 * Dự án mẫu (D-Q4) có nhãn "Dự án mẫu" và nút Xoá cho người tạo; xoá bị chặn vì đã có dữ liệu người
	 * khác (409 `TASK_SAMPLE_HAS_OTHERS`) thì hộp hiện câu của máy chủ và gợi ý Đóng dự án.
	 */
	const route = useRoute();
	const router = useRouter();
	const authStore = useAuthStore();
	const service = useTasksService();
	const toast = useToast();
	const { canUse, canWrite } = useModuleAccess();
	const readOnly = computed(() => !canWrite('TASKS'));
	const codeParam = computed(() => String(route.params.code ?? ''));
	useHead({ title: () => `Dự án ${codeParam.value}` });

	const project = ref<TaskProjectDetail | null>(null);
	const loading = ref(true);
	const loadError = ref('');
	const notFound = ref(false);
	const groups = ref<TaskGroup[]>([]);
	const sprints = ref<TaskSprint[]>([]);

	async function loadExtras() {
		const p = project.value;
		if (!p) return;
		try {
			const [g, s] = await Promise.all([service.listGroups(p.id), p.useSprints ? service.listSprints(p.id) : Promise.resolve([] as TaskSprint[])]);
			groups.value = g;
			sprints.value = s;
		} catch {
			groups.value = [];
			sprints.value = [];
		}
	}

	async function load(silent = false) {
		if (!silent) loading.value = true;
		loadError.value = '';
		notFound.value = false;
		try {
			// Lần đầu mở theo mã trên đường dẫn (máy chủ nhận cả mã lẫn id); tải lại sau thao tác thì dùng id.
			project.value = await service.getProject(project.value?.id ?? codeParam.value);
			loadExtras();
		} catch (err) {
			const info = taskErrorInfo(err, 'Chưa tải được dự án.');
			if (info.code === 'TASK_PROJECT_NOT_FOUND' || info.status === 404) notFound.value = true;
			else loadError.value = info.message;
		} finally {
			loading.value = false;
		}
	}
	onMounted(() => {
		if (canUse('TASKS')) load();
		else loading.value = false;
	});

	/** Việc trong thẻ Việc vừa đổi trạng thái, người làm, hạn: chỉ cần số đếm mới, nhóm và đợt giữ nguyên. */
	async function refreshCounts() {
		const p = project.value;
		if (!p) return;
		try {
			project.value = await service.getProject(p.id);
		} catch {
			// Giữ số cũ; lần tải sau sẽ đúng.
		}
	}

	type Tab = 'tasks' | 'sprints' | 'overview' | 'members' | 'settings';
	const tab = computed<Tab>(() => {
		const t = String(route.query.tab ?? 'tasks');
		if (t === 'sprints' && !project.value?.useSprints) return 'tasks';
		if (t === 'settings' && !(project.value?.canManage && !readOnly.value)) return 'tasks';
		return (['tasks', 'sprints', 'overview', 'members', 'settings'] as Tab[]).includes(t as Tab) ? (t as Tab) : 'tasks';
	});
	function setTab(t: Tab) {
		// Đổi thẻ thì đóng khung việc đang mở (thẻ khác không có khung).
		router.replace({ query: { ...route.query, tab: t === 'tasks' ? undefined : t, task: undefined } });
	}
	const tabs = computed(() => {
		const p = project.value;
		const list: Array<{ key: Tab; label: string }> = [{ key: 'tasks', label: 'Việc' }];
		if (p?.useSprints) list.push({ key: 'sprints', label: 'Việc chờ xếp và Đợt' });
		list.push({ key: 'overview', label: 'Tổng quan' });
		list.push({ key: 'members', label: `Thành viên (${p?.members.length ?? 0})` });
		if (p?.canManage && !readOnly.value) list.push({ key: 'settings', label: 'Cài đặt' });
		return list;
	});

	/** Bấm một ô trên Tổng quan: sang thẻ Việc, Danh sách, đã lọc sẵn. */
	function applyFilter(patch: Record<string, string>) {
		router.replace({ query: { mode: undefined, q: undefined, status: undefined, due: undefined, assignee: undefined, taskGroup: undefined, sprint: undefined, ...patch, tab: undefined } });
	}

	const isAdmin = computed(() => authStore.user?.role === 'ADMIN');
	const isContributor = computed(() => project.value?.myRole === 'MANAGER' || project.value?.myRole === 'MEMBER' || isAdmin.value);
	const canCreateTask = computed(() => !readOnly.value && project.value?.status === 'ACTIVE' && isContributor.value);
	const canReorder = computed(() => isContributor.value);

	const workspaceRef = ref<InstanceType<typeof TaskWorkspace> | null>(null);
	const panel = useTaskPanel();
	const showCreate = ref(false);
	function onCreated(t: TaskDetail) {
		showCreate.value = false;
		workspaceRef.value?.reload();
		// Thẻ Tổng quan, Thành viên, Cài đặt không có khung việc: sang thẻ Việc rồi mở khung.
		if (tab.value === 'tasks' || tab.value === 'sprints') panel.open(t.code);
		else router.push({ query: { ...route.query, tab: undefined, task: t.code } });
		load(true);
	}

	const showEdit = ref(false);
	function onSaved(p: TaskProjectDetail) {
		showEdit.value = false;
		project.value = p;
		loadExtras();
	}

	const confirmClose = ref(false);
	const busy = ref(false);
	async function closeOrReopen() {
		const p = project.value;
		if (!p) return;
		busy.value = true;
		try {
			project.value = p.status === 'ACTIVE' ? await service.closeProject(p.id) : await service.reopenProject(p.id);
			toast.success(p.status === 'ACTIVE' ? 'Đã đóng dự án' : 'Đã mở lại dự án');
		} catch (err) {
			toast.error(taskErrorInfo(err).message);
		} finally {
			busy.value = false;
			confirmClose.value = false;
		}
	}

	// ─── Dự án mẫu ──────────────────────────────────────────────────────────
	const canDeleteSample = computed(
		() => !!project.value?.isSample && !readOnly.value && (project.value.createdBy.id === authStore.user?.id || isAdmin.value),
	);
	const confirmDelete = ref(false);
	const deleteBlocked = ref('');
	async function deleteSample() {
		const p = project.value;
		if (!p) return;
		busy.value = true;
		try {
			await service.deleteProject(p.id);
			toast.success(`Đã xoá dự án mẫu ${p.code}`);
			confirmDelete.value = false;
			router.push('/cong-viec/du-an');
		} catch (err) {
			const info = taskErrorInfo(err);
			if (info.code === 'TASK_SAMPLE_HAS_OTHERS') deleteBlocked.value = info.message;
			else toast.error(info.message);
		} finally {
			busy.value = false;
		}
	}
	function closeInstead() {
		confirmDelete.value = false;
		deleteBlocked.value = '';
		// Dự án đã đóng sẵn thì không mở hộp (bấm sẽ thành Mở lại).
		if (project.value?.status === 'ACTIVE') confirmClose.value = true;
	}

	const counts = computed(() => project.value?.taskCounts);

	// Hướng dẫn mở từ tab bên phải: bước đầu mỗi tour chuyển sang đúng thẻ và chế độ xem. Tiến độ và Đợt bắt
	// đầu ở danh sách Dự án (bấm mở một dự án) rồi chạy tiếp ở đây.
	const showTasksMode = (mode: 'board' | 'timeline') => router.replace({ query: { ...route.query, tab: undefined, task: undefined, mode } });
	usePageTour(
		'tasks-board',
		() => tasksBoardTour({ showBoard: () => showTasksMode('board') }),
		() => canUse('TASKS') && !!project.value && tab.value === 'tasks' && route.query.mode === 'board',
	);
	usePageTour(
		'tasks-timeline',
		() => tasksTimelineTour({ showTimeline: () => showTasksMode('timeline') }),
		() => canUse('TASKS') && !!project.value && tab.value === 'tasks' && route.query.mode === 'timeline',
	);
	usePageTour(
		'tasks-sprints',
		() => tasksSprintTour({ useSprints: () => project.value?.useSprints ?? true, showSprints: () => setTab('sprints') }),
		() => canUse('TASKS') && !!project.value && tab.value === 'sprints',
	);
</script>

<template>
	<div class="space-y-4 pb-24">
		<NuxtLink to="/cong-viec/du-an" class="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-brand-600 dark:text-gray-300">
			<Icon name="heroicons:arrow-left" class="h-4 w-4" />Dự án
		</NuxtLink>

		<div v-if="loading" class="space-y-3" aria-busy="true">
			<div class="h-8 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
			<div class="h-64 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>
		<TaskEmptyState
			v-else-if="notFound"
			kind="filtered"
			:title="`Không mở được dự án ${codeParam}`"
			description="Dự án không có, hoặc bạn không là thành viên. Bạn hỏi quản lý dự án để được thêm vào."
			action-label="Về danh sách dự án"
			@action="router.push('/cong-viec/du-an')"
		/>
		<TaskEmptyState v-else-if="loadError" kind="error" title="Chưa tải được dự án" :description="loadError" action-label="Thử lại" @action="load()" />

		<template v-else-if="project">
			<UiPageHeader
				:title="project.name"
				:description="project.description || `Dự án ${project.code}. Số hiệu mọi việc trong dự án bắt đầu bằng ${project.code}.`"
			>
				<CommonAppButton v-if="canCreateTask" data-testid="project-task-create" @click="showCreate = true">
					<Icon name="heroicons:plus" class="mr-1 h-4 w-4" />Tạo việc
				</CommonAppButton>
				<CommonAppButton v-if="project.canManage && !readOnly" variant="secondary" @click="showEdit = true">Sửa</CommonAppButton>
				<CommonAppButton
					v-if="canDeleteSample"
					variant="danger_outline"
					data-testid="project-delete-sample"
					@click="confirmDelete = true; deleteBlocked = ''"
				>
					Xoá dự án mẫu
				</CommonAppButton>
				<CommonAppButton
					v-if="project.canManage && !readOnly"
					:variant="project.status === 'ACTIVE' ? 'danger_outline' : 'outline'"
					:loading="busy && !confirmDelete"
					data-testid="project-close-toggle"
					@click="project.status === 'ACTIVE' ? (confirmClose = true) : closeOrReopen()"
				>
					{{ project.status === 'ACTIVE' ? 'Đóng dự án' : 'Mở lại dự án' }}
				</CommonAppButton>
			</UiPageHeader>
			<CommonAppModuleNotice module="TASKS" />

			<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
				<span class="rounded bg-brand-50 px-1.5 py-0.5 text-xs font-bold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{{ project.code }}</span>
				<span
					v-if="project.isSample"
					class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
					data-testid="project-sample-badge"
				>
					Dự án mẫu
				</span>
				<span
					class="rounded-full px-2 py-0.5 text-xs"
					:class="project.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'"
					data-testid="project-status"
				>
					{{ project.statusLabel }}
				</span>
				<span v-if="project.viaDepartment">Bạn xem với tư cách trưởng phòng</span>
				<span v-else-if="project.myRoleLabel">Bạn là {{ project.myRoleLabel.toLowerCase() }}</span>
				<span v-if="project.department">{{ project.department.name }}</span>
				<span v-if="counts">{{ counts.TODO }} chưa làm · {{ counts.IN_PROGRESS }} đang làm · {{ counts.IN_REVIEW }} chờ nghiệm thu · {{ counts.DONE }} hoàn thành</span>
			</div>
			<p v-if="project.isSample" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
				Đây là dự án để thử. Việc trong dự án đều giao cho chính bạn nên không ai nhận thông báo, và không tính vào báo cáo. Thử xong thì xoá đi.
			</p>
			<p v-if="project.status === 'CLOSED'" class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300">
				Dự án đã đóng nên không thêm việc mới được. Việc đang có vẫn làm tiếp bình thường.
			</p>
			<!-- Trưởng phòng của một thành viên, không là thành viên (bridge mục 24): chỉ đọc. -->
			<p v-else-if="project.viaDepartment" class="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-100" data-testid="project-via-department">
				Bạn xem với tư cách trưởng phòng vì có người trong phòng bạn tham gia dự án này. Bạn chỉ xem được, không sửa dự án, thành viên, nhóm hay đợt.
			</p>
			<p v-else-if="project.myRole === 'VIEWER'" class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300" data-testid="project-viewer-note">
				Bạn là người xem của dự án này nên chỉ xem được, không tạo việc, đổi nhóm hay bình luận.
			</p>

			<div class="flex gap-4 overflow-x-auto border-b border-gray-200 text-sm dark:border-gray-700" role="tablist">
				<button
					v-for="t in tabs"
					:key="t.key"
					type="button"
					role="tab"
					:aria-selected="tab === t.key"
					class="-mb-px shrink-0 border-b-2 px-1 pb-2 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
					:class="tab === t.key ? 'border-brand-600 text-brand-700 dark:text-brand-300' : 'border-transparent text-gray-600 dark:text-gray-400'"
					:data-testid="`project-tab-${t.key}`"
					@click="setTab(t.key)"
				>
					{{ t.label }}
				</button>
			</div>

			<TaskWorkspace
				v-if="tab === 'tasks'"
				ref="workspaceRef"
				:base="{ view: 'project', projectId: project.id }"
				:storage-key="`tasks-filters:project:${project.id}`"
				:reorder="canReorder"
				:quick-create="canCreateTask ? { projectId: project.id, defaultAssigneeId: authStore.user?.id ?? null } : null"
				:realtime-project-id="project.id"
				:read-only="readOnly"
				:task-groups="groups"
				:sprints="project.useSprints ? sprints : null"
				:can-contribute="isContributor && !readOnly"
				:wip-limits="project.wipLimits"
				empty-title="Dự án chưa có việc nào"
				empty-description="Tạo việc đầu tiên và giao cho thành viên, kèm hạn và điểm."
				:empty-action="canCreateTask ? 'Tạo việc đầu tiên' : undefined"
				@empty-action="showCreate = true"
				@changed="refreshCounts"
			/>
			<TaskSprintPlanner
				v-else-if="tab === 'sprints'"
				:project="project"
				:read-only="readOnly"
				:can-plan="isContributor"
				:can-manage="project.canManage"
				:default-assignee-id="authStore.user?.id ?? null"
				@changed="load(true)"
			/>
			<TaskProjectOverview v-else-if="tab === 'overview'" :project-id="project.id" @filter="applyFilter" />
			<TaskProjectSettings v-else-if="tab === 'settings'" :project="project" :read-only="readOnly" @saved="onSaved" @groups-changed="loadExtras" />
			<TaskProjectMembers v-else :project="project" :read-only="readOnly" @changed="load(true)" />

			<TaskCreateModal v-if="showCreate" :project-id="project.id" @close="showCreate = false" @created="onCreated" />
			<TaskProjectFormModal v-if="showEdit" :project="project" @close="showEdit = false" @saved="onSaved" />
			<RecruitConfirmModal
				v-if="confirmClose"
				title="Đóng dự án"
				description="Dự án đóng thì không thêm việc mới được, việc đang có vẫn làm tiếp. Bạn mở lại được bất cứ lúc nào."
				confirm-label="Đóng dự án"
				:loading="busy"
				@confirm="closeOrReopen"
				@close="confirmClose = false"
			/>
			<RecruitConfirmModal
				v-if="confirmDelete && !deleteBlocked"
				title="Xoá dự án mẫu"
				:description="`Xoá hẳn dự án ${project.code} cùng mọi việc, bình luận, file trong đó. Không lấy lại được.`"
				confirm-label="Xoá dự án mẫu"
				:loading="busy"
				@confirm="deleteSample"
				@close="confirmDelete = false"
			/>
			<RecruitConfirmModal
				v-if="confirmDelete && deleteBlocked"
				title="Không xoá được dự án mẫu"
				:description="deleteBlocked"
				:confirm-label="project.status === 'ACTIVE' ? 'Đóng dự án' : 'Đã hiểu'"
				@confirm="closeInstead"
				@close="confirmDelete = false; deleteBlocked = ''"
			/>
		</template>
		<TaskActionDialogHost />
	</div>
</template>
