<script setup lang="ts">
	import TaskCard from '~/components/modules/tasks/TaskCard.vue';
	import type { SortableDropEvent } from '~/composables/useSortableList';
	import type { TaskListItem, TaskStatus } from '~/types/tasks.types';

	/**
	 * Một cột của bảng việc. Mỗi cột giữ một thể hiện SortableJS riêng (qua `useSortableList`), cùng
	 * nhóm với các cột khác nên kéo qua lại được.
	 *
	 * `blockedReason` có giá trị khi đang kéo một thẻ không thả được vào cột này: cột mờ đi và hiện
	 * câu lý do ngay trong cột (lấy từ `columnRules` của thẻ đang kéo).
	 */
	const props = defineProps<{
		status: TaskStatus;
		label: string;
		total: number;
		tasks: TaskListItem[];
		today: string;
		group: string;
		blockedReason: string | null;
		/** Đang kéo một thẻ từ chính cột này. */
		isSource: boolean;
		reorder: boolean;
		activeCode?: string | null;
		disabled?: boolean;
	}>();

	const emit = defineEmits<{
		dragStart: [id: number];
		dragEnd: [];
		drop: [event: SortableDropEvent];
		open: [task: TaskListItem];
		status: [task: TaskListItem, status: TaskStatus];
		moveTop: [task: TaskListItem];
		moveBottom: [task: TaskListItem];
		changeDue: [task: TaskListItem];
		reassign: [task: TaskListItem];
	}>();

	const listRef = ref<HTMLElement | null>(null);

	useSortableList(listRef, {
		group: props.group,
		disabled: () => !!props.disabled,
		onStart: id => emit('dragStart', id),
		onEnd: () => emit('dragEnd'),
		onDrop: e => emit('drop', e),
	});

	const HEADER_DOT: Record<TaskStatus, string> = {
		TODO: 'bg-gray-400',
		IN_PROGRESS: 'bg-sky-500',
		IN_REVIEW: 'bg-violet-500',
		DONE: 'bg-emerald-500',
		CANCELLED: 'bg-rose-400',
	};
</script>

<template>
	<section
		class="relative flex w-[85vw] max-w-[20rem] shrink-0 snap-start flex-col rounded-xl bg-gray-50 transition-opacity sm:w-64 2xl:w-72 dark:bg-gray-800/40"
		:class="blockedReason ? 'opacity-50' : ''"
		:aria-label="`Cột ${label}, ${total} việc`"
		:data-column="status"
	>
		<header class="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
			<h3 class="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
				<span class="h-2 w-2 rounded-full" :class="HEADER_DOT[status]" aria-hidden="true" />
				{{ label }}
			</h3>
			<span class="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-900 dark:text-gray-300">{{ total }}</span>
		</header>

		<p
			v-if="blockedReason"
			data-testid="column-blocked-reason"
			class="mx-3 mb-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs leading-snug text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300"
		>
			{{ blockedReason }}
		</p>

		<div
			ref="listRef"
			:data-sortable-zone="status"
			class="flex min-h-[4rem] flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3"
		>
			<TaskCard
				v-for="t in tasks"
				:key="t.id"
				:task="t"
				:today="today"
				:active="activeCode === t.code"
				:reorder="reorder"
				@open="emit('open', t)"
				@status="s => emit('status', t, s)"
				@move-top="emit('moveTop', t)"
				@move-bottom="emit('moveBottom', t)"
				@change-due="emit('changeDue', t)"
				@reassign="emit('reassign', t)"
			/>
			<p v-if="!tasks.length && !isSource" class="py-4 text-center text-xs text-gray-400 dark:text-gray-500" data-no-drag>
				Chưa có việc
			</p>
			<slot name="footer" />
		</div>
	</section>
</template>
