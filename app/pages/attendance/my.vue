<script setup lang="ts">
	import { formatVNTime, formatShiftDisplay, formatMinutes } from '~/utils/attendance.utils';
	import { violationStatusLabel, violationStatusClass } from '~/utils/violation.utils';
	import type { AttendanceRecordDetail } from '~/types/attendance.types';
	import { useAttendanceService } from '~/services/attendance.service';
	import { useViolationRequestService } from '~/services/violation-request.service';
	import ViolationRequestModal from '~/components/modules/violation/ViolationRequestModal.vue';
	import ViolationDetailModal from '~/components/modules/violation/ViolationDetailModal.vue';
	import type { ViolationCounter, ViolationRequestType, ViolationRequestStatus, ViolationDetailView } from '~/types/violation.types';

	definePageMeta({ title: 'Chấm công của tôi' });

	const attendanceService = useAttendanceService();
	const violationService = useViolationRequestService();
	const toast = useToast();

	// ─── Calendar state ───────────────────────────────────────────────────────────

	const now = new Date();
	const viewYear = ref(now.getFullYear());
	const viewMonth = ref(now.getMonth()); // 0-indexed
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
		'Tháng 1',
		'Tháng 2',
		'Tháng 3',
		'Tháng 4',
		'Tháng 5',
		'Tháng 6',
		'Tháng 7',
		'Tháng 8',
		'Tháng 9',
		'Tháng 10',
		'Tháng 11',
		'Tháng 12',
	];

	function daysInMonth(year: number, month: number) {
		return new Date(year, month + 1, 0).getDate();
	}

	function toDateStr(year: number, month: number, day: number) {
		return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
	}

	const todayStr = computed(() => toDateStr(now.getFullYear(), now.getMonth(), now.getDate()));

	const monthLabel = computed(() => `${MONTH_NAMES[viewMonth.value]}, ${viewYear.value}`);

	const calendarCells = computed(() => {
		const rawDow = new Date(viewYear.value, viewMonth.value, 1).getDay(); // 0=Sun, 1=Mon ...
		const firstDow = (rawDow + 6) % 7; // Mon=0 ... Sun=6
		const total = daysInMonth(viewYear.value, viewMonth.value);
		const cells: Array<{ day: number | null; dateStr: string | null }> = [];
		for (let i = 0; i < firstDow; i++) cells.push({ day: null, dateStr: null });
		for (let d = 1; d <= total; d++) cells.push({ day: d, dateStr: toDateStr(viewYear.value, viewMonth.value, d) });
		while (cells.length % 7 !== 0) cells.push({ day: null, dateStr: null });
		return cells;
	});

	// ─── Styling helpers ──────────────────────────────────────────────────────────

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
		const isToday = dateStr === todayStr.value;
		const isSelected = dateStr === selectedDate.value;

		if (isToday)
			return 'w-8 h-8 rounded-full bg-brand-500 text-white font-semibold flex items-center justify-center text-sm';
		if (isSelected)
			return 'w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white font-semibold flex items-center justify-center text-sm';
		if (!record) return 'w-8 h-8 flex items-center justify-center text-sm text-gray-700 dark:text-gray-300';
		if (record.missingType) return 'w-8 h-8 flex items-center justify-center text-sm text-amber-500 font-medium';
		if (record.status === 'ABSENT') return 'w-8 h-8 flex items-center justify-center text-sm text-red-500 font-medium';
		if (record.status === 'LATE') return 'w-8 h-8 flex items-center justify-center text-sm text-orange-400 font-medium';
		if (record.status === 'LEAVE') return 'w-8 h-8 flex items-center justify-center text-sm text-blue-400 font-medium';
		return 'w-8 h-8 flex items-center justify-center text-sm text-gray-700 dark:text-gray-300';
	}

	// ─── Fetch ────────────────────────────────────────────────────────────────────

	async function fetchMonth() {
		loading.value = true;
		const m = String(viewMonth.value + 1).padStart(2, '0');
		const last = String(daysInMonth(viewYear.value, viewMonth.value)).padStart(2, '0');
		const startDate = `${viewYear.value}-${m}-01`;
		const endDate = `${viewYear.value}-${m}-${last}`;
		try {
			const res = await attendanceService.findMyHistory({ startDate, endDate, limit: 100 });
			records.value = res.data;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không tải được dữ liệu chấm công');
		} finally {
			loading.value = false;
		}
	}

	// ─── Navigation ───────────────────────────────────────────────────────────────

	function prevMonth() {
		if (viewMonth.value === 0) {
			viewMonth.value = 11;
			viewYear.value--;
		} else viewMonth.value--;
		selectedDate.value = null;
		fetchMonth();
	}

	function nextMonth() {
		if (viewMonth.value === 11) {
			viewMonth.value = 0;
			viewYear.value++;
		} else viewMonth.value++;
		selectedDate.value = null;
		fetchMonth();
	}

	function selectDay(dateStr: string | null) {
		if (!dateStr) return;
		selectedDate.value = selectedDate.value === dateStr ? null : dateStr;
	}

	// ─── Selected day display ─────────────────────────────────────────────────────

	const selectedDayLabel = computed(() => {
		if (!selectedDate.value) return '';
		const d = new Date(selectedDate.value + 'T00:00:00');
		const dow = DOW_NAMES[d.getDay()];
		return `${dow}, ngày ${d.getDate()} ${MONTH_NAMES[d.getMonth()].toLowerCase()}, ${d.getFullYear()}`;
	});

	function statusLabel(r: AttendanceRecordDetail): string {
		if (r.missingType === 'MISSING_CHECKIN') return 'Thiếu check-in';
		if (r.missingType === 'MISSING_CHECKOUT') return 'Thiếu check-out';
		if (r.status === 'PRESENT') return 'Đúng giờ';
		if (r.status === 'LATE') return `Đến muộn ${formatMinutes(r.lateMinutes)}`;
		if (r.status === 'ABSENT') return 'Vắng';
		if (r.status === 'LEAVE') return 'Nghỉ phép';
		return r.status;
	}

	function statusBadgeClass(r: AttendanceRecordDetail): string {
		if (r.missingType) return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
		switch (r.status) {
			case 'PRESENT':
				return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
			case 'LATE':
				return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400';
			case 'ABSENT':
				return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
			case 'LEAVE':
				return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
			default:
				return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
		}
	}

	// ─── Violation display helpers ────────────────────────────────────────────────


	// ─── Violation detail modal ───────────────────────────────────────────────────
	const detailViolation = ref<ViolationDetailView | null>(null);
	const detailLoadingId = ref<number | null>(null);

	async function openViolationDetail(id: number) {
		detailLoadingId.value = id;
		try {
			const full = await violationService.findById(id);
			detailViolation.value = full;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không tải được chi tiết phiếu giải trình');
		} finally {
			detailLoadingId.value = null;
		}
	}

	// ─── Violation modal ─────────────────────────────────────────────────────────

	const violationModal = reactive({
		open: false,
		loading: false,
		counter: null as ViolationCounter | null,
		type: undefined as ViolationRequestType | undefined,
		date: undefined as string | undefined,
	});

	async function openViolationModal(type: ViolationRequestType) {
		if (!selectedRecord.value) return;
		violationModal.loading = true;
		try {
			const counter = await violationService.getMyStatus(viewMonth.value + 1, viewYear.value);
			violationModal.counter = counter;
			violationModal.type = type;
			violationModal.date = selectedRecord.value.date;
			violationModal.open = true;
		} catch {
			toast.error('Không tải được thông tin quota vi phạm');
		} finally {
			violationModal.loading = false;
		}
	}

	onMounted(async () => {
		await fetchMonth();
		// Auto-select today when loading the current month
		if (viewYear.value === now.getFullYear() && viewMonth.value === now.getMonth()) {
			selectedDate.value = todayStr.value;
		}
	});
