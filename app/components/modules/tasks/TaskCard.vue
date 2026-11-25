<script setup lang="ts">
	import TaskCardMenu from '~/components/modules/tasks/TaskCardMenu.vue';
	import TaskPriorityBadge from '~/components/modules/tasks/TaskPriorityBadge.vue';
	import type { TaskListItem, TaskStatus } from '~/types/tasks.types';
	import { DUE_TONE_CLASS, dueTone, taskDueText } from '~/utils/tasks.utils';

	/**
	 * Thẻ trên bảng việc (mục 9.2): số hiệu, tiêu đề tối đa ba dòng, ảnh người thực hiện, hạn có màu,
	 * ưu tiên khi Cao hoặc Gấp, điểm, việc con và mục kiểm tra xong trên tổng, số bình luận, dấu "đã
	 * đổi hạn n lần". Không hiện mô tả. Tab tới được, Enter mở, chuột phải hay nút ba chấm mở menu.
	 */
	const props = defineProps<{
		task: TaskListItem;
		today: string;
		active?: boolean;
		reorder?: boolean;
	}>();

	const emit = defineEmits<{
		open: [];
		status: [status: TaskStatus];
		moveTop: [];
		moveBottom: [];
		changeDue: [];
		reassign: [];
	}>();

	const menuRef = ref<InstanceType<typeof TaskCardMenu> | null>(null);
	const tone = computed(() => dueTone(props.task, props.today));

	function onContextMenu(e: MouseEvent) {
		e.preventDefault();
		menuRef.value?.openAt(e.clientX, e.clientY);
	}
</script>

<template>
	<div
		:data-sortable-id="task.id"
		:data-task-code="task.code"
		tabindex="0"
		role="button"
		:aria-label="`${task.code} ${task.title}, ${task.statusLabel}, hạn ${taskDueText(task, today)}`"
		class="group cursor-pointer rounded-lg border bg-white p-3 shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-900"
		:class="active ? 'border-brand-500 ring-1 ring-brand-500' : 'border-gray-200 dark:border-gray-700'"
		@click="emit('open')"
		@keydown.enter.self.prevent="emit('open')"
		@contextmenu="onContextMenu"
	>
		<div class="flex items-start justify-between gap-2">
			<span class="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400">
				<span
					v-if="task.dependencies?.late"
					class="h-2 w-2 rounded-full bg-rose-500"
					title="Việc này đang chờ một việc bị trễ"
					data-testid="task-late-dot"
				/>
				{{ task.code }}
				<span v-if="task.recurrenceId" class="rounded bg-teal-50 px-1 font-normal text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">Định kỳ</span>
			</span>
			<TaskCardMenu
				ref="menuRef"
				:task="task"
				:reorder="reorder"
				compact
				@open="emit('open')"
				@status="s => emit('status', s)"
				@move-top="emit('moveTop')"
				@move-bottom="emit('moveBottom')"
				@change-due="emit('changeDue')"
				@reassign="emit('reassign')"
			/>
		</div>
		<p class="mt-1 line-clamp-3 text-sm font-medium text-gray-900 dark:text-gray-100">{{ task.title }}</p>
		<p v-if="task.parent" class="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">
			Việc con của {{ task.parent.title ?? task.parent.code }}
		</p>

		<div class="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
			<span :class="DUE_TONE_CLASS[tone]" class="inline-flex items-center gap-1">
				<Icon name="heroicons:calendar" class="h-3.5 w-3.5" aria-hidden="true" />
				{{ taskDueText(task, today) }}
			</span>
			<TaskPriorityBadge :priority="task.priority" only-high />
			<span class="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300" :title="`${task.points} điểm`">
				{{ task.points }} đ
			</span>
			<span v-if="task.subtasks.total" class="inline-flex items-center gap-0.5 text-gray-500 dark:text-gray-400" title="Việc con xong trên tổng">
				<Icon name="heroicons:rectangle-stack" class="h-3.5 w-3.5" aria-hidden="true" />
				{{ task.subtasks.done }}/{{ task.subtasks.total }}
			</span>
			<span v-if="task.checklist.total" class="inline-flex items-center gap-0.5 text-gray-500 dark:text-gray-400" title="Mục kiểm tra xong trên tổng">
				<Icon name="heroicons:check-circle" class="h-3.5 w-3.5" aria-hidden="true" />
				{{ task.checklist.done }}/{{ task.checklist.total }}
			</span>
			<span v-if="task.commentCount" class="inline-flex items-center gap-0.5 text-gray-500 dark:text-gray-400" title="Bình luận">
				<Icon name="heroicons:chat-bubble-left" class="h-3.5 w-3.5" aria-hidden="true" />
				{{ task.commentCount }}
			</span>
		</div>

		<div class="mt-2 flex items-center justify-between gap-2">
			<span class="flex flex-col text-[11px]">
				<span v-if="task.dueChangeCount" class="text-amber-700 dark:text-amber-400">đã đổi hạn {{ task.dueChangeCount }} lần</span>
				<span v-if="task.sprintMoveCount" class="text-orange-700 dark:text-orange-400" data-testid="task-sprint-moves">
					chuyển đợt {{ task.sprintMoveCount }} lần
				</span>
			</span>
			<CommonAppAvatar
				:src="task.assignee.avatarUrl"
				:name="task.assignee.fullName"
				size="xs"
				:title="`Người thực hiện: ${task.assignee.fullName}`"
			/>
		</div>
	</div>
</template>
