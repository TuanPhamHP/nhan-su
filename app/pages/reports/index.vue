<script setup lang="ts">
	import type { SelectOption } from '~/components/ui/Select.vue';
	import type { AttendanceReportResponse } from '~/types/report.types';

	definePageMeta({ title: 'Báo cáo' });

	const toast = useToast();

	const {
		attendanceReport,
		leaveReport,
		loadingAttendance,
		loadingLeave,
		exportingAttendance,
		exportingLeave,
		fetchAttendanceReport,
		fetchLeaveReport,
		exportAttendanceExcel,
		exportLeaveExcel,
	} = useReports();

	const { departments, fetchAll: fetchDepartments } = useDepartment();
	const { leaveTypes, fetchLeaveTypes } = useLeaveTypes();

	// ─── Tabs ──────────────────────────────────────────────────────────────────
	type Tab = 'attendance' | 'leave';
	const activeTab = ref<Tab>('attendance');

	// ─── Shared helpers ────────────────────────────────────────────────────────
	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = now.getMonth() + 1;
	const DISPLAY_LIMIT = 100;

	const yearOptions = computed<SelectOption[]>(() =>
		Array.from({ length: currentYear - 2019 }, (_, i) => {
			const y = currentYear + 1 - i;
			return { value: y, label: String(y) };
		}),
	);

	const monthOptions = computed<SelectOption[]>(() =>
		Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Tháng ${i + 1}` })),
	);

	const monthOptionsWithAll = computed<SelectOption[]>(() => [
		{ value: undefined, label: 'Cả năm' },
		...monthOptions.value,
	]);

	const departmentOptions = computed<SelectOption[]>(() => [
		{ value: undefined, label: 'Tất cả phòng ban' },
		...departments.value.map(d => ({ value: d.id, label: d.name })),
	]);

	const leaveTypeOptions = computed<SelectOption[]>(() => [
		{ value: undefined, label: 'Tất cả loại phép' },
		...leaveTypes.value.map(t => ({ value: t.id, label: t.name })),
	]);

	// ═══════════════════════════════════════════════════════════════════════════
	// TAB 1 — BẢNG CÔNG
	// ═══════════════════════════════════════════════════════════════════════════
	const attendanceFetched = ref(false);

	const attendanceFilter = reactive({
		year: currentYear,
		month: currentMonth,
		departmentId: undefined as number | undefined,
	});

	const attendanceRows = computed(() => attendanceReport.value.slice(0, DISPLAY_LIMIT));
	const attendanceOverflow = computed(() => attendanceReport.value.length > DISPLAY_LIMIT);

	const attendanceSummary = computed(() => {
		const rows = attendanceReport.value;
		if (!rows.length) return null;
		const n = rows.length;
		const sum = (fn: (r: AttendanceReportResponse) => number) => rows.reduce((s, r) => s + fn(r), 0);
		return {
			totalEmployees: n,
			avgPresent: (sum(r => r.presentDays) / n).toFixed(1),
			avgLate: (sum(r => r.lateDays) / n).toFixed(1),
			avgAbsent: (sum(r => r.absentDays) / n).toFixed(1),
			avgRate: (sum(r => r.attendanceRate) / n).toFixed(1),
		};
	});

	async function viewAttendanceReport() {
		try {
			await fetchAttendanceReport({
				year: attendanceFilter.year,
				month: attendanceFilter.month,
				departmentId: attendanceFilter.departmentId,
			});
			attendanceFetched.value = true;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi tải báo cáo bảng công');
		}
	}

	async function handleExportAttendance() {
		try {
			await exportAttendanceExcel({
				year: attendanceFilter.year,
				month: attendanceFilter.month,
				departmentId: attendanceFilter.departmentId,
			});
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi xuất Excel bảng công');
		}
	}

	function rateClass(rate: number): string {
		if (rate >= 90) return 'text-green-600 dark:text-green-400';
		if (rate >= 80) return 'text-orange-500 dark:text-orange-400';
		return 'text-red-600 dark:text-red-400 font-bold';
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// TAB 2 — NGHỈ PHÉP
	// ═══════════════════════════════════════════════════════════════════════════
	const leaveFetched = ref(false);

	const leaveFilter = reactive({
		year: currentYear,
		month: undefined as number | undefined,
		departmentId: undefined as number | undefined,
		leaveTypeId: undefined as number | undefined,
	});

	const leaveRows = computed(() => leaveReport.value.slice(0, DISPLAY_LIMIT));
	const leaveOverflow = computed(() => leaveReport.value.length > DISPLAY_LIMIT);

	async function viewLeaveReport() {
		try {
			await fetchLeaveReport({
				year: leaveFilter.year,
				month: leaveFilter.month,
				departmentId: leaveFilter.departmentId,
				leaveTypeId: leaveFilter.leaveTypeId,
			});
			leaveFetched.value = true;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi tải báo cáo nghỉ phép');
		}
	}

	async function handleExportLeave() {
		try {
			await exportLeaveExcel({
				year: leaveFilter.year,
				month: leaveFilter.month,
				departmentId: leaveFilter.departmentId,
				leaveTypeId: leaveFilter.leaveTypeId,
			});
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi xuất Excel nghỉ phép');
		}
	}

	function remainingClass(days: number): string {
		if (days < 2) return 'text-red-600 dark:text-red-400 font-semibold';
		if (days <= 5) return 'text-orange-500 dark:text-orange-400 font-medium';
		return 'text-green-600 dark:text-green-400 font-medium';
	}

	// ─── Lifecycle ─────────────────────────────────────────────────────────────
	onMounted(() => {
		fetchDepartments();
		fetchLeaveTypes();
		viewAttendanceReport();
		viewLeaveReport();
	});
</script>

<template>
	<div class="space-y-5">
		<!-- Page header -->
		<div>
			<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Báo cáo</h1>
			<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Xem và xuất báo cáo chấm công, nghỉ phép</p>
		</div>

		<!-- Tabs -->
		<div class="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
			<button
				v-for="tab in [
					{ key: 'attendance', label: 'Bảng công' },
					{ key: 'leave', label: 'Nghỉ phép' },
				] as const"
				:key="tab.key"
				class="px-4 py-1.5 text-sm font-medium rounded-lg transition-all"
				:class="
					activeTab === tab.key
						? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
						: 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
				"
				@click="activeTab = tab.key"
			>
				{{ tab.label }}
			</button>
		</div>

		<!-- ══════════════════════════════ TAB 1: BẢNG CÔNG ══════════════════════════════ -->
		<template v-if="activeTab === 'attendance'">
			<!-- Filter bar -->
			<div class="flex flex-col sm:flex-row flex-wrap gap-3">
				<div class="w-full sm:w-36">
					<UiSelect
						:model-value="attendanceFilter.month"
						:options="monthOptions"
						@update:model-value="attendanceFilter.month = $event as number"
					/>
				</div>
				<div class="w-full sm:w-28">
					<UiSelect
						:model-value="attendanceFilter.year"
						:options="yearOptions"
						@update:model-value="attendanceFilter.year = $event as number"
					/>
				</div>
				<div class="w-full sm:w-48">
					<UiSelect
						:model-value="attendanceFilter.departmentId"
						:options="departmentOptions"
						placeholder="Tất cả phòng ban"
						@update:model-value="attendanceFilter.departmentId = $event as number | undefined"
					/>
				</div>
				<CommonAppButton :loading="loadingAttendance" @click="viewAttendanceReport">
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
						/>
					</svg>
					Xem báo cáo
				</CommonAppButton>
				<CommonAppButton
					variant="secondary"
					:loading="exportingAttendance"
					:disabled="!attendanceFetched || attendanceReport.length === 0"
					@click="handleExportAttendance"
				>
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
						/>
					</svg>
					Xuất Excel
				</CommonAppButton>
			</div>

			<!-- Summary cards -->
			<div v-if="attendanceSummary" class="grid grid-cols-2 sm:grid-cols-5 gap-3">
				<div class="px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
					<p class="text-xs text-gray-500 dark:text-gray-400">Tổng nhân viên</p>
					<p class="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{{ attendanceSummary.totalEmployees }}</p>
				</div>
				<div class="px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
					<p class="text-xs text-gray-500 dark:text-gray-400">TB đi làm (ngày)</p>
					<p class="text-xl font-bold text-green-600 dark:text-green-400 mt-0.5">{{ attendanceSummary.avgPresent }}</p>
				</div>
				<div class="px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
					<p class="text-xs text-gray-500 dark:text-gray-400">TB đi muộn (ngày)</p>
					<p class="text-xl font-bold text-orange-500 dark:text-orange-400 mt-0.5">{{ attendanceSummary.avgLate }}</p>
				</div>
				<div class="px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
					<p class="text-xs text-gray-500 dark:text-gray-400">TB vắng (ngày)</p>
					<p class="text-xl font-bold text-red-600 dark:text-red-400 mt-0.5">{{ attendanceSummary.avgAbsent }}</p>
				</div>
				<div class="px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
					<p class="text-xs text-gray-500 dark:text-gray-400">TB tỷ lệ chuyên cần</p>
					<p class="text-xl font-bold mt-0.5" :class="rateClass(Number(attendanceSummary.avgRate))">
						{{ attendanceSummary.avgRate }}%
					</p>
				</div>
			</div>

			<!-- Overflow warning -->
			<div
				v-if="attendanceOverflow"
				class="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400"
			>
				<svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
					/>
				</svg>
				Đang hiển thị {{ DISPLAY_LIMIT }}/{{ attendanceReport.length }} nhân viên. Xuất Excel để xem đầy đủ.
			</div>

			<!-- Table -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
								<th
									class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
								>
									Mã NV
								</th>
								<th
									class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
								>
									Họ tên
								</th>
								<th
									class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
								>
									Phòng ban
								</th>
								<th
									class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
								>
									Chức vụ
								</th>
								<th
									class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
								>
									Đi làm
								</th>
								<th
									class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
								>
									Đi muộn
								</th>
								<th
									class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
								>
									Vắng
								</th>
								<th
									class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
								>
									Nghỉ phép
								</th>
								<th
									class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
								>
									Phút muộn
								</th>
								<th
									class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
								>
									Tỷ lệ (%)
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<!-- Loading skeleton -->
							<template v-if="loadingAttendance">
								<tr v-for="i in 8" :key="i">
									<td v-for="j in 10" :key="j" class="px-4 py-3">
										<div
											class="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
											:class="j === 2 ? 'w-32' : 'w-14'"
										/>
									</td>
								</tr>
							</template>

							<!-- Empty state — before first fetch -->
							<tr v-else-if="!attendanceFetched">
								<td colspan="10" class="px-4 py-14 text-center">
									<svg
										class="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="1.5"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5"
										/>
									</svg>
									<p class="text-sm text-gray-400 dark:text-gray-500">Chọn tháng và nhấn "Xem báo cáo"</p>
								</td>
							</tr>

							<!-- No data after fetch -->
							<tr v-else-if="attendanceRows.length === 0">
								<td colspan="10" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
									Không có dữ liệu chấm công
								</td>
							</tr>

							<!-- Data rows -->
							<tr
								v-for="row in attendanceRows"
								:key="row.employeeId"
								class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
							>
								<td class="px-4 py-3">
									<span class="font-mono text-xs text-gray-500 dark:text-gray-400">{{ row.employeeCode }}</span>
								</td>
								<td class="px-4 py-3 font-bold text-gray-900 dark:text-white whitespace-nowrap">{{ row.fullName }}</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
									{{ row.departmentName ?? '—' }}
								</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
									{{ row.positionName ?? '—' }}
								</td>
								<td class="px-4 py-3 text-right font-medium text-green-600 dark:text-green-400">
									{{ row.presentDays + row.lateDays }} / {{ row.totalWorkDays }}
								</td>
								<td
									class="px-4 py-3 text-right"
									:class="
										row.lateDays > 0
											? 'text-orange-500 dark:text-orange-400 font-medium'
											: 'text-gray-500 dark:text-gray-400'
									"
								>
									{{ row.lateDays }}
								</td>
								<td
									class="px-4 py-3 text-right"
									:class="
										row.absentDays > 0
											? 'text-red-600 dark:text-red-400 font-medium'
											: 'text-gray-500 dark:text-gray-400'
									"
								>
									{{ row.absentDays }}
								</td>
								<td
									class="px-4 py-3 text-right"
									:class="
										row.onLeaveDays > 0
											? 'text-blue-500 dark:text-blue-400 font-medium'
											: 'text-gray-500 dark:text-gray-400'
									"
								>
									{{ row.onLeaveDays }}
								</td>
								<td
									class="px-4 py-3 text-right"
									:class="
										row.totalLateMinutes > 0
											? 'text-orange-500 dark:text-orange-400 font-medium'
											: 'text-gray-500 dark:text-gray-400'
									"
								>
									{{ row.totalLateMinutes }}
								</td>
								<td class="px-4 py-3 text-right" :class="rateClass(row.attendanceRate)">
									{{ row.attendanceRate.toFixed(1) }}%
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</template>

		<!-- ══════════════════════════════ TAB 2: NGHỈ PHÉP ══════════════════════════════ -->
		<template v-else-if="activeTab === 'leave'">
			<!-- Filter bar -->
			<div class="flex flex-col sm:flex-row flex-wrap gap-3">
				<div class="w-full sm:w-28">
					<UiSelect
						:model-value="leaveFilter.year"
						:options="yearOptions"
						@update:model-value="leaveFilter.year = $event as number"
					/>
				</div>
				<div class="w-full sm:w-36">
					<UiSelect
						:model-value="leaveFilter.month"
						:options="monthOptionsWithAll"
						@update:model-value="leaveFilter.month = $event as number | undefined"
					/>
				</div>
				<div class="w-full sm:w-48">
					<UiSelect
						:model-value="leaveFilter.departmentId"
						:options="departmentOptions"
						placeholder="Tất cả phòng ban"
						@update:model-value="leaveFilter.departmentId = $event as number | undefined"
					/>
				</div>
				<div class="w-full sm:w-44">
					<UiSelect
						:model-value="leaveFilter.leaveTypeId"
						:options="leaveTypeOptions"
						placeholder="Tất cả loại phép"
						@update:model-value="leaveFilter.leaveTypeId = $event as number | undefined"
					/>
				</div>
				<CommonAppButton :loading="loadingLeave" @click="viewLeaveReport">
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
						/>
					</svg>
					Xem báo cáo
				</CommonAppButton>
				<CommonAppButton
					variant="secondary"
					:loading="exportingLeave"
					:disabled="!leaveFetched || leaveReport.length === 0"
					@click="handleExportLeave"
				>
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
						/>
					</svg>
					Xuất Excel
				</CommonAppButton>
			</div>

			<!-- Overflow warning -->
			<div
				v-if="leaveOverflow"
				class="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400"
			>
				<svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
					/>
				</svg>
				Đang hiển thị {{ DISPLAY_LIMIT }}/{{ leaveReport.length }} bản ghi. Xuất Excel để xem đầy đủ.
			</div>

			<!-- Table -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
								<th
									class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
								>
									Mã NV
								</th>
								<th
									class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
								>
									Họ tên
								</th>
								<th
									class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
								>
									Phòng ban
								</th>
								<th
									class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
								>
									Loại phép
								</th>
								<th
									class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
								>
									Tổng đơn
								</th>
								<th
									class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
								>
									Đã duyệt
								</th>
								<th
									class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
								>
									Tổng ngày đã dùng
								</th>
								<th
									class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
								>
									Còn lại
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<!-- Loading skeleton -->
							<template v-if="loadingLeave">
								<tr v-for="i in 8" :key="i">
									<td v-for="j in 8" :key="j" class="px-4 py-3">
										<div
											class="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
											:class="j === 2 ? 'w-28' : 'w-14'"
										/>
									</td>
								</tr>
							</template>

							<!-- Empty state — before first fetch -->
							<tr v-else-if="!leaveFetched">
								<td colspan="8" class="px-4 py-14 text-center">
									<svg
										class="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3"
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
									<p class="text-sm text-gray-400 dark:text-gray-500">Chọn năm và nhấn "Xem báo cáo"</p>
								</td>
							</tr>

							<!-- No data after fetch -->
							<tr v-else-if="leaveRows.length === 0">
								<td colspan="8" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
									Không có dữ liệu nghỉ phép
								</td>
							</tr>

							<!-- Data rows -->
							<tr
								v-for="(row, idx) in leaveRows"
								:key="`${row.employeeId}-${row.leaveTypeCode}-${idx}`"
								class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
							>
								<td class="px-4 py-3">
									<span class="font-mono text-xs text-gray-500 dark:text-gray-400">{{ row.employeeCode }}</span>
								</td>
								<td class="px-4 py-3 font-bold text-gray-900 dark:text-white whitespace-nowrap">{{ row.fullName }}</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
									{{ row.departmentName ?? '—' }}
								</td>
								<td class="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{{ row.leaveTypeName }}</td>
								<td class="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{{ row.totalRequests }}</td>
								<td class="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{{ row.approvedRequests }}</td>
								<td class="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
									{{ row.totalDaysApproved }}
								</td>
								<td class="px-4 py-3 text-right">
									<span v-if="row.remainingBalance === null" class="text-gray-400 dark:text-gray-500">—</span>
									<span v-else :class="remainingClass(row.remainingBalance)">{{ row.remainingBalance }}</span>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</template>
	</div>
</template>
