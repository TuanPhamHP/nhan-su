<script setup lang="ts">
	import { formatVNTime, formatShiftDisplay, formatMinutes } from '~/utils/attendance.utils';
	import type { AttendanceRecordDetail } from '~/types/attendance.types';
	import { useAttendanceService } from '~/services/attendance.service';

	const props = defineProps<{
		employeeId: number;
		employeeName: string;
		employeeCode: string;
		initialYear: number;
		initialMonth: number; // 1-indexed
	}>();

	const emit = defineEmits<{ close: [] }>();

	const attendanceService = useAttendanceService();
	const toast = useToast();

	// ─── Calendar state ───────────────────────────────────────────────────────────

	const viewYear = ref(props.initialYear);
	const viewMonth = ref(props.initialMonth - 1); // 0-indexed internally
	const selectedDate = ref<string | null>(null);

	// ─── Data ─────────────────────────────────────────────────────────────────────

	const records = ref<AttendanceRecordDetail[]>([]);
	const loading = ref(false);

	const recordsByDate = computed(() => {
		const map = new Map<string, AttendanceRecordDetail>();
		for (const r of records.value) map.set(r.date, r);
		return map;
	});

	const selectedRecord = computed(() =>
		selectedDate.value ? (recordsByDate.value.get(selectedDate.value) ?? null) : null,
	);

	// ─── Stats ────────────────────────────────────────────────────────────────────

	const stats = computed(() => ({
		attendanceDays: records.value.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length,
		lateDays: records.value.filter(r => r.lateMinutes > 0).length,
		earlyOutDays: records.value.filter(r => r.earlyMinutes > 0).length,
		noRecord: records.value.filter(r => r.status === 'ABSENT').length,
	}));

	// ─── Calendar helpers ─────────────────────────────────────────────────────────

	const DOW_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
	const DOW_NAMES = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
	const MONTH_NAMES = [
		'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
		'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
	];

	function daysInMonth(year: number, month: number) {
		return new Date(year, month + 1, 0).getDate();
	}

	function toDateStr(year: number, month: number, day: number) {
		return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
	}

	const now = new Date();
	const todayStr = computed(() => toDateStr(now.getFullYear(), now.getMonth(), now.getDate()));

	const monthLabel = computed(() => `${MONTH_NAMES[viewMonth.value]}, ${viewYear.value}`);

	const calendarCells = computed(() => {
		const rawDow = new Date(viewYear.value, viewMonth.value, 1).getDay();
		const firstDow = (rawDow + 6) % 7;
		const total = daysInMonth(viewYear.value, viewMonth.value);
		const cells: Array<{ day: number | null; dateStr: string | null }> = [];
		for (let i = 0; i < firstDow; i++) cells.push({ day: null, dateStr: null });
		for (let d = 1; d <= total; d++) cells.push({ day: d, dateStr: toDateStr(viewYear.value, viewMonth.value, d) });
		while (cells.length % 7 !== 0) cells.push({ day: null, dateStr: null });
		return cells;
	});

	// ─── Styling helpers ──────────────────────────────────────────────────────────

	function statusDotColor(status: string): string {
		switch (status) {
			case 'PRESENT': return 'bg-green-500';
			case 'LATE': return 'bg-orange-400';
			case 'ABSENT': return 'bg-red-500';
			case 'LEAVE': return 'bg-blue-400';
			default: return '';
		}
	}

	function dayNumberStyle(dateStr: string, record: AttendanceRecordDetail | undefined): string {
		const isToday = dateStr === todayStr.value;
		const isSelected = dateStr === selectedDate.value;
		if (isToday)
			return 'w-8 h-8 rounded-full bg-brand-500 text-white font-semibold flex items-center justify-center text-sm';
		if (isSelected)
			return 'w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white font-semibold flex items-center justify-center text-sm';
		if (!record) return 'w-8 h-8 flex items-center justify-center text-sm text-gray-700 dark:text-gray-300';
		if (record.status === 'ABSENT') return 'w-8 h-8 flex items-center justify-center text-sm text-red-500 font-medium';
		if (record.status === 'LATE') return 'w-8 h-8 flex items-center justify-center text-sm text-orange-400 font-medium';
		if (record.status === 'LEAVE') return 'w-8 h-8 flex items-center justify-center text-sm text-blue-400 font-medium';
		return 'w-8 h-8 flex items-center justify-center text-sm text-gray-700 dark:text-gray-300';
	}

	function statusLabel(r: AttendanceRecordDetail): string {
		if (r.status === 'PRESENT') return 'Đúng giờ';
		if (r.status === 'LATE') return `Đến muộn ${formatMinutes(r.lateMinutes)}`;
		if (r.status === 'ABSENT') return 'Vắng';
		if (r.status === 'LEAVE') return 'Nghỉ phép';
		return r.status;
	}

	function statusBadgeClass(status: string): string {
		switch (status) {
			case 'PRESENT': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
			case 'LATE': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400';
			case 'ABSENT': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
			case 'LEAVE': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
			default: return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
		}
	}

	const selectedDayLabel = computed(() => {
		if (!selectedDate.value) return '';
		const d = new Date(selectedDate.value + 'T00:00:00');
		const dow = DOW_NAMES[d.getDay()];
		return `${dow}, ngày ${d.getDate()} ${MONTH_NAMES[d.getMonth()].toLowerCase()}, ${d.getFullYear()}`;
	});

	// ─── Fetch ────────────────────────────────────────────────────────────────────

	async function fetchMonth() {
		loading.value = true;
		const m = String(viewMonth.value + 1).padStart(2, '0');
		const last = String(daysInMonth(viewYear.value, viewMonth.value)).padStart(2, '0');
		const startDate = `${viewYear.value}-${m}-01`;
		const endDate = `${viewYear.value}-${m}-${last}`;
		try {
			const res = await attendanceService.findAll({ startDate, endDate, employeeId: props.employeeId, limit: 100 });
			records.value = res.data;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không tải được dữ liệu chấm công');
		} finally {
			loading.value = false;
		}
	}

	// ─── Navigation ───────────────────────────────────────────────────────────────

	function prevMonth() {
		if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value--; }
		else viewMonth.value--;
		selectedDate.value = null;
		fetchMonth();
	}

	function nextMonth() {
		if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++; }
		else viewMonth.value++;
		selectedDate.value = null;
		fetchMonth();
	}

	function selectDay(dateStr: string | null) {
		if (!dateStr) return;
		selectedDate.value = selectedDate.value === dateStr ? null : dateStr;
	}

	// ─── Close on Escape ─────────────────────────────────────────────────────────

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') emit('close');
	}

	onMounted(() => {
		fetchMonth();
		document.addEventListener('keydown', onKeydown);
	});

	onUnmounted(() => {
		document.removeEventListener('keydown', onKeydown);
	});
