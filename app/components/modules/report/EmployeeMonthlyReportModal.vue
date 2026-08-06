<script setup lang="ts">
import type { ContractType, EmployeeMonthlyReportResponse } from '~/types/report.types';
import { useReportService } from '~/services/report.service';

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
		data.value = await reportService.fetchEmployeeMonthlyReport(
			props.employeeId,
			viewMonth.value,
			viewYear.value,
		);
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
			class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0"
			>
				<div>
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ employeeName }}</h2>
					<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
						{{ employeeCode }} · Báo cáo công tháng
					</p>
				</div>
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

				<!-- Employee info bar -->
				<div
					v-if="data"
					class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
				>
					<div class="text-xs text-gray-500 dark:text-gray-400">
						<span class="font-medium text-gray-700 dark:text-gray-300">Phòng ban:</span>
						{{ data.employee.department ?? '—' }}
					</div>
					<div class="text-xs text-gray-500 dark:text-gray-400">
						<span class="font-medium text-gray-700 dark:text-gray-300">Chức vụ:</span>
						{{ data.employee.position ?? '—' }}
					</div>
					<div class="text-xs text-gray-500 dark:text-gray-400">
						<span class="font-medium text-gray-700 dark:text-gray-300">Ngày vào làm:</span>
						{{ data.employee.joinDate }}
					</div>
					<span
						v-if="data.employee.contractType"
						class="ml-auto inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
						:class="CONTRACT_TYPE_CLS[data.employee.contractType]"
					>
						{{ CONTRACT_TYPE_LABEL[data.employee.contractType] }}
					</span>
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
				<div
					v-else-if="errorMessage && !data"
					class="flex flex-col items-center justify-center py-10 text-center"
				>
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
					<p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
						Vui lòng đổi tháng khác hoặc kiểm tra quyền xem.
					</p>
				</div>

				<!-- Data -->
				<template v-else-if="data">
					<!-- Section: Attendance -->
					<section>
						<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Công tháng</h3>
						<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
							<div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
								<p class="text-xs text-gray-500 dark:text-gray-400">Công định mức</p>
								<p class="text-lg font-bold text-gray-900 dark:text-white mt-1">
									{{ fmtDays(data.attendance.workingDays) }}
								</p>
							</div>
							<div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
								<p class="text-xs text-gray-500 dark:text-gray-400">Công thực tế</p>
								<p class="text-lg font-bold text-green-600 dark:text-green-400 mt-1">
									{{ fmtDays(data.attendance.actualWorkDays) }}
								</p>
							</div>
							<div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
								<p class="text-xs text-gray-500 dark:text-gray-400">Công tác</p>
								<p class="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-1">
									{{ fmtDays(data.attendance.businessTripDays) }}
								</p>
							</div>
							<div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
								<p class="text-xs text-gray-500 dark:text-gray-400">Nghỉ phép năm</p>
								<p class="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1">
									{{ fmtDays(data.attendance.annualLeaveDays) }}
								</p>
							</div>
							<div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
								<p class="text-xs text-gray-500 dark:text-gray-400">Nghỉ chế độ</p>
								<p class="text-lg font-bold text-teal-600 dark:text-teal-400 mt-1">
									{{ fmtDays(data.attendance.welfareLeaveDays) }}
								</p>
							</div>
							<div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
								<p class="text-xs text-gray-500 dark:text-gray-400">Nghỉ không lương</p>
								<p class="text-lg font-bold text-red-600 dark:text-red-400 mt-1">
									{{ fmtDays(data.attendance.unpaidLeaveDays) }}
								</p>
							</div>
							<div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
								<p class="text-xs text-gray-500 dark:text-gray-400">Ngày lễ</p>
								<p class="text-lg font-bold text-purple-600 dark:text-purple-400 mt-1">
									{{ fmtDays(data.attendance.publicHolidayDays) }}
								</p>
							</div>
							<div
								class="p-4 rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 sm:col-span-2"
							>
								<p class="text-xs text-brand-700 dark:text-brand-300 font-medium">Tổng công tính lương</p>
								<p class="text-lg font-bold text-brand-700 dark:text-brand-300 mt-1">
									{{ fmtDays(data.attendance.totalPayrollDays) }}
								</p>
								<p class="text-[10px] text-brand-600/70 dark:text-brand-400/70 mt-0.5 leading-tight">
									= Thực tế + Phép năm + Chế độ + Ngày lễ + Công tác
								</p>
							</div>
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
									<div
										class="h-full rounded-full transition-all"
										:class="b.cls"
										:style="{ width: `${b.pct}%` }"
									/>
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
							<div
								class="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
							>
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