</script>

<template>
	<div class="space-y-5">
		<!-- Page title -->
		<div>
			<h1 class="text-lg font-semibold text-gray-900 dark:text-white">Chấm công của tôi</h1>
			<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Lịch sử chấm công cá nhân theo tháng</p>
		</div>

		<!-- Stats row -->
		<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
			<div
				class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 text-center"
			>
				<p class="text-2xl font-bold text-gray-900 dark:text-white">{{ loading ? '—' : stats.attendanceDays }}</p>
				<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Ngày đi làm</p>
			</div>
			<div
				class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 text-center"
			>
				<p class="text-2xl font-bold text-orange-500">{{ loading ? '—' : stats.lateDays }}</p>
				<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Đến muộn</p>
			</div>
			<div
				class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 text-center"
			>
				<p class="text-2xl font-bold text-yellow-500">{{ loading ? '—' : stats.earlyOutDays }}</p>
				<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Về sớm</p>
			</div>
			<div
				class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 text-center"
			>
				<p class="text-2xl font-bold text-red-500">{{ loading ? '—' : stats.noRecord }}</p>
				<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Vắng</p>
			</div>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
			<!-- Calendar card -->
			<div
				class="lg:col-span-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
			>
				<!-- Month navigation -->
				<div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
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
								class="min-h-[56px] flex items-center justify-center border-b border-gray-100 dark:border-gray-700"
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
								class="min-h-[56px] flex flex-col items-center pt-2 pb-1.5 border-b border-gray-100 dark:border-gray-700 transition-colors"
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
										:class="statusDotColor(recordsByDate.get(cell.dateStr)!)"
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
			</div>

			<!-- Detail panel -->
			<div class="lg:col-span-1">
				<!-- No day selected -->
				<div
					v-if="!selectedDate"
					class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 flex flex-col items-center justify-center text-center min-h-48"
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
					<p class="text-sm text-gray-400 dark:text-gray-500">Chọn một ngày để xem chi tiết chấm công</p>
				</div>

				<!-- Day selected — no record -->
				<div
					v-else-if="!selectedRecord"
					class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6"
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
					class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 space-y-4"
				>
					<!-- Date + status -->
					<div>
						<p class="text-xs font-medium text-gray-400 dark:text-gray-500 mb-2">{{ selectedDayLabel }}</p>
						<div class="flex items-center gap-2">
							<span
								class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
								:class="statusBadgeClass(selectedRecord)"
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
						<p v-if="selectedRecord.isHalfDay" class="text-xs text-blue-500 dark:text-blue-400 mt-1">Nghỉ nửa ngày</p>
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

					<!-- Location -->
					<div v-if="selectedRecord.location" class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
						<svg
							class="w-3.5 h-3.5 flex-shrink-0"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
							/>
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

					<!-- Missing checkin / checkout warning -->
					<div
						v-if="selectedRecord.missingType"
						class="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30"
					>
						<div>
							<p class="text-xs font-medium text-amber-700 dark:text-amber-400">
								{{ selectedRecord.missingType === 'MISSING_CHECKIN' ? 'Thiếu check-in' : 'Thiếu check-out' }}
							</p>
							<p class="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
								{{ selectedRecord.isLocked ? 'Bản ghi đã bị khóa' : 'Chấm công không đầy đủ' }}
							</p>
						</div>
						<NuxtLink
							v-if="selectedRecord.missingType === 'MISSING_CHECKOUT'"
							to="/attendance/makeup"
							class="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline flex-shrink-0"
						>
							Tạo đơn bù công
						</NuxtLink>
					</div>

					<!-- Linked violation requests -->
					<div
						v-if="selectedRecord.violationRequests.length > 0"
						class="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2"
					>
						<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
							Phiếu giải trình đã nộp
						</p>
						<div class="space-y-1.5">
							<button
								v-for="vr in selectedRecord.violationRequests"
								:key="vr.id"
								:disabled="detailLoadingId === vr.id"
								class="w-full text-left p-2.5 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 hover:border-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
								@click="openViolationDetail(vr.id)"
							>
								<div class="flex items-center justify-between gap-2 mb-1">
									<span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ vr.typeLabel }}</span>
									<div class="flex items-center gap-1 flex-shrink-0">
										<span
											class="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium"
											:class="violationStatusClass(vr.status)"
										>
											{{ violationStatusLabel(vr.status) }}
										</span>
										<svg
											v-if="detailLoadingId !== vr.id"
											class="w-3.5 h-3.5 text-gray-400"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											stroke-width="2"
										>
											<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
										</svg>
										<svg
											v-else
											class="w-3.5 h-3.5 text-gray-400 animate-spin"
											fill="none"
											viewBox="0 0 24 24"
										>
											<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
											<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
										</svg>
									</div>
								</div>
								<p class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{{ vr.reason }}</p>
								<p v-if="vr.reviewNote" class="text-xs text-red-600 dark:text-red-400 mt-1 italic">
									↳ {{ vr.reviewNote }}
								</p>
							</button>
						</div>
					</div>

					<!-- Violation actions -->
					<div
						v-if="selectedRecord.lateMinutes > 0 || selectedRecord.earlyMinutes > 0 || (selectedRecord.status === 'ABSENT' && selectedRecord.isLocked) || selectedRecord.missingType === 'MISSING_CHECKIN'"
						class="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2"
					>
						<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
							Tạo phiếu giải trình
						</p>
						<div class="flex flex-col gap-1.5">
							<button
								v-if="selectedRecord.lateMinutes > 0"
								:disabled="violationModal.loading"
								class="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-orange-200 dark:border-orange-800/40 bg-orange-50 dark:bg-orange-900/10 text-orange-700 dark:text-orange-400 text-xs font-medium hover:bg-orange-100 dark:hover:bg-orange-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
								@click="openViolationModal('LATE')"
							>
								<span>Giải trình đi muộn</span>
								<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
								</svg>
							</button>

							<button
								v-if="selectedRecord.earlyMinutes > 0"
								:disabled="violationModal.loading"
								class="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-800/40 bg-purple-50 dark:bg-purple-900/10 text-purple-700 dark:text-purple-400 text-xs font-medium hover:bg-purple-100 dark:hover:bg-purple-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
								@click="openViolationModal('EARLY')"
							>
								<span>Giải trình về sớm</span>
								<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
								</svg>
							</button>

							<button
								v-if="selectedRecord.missingType === 'MISSING_CHECKIN'"
								:disabled="violationModal.loading"
								class="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
								@click="openViolationModal('FORGOT_CHECKIN')"
							>
								<span>Giải trình thiếu check-in</span>
								<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
								</svg>
							</button>

							<button
								v-if="selectedRecord.status === 'ABSENT' && selectedRecord.isLocked"
								:disabled="violationModal.loading"
								class="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
								@click="openViolationModal('FORGOT_CHECKIN')"
							>
								<span>Giải trình vắng / quên chấm</span>
								<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
								</svg>
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<Teleport to="body">
		<ViolationRequestModal
			v-if="violationModal.open && violationModal.counter"
			:counter="violationModal.counter"
			:initial-type="violationModal.type"
			:initial-date="violationModal.date"
			@submitted="violationModal.open = false"
			@close="violationModal.open = false"
		/>
		<ViolationDetailModal
			v-if="detailViolation"
			:violation-request="detailViolation"
			@close="detailViolation = null"
		/>
	</Teleport>
</template>
