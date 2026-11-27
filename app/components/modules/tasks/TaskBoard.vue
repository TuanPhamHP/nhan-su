<script setup lang="ts">
	import TaskBoardColumn from '~/components/modules/tasks/TaskBoardColumn.vue';
	import TaskQuickCreate from '~/components/modules/tasks/TaskQuickCreate.vue';
	import type { SortableDropEvent } from '~/composables/useSortableList';
	import type { TaskActionResult } from '~/composables/useTaskActions';
	import type { TaskBoard, TaskDetail, TaskListItem, TaskStatus, TaskWipLimits } from '~/types/tasks.types';
	import { BOARD_STATUSES, STATUS_LABELS, vnToday } from '~/utils/tasks.utils';

	/**
	 * Bảng việc năm cột cố định (mục 9.2). Đã huỷ ẩn mặc định, trang bật bằng công tắc.
	 *
	 * Kéo thẻ: bắt đầu kéo thì cột không thả được mờ đi kèm câu lý do; thả vào cột đó thì thẻ về chỗ
	 * cũ kèm thông báo. Cột cần thông tin (Nghiệm thu, Trả lại, Mở lại, Huỷ) mở hộp trước, chỉ đổi sau
	 * khi xác nhận. Cột không cần hộp thì thẻ sang ngay (cập nhật lạc quan), máy chủ từ chối thì về chỗ
	 * cũ kèm câu máy chủ gửi; lệch phiên bản thì trang tải lại để thẻ về đúng cột mới.
	 */
	const props = withDefaults(
		defineProps<{
			board: TaskBoard | null;
			/** `my`: thứ tự riêng ở Việc của tôi; `shared`: thứ tự chung của dự án. */
			boardKind: 'my' | 'shared';
			/** Được đổi thứ tự trong cột (thành viên dự án, hoặc bảng của tôi). */
			reorder: boolean;
			showCancelled?: boolean;
			/** Có thì hiện dòng tạo nhanh cuối cột Chưa làm. */
			quickCreate?: { projectId?: number | null; defaultAssigneeId?: number | null } | null;
			activeCode?: string | null;
			disabled?: boolean;
			/** Lô 2: giới hạn số thẻ mỗi cột của dự án, chỉ để cảnh báo. */
			wipLimits?: TaskWipLimits | null;
		}>(),
		{ showCancelled: false, quickCreate: null, activeCode: null, disabled: false, wipLimits: null },
	);

	const emit = defineEmits<{
		open: [task: TaskListItem];
		/** Một việc vừa đổi (đã có bản mới của máy chủ). */
		changed: [task: TaskDetail];
		created: [task: TaskDetail];
		/** Cần tải lại cả bảng (lệch phiên bản, lỗi không rõ chỗ). */
		reload: [];
		moreDone: [];
	}>();

	const actions = useTaskActions();
	const today = vnToday();
	const group = `task-board-${Math.random().toString(36).slice(2)}`;

	interface Col {
		status: TaskStatus;
		label: string;
		total: number;
		tasks: TaskListItem[];
	}

	const cols = ref<Col[]>([]);

	watch(
		() => props.board,
		b => {
			const byStatus = new Map((b?.columns ?? []).map(c => [c.status, c]));
			cols.value = BOARD_STATUSES.filter(s => s !== 'CANCELLED' || props.showCancelled).map(s => {
				const c = byStatus.get(s);
				return { status: s, label: c?.label ?? STATUS_LABELS[s], total: c?.total ?? 0, tasks: [...(c?.tasks ?? [])] };
			});
		},
		{ immediate: true },
	);

	const dragging = ref<TaskListItem | null>(null);

	function findTask(id: number): { col: Col; index: number; task: TaskListItem } | null {
		for (const col of cols.value) {
			const index = col.tasks.findIndex(t => t.id === id);
			if (index >= 0) return { col, index, task: col.tasks[index]! };
		}
		return null;
	}

	function blockedReason(status: TaskStatus): string | null {
		const t = dragging.value;
		if (!t || t.status === status) return null;
		const rule = t.columnRules[status];
		if (rule?.allowed) return null;
		return rule?.reason ?? `Không chuyển được sang ${STATUS_LABELS[status]}.`;
	}

	function onDragStart(id: number) {
		dragging.value = findTask(id)?.task ?? null;
	}

	/** Chụp lại cả bảng trước khi đổi lạc quan, để máy chủ từ chối thì trả về đúng như cũ. */
	function snapshot() {
		return cols.value.map(c => ({ ...c, tasks: [...c.tasks] }));
	}

	function placeLocal(task: TaskListItem, toStatus: TaskStatus, beforeId: number | null, afterId: number | null) {
		const found = findTask(task.id);
		if (!found) return;
		found.col.tasks.splice(found.index, 1);
		const to = cols.value.find(c => c.status === toStatus);
		if (!to) return;
		if (found.col !== to) {
			found.col.total = Math.max(0, found.col.total - 1);
			to.total += 1;
		}
		let index = to.tasks.length;
		if (beforeId != null) {
			const i = to.tasks.findIndex(t => t.id === beforeId);
			if (i >= 0) index = i + 1;
		} else if (afterId != null) {
			const i = to.tasks.findIndex(t => t.id === afterId);
			if (i >= 0) index = i;
		}
		to.tasks.splice(index, 0, { ...task, status: toStatus });
	}

	/** Thay thẻ bằng bản mới của máy chủ; trạng thái khác cột đang đứng thì dời sang cột đúng. */
	function applyServer(updated: TaskListItem) {
		const found = findTask(updated.id);
		if (!found) return;
		if (found.col.status === updated.status) {
			found.col.tasks.splice(found.index, 1, updated);
			return;
		}
		found.col.tasks.splice(found.index, 1);
		found.col.total = Math.max(0, found.col.total - 1);
		const to = cols.value.find(c => c.status === updated.status);
		if (to) {
			to.tasks.push(updated);
			to.total += 1;
		}
	}

	function afterResult(result: TaskActionResult, before: Col[] | null) {
		if (result.ok) {
			applyServer(result.task);
			emit('changed', result.task);
			return;
		}
		if (before) cols.value = before;
		if (result.conflict) emit('reload');
	}

	async function move(task: TaskListItem, toStatus: TaskStatus, beforeId: number | null, afterId: number | null) {
		const changingColumn = toStatus !== task.status;
		const rule = changingColumn ? task.columnRules[toStatus] : null;
		// Đổi thứ tự trên bảng chung mà không được quyền thì không gửi thẻ cạnh: máy chủ đặt cuối cột.
		const withNeighbors = props.reorder;
		if (!changingColumn && !props.reorder) return;
		const needsDialog = !!rule?.allowed && (rule.needsReason || rule.action === 'accept');
		let before: Col[] | null = null;
		if (!needsDialog && (!changingColumn || rule?.allowed)) {
			before = snapshot();
			placeLocal(task, toStatus, beforeId, afterId);
		}
		const result = await actions.moveTask(task, {
			status: changingColumn ? toStatus : undefined,
			beforeId: withNeighbors ? (beforeId ?? undefined) : undefined,
			afterId: withNeighbors ? (afterId ?? undefined) : undefined,
			board: props.boardKind,
		});
		if (result.ok && needsDialog) placeLocal(task, toStatus, beforeId, afterId);
		afterResult(result, before);
	}

	function onDrop(e: SortableDropEvent) {
		const found = findTask(e.id);
		dragging.value = null;
		if (!found) return;
		const toStatus = e.toZone as TaskStatus;
		if (toStatus === found.col.status) {
			// Thả về đúng chỗ cũ thì thôi.
			const prev = found.col.tasks[found.index - 1]?.id ?? null;
			const next = found.col.tasks[found.index + 1]?.id ?? null;
			if (prev === e.beforeId && next === e.afterId) return;
		}
		move(found.task, toStatus, e.beforeId, e.afterId);
	}

	function moveTop(task: TaskListItem) {
		const col = findTask(task.id)?.col;
		const first = col?.tasks[0];
		if (!first || first.id === task.id) return;
		move(task, task.status, null, first.id);
	}

	function moveBottom(task: TaskListItem) {
		const col = findTask(task.id)?.col;
		const last = col?.tasks[col.tasks.length - 1];
		if (!last || last.id === task.id) return;
		move(task, task.status, last.id, null);
	}

	async function changeDue(task: TaskListItem) {
		afterResult(await actions.changeDue(task), null);
	}

	async function reassign(task: TaskListItem) {
		afterResult(await actions.reassign(task), null);
	}

	function onCreated(task: TaskDetail) {
		const todo = cols.value.find(c => c.status === task.status);
		if (todo) {
			todo.tasks.push(task);
			todo.total += 1;
		}
		emit('created', task);
	}

	defineExpose({ applyServer });
