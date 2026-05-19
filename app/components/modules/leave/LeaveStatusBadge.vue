<script setup lang="ts">
import type { LeaveStatus } from '~/types/leave.types';

const props = defineProps<{ status: LeaveStatus }>();

const config = computed(() => {
	const map: Record<LeaveStatus, { label: string; class: string }> = {
		PENDING:   { label: 'Chờ duyệt', class: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
		APPROVED:  { label: 'Đã duyệt',  class: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
		REJECTED:  { label: 'Từ chối',   class: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
		CANCELLED: { label: 'Đã thu hồi', class: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
	};
	return map[props.status] ?? { label: props.status, class: 'bg-gray-100 text-gray-600' };
});
</script>

<template>
	<span :class="['inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', config.class]">
		{{ config.label }}
	</span>
</template>
