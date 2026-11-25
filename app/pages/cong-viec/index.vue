<script setup lang="ts">
	import TaskActionDialogHost from '~/components/modules/tasks/TaskActionDialogHost.vue';
	import TaskBoard from '~/components/modules/tasks/TaskBoard.vue';
	import TaskCreateModal from '~/components/modules/tasks/TaskCreateModal.vue';
	import TaskDetailPanel from '~/components/modules/tasks/TaskDetailPanel.vue';
	import TaskEmptyState from '~/components/modules/tasks/TaskEmptyState.vue';
	import TaskMyRow from '~/components/modules/tasks/TaskMyRow.vue';
	import TaskQuickCreate from '~/components/modules/tasks/TaskQuickCreate.vue';
	import { useAuthStore } from '~/stores/auth';
	import { useApprovalStore } from '~/stores/approval';
	import { useTasksService } from '~/services/tasks.service';
	import { tasksBoardTour, tasksMyTour } from '~/tours/tasks';
	import type { TaskActionResult } from '~/composables/useTaskActions';
	import type { TaskAction, TaskBoard as TaskBoardData, TaskDetail, TaskListItem, TaskStatus, TaskView } from '~/types/tasks.types';
	import { MY_GROUP_LABELS, groupMyTasks, taskErrorInfo, vnToday, type MyGroupKey } from '~/utils/tasks.utils';

	/**
	 * UI-01 Việc của tôi. Nhóm Quá hạn, Hôm nay, Sắp tới 7 ngày, Sau đó; khối Chờ tôi nghiệm thu nổi
	 * trên cùng; thẻ Tôi giao, Tôi theo dõi; nút thao tác chính ngay trên dòng; bảng việc riêng (thứ
	 * tự kéo thả chỉ của mình, `board=my`).
	 *
	 * Lô 2: đường dẫn có `assigneeIds=<id>` (thông báo `TASK_OFFBOARDING_OPEN` khi một người nghỉ việc còn
	 * việc đang mở) thì trang hiện việc đang mở của người đó trong phạm vi người xem, để giao lại bằng
	 * nút Đổi người thực hiện. Hệ thống không tự chuyển việc.
	 */
	useHead({ title: 'Việc của tôi' });

	const route = useRoute();
	const router = useRouter();
	const authStore = useAuthStore();
	const approvalStore = useApprovalStore();
	const service = useTasksService();
	const actions = useTaskActions();
	const panel = useTaskPanel();
	panel.bindPage();
	const { canUse, canWrite } = useModuleAccess();
	const readOnly = computed(() => !canWrite('TASKS'));
	const today = vnToday();

	type Tab = 'my' | 'assigned' | 'watching';
	const TABS: Array<{ key: Tab; label: string }> = [
		{ key: 'my', label: 'Tôi làm' },
		{ key: 'assigned', label: 'Tôi giao' },
		{ key: 'watching', label: 'Tôi theo dõi' },
	];
	const tab = computed<Tab>(() => {
		const t = String(route.query.tab ?? 'my');
		return t === 'assigned' || t === 'watching' ? t : 'my';
	});
	/** Id người nghỉ việc từ thông báo cảnh báo nghỉ việc (một id). */
	const offboardId = computed<number | null>(() => {
		const n = Number(String(route.query.assigneeIds ?? '').split(',')[0]);
		return Number.isInteger(n) && n > 0 ? n : null;
	});
	const offboardName = ref('');
	const mode = computed<'list' | 'board'>(() => (route.query.mode === 'board' && !offboardId.value ? 'board' : 'list'));
	function setQuery(patch: Record<string, string | undefined>) {
		const query = { ...route.query, ...patch };
		for (const [k, v] of Object.entries(query)) if (v === undefined) delete query[k];
		router.replace({ query });
	}

	const q = ref(String(route.query.q ?? ''));
	let qTimer: ReturnType<typeof setTimeout> | null = null;
	watch(q, v => {
		if (qTimer) clearTimeout(qTimer);
		qTimer = setTimeout(() => setQuery({ q: v.trim() || undefined }), 350);
	});

	// ─── Dữ liệu ─────────────────────────────────────────────────────────────
	const tasks = ref<TaskListItem[]>([]);
	const total = ref(0);
	const page = ref(1);
	const loading = ref(true);
	const loadingMore = ref(false);
	const loadError = ref('');
	const doneCount = ref<number | null>(null);
	const review = ref<TaskListItem[]>([]);
	const reviewTotal = ref(0);
	const board = ref<TaskBoardData | null>(null);
	const LIMIT = 50;

	const openStatuses = 'TODO,IN_PROGRESS,IN_REVIEW';

	async function loadReview() {
		try {
			const res = await service.list({ view: 'review', sort: 'dueDate', limit: 20 });
			review.value = res.data;
			reviewTotal.value = res.meta.total;
		} catch {
			review.value = [];
		}
	}

	/** `silent`: tải lại do kênh thời gian thực hay sau thao tác, không hiện khung xám. */
	async function loadList(more = false, silent = false) {
		if (more) loadingMore.value = true;
		else if (!silent) loading.value = true;
		loadError.value = '';
		try {
			const next = more ? page.value + 1 : 1;
			const res = await service.list({
				view: offboardId.value ? undefined : (tab.value as TaskView),
				assigneeIds: offboardId.value ? String(offboardId.value) : undefined,
				status: openStatuses,
				sort: 'dueDate',
				q: String(route.query.q ?? '') || undefined,
				page: next,
				limit: LIMIT,
			});
			tasks.value = more ? [...tasks.value, ...res.data] : res.data;
			total.value = res.meta.total;
			page.value = next;
			if (offboardId.value) {
				const name = res.data.find(t => t.assignee.id === offboardId.value)?.assignee.fullName;
				if (name) offboardName.value = name;
				doneCount.value = 1;
			} else if (!more && !res.data.length && !route.query.q) {
				// Phân biệt "chưa có việc" với "đã xong hết": hỏi xem đã từng có việc hoàn thành chưa.
				const done = await service.list({ view: tab.value as TaskView, status: 'DONE', limit: 1 });
				doneCount.value = done.meta.total;
			}
		} catch (err) {
			if (!silent) loadError.value = taskErrorInfo(err, 'Chưa tải được danh sách việc.').message;
		} finally {
			loading.value = false;
			loadingMore.value = false;
		}
	}

	async function loadBoard(silent = false) {
		if (!silent) loading.value = true;
		loadError.value = '';
		try {
			board.value = await service.board({
				view: tab.value as TaskView,
				q: String(route.query.q ?? '') || undefined,
				includeCancelled: route.query.cancelled === '1' || undefined,
			});
		} catch (err) {
			if (!silent) loadError.value = taskErrorInfo(err, 'Chưa tải được bảng việc.').message;
		} finally {
			loading.value = false;
		}
	}

	function reload(silent = false) {
		if (tab.value === 'my' && !offboardId.value) loadReview();
		if (mode.value === 'board') loadBoard(silent);
		else loadList(false, silent);
		approvalStore.fetchCounts();
	}

	watch(() => [tab.value, mode.value, route.query.q, route.query.cancelled, offboardId.value], () => reload());
	onMounted(() => {
		if (canUse('TASKS')) reload();
		else loading.value = false;
		if (route.query.create === '1') showCreate.value = true;
	});

	// ─── Realtime: việc mình làm, giao, nghiệm thu, theo dõi đổi thì tải lại ─────
	const { subscribe } = useTaskRealtime();
	let unsubscribe: (() => void) | null = null;
	let rtTimer: ReturnType<typeof setTimeout> | null = null;
	onMounted(() => {
		unsubscribe = subscribe({
			onTaskChanged: () => {
				if (rtTimer) clearTimeout(rtTimer);
				rtTimer = setTimeout(() => reload(true), 600);
			},
		});
	});
	onBeforeUnmount(() => {
		unsubscribe?.();
		if (rtTimer) clearTimeout(rtTimer);
	});

	// ─── Nhóm theo hạn ──────────────────────────────────────────────────────
	const groups = computed(() => groupMyTasks(tasks.value, today));
	const GROUP_ORDER: MyGroupKey[] = ['overdue', 'today', 'upcoming', 'later'];
	const collapsed = ref<Record<string, boolean>>({});
	const COLLAPSE_KEY = 'tasks-my-collapsed';
	onMounted(() => {
		try {
			collapsed.value = JSON.parse(localStorage.getItem(COLLAPSE_KEY) ?? '{}') as Record<string, boolean>;
		} catch {
			collapsed.value = {};
		}
	});
	function toggleGroup(key: string) {
		collapsed.value = { ...collapsed.value, [key]: !collapsed.value[key] };
		try {
			localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed.value));
		} catch {
			// bỏ qua
		}
	}
	const GROUP_TONE: Record<MyGroupKey, string> = {
		overdue: 'text-rose-700 dark:text-rose-400',
		today: 'text-orange-700 dark:text-orange-400',
		upcoming: 'text-gray-800 dark:text-gray-100',
		later: 'text-gray-800 dark:text-gray-100',
	};

	// ─── Thao tác ───────────────────────────────────────────────────────────
	function patch(updated: TaskListItem) {
		const replace = (list: TaskListItem[]) => {
			const i = list.findIndex(t => t.id === updated.id);
			if (i >= 0) list.splice(i, 1, updated);
		};
		replace(tasks.value);
		replace(review.value);
		// Việc đã xong hay huỷ (hoặc đã giao lại cho người khác, ở danh sách việc của người nghỉ) rời
		// khỏi danh sách việc đang mở.
		const leftOffboard = !!offboardId.value && updated.assignee.id !== offboardId.value;
		if (updated.status === 'DONE' || updated.status === 'CANCELLED' || leftOffboard) {
			const before = tasks.value.length;
			tasks.value = tasks.value.filter(t => t.id !== updated.id);
			if (tasks.value.length < before) total.value = Math.max(0, total.value - 1);
			// Vừa làm xong việc cuối cùng thì trạng thái rỗng phải là "đã xong hết", không phải "chưa có việc".
			if (updated.status === 'DONE') doneCount.value = (doneCount.value ?? 0) + 1;
		}
		if (updated.status !== 'IN_REVIEW') review.value = review.value.filter(t => t.id !== updated.id);
	}

	function after(result: TaskActionResult) {
		if (result.ok) {
			patch(result.task);
			approvalStore.fetchCounts();
		} else if (result.conflict) {
			reload(true);
		}
	}

	async function onAction(task: TaskListItem, action: TaskAction) {
		after(await actions.runAction(task, action));
		if (action === 'accept' || action === 'return') loadReview();
	}
	async function onStatus(task: TaskListItem, status: TaskStatus) {
		const action = task.columnRules[status]?.action;
		if (action) await onAction(task, action);
	}

	async function changeDue(task: TaskListItem) {
		after(await actions.changeDue(task));
	}
	async function reassign(task: TaskListItem) {
		after(await actions.reassign(task));
	}

	function onPanelChanged(t: TaskDetail) {
		patch(t);
		if (mode.value === 'board') loadBoard(true);
		loadReview();
		approvalStore.fetchCounts();
	}

	const showCreate = ref(false);
	function onCreated(t: TaskDetail) {
		showCreate.value = false;
		if (t.assignee.id === authStore.user?.id || tab.value === 'assigned') reload();
		panel.open(t.code);
	}
	function onQuickCreated(t: TaskDetail) {
		if (tab.value === 'my' && t.assignee.id === authStore.user?.id) tasks.value = [...tasks.value, t];
		else if (tab.value === 'assigned' && t.assignee.id !== authStore.user?.id) tasks.value = [...tasks.value, t];
		total.value += 1;
	}

	// ─── Rỗng ───────────────────────────────────────────────────────────────
	const emptyKind = computed<'none' | 'done' | 'filtered'>(() => {
		if (route.query.q) return 'filtered';
		return doneCount.value ? 'done' : 'none';
	});
	const emptyText = computed(() => {
		if (offboardId.value) return { title: 'Không còn việc đang mở nào', desc: 'Mọi việc của người này đã được giao lại hoặc đã xong.', action: '' };
		if (emptyKind.value === 'filtered') return { title: 'Không có việc khớp bộ lọc', desc: 'Bạn thử từ khoá khác.', action: 'Xoá bộ lọc' };
		if (emptyKind.value === 'done') {
			if (tab.value === 'my') return { title: 'Bạn đã xong hết việc', desc: 'Không còn việc nào đang mở. Nghỉ tay một chút nhé.', action: '' };
			return { title: 'Không còn việc nào đang mở', desc: 'Mọi việc ở đây đã hoàn thành.', action: '' };
		}
		if (tab.value === 'my') return { title: 'Chưa có việc nào được giao cho bạn', desc: 'Khi có người giao việc, việc sẽ hiện ở đây. Bạn cũng tự tạo việc cho mình được.', action: readOnly.value ? '' : 'Tạo việc' };
		if (tab.value === 'assigned') return { title: 'Bạn chưa giao việc cho ai', desc: 'Giao việc kèm hạn và điểm để theo dõi tiến độ ở đây.', action: readOnly.value ? '' : 'Giao việc đầu tiên' };
		return { title: 'Bạn chưa theo dõi việc nào', desc: 'Mở một việc rồi bấm Theo dõi việc này để thấy nó ở đây.', action: '' };
	});
	function onEmptyAction() {
		if (emptyKind.value === 'filtered') q.value = '';
		else showCreate.value = true;
	}

	// ─── Hướng dẫn ──────────────────────────────────────────────────────────
	usePageTour(
		'tasks-my',
		() => tasksMyTour({ hasRows: () => tasks.value.length > 0, hasReview: () => review.value.length > 0, canCreate: () => !readOnly.value }),
		() => canUse('TASKS') && mode.value === 'list' && !loading.value && !loadError.value,
	);
	usePageTour('tasks-board', tasksBoardTour, () => canUse('TASKS') && mode.value === 'board' && !loading.value && !loadError.value && !!board.value);
