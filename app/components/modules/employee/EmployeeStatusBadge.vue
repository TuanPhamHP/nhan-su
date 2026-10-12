<script setup lang="ts">
import type { EmployeeStatus } from '~/types/employee.types';
import { formatDate } from '~/utils/date';

/**
 * `terminationDate` có ở cả EmployeeDetail (GET /v1/employees/:id, /me) và EmployeeSummary
 * (GET /v1/employees, BE bổ sung 12/10/2026). Vẫn để optional vì vài endpoint khác tái dùng
 * kiểu EmployeeSummary nhưng không trả field này — thiếu thì badge chỉ hiện "Đã nghỉ việc".
 */
const props = defineProps<{ status: EmployeeStatus; terminationDate?: string | null }>();

const config = computed(() => {
	const map: Record<EmployeeStatus, { label: string; cls: string }> = {
		ACTIVE: {
			label: 'Đang làm việc',
			cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
		},
		INACTIVE: {
			label: props.terminationDate ? `Đã nghỉ việc ${formatDate(props.terminationDate)}` : 'Đã nghỉ việc',
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
