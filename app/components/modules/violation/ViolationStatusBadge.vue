<script setup lang="ts">
	import type { ViolationRequestStatus } from '~/types/violation.types';

	defineProps<{ status: ViolationRequestStatus }>();

	const labelMap: Record<ViolationRequestStatus, string> = {
		PENDING: 'Chờ duyệt',
		APPROVED: 'Đã duyệt',
		REJECTED: 'Từ chối',
		CANCELLED: 'Đã thu hồi',
	};

	const classMap: Record<ViolationRequestStatus, string> = {
		PENDING: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
		APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
		REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
		CANCELLED: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
	};
</script>

<template>
	<span :class="['inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', classMap[status]]">
		{{ labelMap[status] }}
	</span>
</template>
