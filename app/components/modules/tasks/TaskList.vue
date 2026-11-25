<script setup lang="ts">
	import TaskCardMenu from '~/components/modules/tasks/TaskCardMenu.vue';
	import TaskQuickCreate from '~/components/modules/tasks/TaskQuickCreate.vue';
	import TaskStatusBadge from '~/components/modules/tasks/TaskStatusBadge.vue';
	import type { TaskActionResult } from '~/composables/useTaskActions';
	import type { TaskDetail, TaskListItem, TaskPriority, TaskStatus } from '~/types/tasks.types';
	import {
		BOARD_STATUSES,
		DUE_TONE_CLASS,
		MY_GROUP_LABELS,
		PRIORITY_LABELS,
		STATUS_LABELS,
		dueTone,
		groupMyTasks,
		taskDueText,
		vnToday,
	} from '~/utils/tasks.utils';

	/**
	 * Danh sách việc (mục 9.2): sửa ngay trên ô Trạng thái, Ưu tiên, Người thực hiện; ô Hạn mở hộp
	 * Đổi hạn có lý do; ô không có quyền hiện chữ thường kèm lý do khi rê chuột. Nhóm thu gọn được,
	 * đầu nhóm có số việc và tổng điểm, trạng thái thu gọn nhớ trong trình duyệt.
	 */
	export type TaskGroupBy = 'status' | 'assignee' | 'due' | 'none';

	const props = withDefaults(
		defineProps<{
			tasks: TaskListItem[];
			groupBy: TaskGroupBy;
			/** Cột cuối: tên dự án (Việc của phòng) hay phòng (không dùng ở lô 1). */
			showProject?: boolean;
			activeCode?: string | null;
			quickCreate?: { projectId?: number | null; defaultAssigneeId?: number | null } | null;
			/** Khoá nhớ nhóm đang thu gọn. */
			storageKey: string;
			disabled?: boolean;
		}>(),
		{ showProject: false, activeCode: null, quickCreate: null, disabled: false },
	);

	const emit = defineEmits<{
		open: [task: TaskListItem];
		changed: [task: TaskDetail];
		created: [task: TaskDetail];
		reload: [];
	}>();

	const actions = useTaskActions();
	const today = vnToday();
	const rows = ref<TaskListItem[]>([]);
	watch(
		() => props.tasks,
		v => {
			rows.value = [...v];
		},
		{ immediate: true },
	);

	interface Group {
		key: string;
		label: string;
		tasks: TaskListItem[];
		defaultAssigneeId: number | null;
	}

	const groups = computed<Group[]>(() => {
		const list = rows.value;
		if (props.groupBy === 'none') return [{ key: 'all', label: 'Tất cả', tasks: list, defaultAssigneeId: null }];
		if (props.groupBy === 'status') {
			return BOARD_STATUSES.map(s => ({
				key: s,
				label: STATUS_LABELS[s],
				tasks: list.filter(t => t.status === s),
				defaultAssigneeId: null,
			})).filter(g => g.tasks.length || g.key === 'TODO');
		}
		if (props.groupBy === 'due') {
			const g = groupMyTasks(list, today);
			return (Object.keys(g) as Array<keyof typeof g>).map(k => ({
				key: k,
				label: MY_GROUP_LABELS[k],
				tasks: g[k],
				defaultAssigneeId: null,
			})).filter(x => x.tasks.length);
		}
		const byPerson = new Map<number, Group>();
		for (const t of list) {
			const g = byPerson.get(t.assignee.id) ?? {
				key: `p-${t.assignee.id}`,
				label: t.assignee.fullName,
				tasks: [],
				defaultAssigneeId: t.assignee.id,
			};
			g.tasks.push(t);
			byPerson.set(t.assignee.id, g);
		}
		return [...byPerson.values()].sort((a, b) => a.label.localeCompare(b.label, 'vi'));
	});

	const collapsed = ref<Record<string, boolean>>({});
	onMounted(() => {
		try {
			collapsed.value = JSON.parse(localStorage.getItem(props.storageKey) ?? '{}') as Record<string, boolean>;
		} catch {
			collapsed.value = {};
		}
	});
	function toggleGroup(key: string) {
		collapsed.value = { ...collapsed.value, [key]: !collapsed.value[key] };
		try {
			localStorage.setItem(props.storageKey, JSON.stringify(collapsed.value));
		} catch {
			// Trình duyệt chặn bộ nhớ: vẫn thu gọn được trong lượt này.
		}
	}

	function replaceRow(updated: TaskListItem) {
		const i = rows.value.findIndex(t => t.id === updated.id);
		if (i >= 0) rows.value.splice(i, 1, updated);
	}

	function handle(result: TaskActionResult, revert?: TaskListItem) {
		if (result.ok) {
			replaceRow(result.task);
			emit('changed', result.task);
			return;
		}
		if (revert) replaceRow(revert);
		if (result.conflict) emit('reload');
	}

	/** Trạng thái chọn được trên ô: chỉ các cột máy chủ cho chuyển tới, giống menu trên thẻ. */
	function statusOptions(task: TaskListItem): TaskStatus[] {
		return BOARD_STATUSES.filter(s => s !== task.status && task.columnRules[s]?.allowed);
	}

	async function onStatus(task: TaskListItem, value: string) {
		const status = value as TaskStatus;
		const action = task.columnRules[status]?.action;
		if (!action) return;
		handle(await actions.runAction(task, action));
	}

	async function onPriority(task: TaskListItem, value: string) {
		const priority = value as TaskPriority;
		if (priority === task.priority) return;
		const before = task;
		replaceRow({ ...task, priority, priorityLabel: PRIORITY_LABELS[priority] });
		handle(await actions.updateFields(before, { priority }), before);
	}

	async function doReassign(task: TaskListItem) {
		handle(await actions.reassign(task));
	}

	async function doDue(task: TaskListItem) {
		handle(await actions.changeDue(task));
	}

	async function onMenuStatus(task: TaskListItem, status: TaskStatus) {
		await onStatus(task, status);
	}

	const NO_EDIT = 'Chỉ người giao hoặc quản lý dự án sửa được ô này.';
	const NO_REASSIGN = 'Chỉ người giao, quản lý dự án hoặc trưởng phòng của người giao đổi được người thực hiện.';
	const NO_DUE = 'Chỉ người giao, quản lý dự án hoặc trưởng phòng của người giao đổi được hạn.';
	const NO_STATUS = 'Bạn không chuyển được việc này sang trạng thái nào khác.';

	const groupPoints = (g: Group) => g.tasks.reduce((s, t) => s + t.points, 0);
