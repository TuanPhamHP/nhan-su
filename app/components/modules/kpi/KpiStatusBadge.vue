<script setup lang="ts">
	import type { KpiReviewStatus } from '~/types/kpi.types';
	import { KPI_STATUS_CLASS, KPI_STATUS_LABELS } from '~/utils/kpi.utils';

	/** Nhãn bước của phiếu KPI; chữ lấy từ máy chủ (`statusLabel`) khi có. */
	const props = defineProps<{ status: KpiReviewStatus; label?: string }>();
</script>

<template>
	<span class="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium" :class="KPI_STATUS_CLASS[props.status]">
		{{ props.label ?? KPI_STATUS_LABELS[props.status] }}
	</span>
</template>
