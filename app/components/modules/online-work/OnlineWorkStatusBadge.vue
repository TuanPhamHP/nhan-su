<script setup lang="ts">
import type { OnlineWorkStatus } from '~/types/online-work-request.types';

const props = defineProps<{
	status: OnlineWorkStatus;
	rejectLevel?: number | null;
}>();

interface BadgeConfig {
	label: string;
	cls: string;
}

const config: Record<OnlineWorkStatus, BadgeConfig> = {
	PENDING_L1: {
		label: 'Chờ cấp 1',
		cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
	},
	PENDING_L2: {
		label: 'Chờ cấp 2',
		cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
	},
	PENDING_L3: {
		label: 'Chờ Giám đốc',
		cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
	},
	COMPLETED: {
		label: 'Hoàn thành',
		cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
	},
	REJECTED: {
		label: '',
		cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
	},
	CANCELLED: {
		label: 'Đã huỷ',
		cls: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
	},
};

const badge = computed(() => {
	const base = config[props.status];
	if (props.status === 'REJECTED') {
		const levelText = props.rejectLevel ? ` (cấp ${props.rejectLevel})` : '';
		return { ...base, label: `Từ chối${levelText}` };
	}
	return base;
});
</script>

<template>
	<span :class="['inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', badge.cls]">
		{{ badge.label }}
	</span>
</template>
