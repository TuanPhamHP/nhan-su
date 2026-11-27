<script setup lang="ts">
	import type { TaskPriority } from '~/types/tasks.types';
	import { PRIORITY_LABELS, PRIORITY_TONE } from '~/utils/tasks.utils';

	/** Ưu tiên; trên thẻ bảng việc chỉ hiện khi Cao hoặc Gấp (`onlyHigh`). */
	const props = defineProps<{ priority: TaskPriority; onlyHigh?: boolean }>();

	const visible = computed(() => !props.onlyHigh || props.priority === 'HIGH' || props.priority === 'URGENT');
</script>

<template>
	<span
		v-if="visible"
		class="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset"
		:class="PRIORITY_TONE[props.priority].badge"
	>
		<Icon :name="PRIORITY_TONE[props.priority].icon" class="h-3.5 w-3.5" aria-hidden="true" />
		{{ PRIORITY_LABELS[props.priority] }}
	</span>
</template>
