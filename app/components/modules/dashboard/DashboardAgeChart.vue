<script setup lang="ts">
import { Bar } from 'vue-chartjs';
import {
	Chart as ChartJS,
	CategoryScale,
	LinearScale,
	BarElement,
	Tooltip,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const props = defineProps<{
	ageGroups: { range: string; count: number }[];
	averageAge: number | null;
	ageDataCoverage: number;
	totalEmployees: number;
}>();

const hasData = computed(() => props.ageDataCoverage > 0);
const lowCoverage = computed(() => props.ageDataCoverage < props.totalEmployees / 2);

const AGE_COLORS = ['#6366F1', '#8B5CF6', '#A855F7', '#EC4899', '#F97316'];

const chartData = computed(() => ({
	labels: props.ageGroups.map(g => g.range),
	datasets: [
		{
			data: props.ageGroups.map(g => g.count),
			backgroundColor: props.ageGroups.map((_, i) => AGE_COLORS[i % AGE_COLORS.length]),
			borderRadius: 6,
			borderSkipped: false,
		},
	],
}));

const chartOptions = {
	responsive: true,
	maintainAspectRatio: false,
	plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: { parsed: { y: number } }) => ` ${ctx.parsed.y} người` } } },
	scales: {
		y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.06)' } },
		x: { grid: { display: false } },
	},
};
</script>

<template>
	<div v-if="hasData" class="flex flex-col h-full gap-2">
		<div class="flex items-center justify-between text-xs">
			<span class="text-gray-500">Tuổi trung bình: <strong class="text-gray-800 dark:text-gray-200">{{ averageAge ?? '—' }}</strong></span>
			<span v-if="lowCoverage" class="text-amber-600 dark:text-amber-400">
				⚠️ {{ ageDataCoverage }}/{{ totalEmployees }} đã cập nhật
			</span>
		</div>
		<div class="relative flex-1">
			<Bar :data="chartData" :options="chartOptions" />
		</div>
	</div>
	<div v-else class="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
		<svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
			<path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
		</svg>
		<p class="text-sm text-center">Chưa có dữ liệu</p>
		<p class="text-xs text-center">HR cần cập nhật ngày sinh nhân viên</p>
		<NuxtLink to="/management/employees" class="text-xs text-brand-600 dark:text-brand-400 hover:underline mt-1">Cập nhật ngay →</NuxtLink>
	</div>
</template>
