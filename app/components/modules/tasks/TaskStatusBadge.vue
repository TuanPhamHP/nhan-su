<script setup lang="ts">
	import type { TaskStatus } from '~/types/tasks.types';
	import { STATUS_LABELS, STATUS_TONE } from '~/utils/tasks.utils';

	/** Nhãn trạng thái việc; chữ lấy từ máy chủ (`statusLabel`) khi có. */
	const props = defineProps<{ status: TaskStatus; label?: string }>();
</script>

<template>
	<span
		class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
		:class="STATUS_TONE[props.status].badge"
	>
		<Icon v-if="props.status === 'DONE'" name="heroicons:check" class="h-3 w-3" aria-hidden="true" />
		<span v-else class="h-1.5 w-1.5 shrink-0 rounded-full" :class="STATUS_TONE[props.status].dot" aria-hidden="true" />
		{{ props.label ?? STATUS_LABELS[props.status] }}
	</span>
</template>
