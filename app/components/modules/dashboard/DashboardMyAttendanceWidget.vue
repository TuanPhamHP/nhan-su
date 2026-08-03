<script setup lang="ts">
	import { computed, onMounted, ref } from 'vue';
	import type { EmployeeMonthlyReportResponse } from '~/types/reports-me.types';
	import { useMyReport } from '~/composables/useMyReport';

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
		} catch (error: unknown) {
			console.error('Failed to load my monthly attendance report:', error);
			const msg = error && typeof error === 'object' && 'data' in error
				? (error as { data?: { message?: string } }).data?.message
				: 'Không thể tải báo cáo chấm công tháng.';
			toast.error(msg || 'Đã xảy ra lỗi khi tải dữ liệu chấm công.');
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

	const showPicker = ref(false);

	function selectMonth(m: number) {
		currentMonth.value = m;
		showPicker.value = false;
		loadReport();
	}

	function setYear(delta: number) {
		currentYear.value += delta;
		loadReport();
	}

	function setToday() {
		const n = new Date();
		currentMonth.value = n.getMonth() + 1;
		currentYear.value = n.getFullYear();
		showPicker.value = false;
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
	const remainingDays = computed(() => Math.max(workingDays.value - totalPayrollDays.value, 0));

	const progressPercentage = computed(() => {
		if (!workingDays.value) return 0;
		return Math.min(Math.round((totalPayrollDays.value / workingDays.value) * 100), 100);
	});

	function slicePercentage(count: number): number {
		if (!workingDays.value) return 0;
		return Math.min(Math.round((count / workingDays.value) * 1000) / 10, 100);
	}

	const att = computed(() => report.value?.attendance);
	const ovt = computed(() => report.value?.overtime);
	const vio = computed(() => report.value?.violations);

	function formatHour(val?: number): string {
		if (!val) return '0h';
		return `${Number(val.toFixed(1))}h`;
	}

	onMounted(loadReport);
</script>

<template>
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

						<!-- Quick actions footer -->
						<div class="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
							<button
								type="button"
								class="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
								@click="setToday"
							>
								Tháng hiện tại
							</button>
							<button
								type="button"
								class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
								@click="showPicker = false"
							>
								Đóng
							</button>
						</div>
					</div>

					<!-- Backdrop to close when clicking outside -->
					<div
						v-if="showPicker"
						class="fixed inset-0 z-40"
						@click="showPicker = false"
					/>
				</div>

				<NuxtLink
					to="/attendance/my"
					class="h-8 inline-flex items-center gap-1.5 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/80 text-xs font-semibold transition-colors"
				>
					<span>Lịch sử chấm công</span>
					<span>→</span>
				</NuxtLink>
			</div>
		</div>

		<!-- Loading state -->
		<div v-if="loading" class="flex items-center justify-center min-h-[220px]">
			<svg class="animate-spin w-7 h-7 text-brand-500" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
			</svg>
		</div>

		<!-- Main 1/3 Chart + 2/3 Detail Content (compact & short) -->
		<div v-else-if="report" class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
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
									{{ formatHour((ovt?.holidayOnlineHours || 0) + (ovt?.holidayOfflineHours || 0)) }}
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
							<p class="text-2xl font-bold text-gray-900 dark:text-white">{{ att?.annualLeaveDays || 0 }} <span class="text-xs font-medium text-gray-500">phép</span></p>
						</div>
						<div class="mt-3 pt-2.5 border-t border-gray-200/60 dark:border-gray-700/60 space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
							<div class="flex justify-between items-center">
								<span>Lễ / Chế độ:</span>
								<span class="font-semibold text-gray-800 dark:text-gray-200">
									{{ (att?.publicHolidayDays || 0) + (att?.welfareLeaveDays || 0) }} ngày
								</span>
							</div>
							<div class="flex justify-between items-center">
								<span>Công tác:</span>
								<span class="font-semibold text-gray-800 dark:text-gray-200">{{ att?.businessTripDays || 0 }} ngày</span>
							</div>
							<div class="flex justify-between items-center">
								<span>Không lương (KL):</span>
								<span class="font-semibold text-gray-800 dark:text-gray-200">{{ att?.unpaidLeaveDays || 0 }} ngày</span>
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
								<span class="font-semibold text-gray-800 dark:text-gray-200">{{ vio?.forgotCheckCount || 0 }} lần</span>
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
							<span class="font-bold text-gray-900 dark:text-white">{{ att?.totalPayrollDays || 0 }} / {{ workingDays }} ngày</span>
						</div>
						<div class="flex items-center gap-1.5">
							<span class="w-2 h-2 rounded-full bg-emerald-500"></span>
							<span class="text-gray-500 dark:text-gray-400 font-medium">Công ăn ca (thực tế):</span>
							<span class="font-bold text-gray-900 dark:text-white">{{ att?.totalActualDays || 0 }} ngày</span>
						</div>
					</div>

					
				</div>
			</div>
		</div>

		<!-- Empty / Error state -->
		<div v-else class="flex flex-col items-center justify-center text-center text-gray-400 min-h-[200px]">
			<p class="text-2xl mb-1">📊</p>
			<p class="text-xs">Chưa có dữ liệu báo cáo</p>
		</div>
	</div>
</template>
