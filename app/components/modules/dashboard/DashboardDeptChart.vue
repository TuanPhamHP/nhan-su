<script setup lang="ts">
import { Bar } from 'vue-chartjs';
import {
	Chart as ChartJS,
	CategoryScale,
	LinearScale,
	BarElement,
	Tooltip,
	Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const props = defineProps<{
	data: { departmentId: number; departmentName: string; count: number }[];
}>();

const PALETTE = ['#6366F1', '#8B5CF6', '#EC4899', '#F97316', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#14B8A6', '#A855F7'];

const chartData = computed(() => ({
	labels: props.data.map(d => d.departmentName),
	datasets: [
		{
			label: 'Nhân viên',
			data: props.data.map(d => d.count),
			backgroundColor: props.data.map((_, i) => PALETTE[i % PALETTE.length]),
			borderRadius: 6,
			borderSkipped: false,
		},
	],
}));

const chartOptions = {
	indexAxis: 'y' as const,
	responsive: true,
	maintainAspectRatio: false,
	plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: { parsed: { x: number } }) => ` ${ctx.parsed.x} nhân viên` } } },
	scales: {
		x: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.05)' } },
		y: { grid: { display: false }, ticks: { font: { size: 11 } } },
	},
};
</script>

<template>
	<div v-if="data.length" class="relative h-full">
		<Bar :data="chartData" :options="chartOptions" />
	</div>
	<div v-else class="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
		<svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
			<path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
		</svg>
		<p class="text-sm">Chưa có dữ liệu phòng ban</p>
	</div>
</template>
