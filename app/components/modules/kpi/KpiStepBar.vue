<script setup lang="ts">
	import type { KpiReviewStatus } from '~/types/kpi.types';
	import { KPI_STATUS_LABELS, KPI_STEP_SHORT, KPI_STEPS } from '~/utils/kpi.utils';

	/**
	 * Thanh năm bước của phiếu (ui-research mục 11): bước đã qua có dấu tích, bước hiện tại tô màu và
	 * kèm hạn của bước nếu có. Màn hẹp dùng nhãn ngắn.
	 */
	const props = defineProps<{ status: KpiReviewStatus; dueText?: string | null }>();
	const current = computed(() => KPI_STEPS.indexOf(props.status));
</script>

<template>
	<ol class="flex w-full items-start gap-1" :aria-label="`Bước hiện tại: ${KPI_STATUS_LABELS[status]}`" data-testid="kpi-steps">
		<li v-for="(s, i) in KPI_STEPS" :key="s" class="min-w-0 flex-1" :aria-current="i === current ? 'step' : undefined">
			<div
				class="h-1.5 rounded-full"
				:class="i < current ? 'bg-brand-500' : i === current ? (s === 'PUBLISHED' ? 'bg-emerald-500' : 'bg-brand-600') : 'bg-gray-200 dark:bg-gray-700'"
			/>
			<p
				class="mt-1 truncate text-[11px] sm:text-xs"
				:class="i === current ? 'font-semibold text-gray-900 dark:text-white' : i < current ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400'"
			>
				<Icon v-if="i < current" name="heroicons:check" class="-mt-0.5 mr-0.5 inline h-3 w-3" aria-hidden="true" />
				<span class="sm:hidden">{{ KPI_STEP_SHORT[s] }}</span>
				<span class="hidden sm:inline">{{ KPI_STATUS_LABELS[s] }}</span>
			</p>
			<p v-if="i === current && dueText" class="truncate text-[11px] text-amber-700 dark:text-amber-400">{{ dueText }}</p>
		</li>
	</ol>
</template>
