<script setup lang="ts">
	import TaskCardMenu from '~/components/modules/tasks/TaskCardMenu.vue';
	import TaskPriorityBadge from '~/components/modules/tasks/TaskPriorityBadge.vue';
	import TaskStatusBadge from '~/components/modules/tasks/TaskStatusBadge.vue';
	import type { TaskAction, TaskListItem, TaskStatus } from '~/types/tasks.types';
	import { ACTION_LABELS, DUE_TONE_CLASS, dueTone, primaryActions, taskDueText } from '~/utils/tasks.utils';

	/**
	 * Một dòng ở Việc của tôi: nút thao tác chính ngay trên dòng (Báo xong, Nghiệm thu…) để người
	 * không quen phần mềm khỏi phải mở khung chi tiết (UI-01). Màn 390 điểm ảnh xuống hai hàng.
	 */
	const props = defineProps<{
		task: TaskListItem;
		today: string;
		active?: boolean;
		/** Người đang xem ở góc nào: dòng việc người khác làm thì hiện tên người làm thay vì người giao. */
		showAssignee?: boolean;
		readOnly?: boolean;
		busy?: boolean;
		/** Khi tìm ở mọi ngăn: việc này nằm ở ngăn nào của người xem ("Tôi làm", "Tôi giao"…). */
		relation?: string;
	}>();

	const emit = defineEmits<{
		open: [];
		action: [action: TaskAction];
		status: [status: TaskStatus];
		changeDue: [];
		reassign: [];
	}>();

	const main = computed(() => (props.readOnly ? [] : primaryActions(props.task.allowedActions, 1)));
	const tone = computed(() => dueTone(props.task, props.today));
</script>

<template>
	<li
		class="flex flex-col gap-2 border-t border-gray-100 px-3 py-2.5 first:border-t-0 sm:flex-row sm:items-center sm:gap-3 dark:border-gray-800"
		:class="active ? 'bg-brand-50/60 dark:bg-brand-900/20' : ''"
		:data-task-code="task.code"
		data-tour="task-row"
	>
		<div class="flex min-w-0 flex-1 items-start gap-2">
			<TaskStatusBadge :status="task.status" :label="task.statusLabel" class="mt-0.5" />
			<div class="min-w-0 flex-1">
				<button
					type="button"
					class="block max-w-full text-left text-sm font-medium text-gray-900 hover:text-brand-600 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-gray-100 dark:hover:text-brand-400"
					@click="emit('open')"
				>
					<span class="mr-1 text-xs font-normal text-gray-500 dark:text-gray-400">{{ task.code }}</span>{{ task.title }}
				</button>
				<p class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
					<span
						v-if="relation"
						class="rounded bg-gray-100 px-1.5 font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
						data-testid="row-relation"
					>
						{{ relation }}
					</span>
					<span :class="DUE_TONE_CLASS[tone]">{{ taskDueText(task, today) }}</span>
					<TaskPriorityBadge :priority="task.priority" only-high />
					<span>{{ task.points == null ? 'Chưa có điểm' : `${task.points} điểm` }}</span>
					<span
						v-if="task.recurrenceId"
						class="rounded bg-teal-50 px-1 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
						data-testid="row-recurring"
					>
						Việc định kỳ
					</span>
					<span v-if="task.dependencies?.late" class="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400" data-testid="task-late-dot">
						<span class="h-1.5 w-1.5 rounded-full bg-rose-500" />phải chờ việc khác đang trễ hạn
					</span>
					<span v-if="task.project" class="truncate">{{ task.project.name }}</span>
					<span v-if="showAssignee">làm: {{ task.assignee.fullName }}</span>
					<span v-else-if="task.assigner.id !== task.assignee.id">giao: {{ task.assigner.fullName }}</span>
					<span v-if="task.checklist.total">kiểm tra {{ task.checklist.done }}/{{ task.checklist.total }}</span>
					<span v-if="task.commentCount">{{ task.commentCount }} bình luận</span>
				</p>
			</div>
		</div>
		<div class="flex items-center justify-end gap-1.5">
			<CommonAppButton
				v-for="a in main"
				:key="a"
				size="sm"
				:variant="a === 'accept' || a === 'submit' || a === 'self_close' ? 'primary' : 'outline'"
				:loading="busy"
				:data-testid="`row-action-${a}`"
				@click="emit('action', a)"
			>
				{{ ACTION_LABELS[a] }}
			</CommonAppButton>
			<CommonAppButton
				v-if="!readOnly && task.allowedActions.includes('accept')"
				size="sm"
				variant="danger_outline"
				data-testid="row-action-return"
				@click="emit('action', 'return')"
			>
				Trả lại
			</CommonAppButton>
			<TaskCardMenu
				v-if="!readOnly"
				:task="task"
				:primary-shown="main.length"
				@open="emit('open')"
				@status="s => emit('status', s)"
				@change-due="emit('changeDue')"
				@reassign="emit('reassign')"
			/>
		</div>
	</li>
</template>
