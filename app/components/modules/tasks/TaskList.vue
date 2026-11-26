<script setup lang="ts">
	import TaskCardMenu from '~/components/modules/tasks/TaskCardMenu.vue';
	import TaskQuickCreate from '~/components/modules/tasks/TaskQuickCreate.vue';
	import TaskStatusBadge from '~/components/modules/tasks/TaskStatusBadge.vue';
	import type { TaskActionResult } from '~/composables/useTaskActions';
	import type { TaskDetail, TaskGroup as TaskGroupData, TaskListItem, TaskPriority, TaskStatus } from '~/types/tasks.types';
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
	export type TaskGroupBy = 'status' | 'assignee' | 'due' | 'taskGroup' | 'none';

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
			/** Lô 2: nhóm việc của dự án; có thì thêm cột Nhóm, sửa ngay trên ô khi `canEditGroup`. */
			taskGroups?: TaskGroupData[];
			/** Thành viên dự án vai Quản lý, Thành viên (ADMIN); Người xem chỉ thấy chữ. */
			canEditGroup?: boolean;
		}>(),
		{ showProject: false, activeCode: null, quickCreate: null, disabled: false, taskGroups: () => [], canEditGroup: false },
	);

	const emit = defineEmits<{
		open: [task: TaskListItem];
		changed: [task: TaskDetail];
		created: [task: TaskDetail];
		reload: [];
	}>();

	const actions = useTaskActions();
	const today = vnToday();
	const narrow = useNarrowScreen();
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
		/** Nhóm việc điền sẵn cho dòng tạo nhanh cuối nhóm. */
		groupId?: number | null;
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
		if (props.groupBy === 'taskGroup') {
			const out: Group[] = props.taskGroups
				.filter(g => !g.archived || list.some(t => t.group?.id === g.id))
				.map(g => ({
					key: `tg-${g.id}`,
					label: g.archived ? `${g.name} (đã cất)` : g.name,
					tasks: list.filter(t => t.group?.id === g.id),
					defaultAssigneeId: null,
					groupId: g.archived ? null : g.id,
				}));
			const none = list.filter(t => !t.group);
			if (none.length) out.push({ key: 'tg-none', label: 'Chưa có nhóm', tasks: none, defaultAssigneeId: null, groupId: null });
			return out;
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
	const NO_GROUP = 'Chỉ quản lý dự án và thành viên đổi được nhóm việc. Người xem chỉ xem.';

	const showGroupCol = computed(() => props.taskGroups.length > 0);
	const cols = computed(() => 8 + (props.showProject ? 1 : 0) + (showGroupCol.value ? 1 : 0));
	const activeGroups = computed(() => props.taskGroups.filter(g => !g.archived));

	/** Đổi nhóm ngay trên ô: hiện lạc quan, máy chủ từ chối thì trả về như cũ (`PATCH /tasks/:id`). */
	async function onGroup(task: TaskListItem, value: string) {
		const groupId = value ? Number(value) : null;
		if ((task.group?.id ?? null) === groupId) return;
		const before = task;
		const g = props.taskGroups.find(x => x.id === groupId);
		replaceRow({ ...task, group: g ? { id: g.id, name: g.name } : null });
		handle(await actions.updateFields(before, { groupId }), before);
	}

	const groupPoints = (g: Group) => g.tasks.reduce((s, t) => s + (t.points ?? 0), 0);
</script>

<template>
	<!--
		Màn hẹp: mỗi việc là một thẻ (tiêu đề, người làm, hạn tô đỏ khi trễ, trạng thái). Bảng 58–70rem trên
		điện thoại chỉ còn thấy số hiệu và tiêu đề, phải vuốt ngang mới thấy người làm và hạn.
	-->
	<div v-if="narrow !== false" class="space-y-3 sm:hidden" data-testid="task-list-cards">
		<section
			v-for="g in groups"
			:key="g.key"
			class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
		>
			<button
				v-if="groupBy !== 'none'"
				type="button"
				class="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500 dark:text-gray-100"
				:aria-expanded="!collapsed[g.key]"
				@click="toggleGroup(g.key)"
			>
				<Icon name="heroicons:chevron-down" class="h-4 w-4 transition-transform" :class="collapsed[g.key] ? '-rotate-90' : ''" aria-hidden="true" />
				<span class="min-w-0 truncate">{{ g.label }}</span>
				<span class="shrink-0 font-normal text-gray-500 dark:text-gray-400">{{ g.tasks.length }} việc · {{ groupPoints(g) }} điểm</span>
			</button>
			<ul v-if="!collapsed[g.key]" class="divide-y divide-gray-100 border-t border-gray-100 dark:divide-gray-800 dark:border-gray-800">
				<li
					v-for="t in g.tasks"
					:key="t.id"
					class="flex items-start gap-2 px-3 py-2.5"
					:class="activeCode === t.code ? 'bg-brand-50/60 dark:bg-brand-900/20' : ''"
					:data-task-code="t.code"
					data-testid="task-card-row"
				>
					<div class="min-w-0 flex-1">
						<button
							type="button"
							class="block max-w-full text-left text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-gray-100"
							@click="emit('open', t)"
						>
							<span class="mr-1 text-xs font-normal text-gray-500 dark:text-gray-400">{{ t.code }}</span>{{ t.title }}
						</button>
						<p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
							<TaskStatusBadge :status="t.status" :label="t.statusLabel" />
							<span :class="DUE_TONE_CLASS[dueTone(t, today)]">{{ taskDueText(t, today) }}</span>
							<span class="inline-flex min-w-0 items-center gap-1">
								<CommonAppAvatar :src="t.assignee.avatarUrl" :name="t.assignee.fullName" size="xs" />
								<span class="truncate">{{ t.assignee.fullName }}</span>
							</span>
							<span v-if="t.points != null">{{ t.points }} điểm</span>
							<span v-if="t.dependencies?.late" class="text-rose-600 dark:text-rose-400">phải chờ việc khác đang trễ hạn</span>
							<span v-if="showProject && t.project" class="truncate">{{ t.project.name }}</span>
						</p>
					</div>
					<TaskCardMenu
						v-if="!disabled"
						:task="t"
						@open="emit('open', t)"
						@status="s => onMenuStatus(t, s)"
						@change-due="doDue(t)"
						@reassign="doReassign(t)"
					/>
				</li>
				<li v-if="quickCreate && !disabled" class="px-3 py-2">
					<TaskQuickCreate
						:project-id="quickCreate.projectId"
						:group-id="g.groupId ?? null"
						:default-assignee-id="g.defaultAssigneeId ?? quickCreate.defaultAssigneeId"
						@created="t => { rows.push(t); emit('created', t); }"
					/>
				</li>
			</ul>
		</section>
	</div>
	<!-- `relative`: chữ `sr-only` (định vị tuyệt đối) trong đầu bảng không thoát khỏi khung cuộn và làm trang rộng ra. -->
	<div v-if="narrow !== true" class="relative hidden overflow-x-auto rounded-xl border border-gray-200 bg-white sm:block dark:border-gray-700 dark:bg-gray-900" data-testid="task-list">
		<table class="w-full text-sm" :class="showProject || showGroupCol ? 'min-w-[70rem]' : 'min-w-[58rem]'">
			<thead class="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
				<tr>
					<th class="w-24 px-3 py-2">Số hiệu</th>
					<th class="min-w-[16rem] px-3 py-2">Tiêu đề</th>
					<th class="w-44 px-3 py-2">Người thực hiện</th>
					<th class="w-28 px-3 py-2">Hạn</th>
					<th class="w-40 px-3 py-2">Trạng thái</th>
					<th class="w-32 px-3 py-2">Ưu tiên</th>
					<th class="w-16 px-3 py-2 text-right">Điểm</th>
					<th v-if="showGroupCol" class="w-40 px-3 py-2">Nhóm việc</th>
					<th v-if="showProject" class="w-40 px-3 py-2">Dự án</th>
					<th class="w-10 px-2 py-2"><span class="sr-only">Thao tác</span></th>
				</tr>
			</thead>
			<template v-for="g in groups" :key="g.key">
				<tbody>
					<tr v-if="groupBy !== 'none'" class="sticky top-0 z-10 bg-white dark:bg-gray-900">
						<th :colspan="cols" class="border-t border-gray-100 px-3 py-2 text-left dark:border-gray-800">
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
						<td class="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
							<span class="inline-flex items-center gap-1">
								<span
									v-if="t.dependencies?.late"
									class="h-2 w-2 rounded-full bg-rose-500"
									title="Việc này đang chờ một việc bị trễ"
									data-testid="task-late-dot"
								/>
								{{ t.code }}
							</span>
						</td>
						<td class="px-3 py-2">
							<button
								type="button"
								class="text-left font-medium text-gray-900 hover:text-brand-600 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-gray-100 dark:hover:text-brand-400"
								@click="emit('open', t)"
							>
								{{ t.title }}
							</button>
							<span v-if="t.parent" class="ml-1 text-xs text-gray-400">· việc con của {{ t.parent.title ?? t.parent.code }}</span>
							<span v-if="t.recurrenceId" class="ml-1 rounded bg-teal-50 px-1 text-[11px] text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">Định kỳ</span>
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
						<td v-if="showGroupCol" class="px-3 py-2">
							<select
								v-if="canEditGroup && !disabled && !t.parent && t.status !== 'CANCELLED'"
								:value="t.group?.id ?? ''"
								class="w-36 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
								:aria-label="`Nhóm việc ${t.code}`"
								:data-testid="`task-group-select-${t.code}`"
								@change="e => onGroup(t, (e.target as HTMLSelectElement).value)"
							>
								<option value="">Chưa có nhóm</option>
								<option v-if="t.group && !activeGroups.some(g => g.id === t.group!.id)" :value="t.group.id" disabled>{{ t.group.name }} (đã cất)</option>
								<option v-for="g in activeGroups" :key="g.id" :value="g.id">{{ g.name }}</option>
							</select>
							<span v-else class="text-xs text-gray-600 dark:text-gray-300" :title="t.parent ? 'Việc con theo nhóm của việc cha.' : NO_GROUP" :data-testid="`task-group-text-${t.code}`">
								{{ t.group?.name ?? '—' }}
							</span>
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
						<td :colspan="cols" class="px-3 py-2">
							<TaskQuickCreate
								:project-id="quickCreate.projectId"
								:group-id="g.groupId ?? null"
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
