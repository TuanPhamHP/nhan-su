<script setup lang="ts">
import type { OvertimeStatus } from '~/types/overtime.types';

const props = defineProps<{ status: OvertimeStatus }>();

const config: Record<OvertimeStatus, { label: string; class: string }> = {
	PENDING: {
		label: 'Chờ duyệt',
		class: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
	},
	APPROVED: {
		label: 'Đã duyệt',
		class: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
	},
	REJECTED: {
		label: 'Từ chối',
		class: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
	},
	CANCELLED: {
		label: 'Đã thu hồi',
		class: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
	},
	AUTO_CANCELLED: {
		label: 'Hết hạn',
		class: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
	},
};

const badge = computed(() => config[props.status]);
</script>

<template>
	<span :class="['inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', badge.class]">
		{{ badge.label }}
	</span>
</template>
