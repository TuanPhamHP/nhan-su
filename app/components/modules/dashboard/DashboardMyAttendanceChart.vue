<script setup lang="ts">
	import { computed, onMounted, ref, watch } from 'vue';
	import { Doughnut } from 'vue-chartjs';
	import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js';
	import type { EmployeeMonthlyReportResponse } from '~/types/reports-me.types';
	import { useMyReport } from '~/composables/useMyReport';

	ChartJS.register(ArcElement, Tooltip);

	const { fetchMyMonthlyReport } = useMyReport();
	const toast = useToast();

	const now = new Date();
	const currentMonth = ref(now.getMonth() + 1);
	const currentYear = ref(now.getFullYear());
	const loading = ref(true);
	const report = ref<EmployeeMonthlyReportResponse | null>(null);

	async function loadReport() {
		loading.value = true;
		try {
			report.value = await fetchMyMonthlyReport({
				month: currentMonth.value,
				year: currentYear.value,
			});
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Không tải được dữ liệu báo cáo công';
			toast.error(msg);
		} finally {
			loading.value = false;
		}
	}

	function prevMonth() {
		if (currentMonth.value === 1) {
			currentMonth.value = 12;
			currentYear.value--;
		} else {
			currentMonth.value--;
		}
		loadReport();
	}

	function nextMonth() {
		if (currentMonth.value === 12) {
			currentMonth.value = 1;
			currentYear.value++;
		} else {
			currentMonth.value++;
		}
		loadReport();
	}

	const slices = computed(() => {
		if (!report.value) return [];
		const att = report.value.attendance;
		const normalWorkDays = Math.max(att.actualWorkDays - att.businessTripDays, 0);

		return [
			{
				key: 'ACTUAL',
				label: 'Đã làm việc thực tế',
				count: normalWorkDays,
				color: '#3B82F6', // blue-500
			},
			{
				key: 'TRIP',
				label: 'Đã đi công tác',
				count: att.businessTripDays,
				color: '#8B5CF6', // purple-500
			},
			{
				key: 'ANNUAL',
				label: 'Đã nghỉ phép năm',
				count: att.annualLeaveDays,
				color: '#10B981', // emerald-500
			},
			{
				key: 'HOLIDAY',
				label: 'Đã nghỉ lễ / chế độ',
				count: att.publicHolidayDays + att.welfareLeaveDays,
				color: '#F59E0B', // amber-500
			},
		];
	});

	const totalPayrollDays = computed(() => report.value?.attendance.totalPayrollDays ?? 0);
	const workingDays = computed(() => report.value?.attendance.workingDays ?? 0);

	const progressPercentage = computed(() => {
		if (!workingDays.value) return 0;
		return Math.min(Math.round((totalPayrollDays.value / workingDays.value) * 100), 100);
	});

	const chartData = computed(() => {
		const items = slices.value;
		const total = items.reduce((sum, item) => sum + item.count, 0);

		if (total === 0) {
			return {
				labels: ['Chưa có dữ liệu'],
				datasets: [
					{
						data: [1],
						backgroundColor: ['#E5E7EB'],
						borderWidth: 0,
					},
				],
			};
		}

		return {
			labels: items.map(item => item.label),
			datasets: [
				{
					data: items.map(item => item.count),
					backgroundColor: items.map(item => item.color),
					borderWidth: 2,
					borderColor: 'transparent',
					hoverBorderColor: '#fff',
				},
			],
		};
	});

	const chartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		cutout: '72%',
		plugins: {
			legend: { display: false },
			tooltip: {
				callbacks: {
					label: (ctx: { label: string; parsed: number }) => ` ${ctx.label}: ${ctx.parsed} ngày`,
				},
			},
		},
	};

	onMounted(loadReport);
</script>

<template>
	<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-xs flex flex-col h-full">
		<!-- Card Header with Month Navigation -->
		<div class="flex items-center justify-between gap-2 mb-4">
			<div>
				<h3 class="font-bold text-gray-900 dark:text-white text-base">Phân rã ngày công</h3>
				<p class="text-xs text-gray-500 dark:text-gray-400">
					Báo cáo cá nhân tháng {{ currentMonth }}/{{ currentYear }}
				</p>
			</div>

			<!-- Quick switch month -->
			<div class="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
				<button
					type="button"
					class="w-7 h-7 flex items-center justify-center rounded hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
					title="Tháng trước"
					@click="prevMonth"
				>
					<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
					</svg>
				</button>
				<span class="text-xs font-semibold px-1.5 text-gray-700 dark:text-gray-200">
					T{{ currentMonth }}
				</span>
				<button
					type="button"
					class="w-7 h-7 flex items-center justify-center rounded hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
					title="Tháng sau"
					@click="nextMonth"
				>
					<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
					</svg>
				</button>
			</div>
		</div>

		<!-- Loading state -->
		<div v-if="loading" class="flex-1 flex items-center justify-center min-h-[220px]">
			<svg class="animate-spin w-7 h-7 text-brand-500" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
			</svg>
		</div>

		<!-- Chart Content -->
		<template v-else-if="report">
			<!-- Doughnut Chart -->
			<div class="relative flex-1 min-h-[180px] py-2">
				<Doughnut :data="chartData" :options="chartOptions" />
				<!-- Center Badge -->
				<div class="absolute inset-0 flex items-center justify-center pointer-events-none">
					<div class="text-center">
						<p class="text-2xl font-extrabold text-gray-900 dark:text-white">
							{{ totalPayrollDays }}
						</p>
						<p class="text-[11px] text-gray-400 font-medium">/ {{ workingDays }} ngày</p>
						<p class="text-[10px] text-blue-600 dark:text-blue-400 font-semibold mt-0.5">
							{{ progressPercentage }}%
						</p>
					</div>
				</div>
			</div>

			<!-- Legend -->
			<div class="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs">
				<div
					v-for="item in slices"
					:key="item.key"
					class="flex items-center justify-between px-2 py-1 rounded bg-gray-50 dark:bg-gray-800/50"
				>
					<div class="flex items-center gap-1.5 min-w-0">
						<span class="w-2.5 h-2.5 rounded-sm flex-shrink-0" :style="{ backgroundColor: item.color }" />
						<span class="text-gray-600 dark:text-gray-400 truncate">{{ item.label }}</span>
					</div>
					<span class="font-bold text-gray-900 dark:text-gray-100 ml-1">{{ item.count }}</span>
				</div>
			</div>

			<!-- Quick Stats & Link -->
			<div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs">
				<div class="flex items-center gap-3">
					<div>
						<span class="text-gray-400">OT:</span>
						<span class="font-semibold text-gray-800 dark:text-gray-200 ml-1">{{ report.overtime.totalHours }}h</span>
					</div>
					<div>
						<span class="text-gray-400">Vi phạm:</span>
						<span
							class="font-semibold ml-1"
							:class="report.violations.totalCount > 0 ? 'text-amber-600' : 'text-emerald-600'"
						>
							{{ report.violations.totalCount }}
						</span>
					</div>
				</div>
				<NuxtLink
					to="/attendance/my"
					class="font-semibold text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-0.5"
				>
					Chi tiết →
				</NuxtLink>
			</div>
		</template>

		<!-- Empty / Error state -->
		<div v-else class="flex-1 flex flex-col items-center justify-center text-center text-gray-400 min-h-[200px]">
			<p class="text-2xl mb-1">📊</p>
			<p class="text-xs">Chưa có dữ liệu báo cáo</p>
		</div>
	</div>
</template>