</script>

<template>
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		@click.self="emit('close')"
	>
		<!-- Dialog -->
		<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
				<div>
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ employeeName }}</h2>
					<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
						{{ employeeCode }} · Chi tiết chấm công theo tháng
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
				<!-- Stats row -->
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
					<div class="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
						<p class="text-2xl font-bold text-gray-900 dark:text-white">{{ loading ? '—' : stats.attendanceDays }}</p>
						<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Ngày đi làm</p>
					</div>
					<div class="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
						<p class="text-2xl font-bold text-orange-500">{{ loading ? '—' : stats.lateDays }}</p>
						<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Đến muộn</p>
					</div>
					<div class="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
						<p class="text-2xl font-bold text-yellow-500">{{ loading ? '—' : stats.earlyOutDays }}</p>
						<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Về sớm</p>
					</div>
					<div class="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
						<p class="text-2xl font-bold text-red-500">{{ loading ? '—' : stats.noRecord }}</p>
						<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Vắng</p>
					</div>
				</div>

				<!-- Calendar + Detail -->
				<div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
					<!-- Calendar card -->
					<div class="lg:col-span-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
						<!-- Month navigation -->
						<div class="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-700">
							<button
								type="button"
								class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
								@click="prevMonth"
							>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
								</svg>
							</button>
							<span class="text-sm font-semibold text-gray-800 dark:text-gray-200">{{ monthLabel }}</span>
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

						<!-- Calendar grid -->
						<div class="p-4">
							<div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
								<!-- Day of week header -->
								<div class="grid grid-cols-7 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
									<div
										v-for="(label, i) in DOW_LABELS"
										:key="label"
										class="text-center text-xs font-semibold py-2.5"
										:class="[
											label === 'CN' || label === 'T7' ? 'text-red-400' : 'text-gray-500 dark:text-gray-400',
											i < 6 ? 'border-r border-gray-200 dark:border-gray-700' : '',
										]"
									>
										{{ label }}
									</div>
								</div>

								<!-- Loading skeleton -->
								<div v-if="loading" class="grid grid-cols-7">
									<div
										v-for="i in 35"
										:key="i"
										class="min-h-[52px] flex items-center justify-center border-b border-gray-100 dark:border-gray-700"
										:class="[
											(i - 1) % 7 < 6 ? 'border-r border-gray-100 dark:border-gray-700' : '',
											i > 28 ? 'border-b-0' : '',
										]"
									>
										<div class="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse" />
									</div>
								</div>

								<!-- Day cells -->
								<div v-else class="grid grid-cols-7">
									<div
										v-for="(cell, idx) in calendarCells"
										:key="idx"
										class="min-h-[52px] flex flex-col items-center pt-2 pb-1.5 border-b border-gray-100 dark:border-gray-700 transition-colors"
										:class="[
											idx % 7 < 6 ? 'border-r border-gray-100 dark:border-gray-700' : '',
											idx >= calendarCells.length - 7 ? 'border-b-0' : '',
											idx % 7 >= 5 ? 'bg-gray-50/60 dark:bg-gray-800/25' : '',
											cell.dateStr ? 'cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-900/10' : '',
										]"
										@click="selectDay(cell.dateStr)"
									>
										<template v-if="cell.day && cell.dateStr">
											<div :class="dayNumberStyle(cell.dateStr, recordsByDate.get(cell.dateStr))">
												{{ cell.day }}
											</div>
											<div
												v-if="recordsByDate.has(cell.dateStr)"
												class="mt-1 w-1.5 h-1.5 rounded-full"
												:class="statusDotColor(recordsByDate.get(cell.dateStr)!.status)"
											/>
											<div v-else class="mt-1 w-1.5 h-1.5" />
										</template>
									</div>
								</div>
							</div>

							<!-- Legend -->
							<div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4">
								<div class="flex items-center gap-1.5">
									<span class="w-2 h-2 rounded-full bg-green-500 inline-block" />
									<span class="text-xs text-gray-500 dark:text-gray-400">Đúng giờ</span>
								</div>
								<div class="flex items-center gap-1.5">
									<span class="w-2 h-2 rounded-full bg-orange-400 inline-block" />
									<span class="text-xs text-gray-500 dark:text-gray-400">Đến muộn</span>
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
					</div>

					<!-- Detail panel -->
					<div class="lg:col-span-1">
						<!-- No day selected -->
						<div
							v-if="!selectedDate"
							class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col items-center justify-center text-center min-h-48"
						>
							<svg
								class="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="1.5"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5"
								/>
							</svg>
							<p class="text-sm text-gray-400 dark:text-gray-500">Chọn một ngày để xem chi tiết</p>
						</div>

						<!-- Day selected — no record -->
						<div
							v-else-if="!selectedRecord"
							class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6"
						>
							<p class="text-xs font-medium text-gray-400 dark:text-gray-500 mb-3">{{ selectedDayLabel }}</p>
							<div class="flex flex-col items-center justify-center py-6 text-center">
								<svg
									class="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2"
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
								<p class="text-sm text-gray-500 dark:text-gray-400">Không có dữ liệu chấm công</p>
								<p class="text-xs text-gray-400 dark:text-gray-600 mt-1">Ngày nghỉ hoặc chưa có lịch ca</p>
							</div>
						</div>

						<!-- Day selected — has record -->
						<div
							v-else
							class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4"
						>
							<!-- Date + status -->
							<div>
								<p class="text-xs font-medium text-gray-400 dark:text-gray-500 mb-2">{{ selectedDayLabel }}</p>
								<div class="flex items-center gap-2 flex-wrap">
									<span
										class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
										:class="statusBadgeClass(selectedRecord.status)"
									>
										{{ statusLabel(selectedRecord) }}
									</span>
									<span
										v-if="selectedRecord.isLocked"
										class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
									>
										<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
											/>
										</svg>
										Đã khóa
									</span>
									<span
										v-if="selectedRecord.isManual"
										class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
									>
										Thủ công
									</span>
								</div>
							</div>

							<!-- Shift info -->
							<div v-if="selectedRecord.shift" class="p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
								<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
									{{ selectedRecord.shift.name }}
								</p>
								<p class="text-xs text-gray-500 dark:text-gray-400">
									<span class="font-medium text-gray-700 dark:text-gray-300">Giờ bắt đầu:</span>
									{{
										selectedRecord.isHalfDay && selectedRecord.effectiveStart
											? formatVNTime(selectedRecord.effectiveStart)
											: selectedRecord.shift.checkInTime
									}}
								</p>
								<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
									{{ formatShiftDisplay(selectedRecord) }}
								</p>
								<p v-if="selectedRecord.isHalfDay" class="text-xs text-blue-500 dark:text-blue-400 mt-1">
									Nghỉ nửa ngày
								</p>
							</div>

							<!-- Times -->
							<div class="space-y-3">
								<!-- Check-in -->
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<div class="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
										<span class="text-xs text-gray-500 dark:text-gray-400">Vào</span>
									</div>
									<div class="text-right">
										<span v-if="selectedRecord.checkInAt" class="text-sm font-semibold text-gray-800 dark:text-gray-200">
											{{ formatVNTime(selectedRecord.checkInAt) }}
										</span>
										<span v-else class="text-sm text-gray-400 dark:text-gray-500 italic">Chưa chấm công</span>
										<span v-if="selectedRecord.lateMinutes > 0" class="ml-1.5 text-xs text-orange-500">
											(muộn {{ formatMinutes(selectedRecord.lateMinutes) }})
										</span>
									</div>
								</div>

								<!-- Check-out -->
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<div class="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
										<span class="text-xs text-gray-500 dark:text-gray-400">Ra</span>
									</div>
									<div class="text-right">
										<span v-if="selectedRecord.checkOutAt" class="text-sm font-semibold text-gray-800 dark:text-gray-200">
											{{ formatVNTime(selectedRecord.checkOutAt) }}
										</span>
										<span v-else class="text-sm text-gray-400 dark:text-gray-500 italic">
											{{ selectedRecord.isLocked ? 'Chưa check-out' : 'Chưa kết thúc' }}
										</span>
										<span v-if="selectedRecord.earlyMinutes > 0" class="ml-1.5 text-xs text-yellow-500">
											(sớm {{ formatMinutes(selectedRecord.earlyMinutes) }})
										</span>
									</div>
								</div>
							</div>

							<!-- Work type -->
							<div
								v-if="selectedRecord.workType"
								class="flex items-center gap-2 text-xs"
							>
								<span class="text-gray-500 dark:text-gray-400">Hình thức:</span>
								<span
									class="px-2 py-0.5 rounded-full font-medium"
									:class="{
										'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400': selectedRecord.workType === 'ONLINE_APPROVED' || selectedRecord.workType === 'ONLINE_T7',
										'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300': selectedRecord.workType === 'OFFLINE',
									}"
								>
									{{
										selectedRecord.workType === 'ONLINE_APPROVED' ? 'Online (duyệt)'
										: selectedRecord.workType === 'ONLINE_T7' ? 'Online T7'
										: 'Offline'
									}}
								</span>
							</div>

							<!-- Location -->
							<div v-if="selectedRecord.location" class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
								<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
									<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
								</svg>
								<span>{{ selectedRecord.location.name }}</span>
								<span v-if="selectedRecord.distance !== null" class="text-gray-400 dark:text-gray-600">
									· {{ selectedRecord.distance }}m
								</span>
							</div>

							<!-- Note -->
							<div
								v-if="selectedRecord.note"
								class="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30"
							>
								<p class="text-xs text-amber-700 dark:text-amber-400">{{ selectedRecord.note }}</p>
							</div>

							<!-- Missing checkout badge -->
							<div
								v-if="selectedRecord.isLocked && selectedRecord.missingType"
								class="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/30"
							>
								<svg class="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
								</svg>
								<div>
									<p class="text-xs font-medium text-red-700 dark:text-red-400">Chưa check-out</p>
									<p class="text-xs text-red-500 dark:text-red-500 mt-0.5">Bản ghi đã bị khóa tự động</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
