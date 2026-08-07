<script setup lang="ts">
	import type {
		ContractType,
		EmployeeMonthlyReportResponse,
		EmployeeMonthlyReportBreakdownKey,
		MonthlyReportSymbol,
	} from '~/types/report.types';
	import { useReportService } from '~/services/report.service';
	import { formatDate } from '~/utils/date';
	import { parseISO } from 'date-fns';

	const props = defineProps<{
		employeeId: number;
		employeeName: string;
		employeeCode: string;
		initialYear: number;
		initialMonth: number; // 1-12
	}>();

	const emit = defineEmits<{ close: [] }>();

	const reportService = useReportService();
	const toast = useToast();

	const viewYear = ref(props.initialYear);
	const viewMonth = ref(props.initialMonth); // 1-12

	const data = ref<EmployeeMonthlyReportResponse | null>(null);
	const loading = ref(false);
	const errorMessage = ref<string | null>(null);

	const MONTH_LABEL = computed(() => `Tháng ${viewMonth.value}, ${viewYear.value}`);

	const CONTRACT_TYPE_LABEL: Record<ContractType, string> = {
		PROBATION: 'Thử việc',
		FIXED_TERM: 'Có thời hạn',
		INDEFINITE: 'Không thời hạn',
		SEASONAL: 'Thời vụ',
	};

	const CONTRACT_TYPE_CLS: Record<ContractType, string> = {
		PROBATION: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
		FIXED_TERM: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
		INDEFINITE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
		SEASONAL: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
	};

	// Symbol → màu badge (theo bảng ký hiệu Detail export)
	const SYMBOL_CLS: Record<MonthlyReportSymbol, string> = {
		X: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
		'X/2': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
		'X/2 (Q)': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
		CT: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
		'CT/X': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
		OL: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
		P: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
		'P/X': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
		'P/2': 'bg-slate-200 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300',
		R: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
		L: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
		K: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
		'0': 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
	};

	const WEEKDAY_LABEL = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

	function fmtDateWithWeekday(dateStr: string): string {
		const d = parseISO(dateStr);
		if (Number.isNaN(d.getTime())) return dateStr;
		return `${formatDate(dateStr)} · ${WEEKDAY_LABEL[d.getDay()]}`;
	}

	// State expand: 1 metric row đang mở tại 1 thời điểm
	const expandedKey = ref<EmployeeMonthlyReportBreakdownKey | null>(null);

	function toggleExpand(key: EmployeeMonthlyReportBreakdownKey) {
		expandedKey.value = expandedKey.value === key ? null : key;
	}

	// Cấu hình các dòng metric trong bảng Công tháng (STT + alias + màu số ngày)
	type MetricRow = {
		stt: number;
		key: EmployeeMonthlyReportBreakdownKey;
		alias: string;
		label: string;
		valueClass: string;
	};

	const METRIC_ROWS: MetricRow[] = [
		{ stt: 1, key: 'workingDays', alias: '(1)', label: 'Công định mức', valueClass: 'text-gray-900 dark:text-white' },
		{
			stt: 2,
			key: 'actualWorkDays',
			alias: '(2)',
			label: 'Ngày đi làm thực tế',
			valueClass: 'text-green-600 dark:text-green-400',
		},
		{
			stt: 3,
			key: 'onlineDays',
			alias: '(3)',
			label: 'Ngày đi làm Online',
			valueClass: 'text-green-600 dark:text-green-400',
		},
		{
			stt: 4,
			key: 'businessTripDays',
			alias: '(4)',
			label: 'Công tác',
			valueClass: 'text-indigo-600 dark:text-indigo-400',
		},
		{
			stt: 5,
			key: 'annualLeaveDays',
			alias: '(5)',
			label: 'Nghỉ phép năm',
			valueClass: 'text-blue-600 dark:text-blue-400',
		},
		{
			stt: 6,
			key: 'welfareLeaveDays',
			alias: '(6)',
			label: 'Nghỉ chế độ',
			valueClass: 'text-teal-600 dark:text-teal-400',
		},
		{
			stt: 7,
			key: 'unpaidLeaveDays',
			alias: '(7)',
			label: 'Nghỉ không lương',
			valueClass: 'text-red-600 dark:text-red-400',
		},
		{
			stt: 8,
			key: 'publicHolidayDays',
			alias: '(8)',
			label: 'Ngày lễ',
			valueClass: 'text-purple-600 dark:text-purple-400',
		},
	];

	// Số có `.5` → 1 chữ số thập phân; số nguyên → ẩn `.0`.
	function fmtDays(n: number): string {
		return Number.isInteger(n) ? String(n) : n.toFixed(1);
	}

	function fmtHours(n: number): string {
		if (Number.isInteger(n)) return `${n}h`;
		return `${n.toFixed(2).replace(/\.?0+$/, '')}h`;
	}

	async function fetchReport() {
		loading.value = true;
		errorMessage.value = null;
		try {
			data.value = await reportService.fetchEmployeeMonthlyReport(props.employeeId, viewMonth.value, viewYear.value);
		} catch (e) {
			data.value = null;
			const msg = e instanceof Error ? e.message : 'Không tải được báo cáo công';
			errorMessage.value = msg;
			toast.error(msg);
		} finally {
			loading.value = false;
		}
	}

	function prevMonth() {
		if (viewMonth.value === 1) {
			viewMonth.value = 12;
			viewYear.value--;
		} else {
			viewMonth.value--;
		}
		fetchReport();
	}

	function nextMonth() {
		if (viewMonth.value === 12) {
			viewMonth.value = 1;
			viewYear.value++;
		} else {
			viewMonth.value++;
		}
		fetchReport();
	}

	// Bucket bar chart: chuẩn hoá theo giá trị lớn nhất trong 4 bucket
	const overtimeBuckets = computed(() => {
		const o = data.value?.overtime;
		if (!o) return [];
		const items = [
			{ label: 'Ngày thường (150%)', value: o.normalHours, cls: 'bg-emerald-500' },
			{ label: 'Chủ nhật (200%)', value: o.sundayHours, cls: 'bg-sky-500' },
			{ label: 'Ngày lễ · Online (300%)', value: o.holidayOnlineHours, cls: 'bg-orange-500' },
			{ label: 'Ngày lễ · VP (300%)', value: o.holidayOfflineHours, cls: 'bg-red-500' },
		];
		const max = Math.max(...items.map(i => i.value), 0.0001);
		return items.map(i => ({ ...i, pct: Math.round((i.value / max) * 100) }));
	});

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') emit('close');
	}

	onMounted(() => {
		fetchReport();
		document.addEventListener('keydown', onKeydown);
	});

	onUnmounted(() => {
		document.removeEventListener('keydown', onKeydown);
	});
