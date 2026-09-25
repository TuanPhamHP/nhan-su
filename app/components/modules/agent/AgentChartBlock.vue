<script setup lang="ts">
	import { Bar, Line, Doughnut } from 'vue-chartjs';
	import {
		Chart as ChartJS,
		CategoryScale,
		LinearScale,
		BarElement,
		PointElement,
		LineElement,
		ArcElement,
		Tooltip,
		Legend,
	} from 'chart.js';
	import type { AgentChart } from '~/types/agent.types';

	ChartJS.register(
		CategoryScale,
		LinearScale,
		BarElement,
		PointElement,
		LineElement,
		ArcElement,
		Tooltip,
		Legend,
	);

	const props = defineProps<{ chart: AgentChart }>();

	const PALETTE = [
		'#6366F1',
		'#F97316',
		'#10B981',
		'#EC4899',
		'#0EA5E9',
		'#F59E0B',
		'#8B5CF6',
		'#EF4444',
	];

	/**
	 * Vẽ ĐÚNG những gì server gửi. Không cộng, không làm tròn, không suy ra số nào.
	 *
	 * Số liệu do tool ở backend dựng từ dữ liệu thật; nếu FE tự tính thêm thì con số trên
	 * hình sẽ khác con số trong câu trả lời, mà người xem không có cách nào biết bên nào đúng.
	 */
	const chartData = computed(() => {
		const c = props.chart;
		if (c.type === 'donut') {
			return {
				labels: c.labels,
				datasets: [
					{
						label: c.series[0]?.name ?? '',
						data: c.series[0]?.data ?? [],
						backgroundColor: c.labels.map((_, i) => PALETTE[i % PALETTE.length]),
						borderWidth: 0,
					},
				],
			};
		}
		return {
			labels: c.labels,
			datasets: c.series.map((s, i) => ({
				label: s.name,
				data: s.data,
				backgroundColor: PALETTE[i % PALETTE.length],
				borderColor: PALETTE[i % PALETTE.length],
				borderRadius: c.type === 'bar' ? 4 : 0,
				borderSkipped: false,
				tension: 0.3,
			})),
		};
	});

	const unitSuffix = computed(() => (props.chart.unit ? ` ${props.chart.unit}` : ''));

	/**
	 * Rút gọn nhãn CHỈ để hiển thị trên trục — dữ liệu giữ nguyên, tooltip vẫn hiện đủ.
	 *
	 * Tên người Việt thường 3-4 chữ, xếp cạnh nhau trên khung chat hẹp là chồng chữ và
	 * tràn mép phải trên điện thoại. Lấy hai chữ cuối là cách gọi quen thuộc nhất
	 * ("Lê Thị Hằng Phương" → "Hằng Phương"). Nhãn không phải tên (ngày, tháng) thường
	 * đã ngắn nên không bị đụng tới.
	 */
	const MAX_TICK_CHARS = 14;
	function shortLabel(full: string): string {
		if (full.length <= MAX_TICK_CHARS) return full;
		const parts = full.trim().split(/\s+/);
		if (parts.length >= 2) {
			const tail = parts.slice(-2).join(' ');
			if (tail.length <= MAX_TICK_CHARS) return tail;
		}
		return full.slice(0, MAX_TICK_CHARS - 1) + '…';
	}

	const options = computed(() => ({
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			// Một chuỗi thì chú giải chỉ lặp lại tiêu đề — bỏ đi cho đỡ chật trong khung chat.
			legend: {
				display: props.chart.type === 'donut' || props.chart.series.length > 1,
				position: 'bottom' as const,
				labels: { boxWidth: 12, font: { size: 11 } },
			},
			tooltip: {
				callbacks: {
					// Tooltip luôn hiện nhãn ĐẦY ĐỦ, kể cả khi trục đã rút gọn.
					title: (items: { dataIndex: number }[]) =>
						props.chart.labels[items[0]?.dataIndex ?? 0] ?? '',
					label: (item: { label?: string; formattedValue: string; dataset: { label?: string } }) =>
						`${props.chart.type === 'donut' ? item.label : (item.dataset.label ?? '')}: ${item.formattedValue}${unitSuffix.value}`,
				},
			},
		},
		...(props.chart.type === 'donut'
			? {}
			: {
					scales: {
						x: {
							ticks: {
								font: { size: 10 },
								maxRotation: 45,
								minRotation: 0,
								autoSkip: false,
								callback(_v: unknown, i: number) {
									return shortLabel(props.chart.labels[i] ?? '');
								},
							},
							grid: { display: false },
						},
						y: { beginAtZero: true, ticks: { font: { size: 10 }, precision: 0 } },
					},
				}),
	}));
</script>

<template>
	<!--
		`w-full min-w-0`: cột chat dùng items-start nên figure co giãn theo NỘI DUNG, mà
		canvas của chart.js lại giữ kích thước lần vẽ trước — thành vòng lặp tự nuôi và
		biểu đồ lố ra ngoài mép phải 9px trên iPhone 13. Ép theo bề rộng cột thì canvas
		mới có mốc để co lại.
	-->
	<figure
		class="mt-3 w-full min-w-0 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
	>
		<figcaption class="mb-2">
			<p class="text-xs font-semibold text-gray-800 dark:text-gray-100">{{ chart.title }}</p>
			<p v-if="chart.source" class="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
				{{ chart.source }}
			</p>
		</figcaption>

		<div class="h-56 sm:h-64">
			<Doughnut v-if="chart.type === 'donut'" :data="chartData" :options="options" />
			<Line v-else-if="chart.type === 'line'" :data="chartData" :options="options" />
			<Bar v-else :data="chartData" :options="options" />
		</div>
	</figure>
</template>
