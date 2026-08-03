<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useMyReport } from '~/composables/useMyReport';
import { useAttendanceService } from '~/services/attendance.service';
import type { EmployeeMonthlyReportResponse } from '~/types/reports-me.types';
import type { AttendanceRecordDetail, AttendanceStatus } from '~/types/attendance.types';
import { formatDate } from '~/utils/date';
import { useToast } from '#imports';

const props = defineProps<{
	employeeId: number;
}>();

const toast = useToast();
const { fetchEmployeeMonthlyReport } = useMyReport();
const attendanceService = useAttendanceService();

const now = new Date();
const currentMonth = ref(now.getMonth() + 1);
const currentYear = ref(now.getFullYear());

const loading = ref(false);
const report = ref<EmployeeMonthlyReportResponse | null>(null);
const records = ref<AttendanceRecordDetail[]>([]);

const startDateStr = computed(() => {
	const y = currentYear.value;
	const m = String(currentMonth.value).padStart(2, '0');
	return `${y}-${m}-01`;
});

const endDateStr = computed(() => {
	const y = currentYear.value;
	const m = currentMonth.value;
	const lastDay = new Date(y, m, 0).getDate();
	return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
});

async function loadData() {
	if (!props.employeeId) return;
	loading.value = true;
	try {
		const [rep, att] = await Promise.all([
			fetchEmployeeMonthlyReport(props.employeeId, {
				month: currentMonth.value,
				year: currentYear.value,
			}),
			attendanceService.findAll({
				employeeId: props.employeeId,
				startDate: startDateStr.value,
				endDate: endDateStr.value,
				limit: 100,
			}),
		]);
		report.value = rep;
		records.value = att.data || [];
	} catch (e: unknown) {
		console.error('Error loading employee monthly report:', e);
		const msg =
			e && typeof e === 'object' && 'data' in e
				? (e as { data?: { message?: string } }).data?.message
				: 'Không thể tải báo cáo công tháng của nhân viên.';
		toast.error(msg || 'Lỗi khi tải dữ liệu chấm công.');
	} finally {
		loading.value = false;
	}
}

onMounted(() => {
	loadData();
});

watch(
	() => [props.employeeId, currentMonth.value, currentYear.value],
	() => {
		loadData();
	},
);

function prevMonth() {
	if (currentMonth.value === 1) {
		currentMonth.value = 12;
		currentYear.value--;
	} else {
		currentMonth.value--;
	}
}

function nextMonth() {
	if (currentMonth.value === 12) {
		currentMonth.value = 1;
		currentYear.value++;
	} else {
		currentMonth.value++;
	}
}

const showPicker = ref(false);

function selectMonth(m: number) {
	currentMonth.value = m;
	showPicker.value = false;
	loadData();
}

function setYear(delta: number) {
	currentYear.value += delta;
	loadData();
}

const att = computed(() => report.value?.attendance);
const ovt = computed(() => report.value?.overtime);
const vio = computed(() => report.value?.violations);

const workingDays = computed(() => att.value?.workingDays ?? 0);
const totalPayrollDays = computed(() => att.value?.totalPayrollDays ?? 0);

const progressPercentage = computed(() => {
	if (!workingDays.value) return 0;
	return Math.min(Math.round((totalPayrollDays.value / workingDays.value) * 100), 100);
});

function slicePercentage(count: number): number {
	if (!workingDays.value) return 0;
	return Math.min(Math.round((count / workingDays.value) * 1000) / 10, 100);
}

const slices = computed(() => {
	if (!att.value) return [];
	const normalWorkDays = Math.max(att.value.actualWorkDays - att.value.businessTripDays, 0);

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
			count: att.value.businessTripDays,
			color: '#8B5CF6', // purple-500
		},
		{
			key: 'LEAVE',
			label: 'Đã nghỉ phép năm',
			count: att.value.annualLeaveDays,
			color: '#10B981', // green-500
		},
		{
			key: 'HOLIDAY',
			label: 'Đã nghỉ lễ / chế độ',
			count: att.value.publicHolidayDays + att.value.welfareLeaveDays,
			color: '#F59E0B', // amber-500
		},
	];
});

