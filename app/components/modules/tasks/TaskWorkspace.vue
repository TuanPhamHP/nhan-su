<script setup lang="ts">
	import TaskBoard from '~/components/modules/tasks/TaskBoard.vue';
	import TaskCalendar from '~/components/modules/tasks/TaskCalendar.vue';
	import TaskTimeline from '~/components/modules/tasks/TaskTimeline.vue';
	import TaskDetailPanel from '~/components/modules/tasks/TaskDetailPanel.vue';
	import TaskEmptyState from '~/components/modules/tasks/TaskEmptyState.vue';
	import TaskFilterBar from '~/components/modules/tasks/TaskFilterBar.vue';
	import TaskList from '~/components/modules/tasks/TaskList.vue';
	import { useTasksService } from '~/services/tasks.service';
	import type {
		TaskBoard as TaskBoardData,
		TaskDetail,
		TaskGroup,
		TaskListItem,
		TaskListQuery,
		TaskSprint,
		TaskWipLimits,
	} from '~/types/tasks.types';
	import { taskErrorInfo } from '~/utils/tasks.utils';

	/**
	 * Bốn chế độ xem Danh sách, Bảng việc, Tiến độ, Lịch trên cùng một tập việc, dùng chung một thanh
	 * lọc (UI-04 dự án, UI-05 việc của phòng). Đổi chế độ xem giữ nguyên bộ lọc; bộ lọc nằm trên đường
	 * dẫn và được nhớ theo `storageKey` (mỗi dự án một khoá).
	 */
	const props = withDefaults(
		defineProps<{
			/** Phần cố định của truy vấn: `view` và `projectId`/`departmentId`. */
			base: TaskListQuery;
			storageKey: string;
			reorder: boolean;
			quickCreate?: { projectId?: number | null; defaultAssigneeId?: number | null } | null;
			showProject?: boolean;
			/** Phòng dự án cho kênh thời gian thực. */
			realtimeProjectId?: number | null;
			readOnly?: boolean;
			emptyTitle: string;
			emptyDescription: string;
			emptyAction?: string;
			/** Lô 2, chỉ có trong dự án: nhóm việc (lọc, nhóm, đổi nhóm trên dòng), đợt (lọc). */
			taskGroups?: TaskGroup[];
			sprints?: TaskSprint[] | null;
			/** Được đổi nhóm việc trên dòng, nối phụ thuộc trên biểu đồ (thành viên Quản lý, Thành viên; ADMIN). */
			canContribute?: boolean;
			wipLimits?: TaskWipLimits | null;
		}>(),
		{
			quickCreate: null,
			showProject: false,
			realtimeProjectId: null,
			readOnly: false,
			emptyAction: undefined,
			taskGroups: () => [],
			sprints: null,
			canContribute: false,
			wipLimits: null,
		},
	);
	const emit = defineEmits<{ emptyAction: []; changed: [] }>();

	const service = useTasksService();
	const panel = useTaskPanel();
	const filters = useTaskFilters(() => props.storageKey);
	const { state } = filters;

	const tasks = ref<TaskListItem[]>([]);
	const total = ref(0);
	const page = ref(1);
	const board = ref<TaskBoardData | null>(null);
	const loading = ref(true);
	const loadingMore = ref(false);
	const loadError = ref('');
	const people = ref<Array<{ id: number; fullName: string }>>([]);

	async function loadPeople() {
		// Ô lọc người thực hiện chỉ liệt kê người có việc trong phạm vi này.
		try {
			const res = await service.list({ ...props.base, limit: 100 });
			const map = new Map<number, string>();
			for (const t of res.data) map.set(t.assignee.id, t.assignee.fullName);
			people.value = [...map].map(([id, fullName]) => ({ id, fullName })).sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
		} catch {
			people.value = [];
		}
	}

	/** `silent`: tải lại do kênh thời gian thực, giữ nguyên màn đang xem thay vì hiện khung xám. */
	const timelineRef = ref<InstanceType<typeof TaskTimeline> | null>(null);
	const calendarRef = ref<InstanceType<typeof TaskCalendar> | null>(null);
	/** Truy vấn đầy đủ cho Tiến độ và Lịch: hai màn tự tải theo khoảng ngày của mình. */
	const viewQuery = computed<TaskListQuery>(() => ({ ...props.base, ...filters.apiQuery.value }));

	async function load(more = false, silent = false) {
		if (state.mode === 'timeline' || state.mode === 'calendar') {
			// Hai màn này tự tải khi truy vấn đổi; ở đây chỉ nhắc tải lại khi có thay đổi từ ngoài.
			loading.value = false;
			if (silent) (state.mode === 'timeline' ? timelineRef.value : calendarRef.value)?.reload();
			return;
		}
		if (more) loadingMore.value = true;
		else if (!silent) loading.value = true;
		loadError.value = '';
		try {
			if (state.mode === 'board') {
				const { status: _s, ...rest } = filters.apiQuery.value;
				board.value = await service.board({ ...props.base, ...rest, includeCancelled: state.cancelled || undefined });
			} else {
				const next = more ? page.value + 1 : 1;
				const res = await service.list({ ...props.base, ...filters.apiQuery.value, sort: 'dueDate', page: next, limit: 50 });
				tasks.value = more ? [...tasks.value, ...res.data] : res.data;
				total.value = res.meta.total;
				page.value = next;
			}
		} catch (err) {
			if (!silent) loadError.value = taskErrorInfo(err, 'Chưa tải được việc.').message;
		} finally {
			loading.value = false;
			loadingMore.value = false;
		}
	}

	let ready = false;
	onMounted(() => {
		filters.init();
		nextTick(() => {
			ready = true;
			load();
			loadPeople();
		});
	});
	watch(
		() => [
			state.mode,
			state.q,
			state.status,
			state.due,
			state.priority,
			state.assignee,
			state.cancelled,
			state.taskGroup,
			state.sprint,
			state.points,
			JSON.stringify(props.base),
		],
		() => {
			if (ready) load();
		},
	);

	// ─── Thời gian thực ─────────────────────────────────────────────────────
	const { subscribe } = useTaskRealtime();
	let unsubscribe: (() => void) | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;
	onMounted(() => {
		unsubscribe = subscribe(
			{
				onTaskChanged: () => {
					if (timer) clearTimeout(timer);
					timer = setTimeout(() => load(false, true), 600);
				},
			},
			props.realtimeProjectId,
		);
	});
	onBeforeUnmount(() => {
		unsubscribe?.();
		if (timer) clearTimeout(timer);
	});

	function onChanged(t: TaskDetail) {
		const i = tasks.value.findIndex(x => x.id === t.id);
		if (i >= 0) tasks.value.splice(i, 1, t);
		emit('changed');
	}
	function onPanelChanged(t: TaskDetail) {
		onChanged(t);
		if (state.mode !== 'list') load(false, true);
	}
	function onCreated() {
		total.value += 1;
		emit('changed');
	}

	function showMoreDone() {
		state.mode = 'list';
		state.status = 'DONE';
	}

	defineExpose({ reload: () => load() });
