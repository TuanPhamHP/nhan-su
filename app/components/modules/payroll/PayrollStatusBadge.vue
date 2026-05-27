<script setup lang="ts">
import type { PayrollStatus } from '~/types/payroll.types';

const props = defineProps<{ status: PayrollStatus }>();

const config = computed(() => {
	const map: Record<PayrollStatus, { label: string; class: string }> = {
		DRAFT: { label: 'Nháp', class: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
		PUBLISHED: { label: 'Đã phát hành', class: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
	};
	return map[props.status] ?? { label: props.status, class: 'bg-gray-100 text-gray-600' };
});
</script>

<template>
	<span :class="['inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', config.class]">
		{{ config.label }}
	</span>
</template>