</script>

<template>
	<!--
		Điện thoại: cột bắt dính khi vuốt, nhưng tắt bắt dính lúc đang kéo thẻ, không thì bảng tự cuộn tới
		mép (để thấy cột bên cạnh) lại bị kéo ngược về cột cũ và không thả sang cột khác được. Bảng tràn sát
		hai mép màn (`-mx-4 px-4`): ngón tay kéo tới mép màn vẫn nằm trong bảng nên bảng mới tự cuộn ngang.
	-->
	<div
		class="-mx-4 flex scroll-px-4 gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:snap-none sm:px-0"
		:class="dragging ? 'snap-none' : 'snap-x snap-mandatory'"
		data-testid="task-board"
		data-tour="task-board"
	>
		<TaskBoardColumn
			v-for="col in cols"
			:key="col.status"
			:status="col.status"
			:label="col.label"
			:total="col.total"
			:tasks="col.tasks"
			:today="today"
			:group="group"
			:blocked-reason="blockedReason(col.status)"
			:is-source="dragging?.status === col.status"
			:reorder="reorder"
			:active-code="activeCode"
			:disabled="disabled"
			:wip-limit="wipLimits?.[col.status as keyof TaskWipLimits] ?? null"
			@drag-start="onDragStart"
			@drag-end="dragging = null"
			@drop="onDrop"
			@open="t => emit('open', t)"
			@status="(t, s) => move(t, s, null, null)"
			@move-top="moveTop"
			@move-bottom="moveBottom"
			@change-due="changeDue"
			@reassign="reassign"
		>
			<template #footer>
				<p
					v-if="col.total > col.tasks.length"
					data-no-drag
					class="text-center text-xs text-gray-500 dark:text-gray-400"
				>
					<button
						v-if="col.status === 'DONE'"
						type="button"
						class="text-brand-600 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-brand-400"
						@click="emit('moreDone')"
					>
						Xem thêm việc đã hoàn thành
					</button>
					<template v-else>Còn {{ col.total - col.tasks.length }} việc, lọc bớt để xem</template>
				</p>
				<TaskQuickCreate
					v-if="quickCreate && col.status === 'TODO' && !disabled"
					:project-id="quickCreate.projectId"
					:default-assignee-id="quickCreate.defaultAssigneeId"
					@created="onCreated"
				/>
			</template>
		</TaskBoardColumn>
	</div>
</template>
