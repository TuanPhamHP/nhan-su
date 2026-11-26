<script setup lang="ts">
	import type { TaskStatus } from '~/types/tasks.types';
	import { STATUS_LABELS } from '~/utils/tasks.utils';

	/** Nhãn trạng thái việc; chữ lấy từ máy chủ (`statusLabel`) khi có. */
	const props = defineProps<{ status: TaskStatus; label?: string }>();

	const CLASS: Record<TaskStatus, string> = {
		TODO: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
		IN_PROGRESS: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
		IN_REVIEW: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
		DONE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
		CANCELLED: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
	};
</script>

<template>
	<span
		class="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
		:class="CLASS[props.status]"
	>
		{{ props.label ?? STATUS_LABELS[props.status] }}
	</span>
</template>
