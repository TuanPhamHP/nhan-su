<script setup lang="ts">
	import TaskDetailPanel from '~/components/modules/tasks/TaskDetailPanel.vue';
	import TaskEmptyState from '~/components/modules/tasks/TaskEmptyState.vue';
	import TaskQuickCreate from '~/components/modules/tasks/TaskQuickCreate.vue';
	import TaskSprintCloseModal from '~/components/modules/tasks/TaskSprintCloseModal.vue';
	import TaskSprintFormModal from '~/components/modules/tasks/TaskSprintFormModal.vue';
	import TaskSprintZone from '~/components/modules/tasks/TaskSprintZone.vue';
	import type { SortableDropEvent } from '~/composables/useSortableList';
	import { useTasksService } from '~/services/tasks.service';
	import type { TaskDetail, TaskListItem, TaskProjectDetail, TaskSprint, TaskSprintCloseResult } from '~/types/tasks.types';
	import { timelineAddDays } from '~/utils/task-timeline';
	import { STATUS_LABELS, TASK_HINTS, shortDate, taskErrorInfo, vnToday } from '~/utils/tasks.utils';

	/**
	 * Việc chờ xếp và Đợt (mục 9.2, S-08): trên là các đợt (đang chạy, chưa bắt đầu), dưới là việc chờ
	 * xếp. Kéo việc giữa các khối (hoặc menu Đưa vào đợt) là `PATCH /tasks/:id { sprintId }` có
	 * `version`, hiện ngay rồi trả về chỗ cũ nếu máy chủ từ chối. Đầu mỗi đợt có tổng điểm và điểm theo
	 * trạng thái; quản lý dự án tạo, bắt đầu, đóng đợt.
	 */
	const props = withDefaults(
		defineProps<{
			project: TaskProjectDetail;
			readOnly?: boolean;
			/** Kéo việc vào đợt: thành viên dự án vai Quản lý, Thành viên; ADMIN. */
			canPlan?: boolean;
			/** Tạo, sửa, bắt đầu, đóng đợt: quản lý dự án, ADMIN. */
			canManage?: boolean;
			defaultAssigneeId?: number | null;
		}>(),
		{ readOnly: false, canPlan: false, canManage: false, defaultAssigneeId: null },
	);
	const emit = defineEmits<{ changed: [] }>();

	const service = useTasksService();
	const actions = useTaskActions();
	const toast = useToast();
	const panel = useTaskPanel();
	const route = useRoute();
	const router = useRouter();
	const today = vnToday();
	const dnd = `sprint-plan-${Math.random().toString(36).slice(2)}`;

	const sprints = ref<TaskSprint[]>([]);
	const zones = ref<Record<string, TaskListItem[]>>({});
	const loading = ref(true);
	const loadError = ref('');
	/** Mở danh sách đợt đã đóng nằm trên đường dẫn (`?closed=1`). */
	const showClosed = computed({
		get: () => route.query.closed === '1',
		set: (v: boolean) => router.replace({ query: { ...route.query, closed: v ? '1' : undefined } }),
	});

	const openSprints = computed(() =>
		sprints.value
			.filter(s => s.status !== 'CLOSED')
			.sort((a, b) => (a.status === 'ACTIVE' ? -1 : b.status === 'ACTIVE' ? 1 : a.startDate.localeCompare(b.startDate))),
	);
	const closedSprints = computed(() => sprints.value.filter(s => s.status === 'CLOSED').sort((a, b) => b.endDate.localeCompare(a.endDate)));
	const hasActive = computed(() => sprints.value.some(s => s.status === 'ACTIVE'));
	const targets = computed(() => [
		...openSprints.value.map(s => ({ key: `s-${s.id}`, label: s.name })),
		{ key: 'backlog', label: 'Việc chờ xếp' },
	]);
	const canDrag = computed(() => props.canPlan && !props.readOnly);

	const OPEN_STATUSES = 'TODO,IN_PROGRESS,IN_REVIEW,DONE';

	async function load(silent = false) {
		if (!silent) loading.value = true;
		loadError.value = '';
		try {
			const list = await service.listSprints(props.project.id);
			sprints.value = list;
			const open = list.filter(s => s.status !== 'CLOSED');
			const [backlog, ...perSprint] = await Promise.all([
				service.list({ projectId: props.project.id, backlog: true, topLevel: true, sort: 'dueDate', limit: 100 }),
				...open.map(s =>
					service.list({ projectId: props.project.id, sprintId: s.id, topLevel: true, status: OPEN_STATUSES, sort: 'dueDate', limit: 100 }),
				),
			]);
			const next: Record<string, TaskListItem[]> = { backlog: backlog!.data };
			open.forEach((s, i) => {
				next[`s-${s.id}`] = perSprint[i]!.data;
			});
			zones.value = next;
		} catch (err) {
			if (!silent) loadError.value = taskErrorInfo(err, 'Chưa tải được đợt và việc chờ xếp.').message;
		} finally {
			loading.value = false;
		}
	}
	onMounted(() => load());

	// Thời gian thực: việc đổi đợt (đóng đợt, người khác kéo) thì tải lại êm.
	const { subscribe } = useTaskRealtime();
	let unsubscribe: (() => void) | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;
	onMounted(() => {
		unsubscribe = subscribe(
			{
				onTaskChanged: () => {
					if (timer) clearTimeout(timer);
					timer = setTimeout(() => load(true), 600);
				},
			},
			props.project.id,
		);
	});
	onBeforeUnmount(() => {
		unsubscribe?.();
		if (timer) clearTimeout(timer);
	});

	// ─── Chuyển việc giữa đợt ───────────────────────────────────────────────
	function sprintIdOf(key: string): number | null {
		return key === 'backlog' ? null : Number(key.slice(2));
	}

	async function moveTask(task: TaskListItem, from: string, to: string) {
		if (from === to) return;
		const before = { ...zones.value };
		const sprint = sprints.value.find(s => `s-${s.id}` === to) ?? null;
		zones.value = {
			...zones.value,
			[from]: (zones.value[from] ?? []).filter(t => t.id !== task.id),
			[to]: [
				...(zones.value[to] ?? []),
				{ ...task, sprint: sprint ? { id: sprint.id, name: sprint.name, status: sprint.status, statusLabel: sprint.statusLabel } : null },
			],
		};
		const result = await actions.updateFields(task, { sprintId: sprintIdOf(to) });
		if (!result.ok) {
			zones.value = before;
			if (result.conflict) load(true);
			return;
		}
		zones.value = { ...zones.value, [to]: (zones.value[to] ?? []).map(t => (t.id === task.id ? result.task : t)) };
		toast.success(to === 'backlog' ? `${task.code} về Việc chờ xếp` : `${task.code} vào ${sprint?.name ?? 'đợt'}`);
		refreshSprints();
		emit('changed');
	}

	async function refreshSprints() {
		try {
			sprints.value = await service.listSprints(props.project.id);
		} catch {
			// giữ số cũ
		}
	}

	function onDrop(e: SortableDropEvent) {
		if (e.fromZone === e.toZone) return;
		const task = zones.value[e.fromZone]?.find(t => t.id === e.id);
		if (task) moveTask(task, e.fromZone, e.toZone);
	}

	function onMoveTo(task: TaskListItem, from: string, to: string) {
		moveTask(task, from, to);
	}

	// ─── Bắt đầu, đóng, tạo, sửa đợt ────────────────────────────────────────
	const busyId = ref<number | null>(null);
	async function start(s: TaskSprint) {
		busyId.value = s.id;
		try {
			await service.startSprint(props.project.id, s.id);
			toast.success(`Đã bắt đầu ${s.name}`);
			emit('changed');
		} catch (err) {
			toast.error(taskErrorInfo(err).message);
		} finally {
			busyId.value = null;
			load(true);
		}
	}

	const closing = ref<TaskSprint | null>(null);
	function onClosed(_r: TaskSprintCloseResult) {
		closing.value = null;
		load(true);
		emit('changed');
	}

	const editing = ref<TaskSprint | null>(null);
	const creating = ref(false);
	const suggested = computed(() => {
		const last = [...sprints.value].sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
		return { name: `Đợt ${sprints.value.length + 1}`, start: last ? timelineAddDays(last.endDate, 1) : today };
	});
	function onSaved() {
		creating.value = false;
		editing.value = null;
		load(true);
	}

	function onQuickCreated(t: TaskDetail) {
		zones.value = { ...zones.value, backlog: [...(zones.value.backlog ?? []), t] };
		emit('changed');
	}

	function pointsLine(s: TaskSprint): string {
		const parts = (['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const).filter(k => s.points[k]).map(k => `${STATUS_LABELS[k]} ${s.points[k]}`);
		return parts.length ? parts.join(' · ') : 'Chưa có việc';
	}
	const backlogPoints = computed(() => (zones.value.backlog ?? []).reduce((n, t) => n + t.points, 0));

	function onPanelChanged() {
		load(true);
	}
</script>

<template>
	<div class="space-y-4" data-testid="sprint-planner">
		<div class="flex flex-wrap items-center gap-2">
			<h2 class="flex items-center gap-1 text-base font-semibold text-gray-900 dark:text-white">
				Đợt
				<span class="cursor-help text-sm font-normal text-gray-400" :title="TASK_HINTS.sprint" aria-label="Đợt là gì">ⓘ</span>
			</h2>
			<CommonAppButton v-if="canManage && !readOnly" size="sm" variant="secondary" class="ml-auto" data-testid="sprint-create" @click="creating = true">
				<Icon name="heroicons:plus" class="mr-1 h-4 w-4" />Tạo đợt
			</CommonAppButton>
		</div>
		<p v-if="canDrag" class="-mt-2 text-xs text-gray-500 dark:text-gray-400">
			Kéo việc giữa các khối để đưa vào đợt, hoặc bấm nút mũi tên trên dòng.
		</p>

		<div v-if="loading" class="space-y-3" aria-busy="true">
			<div v-for="i in 3" :key="i" class="h-32 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>
		<TaskEmptyState v-else-if="loadError" kind="error" title="Chưa tải được đợt" :description="loadError" action-label="Thử lại" @action="load()" />
		<template v-else>
			<TaskEmptyState
				v-if="!openSprints.length"
				kind="none"
				title="Chưa có đợt nào đang mở"
				:description="canManage ? 'Tạo đợt đầu tiên, chọn ngày bắt đầu và kết thúc, rồi kéo việc chờ xếp vào.' : 'Quản lý dự án sẽ tạo đợt. Việc của dự án đang nằm ở Việc chờ xếp.'"
				:action-label="canManage && !readOnly ? 'Tạo đợt đầu tiên' : undefined"
				@action="creating = true"
			/>

			<section
				v-for="s in openSprints"
				:key="s.id"
				class="rounded-xl border bg-white dark:bg-gray-900"
				:class="s.status === 'ACTIVE' ? 'border-brand-300 dark:border-brand-700' : 'border-gray-200 dark:border-gray-700'"
				:aria-label="s.name"
				:data-testid="`sprint-${s.id}`"
				data-tour="task-sprint"
			>
				<header class="flex flex-wrap items-start gap-x-3 gap-y-1 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
					<div class="min-w-0 flex-1">
						<h3 class="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
							{{ s.name }}
							<span
								class="rounded-full px-2 py-0.5 text-xs font-medium"
								:class="s.status === 'ACTIVE' ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'"
							>
								{{ s.statusLabel }}
							</span>
							<span class="text-xs font-normal text-gray-500">{{ shortDate(s.startDate, today) }} tới {{ shortDate(s.endDate, today) }}</span>
						</h3>
						<p v-if="s.goal" class="mt-0.5 text-xs text-gray-600 dark:text-gray-300">{{ s.goal }}</p>
						<p class="mt-1 text-xs text-gray-600 dark:text-gray-300" :data-testid="`sprint-points-${s.id}`">
							<strong>{{ s.totalPoints }} điểm</strong> · {{ pointsLine(s) }}
						</p>
					</div>
					<div v-if="canManage && !readOnly" class="flex items-center gap-2">
						<CommonAppButton v-if="s.status === 'PLANNED'" size="sm" variant="outline" @click="editing = s">Sửa</CommonAppButton>
						<CommonAppButton
							v-if="s.status === 'PLANNED'"
							size="sm"
							:variant="hasActive ? 'outline' : 'primary'"
							:loading="busyId === s.id"
							:data-testid="`sprint-start-${s.id}`"
							:title="hasActive ? 'Dự án đang có đợt chạy; đóng đợt đó trước.' : undefined"
							@click="start(s)"
						>
							Bắt đầu đợt
						</CommonAppButton>
						<CommonAppButton v-if="s.status === 'ACTIVE'" size="sm" variant="outline" @click="editing = s">Sửa</CommonAppButton>
						<CommonAppButton v-if="s.status === 'ACTIVE'" size="sm" :data-testid="`sprint-close-${s.id}`" @click="closing = s">Đóng đợt</CommonAppButton>
					</div>
				</header>
				<TaskSprintZone
					:zone="`s-${s.id}`"
					:tasks="zones[`s-${s.id}`] ?? []"
					:group="dnd"
					:today="today"
					:targets="targets"
					:disabled="!canDrag"
					:active-code="panel.code.value"
					empty-text="Chưa có việc. Kéo việc chờ xếp vào đây."
					@drop="onDrop"
					@open="t => panel.open(t.code)"
					@move-to="(t, key) => onMoveTo(t, `s-${s.id}`, key)"
				/>
			</section>

			<section class="rounded-xl border border-dashed border-gray-300 bg-gray-50/60 dark:border-gray-700 dark:bg-gray-800/30" aria-label="Việc chờ xếp" data-tour="task-backlog">
				<header class="flex items-center gap-2 px-4 py-3">
					<h3 class="flex items-center gap-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
						Việc chờ xếp
						<span class="cursor-help text-xs font-normal text-gray-400" :title="TASK_HINTS.backlog" aria-label="Việc chờ xếp là gì">ⓘ</span>
					</h3>
					<span class="text-xs text-gray-500">{{ (zones.backlog ?? []).length }} việc · {{ backlogPoints }} điểm</span>
				</header>
				<TaskSprintZone
					zone="backlog"
					:tasks="zones.backlog ?? []"
					:group="dnd"
					:today="today"
					:targets="targets"
					:disabled="!canDrag"
					:active-code="panel.code.value"
					empty-text="Không còn việc chờ xếp."
					@drop="onDrop"
					@open="t => panel.open(t.code)"
					@move-to="(t, key) => onMoveTo(t, 'backlog', key)"
				/>
				<div v-if="canDrag && project.status === 'ACTIVE'" class="px-2 pb-2">
					<TaskQuickCreate :project-id="project.id" :default-assignee-id="defaultAssigneeId" @created="onQuickCreated" />
				</div>
			</section>

			<section v-if="closedSprints.length" class="text-sm">
				<button
					type="button"
					class="flex items-center gap-1 font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300"
					:aria-expanded="showClosed"
					@click="showClosed = !showClosed"
				>
					<Icon name="heroicons:chevron-down" class="h-4 w-4 transition-transform" :class="showClosed ? '' : '-rotate-90'" />
					Đợt đã đóng ({{ closedSprints.length }})
				</button>
				<ul v-if="showClosed" class="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-700 dark:bg-gray-900">
					<li v-for="s in closedSprints" :key="s.id" class="flex flex-wrap items-center gap-x-3 px-4 py-2">
						<span class="font-medium text-gray-800 dark:text-gray-200">{{ s.name }}</span>
						<span class="text-xs text-gray-500">{{ shortDate(s.startDate, today) }} tới {{ shortDate(s.endDate, today) }}</span>
						<span class="ml-auto text-xs text-gray-600 dark:text-gray-300">xong {{ s.points.DONE }}/{{ s.totalPoints }} điểm</span>
					</li>
				</ul>
			</section>
		</template>

		<TaskSprintFormModal
			v-if="creating || editing"
			:project-id="project.id"
			:sprint="editing"
			:suggested-name="suggested.name"
			:suggested-start="suggested.start"
			@close="creating = false; editing = null"
			@saved="onSaved"
		/>
		<TaskSprintCloseModal v-if="closing" :project-id="project.id" :sprint="closing" :sprints="sprints" @close="closing = null" @closed="onClosed" />
		<TaskDetailPanel @changed="onPanelChanged" />
	</div>
</template>
