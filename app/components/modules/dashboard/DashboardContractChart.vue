<script setup lang="ts">
import { Doughnut } from 'vue-chartjs';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

type ContractType = 'PROBATION' | 'FIXED_TERM' | 'INDEFINITE' | 'SEASONAL';

const props = defineProps<{
	data: { contractType: ContractType; count: number }[];
}>();

const CONTRACT_LABEL: Record<ContractType, string> = {
	PROBATION: 'Thử việc',
	FIXED_TERM: 'Có thời hạn',
	INDEFINITE: 'Không xác định',
	SEASONAL: 'Thời vụ',
};

const CONTRACT_COLOR: Record<ContractType, string> = {
	PROBATION: '#F97316',
	FIXED_TERM: '#6366F1',
	INDEFINITE: '#A855F7',
	SEASONAL: '#F59E0B',
};

const totalContracts = computed(() => props.data.reduce((s, d) => s + d.count, 0));

const chartData = computed(() => ({
	labels: props.data.map(d => CONTRACT_LABEL[d.contractType]),
	datasets: [
		{
			data: props.data.map(d => d.count),
			backgroundColor: props.data.map(d => CONTRACT_COLOR[d.contractType]),
			borderWidth: 2,
			borderColor: 'transparent',
			hoverBorderColor: '#fff',
		},
	],
}));

const chartOptions = {
	responsive: true,
	maintainAspectRatio: false,
	cutout: '68%',
	plugins: {
		legend: { position: 'bottom' as const, labels: { padding: 12, font: { size: 11 } } },
		tooltip: { callbacks: { label: (ctx: { label: string; parsed: number }) => ` ${ctx.label}: ${ctx.parsed}` } },
	},
};
</script>

<template>
	<div v-if="data.length" class="flex flex-col items-center h-full">
		<div class="relative flex-1 w-full">
			<Doughnut :data="chartData" :options="chartOptions" />
			<div class="absolute inset-0 flex items-center justify-center pointer-events-none" style="padding-bottom: 32px">
				<div class="text-center">
					<p class="text-2xl font-bold text-gray-800 dark:text-gray-100">{{ totalContracts }}</p>
					<p class="text-xs text-gray-500">hợp đồng</p>
				</div>
			</div>
		</div>
	</div>
	<div v-else class="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
		<svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
			<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
		</svg>
		<p class="text-sm">Chưa có hợp đồng</p>
		<NuxtLink to="/management/contracts" class="text-xs text-brand-600 dark:text-brand-400 hover:underline">Tạo hợp đồng →</NuxtLink>
	</div>
</template>
