<script setup lang="ts">
	import type { TaskPriority } from '~/types/tasks.types';
	import { PRIORITY_LABELS } from '~/utils/tasks.utils';

	/** Ưu tiên; trên thẻ bảng việc chỉ hiện khi Cao hoặc Gấp (`onlyHigh`). */
	const props = defineProps<{ priority: TaskPriority; onlyHigh?: boolean }>();

	const CLASS: Record<TaskPriority, string> = {
		LOW: 'text-gray-500 dark:text-gray-400',
		NORMAL: 'text-gray-600 dark:text-gray-300',
		HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
		URGENT: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
	};

	const visible = computed(() => !props.onlyHigh || props.priority === 'HIGH' || props.priority === 'URGENT');
</script>

<template>
	<span
		v-if="visible"
		class="inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium"
		:class="CLASS[props.priority]"
	>
		{{ PRIORITY_LABELS[props.priority] }}
	</span>
</template>