</script>

<template>
	<div class="space-y-4 pb-24">
		<UiPageHeader
			title="Việc của tôi"
			description="Việc bạn làm, việc bạn giao và việc bạn theo dõi, xếp theo hạn. Việc người khác báo xong cho bạn nghiệm thu nằm trên cùng."
			:tour="mode === 'board' ? 'tasks-board' : 'tasks-my'"
		>
			<CommonAppButton v-if="!readOnly" data-tour="task-create" data-testid="task-create-open" @click="showCreate = true">
				<Icon name="heroicons:plus" class="mr-1 h-4 w-4" />Tạo việc
			</CommonAppButton>
		</UiPageHeader>

		<CommonAppModuleNotice module="TASKS" />

		<!-- Việc đang mở của người nghỉ việc (thông báo TASK_OFFBOARDING_OPEN) -->
		<section
			v-if="offboardId"
			class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
			data-testid="task-offboard-banner"
		>
			<p class="font-semibold">Việc đang mở của {{ offboardName || 'người nghỉ việc' }}</p>
			<p class="mt-0.5">
				Người này đã nghỉ việc. Bạn giao lại từng việc cho người khác bằng nút Đổi người thực hiện trong menu ba chấm hoặc khung chi tiết.
				Hệ thống không tự chuyển việc.
			</p>
			<NuxtLink to="/cong-viec" class="mt-1 inline-block font-medium text-brand-700 hover:underline dark:text-brand-300">Về Việc của tôi</NuxtLink>
		</section>

		<!-- Chờ tôi nghiệm thu -->
		<section
			v-if="tab === 'my' && review.length && !offboardId"
			class="rounded-xl border border-violet-200 bg-violet-50/60 dark:border-violet-800 dark:bg-violet-900/10"
			data-tour="task-review"
			data-testid="task-review-block"
			aria-label="Chờ tôi nghiệm thu"
		>
			<h2 class="flex items-center gap-2 px-4 pt-3 text-sm font-semibold text-violet-900 dark:text-violet-200">
				Chờ tôi nghiệm thu
				<span class="rounded-full bg-violet-600 px-2 py-0.5 text-xs text-white">{{ reviewTotal }}</span>
			</h2>
			<ul class="mt-2">
				<TaskMyRow
					v-for="t in review"
					:key="t.id"
					:task="t"
					:today="today"
					:active="panel.code.value === t.code"
					show-assignee
					:read-only="readOnly"
					@open="panel.open(t.code)"
					@action="a => onAction(t, a)"
					@status="s => onStatus(t, s)"
					@change-due="changeDue(t)"
					@reassign="reassign(t)"
				/>
			</ul>
		</section>

		<!-- Thẻ và chế độ xem -->
		<div class="flex flex-wrap items-center gap-2">
			<div v-if="!offboardId" class="flex rounded-lg bg-gray-100 p-0.5 text-sm dark:bg-gray-800" role="tablist" aria-label="Nhóm việc">
				<button
					v-for="t in TABS"
					:key="t.key"
					type="button"
					role="tab"
					:aria-selected="tab === t.key"
					class="rounded-md px-3 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
					:class="tab === t.key ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'"
					@click="setQuery({ tab: t.key === 'my' ? undefined : t.key })"
				>
					{{ t.label }}
				</button>
			</div>
			<div v-if="!offboardId" class="flex rounded-lg bg-gray-100 p-0.5 text-sm dark:bg-gray-800" role="tablist" aria-label="Chế độ xem">
				<button
					type="button"
					role="tab"
					:aria-selected="mode === 'list'"
					class="flex items-center gap-1 rounded-md px-3 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
					:class="mode === 'list' ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'"
					@click="setQuery({ mode: undefined })"
				>
					<Icon name="heroicons:list-bullet" class="h-4 w-4" aria-hidden="true" />Danh sách
				</button>
				<button
					type="button"
					role="tab"
					:aria-selected="mode === 'board'"
					data-tour="task-board-tab"
					class="flex items-center gap-1 rounded-md px-3 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
					:class="mode === 'board' ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'"
					@click="setQuery({ mode: 'board' })"
				>
					<Icon name="heroicons:view-columns" class="h-4 w-4" aria-hidden="true" />Bảng việc
				</button>
			</div>
			<div class="relative min-w-[12rem] flex-1">
				<Icon name="heroicons:magnifying-glass" class="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" aria-hidden="true" />
				<input
					v-model="q"
					type="search"
					placeholder="Tìm theo tiêu đề hoặc số hiệu"
					aria-label="Tìm việc"
					class="w-full rounded-lg border border-gray-200 bg-white py-2 pl-8 pr-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
				/>
			</div>
			<label v-if="mode === 'board'" class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
				<input
					type="checkbox"
					:checked="route.query.cancelled === '1'"
					class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
					@change="e => setQuery({ cancelled: (e.target as HTMLInputElement).checked ? '1' : undefined })"
				/>
				Hiện cột Đã huỷ
			</label>
		</div>

		<!-- Đang tải: khung xám đúng hình dòng hoặc cột -->
		<div v-if="loading" aria-busy="true" data-testid="task-skeleton">
			<div v-if="mode === 'board'" class="flex gap-3 overflow-hidden">
				<div v-for="i in 4" :key="i" class="h-72 w-72 shrink-0 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
			</div>
			<div v-else class="space-y-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
				<div v-for="i in 6" :key="i" class="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
			</div>
		</div>

		<TaskEmptyState v-else-if="loadError" kind="error" title="Chưa tải được việc" :description="loadError" action-label="Thử lại" @action="reload()" />

		<!-- Bảng việc riêng -->
		<TaskBoard
			v-else-if="mode === 'board'"
			:board="board"
			board-kind="my"
			:reorder="tab === 'my'"
			:show-cancelled="route.query.cancelled === '1'"
			:quick-create="tab === 'my' && !readOnly ? { defaultAssigneeId: authStore.user?.id ?? null } : null"
			:active-code="panel.code.value"
			:disabled="readOnly"
			@open="t => panel.open(t.code)"
			@changed="() => { loadReview(); approvalStore.fetchCounts(); }"
			@reload="loadBoard(true)"
		/>

		<!-- Danh sách nhóm theo hạn -->
		<template v-else>
			<TaskEmptyState
				v-if="!tasks.length"
				:kind="emptyKind"
				:title="emptyText.title"
				:description="emptyText.desc"
				:action-label="emptyText.action || undefined"
				@action="onEmptyAction"
			/>
			<div v-else class="space-y-3" data-tour="task-groups" data-testid="task-my-groups">
				<section
					v-for="key in GROUP_ORDER.filter(k => groups[k].length)"
					:key="key"
					class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
					:aria-label="MY_GROUP_LABELS[key]"
				>
					<button
						type="button"
						class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500"
						:class="GROUP_TONE[key]"
						:aria-expanded="!collapsed[key]"
						@click="toggleGroup(key)"
					>
						<Icon name="heroicons:chevron-down" class="h-4 w-4 transition-transform" :class="collapsed[key] ? '-rotate-90' : ''" aria-hidden="true" />
						{{ MY_GROUP_LABELS[key] }}
						<span class="font-normal text-gray-500 dark:text-gray-400">
							{{ groups[key].length }} việc · {{ groups[key].reduce((s, t) => s + t.points, 0) }} điểm
						</span>
					</button>
					<ul v-if="!collapsed[key]" class="border-t border-gray-100 dark:border-gray-800">
						<TaskMyRow
							v-for="t in groups[key]"
							:key="t.id"
							:task="t"
							:today="today"
							:active="panel.code.value === t.code"
							:show-assignee="tab !== 'my' || !!offboardId"
							:read-only="readOnly"
							:busy="false"
							@open="panel.open(t.code)"
							@action="a => onAction(t, a)"
							@status="s => onStatus(t, s)"
							@change-due="changeDue(t)"
							@reassign="reassign(t)"
						/>
					</ul>
				</section>
				<div v-if="tasks.length < total" class="text-center">
					<CommonAppButton variant="secondary" size="sm" :loading="loadingMore" @click="loadList(true)">
						Tải thêm ({{ total - tasks.length }} việc nữa)
					</CommonAppButton>
				</div>
			</div>
			<TaskQuickCreate
				v-if="!readOnly && tab !== 'watching' && !offboardId"
				:default-assignee-id="tab === 'my' ? (authStore.user?.id ?? null) : null"
				@created="onQuickCreated"
			/>
		</template>

		<TaskCreateModal v-if="showCreate" @close="showCreate = false" @created="onCreated" />
		<TaskDetailPanel @changed="onPanelChanged" />
		<TaskActionDialogHost />
	</div>
</template>