</script>

<template>
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="emit('close')">
		<div
			class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden"
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0"
			>
				<h2 class="text-base font-semibold text-gray-900 dark:text-white">Báo cáo công tháng</h2>
				<button
					type="button"
					class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
					@click="emit('close')"
				>
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Body -->
			<div class="overflow-y-auto flex-1 p-6 space-y-5">
				<!-- Month navigator -->
				<div class="flex items-center justify-center gap-4">
					<button
						type="button"
						class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
						@click="prevMonth"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
						</svg>
					</button>
					<span class="text-sm font-semibold text-gray-800 dark:text-gray-200 min-w-[140px] text-center">
						{{ MONTH_LABEL }}
					</span>
					<button
						type="button"
						class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
						@click="nextMonth"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
						</svg>
					</button>
				</div>

				<!-- Employee info card -->
				<div class="rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-5 py-4">
					<!-- Name + code + contract badge -->
					<div class="flex items-start justify-between gap-3 pb-3 border-b border-gray-200 dark:border-gray-700">
						<div class="min-w-0">
							<h3 class="text-base font-semibold text-gray-900 dark:text-white truncate">{{ employeeName }}</h3>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Mã NV: {{ employeeCode }}</p>
						</div>
						<span
							v-if="data?.employee.contractType"
							class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
							:class="CONTRACT_TYPE_CLS[data.employee.contractType]"
						>
							{{ CONTRACT_TYPE_LABEL[data.employee.contractType] }}
						</span>
					</div>

					<!-- Details grid -->
					<dl v-if="data" class="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2 pt-3">
						<div>
							<dt class="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500 font-medium">
								Phòng ban
							</dt>
							<dd class="text-sm text-gray-800 dark:text-gray-200 mt-0.5">
								{{ data.employee.department ?? '—' }}
							</dd>
						</div>
						<div>
							<dt class="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500 font-medium">Chức vụ</dt>
							<dd class="text-sm text-gray-800 dark:text-gray-200 mt-0.5">
								{{ data.employee.position ?? '—' }}
							</dd>
						</div>
						<div>
							<dt class="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500 font-medium">
								Ngày vào làm
							</dt>
							<dd class="text-sm text-gray-800 dark:text-gray-200 mt-0.5">
								{{ formatDate(data.employee.joinDate) }}
							</dd>
						</div>
					</dl>
				</div>

				<!-- Loading -->
				<div v-if="loading" class="space-y-4">
					<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
						<div
							v-for="i in 10"
							:key="i"
							class="h-20 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse border border-gray-200 dark:border-gray-700"
						/>
					</div>
				</div>

				<!-- Error state -->
				<div v-else-if="errorMessage && !data" class="flex flex-col items-center justify-center py-10 text-center">
					<svg
						class="w-10 h-10 text-red-400 mb-3"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
						/>
					</svg>
					<p class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ errorMessage }}</p>
					<p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Vui lòng đổi tháng khác hoặc kiểm tra quyền xem.</p>
				</div>

				<!-- Data -->
				<template v-else-if="data">
					<!-- Section: Attendance -->
					<section>
						<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Công tháng</h3>
						<div class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
										<th
											class="w-16 text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
										>
											STT
										</th>
										<th
											class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
										>
											Loại công
										</th>
										<th
											class="w-32 text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
										>
											Số ngày
										</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
									<template v-for="row in METRIC_ROWS" :key="row.key">
										<tr
											class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
											:class="{ 'bg-gray-50 dark:bg-gray-800/50': expandedKey === row.key }"
											@click="toggleExpand(row.key)"
										>
											<td class="px-4 py-3 text-center text-gray-500 dark:text-gray-400">{{ row.stt }}</td>
											<td class="px-4 py-3 text-gray-700 dark:text-gray-300">
												<div class="flex items-center gap-2">
													<svg
														class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 transition-transform flex-shrink-0"
														:class="{ 'rotate-90': expandedKey === row.key }"
														fill="none"
														viewBox="0 0 24 24"
														stroke="currentColor"
														stroke-width="2.5"
													>
														<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
													</svg>
													<span>{{ row.label }}</span>
													<span class="font-semibold text-brand-600 dark:text-brand-400">{{ row.alias }}</span>
												</div>
											</td>
											<td class="px-4 py-3 text-right font-semibold" :class="row.valueClass">
												{{ fmtDays(data.attendance[row.key]) }}
											</td>
										</tr>
										<tr v-if="expandedKey === row.key" class="bg-gray-50/70 dark:bg-gray-800/40">
											<td :colspan="3" class="px-4 py-3">
												<div
													v-if="!data.attendance.breakdown?.[row.key]?.length"
													class="text-center text-xs text-gray-400 dark:text-gray-500 py-3"
												>
													Không có ngày nào đóng góp vào chỉ số này
												</div>
												<div
													v-else
													class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900"
												>
													<table class="w-full text-xs">
														<thead>
															<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
																<th
																	class="w-40 text-left px-3 py-2 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
																>
																	Ngày
																</th>
																<th
																	class="w-24 text-center px-3 py-2 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
																>
																	Ký hiệu
																</th>
																<th
																	class="w-16 text-right px-3 py-2 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
																>
																	Công
																</th>
																<th
																	class="text-left px-3 py-2 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
																>
																	Diễn giải
																</th>
															</tr>
														</thead>
														<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
															<tr v-for="(d, idx) in data.attendance.breakdown[row.key]" :key="`${row.key}-${idx}`">
																<td class="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
																	{{ fmtDateWithWeekday(d.date) }}
																</td>
																<td class="px-3 py-2 text-center">
																	<span
																		class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
																		:class="SYMBOL_CLS[d.symbol]"
																	>
																		{{ d.symbol }}
																	</span>
																</td>
																<td
																	class="px-3 py-2 text-right font-semibold"
																	:class="d.value === 0 ? 'text-gray-400 dark:text-gray-500' : row.valueClass"
																>
																	{{ fmtDays(d.value) }}
																</td>
																<td class="px-3 py-2 text-gray-600 dark:text-gray-400 leading-snug">
																	{{ d.reason }}
																</td>
															</tr>
														</tbody>
													</table>
												</div>
											</td>
										</tr>
									</template>
								</tbody>
								<tfoot>
									<tr class="border-t border-gray-200 dark:border-gray-700 bg-emerald-50 dark:bg-emerald-900/15">
										<td class="px-4 py-3 text-center text-xs font-semibold text-emerald-700 dark:text-emerald-300">
											Σ
										</td>
										<td class="px-4 py-3">
											<p class="font-semibold text-emerald-700 dark:text-emerald-300">Tổng công tính ăn ca</p>
											<p class="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 leading-tight">
												= (2) — công thực tế offline có mặt, không gồm Công tác, Online, phép, lễ
											</p>
										</td>
										<td class="px-4 py-3 text-right font-bold text-emerald-700 dark:text-emerald-300">
											{{ fmtDays(data.attendance.mealAllowanceDays) }}
										</td>
									</tr>
									<tr class="border-t-2 border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/20">
										<td class="px-4 py-3 text-center text-xs font-semibold text-brand-700 dark:text-brand-300">Σ</td>
										<td class="px-4 py-3">
											<p class="font-semibold text-brand-700 dark:text-brand-300">Tổng công tính lương</p>
											<p class="text-[11px] text-brand-600/80 dark:text-brand-400/80 mt-0.5 leading-tight">
												= (2) + (3) + (4) + (5) + (6) + (8) — không cộng (1) và (7)
											</p>
										</td>
										<td class="px-4 py-3 text-right font-bold text-brand-700 dark:text-brand-300">
											{{ fmtDays(data.attendance.totalPayrollDays) }}
										</td>
									</tr>
								</tfoot>
							</table>
						</div>
					</section>

					<!-- Section: Overtime -->
					<section>
						<div class="flex items-baseline justify-between mb-3">
							<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Tăng ca</h3>
							<span class="text-xs text-gray-500 dark:text-gray-400">
								Tổng giờ (raw):
								<span class="font-bold text-gray-800 dark:text-gray-200 ml-1">
									{{ fmtHours(data.overtime.totalHours) }}
								</span>
							</span>
						</div>
						<div
							v-if="data.overtime.totalHours === 0"
							class="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
						>
							Không có tăng ca trong tháng này
						</div>
						<div
							v-else
							class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 space-y-3"
						>
							<div v-for="b in overtimeBuckets" :key="b.label">
								<div class="flex items-center justify-between text-xs mb-1">
									<span class="text-gray-600 dark:text-gray-400">{{ b.label }}</span>
									<span class="font-semibold text-gray-800 dark:text-gray-200">{{ fmtHours(b.value) }}</span>
								</div>
								<div class="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
									<div class="h-full rounded-full transition-all" :class="b.cls" :style="{ width: `${b.pct}%` }" />
								</div>
							</div>
							<p class="text-[10px] text-gray-400 dark:text-gray-500 leading-snug pt-1">
								Giờ raw chưa nhân hệ số. Tính giờ trả lương cần nhân theo rate 150/200/300%.
							</p>
						</div>
					</section>

					<!-- Section: Violations -->
					<section>
						<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Vi phạm</h3>
						<div
							v-if="data.violations.totalCount === 0"
							class="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
						>
							Không có vi phạm trong tháng này
						</div>
						<div v-else class="grid grid-cols-2 sm:grid-cols-4 gap-3">
							<div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
								<p class="text-xs text-gray-500 dark:text-gray-400">Đi muộn (bị từ chối)</p>
								<p class="text-lg font-bold text-orange-500 dark:text-orange-400 mt-1">
									{{ data.violations.lateCount }}
								</p>
							</div>
							<div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
								<p class="text-xs text-gray-500 dark:text-gray-400">Về sớm (bị từ chối)</p>
								<p class="text-lg font-bold text-yellow-500 dark:text-yellow-400 mt-1">
									{{ data.violations.earlyCount }}
								</p>
							</div>
							<div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
								<p class="text-xs text-gray-500 dark:text-gray-400">Quên chấm công</p>
								<p class="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1">
									{{ data.violations.forgotCheckCount }}
								</p>
							</div>
							<div class="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
								<p class="text-xs text-red-700 dark:text-red-300 font-medium">Tổng vi phạm</p>
								<p class="text-lg font-bold text-red-700 dark:text-red-300 mt-1">
									{{ data.violations.totalCount }}
								</p>
							</div>
						</div>
					</section>
				</template>
			</div>
		</div>
	</div>
</template>