</script>

<template>
	<div class="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900" data-testid="task-list">
		<table class="w-full text-sm" :class="showProject ? 'min-w-[68rem]' : 'min-w-[58rem]'">
			<thead class="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
				<tr>
					<th class="w-24 px-3 py-2">Số hiệu</th>
					<th class="min-w-[16rem] px-3 py-2">Tiêu đề</th>
					<th class="w-44 px-3 py-2">Người thực hiện</th>
					<th class="w-28 px-3 py-2">Hạn</th>
					<th class="w-40 px-3 py-2">Trạng thái</th>
					<th class="w-32 px-3 py-2">Ưu tiên</th>
					<th class="w-16 px-3 py-2 text-right">Điểm</th>
					<th v-if="showProject" class="w-40 px-3 py-2">Dự án</th>
					<th class="w-10 px-2 py-2"><span class="sr-only">Thao tác</span></th>
				</tr>
			</thead>
			<template v-for="g in groups" :key="g.key">
				<tbody>
					<tr v-if="groupBy !== 'none'" class="sticky top-0 z-10 bg-white dark:bg-gray-900">
						<th :colspan="showProject ? 9 : 8" class="border-t border-gray-100 px-3 py-2 text-left dark:border-gray-800">
							<button
								type="button"
								class="flex items-center gap-2 rounded text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-gray-100"
								:aria-expanded="!collapsed[g.key]"
								@click="toggleGroup(g.key)"
							>
								<Icon
									name="heroicons:chevron-down"
									class="h-4 w-4 transition-transform"
									:class="collapsed[g.key] ? '-rotate-90' : ''"
									aria-hidden="true"
								/>
								{{ g.label }}
								<span class="font-normal text-gray-500 dark:text-gray-400">{{ g.tasks.length }} việc · {{ groupPoints(g) }} điểm</span>
							</button>
						</th>
					</tr>
				</tbody>
				<tbody v-if="!collapsed[g.key]">
					<tr
						v-for="t in g.tasks"
						:key="t.id"
						class="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/40"
						:class="activeCode === t.code ? 'bg-brand-50/60 dark:bg-brand-900/20' : ''"
						:data-task-code="t.code"
					>
						<td class="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">{{ t.code }}</td>
						<td class="px-3 py-2">
							<button
								type="button"
								class="text-left font-medium text-gray-900 hover:text-brand-600 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-gray-100 dark:hover:text-brand-400"
								@click="emit('open', t)"
							>
								{{ t.title }}
							</button>
							<span v-if="t.parent" class="ml-1 text-xs text-gray-400">· việc con của {{ t.parent.title ?? t.parent.code }}</span>
						</td>
						<td class="px-3 py-2">
							<button
								v-if="t.permissions.reassign && !disabled"
								type="button"
								class="flex items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:hover:bg-gray-800"
								:aria-label="`Đổi người thực hiện ${t.code}, hiện là ${t.assignee.fullName}`"
								@click="doReassign(t)"
							>
								<CommonAppAvatar :src="t.assignee.avatarUrl" :name="t.assignee.fullName" size="xs" />
								<span class="truncate text-gray-700 dark:text-gray-200">{{ t.assignee.fullName }}</span>
							</button>
							<span v-else class="flex items-center gap-1.5 text-gray-700 dark:text-gray-200" :title="NO_REASSIGN">
								<CommonAppAvatar :src="t.assignee.avatarUrl" :name="t.assignee.fullName" size="xs" />
								<span class="truncate">{{ t.assignee.fullName }}</span>
							</span>
						</td>
						<td class="px-3 py-2">
							<button
								v-if="t.permissions.changeDue && !disabled"
								type="button"
								class="rounded px-1 py-0.5 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:hover:bg-gray-800"
								:class="DUE_TONE_CLASS[dueTone(t, today)]"
								:aria-label="`Đổi hạn ${t.code}, hạn hiện tại ${taskDueText(t, today)}`"
								@click="doDue(t)"
							>
								{{ taskDueText(t, today) }}
							</button>
							<span v-else :class="DUE_TONE_CLASS[dueTone(t, today)]" :title="NO_DUE">{{ taskDueText(t, today) }}</span>
							<span v-if="t.dueChangeCount" class="block text-[11px] text-amber-700 dark:text-amber-400">đổi {{ t.dueChangeCount }} lần</span>
						</td>
						<td class="px-3 py-2">
							<select
								v-if="statusOptions(t).length && !disabled"
								:value="t.status"
								class="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
								:aria-label="`Trạng thái ${t.code}`"
								@change="e => { onStatus(t, (e.target as HTMLSelectElement).value); (e.target as HTMLSelectElement).value = t.status; }"
							>
								<option :value="t.status" disabled>{{ t.statusLabel }}</option>
								<option v-for="s in statusOptions(t)" :key="s" :value="s">{{ STATUS_LABELS[s] }}</option>
							</select>
							<span v-else :title="NO_STATUS"><TaskStatusBadge :status="t.status" :label="t.statusLabel" /></span>
						</td>
						<td class="px-3 py-2">
							<select
								v-if="t.permissions.edit && !disabled"
								:value="t.priority"
								class="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
								:aria-label="`Ưu tiên ${t.code}`"
								@change="e => onPriority(t, (e.target as HTMLSelectElement).value)"
							>
								<option v-for="(label, key) in PRIORITY_LABELS" :key="key" :value="key">{{ label }}</option>
							</select>
							<span v-else class="text-xs text-gray-600 dark:text-gray-300" :title="NO_EDIT">{{ t.priorityLabel }}</span>
						</td>
						<td class="px-3 py-2 text-right text-gray-700 dark:text-gray-200">
							{{ t.points }}<span v-if="t.subtasks.total" class="text-xs text-gray-400"> +{{ t.subtasks.points }}</span>
						</td>
						<td v-if="showProject" class="max-w-[10rem] truncate px-3 py-2 text-xs text-gray-500 dark:text-gray-400" :title="t.project?.name">
							{{ t.project?.name ?? 'Việc lẻ' }}
						</td>
						<td class="px-2 py-2">
							<TaskCardMenu
								:task="t"
								@open="emit('open', t)"
								@status="s => onMenuStatus(t, s)"
								@change-due="doDue(t)"
								@reassign="doReassign(t)"
							/>
						</td>
					</tr>
					<tr v-if="quickCreate && !disabled">
						<td :colspan="showProject ? 9 : 8" class="px-3 py-2">
							<TaskQuickCreate
								:project-id="quickCreate.projectId"
								:default-assignee-id="g.defaultAssigneeId ?? quickCreate.defaultAssigneeId"
								@created="t => { rows.push(t); emit('created', t); }"
							/>
						</td>
					</tr>
				</tbody>
			</template>
		</table>
	</div>
</template>
