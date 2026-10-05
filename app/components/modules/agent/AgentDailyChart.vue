<script setup lang="ts">
	import { Bar } from 'vue-chartjs';
	import {
		Chart as ChartJS,
		BarElement,
		CategoryScale,
		LinearScale,
		Legend,
		Tooltip,
		type Chart,
		type ChartData,
		type ChartOptions,
		type Plugin,
		type TooltipItem,
	} from 'chart.js';
	import type { AgentUsagePoint } from '~/types/agent-analytics.types';
	import { formatDate } from '~/utils/date';

	ChartJS.register(BarElement, CategoryScale, LinearScale, Legend, Tooltip);

	const props = defineProps<{
		daily: AgentUsagePoint[];
		/** Hai đầu khoảng đang lọc — để ngày không ai hỏi vẫn chiếm chỗ trên trục. */
		from?: string;
		to?: string;
	}>();

	const { isDark } = useColorMode();

	type MetricKey = 'tokens' | 'requests' | 'cost';

	const METRICS: { key: MetricKey; label: string; suffix: string }[] = [
		{ key: 'tokens', label: 'Token', suffix: ' token/ngày' },
		{ key: 'requests', label: 'Lượt hỏi', suffix: ' lượt/ngày' },
		{ key: 'cost', label: 'Chi phí', suffix: '/ngày' },
	];

	const metric = ref<MetricKey>('tokens');
	const asTable = ref(false);

	const DAY_MS = 86400000;

	const blankDay = (bucket: string): AgentUsagePoint => ({
		bucket,
		promptTokens: 0,
		completionTokens: 0,
		cachedPromptTokens: 0,
		costUsd: 0,
		requests: 0,
	});

	/**
	 * Điền ngày trống trước khi vẽ.
	 *
	 * Backend chỉ trả về những ngày có phát sinh. Vẽ thẳng mảng đó thì hai ngày cách
	 * nhau cả tuần vẫn đứng sát nhau như hai ngày liền kề — trục hoá ra nói dối. Mà
	 * "mấy hôm liền không ai hỏi" lại đúng là thứ người xem cần thấy.
	 */
	const series = computed<AgentUsagePoint[]>(() => {
		const byDay = new Map(props.daily.map((d) => [d.bucket, d]));
		const start = Date.parse(`${props.from ?? props.daily[0]?.bucket ?? ''}T00:00:00Z`);
		const lastBucket = props.daily[props.daily.length - 1]?.bucket;
		const end = Date.parse(`${props.to ?? lastBucket ?? ''}T00:00:00Z`);

		// from/to hỏng, đảo chiều, hay rộng vô lý thì vẽ nguyên mảng gốc còn hơn vẽ khung rỗng
		if (!Number.isFinite(start) || !Number.isFinite(end)) return props.daily;
		if (end < start || (end - start) / DAY_MS > 400) return props.daily;

		const out: AgentUsagePoint[] = [];
		for (let t = start; t <= end; t += DAY_MS) {
			const key = new Date(t).toISOString().slice(0, 10);
			out.push(byDay.get(key) ?? blankDay(key));
		}
		return out;
	});

	const pick = (d: AgentUsagePoint, m: MetricKey) =>
		m === 'tokens'
			? d.promptTokens + d.completionTokens
			: m === 'requests'
				? d.requests
				: d.costUsd;

	const values = computed(() => series.value.map((d) => pick(d, metric.value)));
	const totalValue = computed(() => values.value.reduce((s, v) => s + v, 0));
	const avgValue = computed(() => (series.value.length ? totalValue.value / series.value.length : 0));
	const peakIndex = computed(() =>
		values.value.reduce((best, v, i) => (v > (values.value[best] ?? 0) ? i : best), 0),
	);
	const peakDay = computed(() => series.value[peakIndex.value]);

	const nf = new Intl.NumberFormat('vi-VN');
	const nf1 = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
	/** Chi phí ở đây thường dưới 1 cent nên cần 4 chữ số lẻ; số 0 thì để trần cho đỡ rác. */
	const fmtUsd = (n: number) => (n === 0 ? '$0' : '$' + n.toFixed(n < 1 ? 4 : 2));
	const fmtValue = (n: number) => (metric.value === 'cost' ? fmtUsd(n) : nf.format(Math.round(n)));
	const avgLabel = computed(
		() => fmtValue(avgValue.value) + (METRICS.find((m) => m.key === metric.value)?.suffix ?? ''),
	);

	/** Nhãn vạch trục: rút gọn K/M để 5 vạch không chen nhau. */
	const fmtAxis = (n: number) => {
		if (metric.value === 'cost') return fmtUsd(n);
		if (n >= 1e6) return nf1.format(n / 1e6) + 'M';
		if (n >= 1e4) return nf.format(Math.round(n / 1e3)) + 'K';
		return nf.format(n);
	};

	/**
	 * Hai sắc của đúng một màu thương hiệu, chọn riêng cho nền sáng và nền tối.
	 *
	 * Không lật ngược bảng màu sáng cho dark mode: brand-400 trên nền trắng mới đủ
	 * tương phản, còn trên nền gray-800 thì brand-300 mới đọc được.
	 */
	const palette = computed(() =>
		isDark.value
			? {
					main: '#489d6f',
					mainHover: '#76b593',
					soft: '#a3ceb7',
					softHover: '#cae3d5',
					surface: '#1f2937',
					grid: 'rgba(148, 163, 184, 0.2)',
					tick: '#9ca3af',
					guide: '#9ca3af',
				}
			: {
					main: '#0e7e42',
					mainHover: '#489d6f',
					soft: '#76b593',
					softHover: '#a3ceb7',
					surface: '#ffffff',
					grid: 'rgba(15, 23, 42, 0.08)',
					tick: '#6b7280',
					guide: '#94a3b8',
				},
	);

	const labels = computed(() => series.value.map((d) => d.bucket.slice(8, 10) + '/' + d.bucket.slice(5, 7)));

	const chartData = computed<ChartData<'bar'>>(() => {
		const c = palette.value;
		const bar = { maxBarThickness: 24, borderSkipped: false as const };
		const cap = { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 };

		if (metric.value === 'tokens') {
			return {
				labels: labels.value,
				datasets: [
					{
						...bar,
						label: 'Token vào',
						data: series.value.map((d) => d.promptTokens),
						backgroundColor: c.main,
						hoverBackgroundColor: c.mainHover,
						// Viền trên màu nền = khe 2px tách hai lớp chồng, không phải nét kẻ quanh cột
						borderColor: c.surface,
						borderWidth: { top: 2, right: 0, bottom: 0, left: 0 },
					},
					{
						...bar,
						label: 'Token ra',
						data: series.value.map((d) => d.completionTokens),
						backgroundColor: c.soft,
						hoverBackgroundColor: c.softHover,
						borderRadius: cap,
					},
				],
			};
		}

		return {
			labels: labels.value,
			datasets: [
				{
					...bar,
					label: metric.value === 'requests' ? 'Lượt hỏi' : 'Chi phí',
					data: values.value,
					backgroundColor: c.main,
					hoverBackgroundColor: c.mainHover,
					borderRadius: cap,
				},
			],
		};
	});

	const options = computed<ChartOptions<'bar'>>(() => {
		const c = palette.value;
		const stacked = metric.value === 'tokens';

		return {
			responsive: true,
			maintainAspectRatio: false,
			animation: { duration: 200 },
			layout: { padding: { top: 18 } },
			// Trỏ vào đâu trong cột cũng ra tooltip — không bắt người ta nhắm đúng cây cột
			interaction: { mode: 'index', intersect: false },
			plugins: {
				legend: {
					display: stacked,
					position: 'bottom',
					align: 'start',
					labels: {
						boxWidth: 10,
						boxHeight: 10,
						padding: 14,
						color: c.tick,
						font: { size: 11 },
					},
				},
				tooltip: {
					backgroundColor: isDark.value ? '#0b1220' : '#1f2937',
					padding: 10,
					boxPadding: 4,
					displayColors: stacked,
					titleFont: { size: 11, weight: 'normal' },
					bodyFont: { size: 12 },
					callbacks: {
						title: (items: TooltipItem<'bar'>[]) =>
							formatDate(series.value[items[0]?.dataIndex ?? 0]?.bucket, 'EEEE, dd/MM/yyyy'),
						label: (item: TooltipItem<'bar'>) =>
							` ${item.dataset.label}: ${fmtValue(item.parsed.y)}`,
						afterBody: (items: TooltipItem<'bar'>[]) => {
							const d = series.value[items[0]?.dataIndex ?? 0];
							if (!d) return [];
							const lines: string[] = [];
							if (metric.value !== 'requests') lines.push(`Lượt hỏi: ${nf.format(d.requests)}`);
							if (metric.value !== 'tokens') {
								lines.push(
									`Token: ${nf.format(d.promptTokens + d.completionTokens)}` +
										` (vào ${nf.format(d.promptTokens)} · ra ${nf.format(d.completionTokens)})`,
								);
							}
							if (d.cachedPromptTokens > 0) {
								lines.push(`Nạp lại từ cache: ${nf.format(d.cachedPromptTokens)} token`);
							}
							if (metric.value !== 'cost') lines.push(`Chi phí: ${fmtUsd(d.costUsd)}`);
							return lines;
						},
					},
				},
			},
			scales: {
				x: {
					stacked,
					grid: { display: false },
					border: { color: c.grid },
					ticks: {
						color: c.tick,
						font: { size: 10 },
						maxRotation: 0,
						autoSkip: true,
						maxTicksLimit: 14,
					},
				},
				y: {
					stacked,
					beginAtZero: true,
					grid: { color: c.grid, drawTicks: false },
					border: { display: false },
					ticks: {
						color: c.tick,
						font: { size: 10 },
						padding: 8,
						maxTicksLimit: 5,
						callback: (v: string | number) => fmtAxis(Number(v)),
					},
				},
			},
		};
	});

	/**
	 * Vạch trung bình + con số của ngày cao nhất.
	 *
	 * Đây là hai thứ mắt phải tự nhẩm nếu biểu đồ không vẽ: hôm nay cao hay thấp hơn
	 * mọi hôm, và đỉnh là bao nhiêu. Vẽ sẵn thì nhìn một cái là xong.
	 */
	const guides: Plugin<'bar'> = {
		id: 'agentDailyGuides',
		afterDatasetsDraw(chart: Chart<'bar'>) {
			const { ctx, chartArea, scales } = chart;
			const yScale = scales.y;
			const xScale = scales.x;
			if (!yScale || !xScale) return;
			const c = palette.value;

			if (avgValue.value > 0) {
				const y = yScale.getPixelForValue(avgValue.value);
				if (Number.isFinite(y) && y > chartArea.top && y < chartArea.bottom) {
					ctx.save();
					ctx.strokeStyle = c.guide;
					ctx.lineWidth = 1;
					ctx.setLineDash([4, 4]);
					ctx.beginPath();
					ctx.moveTo(chartArea.left, y);
					ctx.lineTo(chartArea.right, y);
					ctx.stroke();
					ctx.restore();
				}
			}

			const peak = values.value[peakIndex.value] ?? 0;
			if (peak > 0) {
				const x = xScale.getPixelForValue(peakIndex.value);
				const y = yScale.getPixelForValue(peak);
				if (Number.isFinite(x) && Number.isFinite(y)) {
					ctx.save();
					ctx.fillStyle = c.tick;
					ctx.font = `600 10px ${ChartJS.defaults.font.family}`;
					ctx.textAlign = 'center';
					ctx.textBaseline = 'bottom';
					// Kẹp vào trong khung để nhãn của cột đầu/cuối không bị cắt mép
					const left = chartArea.left + 20;
					const right = chartArea.right - 20;
					ctx.fillText(fmtValue(peak), Math.min(Math.max(x, left), right), y - 6);
					ctx.restore();
				}
			}
		},
	};
