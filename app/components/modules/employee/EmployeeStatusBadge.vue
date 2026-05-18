<script setup lang="ts">
import type { EmployeeStatus } from '~/types/employee.types';

const props = defineProps<{ status: EmployeeStatus }>();

const config = computed(() => {
	const map: Record<EmployeeStatus, { label: string; cls: string }> = {
		ACTIVE: {
			label: 'Đang làm việc',
			cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
		},
		INACTIVE: {
			label: 'Nghỉ việc',
			cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
		},
		ON_LEAVE: {
			label: 'Đang nghỉ phép',
			cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
		},
	};
	return map[props.status];
});
</script>

<template>
	<span :class="['inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', config.cls]">
		{{ config.label }}
	</span>
</template>