</script>

<template>
	<div class="space-y-3">
		<TaskFilterBar
			:state="state"
			:people="people"
			:is-default="filters.isDefault.value"
			:task-groups="taskGroups"
			:sprints="sprints"
			@reset="filters.reset()"
		/>

		<div v-if="loading" aria-busy="true" data-testid="task-skeleton">
			<div v-if="state.mode === 'board'" class="flex gap-3 overflow-hidden">
				<div v-for="i in 4" :key="i" class="h-72 w-72 shrink-0 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
			</div>
			<div v-else class="space-y-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
				<div v-for="i in 6" :key="i" class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
			</div>
		</div>
		<TaskEmptyState v-else-if="loadError" kind="error" title="Chưa tải được việc" :description="loadError" action-label="Thử lại" @action="load()" />

		<TaskTimeline
			v-else-if="state.mode === 'timeline'"
			ref="timelineRef"
			:query="viewQuery"
			:task-groups="taskGroups"
			:read-only="readOnly"
			:can-link="canContribute"
			:active-code="panel.code.value"
			@open="t => panel.open(t.code)"
			@changed="emit('changed')"
		/>
		<TaskCalendar
			v-else-if="state.mode === 'calendar'"
			ref="calendarRef"
			:query="viewQuery"
			:active-code="panel.code.value"
			@open="t => panel.open(t.code)"
		/>

		<TaskBoard
			v-else-if="state.mode === 'board'"
			:board="board"
			board-kind="shared"
			:reorder="reorder"
			:show-cancelled="state.cancelled"
			:quick-create="readOnly ? null : quickCreate"
			:active-code="panel.code.value"
			:disabled="readOnly"
			:wip-limits="wipLimits"
			@open="t => panel.open(t.code)"
			@changed="onChanged"
			@created="onCreated"
			@reload="load(false, true)"
			@more-done="showMoreDone"
		/>

		<template v-else>
			<TaskEmptyState
				v-if="!tasks.length && filters.isFiltered.value"
				kind="filtered"
				title="Không có việc khớp bộ lọc"
				description="Bạn bớt điều kiện lọc hoặc thử từ khoá khác."
				action-label="Xoá bộ lọc"
				@action="filters.reset()"
			/>
			<template v-else>
				<TaskEmptyState
					v-if="!tasks.length"
					kind="none"
					:title="emptyTitle"
					:description="emptyDescription"
					:action-label="readOnly ? undefined : emptyAction"
					@action="emit('emptyAction')"
				/>
				<TaskList
					v-if="tasks.length || (quickCreate && !readOnly)"
					:tasks="tasks"
					:group-by="state.group"
					:show-project="showProject"
					:active-code="panel.code.value"
					:quick-create="readOnly ? null : quickCreate"
					:storage-key="`${storageKey}:collapsed`"
					:disabled="readOnly"
					:task-groups="taskGroups"
					:can-edit-group="canContribute"
					@open="t => panel.open(t.code)"
					@changed="onChanged"
					@created="onCreated"
					@reload="load()"
				/>
				<div v-if="tasks.length < total" class="text-center">
					<CommonAppButton variant="secondary" size="sm" :loading="loadingMore" @click="load(true)">
						Tải thêm ({{ total - tasks.length }} việc nữa)
					</CommonAppButton>
				</div>
			</template>
		</template>

		<TaskDetailPanel @changed="onPanelChanged" />
	</div>
</template>