function formatHour(val?: number): string {
	if (!val) return '0h';
	return `${Number(val.toFixed(1))}h`;
}

function getStatusLabel(status: AttendanceStatus): string {
	switch (status) {
		case 'PRESENT':
			return 'Đủ công';
		case 'LATE':
			return 'Đi muộn';
		case 'ABSENT':
			return 'Vắng mặt';
		case 'LEAVE':
			return 'Nghỉ phép';
		default:
			return status;
	}
}

function getStatusBadgeCls(status: AttendanceStatus): string {
	switch (status) {
		case 'PRESENT':
			return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
		case 'LATE':
			return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
		case 'ABSENT':
			return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
		case 'LEAVE':
			return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
		default:
			return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
	}
}

	function formatTimeOnly(iso?: string | null): string {
		if (!iso) return '—';
		try {
			return formatDate(iso, 'HH:mm');
		} catch {
			return '—';
		}
	}

	// ─── View mode & Calendar State ────────────────────────────────────────────────
	const viewMode = ref<'calendar' | 'table'>('calendar');
	const selectedDate = ref<string | null>(null);

	const DOW_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

	function daysInMonthCount(year: number, month: number) {
		return new Date(year, month, 0).getDate(); // month is 1..12
	}

	const recordsByDate = computed(() => {
		const map = new Map<string, AttendanceRecordDetail>();
		for (const r of records.value) map.set(r.date, r);
		return map;
	});

	const selectedRecord = computed(() =>
		selectedDate.value ? (recordsByDate.value.get(selectedDate.value) ?? null) : null,
	);

	watch(
		records,
		(newRecords) => {
			const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
			if (
				!selectedDate.value ||
				!selectedDate.value.startsWith(`${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}`)
			) {
				if (currentYear.value === now.getFullYear() && currentMonth.value === now.getMonth() + 1) {
					selectedDate.value = todayStr;
				} else if (newRecords.length > 0) {
					selectedDate.value = newRecords[0].date;
				} else {
					selectedDate.value = `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}-01`;
				}
			}
		},
		{ immediate: true },
	);

	const calendarCells = computed(() => {
		const rawDow = new Date(currentYear.value, currentMonth.value - 1, 1).getDay();
		const firstDow = (rawDow + 6) % 7;
		const total = daysInMonthCount(currentYear.value, currentMonth.value);
		const cells: Array<{ day: number | null; dateStr: string | null }> = [];
		for (let i = 0; i < firstDow; i++) cells.push({ day: null, dateStr: null });
		for (let d = 1; d <= total; d++) {
			const m = String(currentMonth.value).padStart(2, '0');
			const day = String(d).padStart(2, '0');
			cells.push({ day: d, dateStr: `${currentYear.value}-${m}-${day}` });
		}
		while (cells.length % 7 !== 0) cells.push({ day: null, dateStr: null });
		return cells;
	});

	function selectDay(dateStr: string | null) {
		if (dateStr) selectedDate.value = dateStr;
	}

	function statusDotColor(record: AttendanceRecordDetail): string {
		if (record.missingType) return 'bg-amber-400';
		switch (record.status) {
			case 'PRESENT':
				return 'bg-green-500';
			case 'LATE':
				return 'bg-orange-400';
			case 'ABSENT':
				return 'bg-red-500';
			case 'LEAVE':
				return 'bg-blue-400';
			default:
				return '';
		}
	}

	function dayNumberStyle(dateStr: string, record: AttendanceRecordDetail | undefined): string {
		const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
		const isToday = dateStr === todayStr;
		const isSelected = dateStr === selectedDate.value;

		if (isToday)
			return 'w-8 h-8 rounded-full bg-brand-600 text-white font-semibold flex items-center justify-center text-sm shadow-xs';
		if (isSelected)
			return 'w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-semibold flex items-center justify-center text-sm ring-2 ring-brand-500';
		if (!record) return 'w-8 h-8 flex items-center justify-center text-sm text-gray-700 dark:text-gray-300';
		if (record.missingType) return 'w-8 h-8 flex items-center justify-center text-sm text-amber-600 font-medium';
		if (record.status === 'ABSENT') return 'w-8 h-8 flex items-center justify-center text-sm text-red-500 font-medium';
		if (record.status === 'LATE') return 'w-8 h-8 flex items-center justify-center text-sm text-orange-500 font-medium';
		if (record.status === 'LEAVE') return 'w-8 h-8 flex items-center justify-center text-sm text-blue-500 font-medium';
		return 'w-8 h-8 flex items-center justify-center text-sm text-gray-700 dark:text-gray-300';
	}

	function formatSelectedDateLabel(dateStr: string | null): string {
		if (!dateStr) return '';
		try {
			const d = new Date(dateStr);
			const days = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
			return `${days[d.getDay()]}, ngày ${d.getDate()} tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
		} catch {
			return dateStr;
		}
	}
</script>

<template>
	<div class="space-y-6">
		<!-- Unified Monthly Attendance Overview Card (100% Identical to Employee Dashboard) -->
		<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
			<!-- Unified Header -->
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 mb-3.5 border-b border-gray-100 dark:border-gray-800">
				<div class="flex items-center gap-2.5">
					<h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Chi tiết chuyên cần & công tháng</h3>
					<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
						Tháng {{ currentMonth }}/{{ currentYear }}
					</span>
				</div>

				<div class="flex items-center gap-2">
					<!-- Month & Year Interactive Picker (Exact height h-8) -->
					<div class="relative h-8 inline-flex items-center gap-1 bg-gray-50 dark:bg-gray-800 px-1 rounded-lg border border-gray-200 dark:border-gray-700">
						<button
							type="button"
							class="w-6 h-6 flex items-center justify-center rounded hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
							title="Tháng trước"
							@click="prevMonth"
						>
							<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
							</svg>
						</button>

						<!-- Clickable Current Month/Year Button -->
						<button
							type="button"
							class="h-6 inline-flex items-center gap-1 text-xs font-semibold px-2 rounded hover:bg-white dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100 transition-colors cursor-pointer"
							title="Bấm để chọn nhanh tháng và năm"
							@click="showPicker = !showPicker"
						>
							<span>T{{ currentMonth }}/{{ currentYear }}</span>
							<svg class="w-2.5 h-2.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
								<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
							</svg>
						</button>

						<button
							type="button"
							class="w-6 h-6 flex items-center justify-center rounded hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
							title="Tháng sau"
							@click="nextMonth"
						>
							<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
							</svg>
						</button>

						<!-- Month & Year Picker Dropdown Popover -->
						<div
							v-if="showPicker"
							class="absolute right-0 top-full mt-2 z-50 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl p-3 w-56 animate-in fade-in zoom-in-95 duration-150"
						>
							<!-- Year selector header -->
							<div class="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-gray-700">
								<button
									type="button"
									class="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold"
									@click="setYear(-1)"
								>
									«
								</button>
								<span class="text-xs font-bold text-gray-900 dark:text-white">Năm {{ currentYear }}</span>
								<button
									type="button"
									class="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold"
									@click="setYear(1)"
								>
									»
								</button>
							</div>

							<!-- 12 Months 4x3 Grid -->
							<div class="grid grid-cols-4 gap-1.5">
								<button
									v-for="m in 12"
									:key="m"
									type="button"
									:class="[
										'py-1.5 rounded-lg text-xs font-medium transition-all text-center',
										m === currentMonth
											? 'bg-brand-600 text-white font-bold shadow-xs scale-105'
											: 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300',
									]"
									@click="selectMonth(m)"
								>
									T{{ m }}
								</button>
							</div>
						</div>
					</div>

					
				</div>
			</div>

			<!-- Loading Skeleton -->
			<div
				v-if="loading && !report"
				class="animate-pulse space-y-4 py-6"
			>
				<div class="h-6 bg-gray-200 dark:bg-gray-800 rounded w-1/3"></div>
				<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
					<div class="h-48 bg-gray-200 dark:bg-gray-800 rounded-xl"></div>
					<div class="lg:col-span-2 h-48 bg-gray-200 dark:bg-gray-800 rounded-xl"></div>
				</div>
			</div>

			<!-- Main 1/3 Chart + 2/3 Detail Content (100% Identical to Employee Dashboard) -->
			<div v-else-if="report && att" class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
				<!-- LEFT 1/3: HORIZONTAL BAR CHART BREAKDOWN CARD -->
				<div class="lg:col-span-1 bg-gray-50/80 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-800 flex flex-col justify-between">
					<!-- Top Summary: Overall Progress -->
					<div>
						<div class="flex items-center justify-between mb-1.5">
							<span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								Phân bố ngày công
							</span>
						</div>

						<div class="flex items-baseline gap-1.5">
							<span class="text-2xl font-bold text-gray-900 dark:text-white">{{ totalPayrollDays }}</span>
							<span class="text-xs font-medium text-gray-500 dark:text-gray-400">/ {{ workingDays }} ngày chuẩn</span>
						</div>
					</div>

					<!-- Horizontal Bars Chart (4 rows) -->
					<div class="mt-2.5 pt-2.5 border-t border-gray-200/60 dark:border-gray-700/60 space-y-2.5">
						<div
							v-for="item in slices"
							:key="item.key"
							class="space-y-1"
						>
							<!-- Label & Count line -->
							<div class="flex items-center justify-between text-xs">
								<span class="font-medium text-gray-700 dark:text-gray-300 truncate">{{ item.label }}</span>
								<span class="font-bold text-gray-900 dark:text-gray-100 ml-2">{{ item.count }} <span class="text-[11px] font-normal text-gray-500">ngày</span></span>
							</div>
							<!-- Horizontal Bar -->
							<div class="h-2 w-full bg-gray-200/70 dark:bg-gray-700/50 rounded-full overflow-hidden">
								<div
									:style="{ width: slicePercentage(item.count) + '%', backgroundColor: item.color }"
									class="h-full rounded-full transition-all duration-500"
								/>
							</div>
						</div>
					</div>
				</div>

				<!-- RIGHT 2/3: ATTENDANCE & OT DETAILS -->
				<div class="lg:col-span-2 flex flex-col gap-3">
					<!-- 3 Mini-Cards Grid -->
					<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
						<!-- Card 1: OT (Overtime) -->
						<div class="bg-gray-50/80 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-800 flex flex-col justify-between">
							<div>
								<div class="flex items-center justify-between mb-2">
									<span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Làm thêm (OT)</span>
									<span class="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 flex items-center justify-center">
										<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
											<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
										</svg>
									</span>
								</div>
								<p class="text-2xl font-bold text-gray-900 dark:text-white">{{ formatHour(ovt?.totalHours) }}</p>
							</div>
							<div class="mt-3 pt-2.5 border-t border-gray-200/60 dark:border-gray-700/60 space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
								<div class="flex justify-between items-center">
									<span>Ngày thường (x1.5):</span>
									<span class="font-semibold text-gray-800 dark:text-gray-200">{{ formatHour(ovt?.normalHours) }}</span>
								</div>
								<div class="flex justify-between items-center">
									<span>Chủ nhật (x2.0):</span>
									<span class="font-semibold text-gray-800 dark:text-gray-200">{{ formatHour(ovt?.sundayHours) }}</span>
								</div>
								<div class="flex justify-between items-center">
									<span>Ngày lễ (x3.0):</span>
									<span class="font-semibold text-gray-800 dark:text-gray-200">
										{{ formatHour((ovt?.holidayOfflineHours || 0) + (ovt?.holidayOnlineHours || 0)) }}
									</span>
								</div>
							</div>
						</div>

						<!-- Card 2: Leave & Holidays -->
						<div class="bg-gray-50/80 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-800 flex flex-col justify-between">
							<div>
								<div class="flex items-center justify-between mb-2">
									<span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nghỉ phép & Lễ</span>
									<span class="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
										<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
											<path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
										</svg>
									</span>
								</div>
								<p class="text-2xl font-bold text-gray-900 dark:text-white">{{ att.annualLeaveDays || 0 }} <span class="text-xs font-medium text-gray-500">phép</span></p>
							</div>
							<div class="mt-3 pt-2.5 border-t border-gray-200/60 dark:border-gray-700/60 space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
								<div class="flex justify-between items-center">
									<span>Lễ / Chế độ:</span>
									<span class="font-semibold text-gray-800 dark:text-gray-200">
										{{ (att.publicHolidayDays || 0) + (att.welfareLeaveDays || 0) }} ngày
									</span>
								</div>
								<div class="flex justify-between items-center">
									<span>Công tác:</span>
									<span class="font-semibold text-gray-800 dark:text-gray-200">{{ att.businessTripDays || 0 }} ngày</span>
								</div>
								<div class="flex justify-between items-center">
									<span>Không lương (KL):</span>
									<span class="font-semibold text-gray-800 dark:text-gray-200">{{ att.unpaidLeaveDays || 0 }} ngày</span>
								</div>
							</div>
						</div>

						<!-- Card 3: Violations (Muộn/Sớm/Quên) -->
						<div class="bg-gray-50/80 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-800 flex flex-col justify-between">
							<div>
								<div class="flex items-center justify-between mb-2">
									<span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Kỷ luật chuyên cần</span>
									<span class="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 flex items-center justify-center">
										<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
											<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
										</svg>
									</span>
								</div>
								<p class="text-2xl font-bold text-red-600 dark:text-red-400">
									{{ vio?.totalCount || 0 }} <span class="text-xs font-medium text-gray-500">vi phạm</span>
								</p>
							</div>
							<div class="mt-3 pt-2.5 border-t border-gray-200/60 dark:border-gray-700/60 space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
								<div class="flex justify-between items-center">
									<span>Đi muộn (Late):</span>
									<span class="font-semibold text-gray-800 dark:text-gray-200">{{ vio?.lateCount || 0 }} lần</span>
								</div>
								<div class="flex justify-between items-center">
									<span>Về sớm (Early):</span>
									<span class="font-semibold text-gray-800 dark:text-gray-200">{{ vio?.earlyCount || 0 }} lần</span>
								</div>
								<div class="flex justify-between items-center">
									<span>Quên checkin/out:</span>
									<span class="font-semibold text-gray-800 dark:text-gray-200">
										{{ vio?.forgotCheckCount || 0 }} lần
									</span>
								</div>
							</div>
						</div>
					</div>

					<!-- Footer Summary Box (Tightly docked below the 3 cards) -->
					<div class="bg-gray-50/80 dark:bg-gray-800/50 rounded-xl px-4 py-3 border border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 text-xs">
						<div class="flex items-center gap-5">
							<div class="flex items-center gap-1.5">
								<span class="w-2 h-2 rounded-full bg-blue-500"></span>
								<span class="text-gray-500 dark:text-gray-400 font-medium">Công tính lương:</span>
								<span class="font-bold text-gray-900 dark:text-white">{{ att.totalPayrollDays }} / {{ workingDays }} ngày</span>
							</div>
							<div class="flex items-center gap-1.5">
								<span class="w-2 h-2 rounded-full bg-emerald-500"></span>
								<span class="text-gray-500 dark:text-gray-400 font-medium">Công ăn ca (thực tế):</span>
								<span class="font-bold text-gray-900 dark:text-white">{{ att.totalActualDays }} ngày</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Daily Attendance Ledger Section -->
		<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
			<div class="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
				<div>
					<h3 class="text-sm font-semibold text-gray-900 dark:text-white">
						Nhật ký chấm công chi tiết
					</h3>
					<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
						Tháng {{ currentMonth }}/{{ currentYear }}
						<span v-if="records.length" class="mx-1">·</span>
						<span v-if="records.length">{{ records.length }} ngày ghi nhận</span>
					</p>
				</div>

				<!-- View Mode Toggle: Calendar vs Table -->
				<div class="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
					<button
						type="button"
						class="px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5"
						:class="
							viewMode === 'calendar'
								? 'bg-white dark:bg-gray-700 text-brand-600 dark:text-white shadow-xs'
								: 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
						"
						@click="viewMode = 'calendar'"
					>
						<span>📅</span>
						<span>Lịch</span>
					</button>
					<button
						type="button"
						class="px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5"
						:class="
							viewMode === 'table'
								? 'bg-white dark:bg-gray-700 text-brand-600 dark:text-white shadow-xs'
								: 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
						"
						@click="viewMode = 'table'"
					>
						<span>📋</span>
						<span>Bảng</span>
					</button>
				</div>
			</div>

			<!-- Skeleton table -->
			<div v-if="loading && !records.length" class="divide-y divide-gray-100 dark:divide-gray-800">
				<div v-for="n in 5" :key="n" class="px-5 py-4 animate-pulse flex items-center justify-between">
					<div class="h-4 bg-gray-200 dark:bg-gray-800 rounded w-24"></div>
					<div class="h-4 bg-gray-200 dark:bg-gray-800 rounded w-32"></div>
					<div class="h-4 bg-gray-200 dark:bg-gray-800 rounded w-20"></div>
					<div class="h-4 bg-gray-200 dark:bg-gray-800 rounded w-28"></div>
				</div>
			</div>

			<!-- Empty table state -->
			<div
				v-else-if="!loading && !records.length"
				class="py-12 flex flex-col items-center justify-center text-center px-4"
			>
				<div class="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3 text-gray-400">
					<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
						/>
					</svg>
				</div>
				<p class="text-sm font-medium text-gray-600 dark:text-gray-300">
					Chưa có dữ liệu chấm công cho tháng {{ currentMonth }}/{{ currentYear }}
				</p>
				<p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
					Nhân viên chưa có lịch sử check-in hoặc chưa phát sinh ngày công trong tháng này.
				</p>
			</div>

			<!-- Calendar View Mode (Default) -->
			<div v-else-if="viewMode === 'calendar'" class="p-5">
				<div class="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
					<!-- LEFT: Calendar Grid (7x5) -->
					<div class="lg:col-span-2 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
						<!-- Day of week header -->
						<div class="grid grid-cols-7 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
							<div
								v-for="(label, i) in DOW_LABELS"
								:key="label"
								class="text-center text-xs font-semibold py-2.5"
								:class="[
									label === 'CN' || label === 'T7' ? 'text-red-500' : 'text-gray-500 dark:text-gray-400',
									i < 6 ? 'border-r border-gray-200 dark:border-gray-700' : '',
								]"
							>
								{{ label }}
							</div>
						</div>

						<!-- Day cells -->
						<div class="grid grid-cols-7">
							<div
								v-for="(cell, idx) in calendarCells"
								:key="idx"
								class="min-h-[64px] flex flex-col items-center pt-2.5 pb-2 border-b border-gray-100 dark:border-gray-800 transition-colors"
								:class="[
									idx % 7 < 6 ? 'border-r border-gray-100 dark:border-gray-800' : '',
									idx >= calendarCells.length - 7 ? 'border-b-0' : '',
									idx % 7 >= 5 ? 'bg-gray-50/50 dark:bg-gray-800/20' : '',
									cell.dateStr ? 'cursor-pointer hover:bg-brand-50/70 dark:hover:bg-brand-900/10' : '',
								]"
								@click="selectDay(cell.dateStr)"
							>
								<template v-if="cell.day && cell.dateStr">
									<div :class="dayNumberStyle(cell.dateStr, recordsByDate.get(cell.dateStr))">
										{{ cell.day }}
									</div>
									<div
										v-if="recordsByDate.has(cell.dateStr)"
										class="mt-1.5 w-2 h-2 rounded-full"
										:class="statusDotColor(recordsByDate.get(cell.dateStr)!)"
									/>
									<div v-else class="mt-1.5 w-2 h-2" />
								</template>
							</div>
						</div>

						<!-- Legend -->
						<div class="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 py-3 px-4 bg-gray-50/50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800">
							<div class="flex items-center gap-1.5">
								<span class="w-2 h-2 rounded-full bg-green-500 inline-block" />
								<span class="text-xs text-gray-500 dark:text-gray-400">Đúng giờ</span>
							</div>
							<div class="flex items-center gap-1.5">
								<span class="w-2 h-2 rounded-full bg-orange-400 inline-block" />
								<span class="text-xs text-gray-500 dark:text-gray-400">Đến muộn</span>
							</div>
							<div class="flex items-center gap-1.5">
								<span class="w-2 h-2 rounded-full bg-amber-400 inline-block" />
								<span class="text-xs text-gray-500 dark:text-gray-400">Thiếu chấm công</span>
							</div>
							<div class="flex items-center gap-1.5">
								<span class="w-2 h-2 rounded-full bg-blue-400 inline-block" />
								<span class="text-xs text-gray-500 dark:text-gray-400">Nghỉ phép</span>
							</div>
							<div class="flex items-center gap-1.5">
								<span class="w-2 h-2 rounded-full bg-red-500 inline-block" />
								<span class="text-xs text-gray-500 dark:text-gray-400">Vắng</span>
							</div>
						</div>
					</div>

					<!-- RIGHT: Selected Day Detail Panel -->
					<div class="lg:col-span-1">
						<!-- No day selected -->
						<div
							v-if="!selectedDate"
							class="bg-gray-50/80 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col items-center justify-center text-center min-h-[260px]"
						>
							<svg
								class="w-10 h-10 text-gray-300 dark:text-gray-600 mb-2.5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="1.5"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
								/>
							</svg>
							<p class="text-sm font-medium text-gray-600 dark:text-gray-300">Chưa chọn ngày</p>
							<p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
								Bấm vào một ngày trên lịch để xem chi tiết chấm công và thao tác.
							</p>
						</div>

						<!-- Selected record details -->
						<div
							v-else-if="selectedRecord"
							class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4 shadow-sm"
						>
							<!-- Date header & badges -->
							<div class="flex items-start justify-between gap-2 pb-3 border-b border-gray-100 dark:border-gray-800">
								<div>
									<p class="text-sm font-bold text-gray-900 dark:text-white">
										{{ formatSelectedDateLabel(selectedRecord.date) }}
									</p>
									<div class="flex flex-wrap items-center gap-1.5 mt-1.5">
										<span
											class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
											:class="getStatusBadgeCls(selectedRecord.status)"
										>
											{{ getStatusLabel(selectedRecord.status) }}
										</span>
										<span
											v-if="selectedRecord.missingType"
											class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
										>
											{{ selectedRecord.missingType === 'MISSING_CHECKIN' ? 'Thiếu check-in' : 'Thiếu check-out' }}
										</span>
										<span
											v-if="selectedRecord.isManual"
											class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400"
										>
											✏️ Sửa thủ công
										</span>
									</div>
								</div>
							</div>

							<!-- Shift details box -->
							<div class="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
								<p class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
									{{ selectedRecord.shift?.name || 'CA HÀNH CHÍNH' }}
								</p>
								<p class="text-xs text-gray-600 dark:text-gray-300 mt-1">
									Giờ làm việc: <span class="font-semibold">{{ selectedRecord.shift?.checkInTime || '08:00' }} - {{ selectedRecord.shift?.checkOutTime || '17:30' }}</span>
								</p>
							</div>

							<!-- Checkin / Checkout Timeline -->
							<div class="space-y-2.5 px-1">
								<!-- Check-in line -->
								<div class="flex items-center justify-between text-sm">
									<div class="flex items-center gap-2">
										<span class="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
										<span class="text-gray-600 dark:text-gray-400">Giờ vào:</span>
									</div>
									<div class="font-mono font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
										<span>{{ formatTimeOnly(selectedRecord.checkInAt) }}</span>
										<span v-if="selectedRecord.lateMinutes > 0" class="text-xs font-sans text-orange-600 dark:text-orange-400 font-medium">
											(Muộn {{ selectedRecord.lateMinutes }}')
										</span>
									</div>
								</div>

								<!-- Check-out line -->
								<div class="flex items-center justify-between text-sm">
									<div class="flex items-center gap-2">
										<span class="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
										<span class="text-gray-600 dark:text-gray-400">Giờ ra:</span>
									</div>
									<div class="font-mono font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
										<span>{{ formatTimeOnly(selectedRecord.checkOutAt) }}</span>
										<span v-if="selectedRecord.earlyMinutes > 0" class="text-xs font-sans text-orange-600 dark:text-orange-400 font-medium">
											(Sớm {{ selectedRecord.earlyMinutes }}')
										</span>
									</div>
								</div>
							</div>

							<!-- Note if any -->
							<div v-if="selectedRecord.note" class="text-xs bg-gray-50 dark:bg-gray-800 p-2.5 rounded-lg text-gray-600 dark:text-gray-300">
								<span class="font-semibold">Ghi chú:</span> {{ selectedRecord.note }}
							</div>

							<!-- Action CTA box at bottom -->
							<div class="pt-2 border-t border-gray-100 dark:border-gray-800 flex flex-col gap-2">
								<div
									v-if="selectedRecord.missingType || selectedRecord.status === 'LATE' || selectedRecord.status === 'ABSENT'"
									class="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between gap-2"
								>
									<div>
										<p class="text-xs font-bold text-amber-800 dark:text-amber-300">
											{{ selectedRecord.missingType ? 'Thiếu chấm công' : (selectedRecord.status === 'ABSENT' ? 'Vắng mặt không phép' : 'Đến muộn / Về sớm') }}
										</p>
										<p class="text-[11px] text-amber-600 dark:text-amber-400">
											Cần theo dõi hoặc nhắc nhở
										</p>
									</div>
									
								</div>
							</div>
						</div>

						<!-- Selected date has no record -->
						<div
							v-else
							class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col items-center justify-center text-center min-h-[220px]"
						>
							<p class="text-sm font-semibold text-gray-700 dark:text-gray-300">
								{{ formatSelectedDateLabel(selectedDate) }}
							</p>
							<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 mt-2">
								Không có phát sinh công
							</span>
							<p class="text-xs text-gray-400 dark:text-gray-500 mt-2">
								Nhân viên không có lịch sử chấm công trong ngày này.
							</p>
						</div>
					</div>
				</div>
			</div>

			<!-- Table View Mode -->
			<div v-else class="overflow-x-auto">
				<table class="w-full text-left border-collapse">
					<thead>
						<tr class="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 text-xs text-gray-500 dark:text-gray-400 font-medium">
							<th class="py-3 px-5">Ngày</th>
							<th class="py-3 px-5">Ca làm việc</th>
							<th class="py-3 px-5">Giờ vào</th>
							<th class="py-3 px-5">Giờ ra</th>
							<th class="py-3 px-5">Muộn / Sớm</th>
							<th class="py-3 px-5">Trạng thái</th>
							<th class="py-3 px-5">Ghi chú</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
						<tr
							v-for="rec in records"
							:key="rec.id"
							class="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors"
						>
							<td class="py-3.5 px-5 font-medium text-gray-900 dark:text-white whitespace-nowrap">
								{{ formatDate(rec.date, 'dd/MM/yyyy') }}
							</td>
							<td class="py-3.5 px-5 text-gray-600 dark:text-gray-300 whitespace-nowrap">
								{{ rec.shift?.name || '—' }}
							</td>
							<td class="py-3.5 px-5 font-mono text-gray-800 dark:text-gray-200 whitespace-nowrap">
								{{ formatTimeOnly(rec.checkInAt) }}
							</td>
							<td class="py-3.5 px-5 font-mono text-gray-800 dark:text-gray-200 whitespace-nowrap">
								{{ formatTimeOnly(rec.checkOutAt) }}
							</td>
							<td class="py-3.5 px-5 whitespace-nowrap text-xs">
								<span v-if="rec.lateMinutes > 0" class="text-amber-600 dark:text-amber-400 font-medium mr-2">
									Muộn {{ rec.lateMinutes }}'
								</span>
								<span v-if="rec.earlyMinutes > 0" class="text-orange-600 dark:text-orange-400 font-medium">
									Sớm {{ rec.earlyMinutes }}'
								</span>
								<span v-if="rec.lateMinutes === 0 && rec.earlyMinutes === 0" class="text-gray-400">
									—
								</span>
							</td>
							<td class="py-3.5 px-5 whitespace-nowrap">
								<span
									class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
									:class="getStatusBadgeCls(rec.status)"
								>
									{{ getStatusLabel(rec.status) }}
								</span>
							</td>
							<td class="py-3.5 px-5 text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate">
								<span v-if="rec.isManual" class="text-brand-600 dark:text-brand-400 font-medium">
									[Chỉnh sửa thủ công]
								</span>
								{{ rec.note || '—' }}
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>
</template>