</script>

<template>
	<section class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
		<header class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">Mức dùng theo ngày</h3>
				<p v-if="series.length" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
					Trung bình {{ avgLabel }} — đường đứt trên biểu đồ
					<template v-if="peakDay && (values[peakIndex] ?? 0) > 0">
						· cao nhất {{ formatDate(peakDay.bucket, 'dd/MM') }}
					</template>
				</p>
			</div>

			<div class="flex items-center gap-2">
				<div class="flex rounded-lg border border-gray-300 p-0.5 dark:border-gray-600">
					<button
						v-for="m in METRICS"
						:key="m.key"
						type="button"
						:class="[
							'rounded-md px-2.5 py-1 text-xs transition',
							metric === m.key
								? 'bg-brand-600 text-white'
								: 'text-gray-600 hover:text-brand-600 dark:text-gray-300',
						]"
						@click="metric = m.key"
					>
						{{ m.label }}
					</button>
				</div>

				<button
					type="button"
					class="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-gray-600 transition hover:border-brand-500 hover:text-brand-600 dark:border-gray-600 dark:text-gray-300"
					@click="asTable = !asTable"
				>
					{{ asTable ? 'Biểu đồ' : 'Bảng số' }}
				</button>
			</div>
		</header>

		<p v-if="!series.length" class="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
			Chưa có dữ liệu.
		</p>

		<div v-else-if="!asTable" class="mt-3 h-72">
			<Bar :data="chartData" :options="options" :plugins="[guides]" />
		</div>

		<!-- Bản số của đúng dữ liệu trên: đọc bằng bàn phím, copy được, không cần rê chuột -->
		<div v-else class="mt-3 max-h-72 overflow-auto">
			<table class="w-full text-sm">
				<thead class="sticky top-0 bg-white text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
					<tr class="border-b border-gray-200 dark:border-gray-700">
						<th class="px-2 py-2 text-left font-medium">Ngày</th>
						<th class="px-2 py-2 text-right font-medium">Lượt hỏi</th>
						<th class="px-2 py-2 text-right font-medium">Token vào</th>
						<th class="px-2 py-2 text-right font-medium">Token ra</th>
						<th class="px-2 py-2 text-right font-medium">Cache</th>
						<th class="px-2 py-2 text-right font-medium">Chi phí</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100 dark:divide-gray-700">
					<tr v-for="d in series" :key="d.bucket">
						<td class="px-2 py-1.5 text-gray-700 dark:text-gray-200">
							{{ formatDate(d.bucket, 'dd/MM/yyyy') }}
						</td>
						<td class="px-2 py-1.5 text-right tabular-nums text-gray-600 dark:text-gray-300">
							{{ nf.format(d.requests) }}
						</td>
						<td class="px-2 py-1.5 text-right tabular-nums text-gray-600 dark:text-gray-300">
							{{ nf.format(d.promptTokens) }}
						</td>
						<td class="px-2 py-1.5 text-right tabular-nums text-gray-600 dark:text-gray-300">
							{{ nf.format(d.completionTokens) }}
						</td>
						<td class="px-2 py-1.5 text-right tabular-nums text-gray-400 dark:text-gray-500">
							{{ nf.format(d.cachedPromptTokens) }}
						</td>
						<td class="px-2 py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-200">
							{{ fmtUsd(d.costUsd) }}
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>
</template>
