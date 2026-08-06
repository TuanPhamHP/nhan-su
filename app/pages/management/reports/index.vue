<script setup lang="ts">
	import type { SelectOption } from '~/components/ui/Select.vue';
	import type { DropdownMenuItem } from '~/components/ui/DropdownMenu.vue';
	import type { AttendanceReportResponse, LeaveReportResponse } from '~/types/report.types';
	import EmployeeAttendanceDetailModal from '~/components/modules/attendance/EmployeeAttendanceDetailModal.vue';
	import EmployeeLeaveReportModal from '~/components/modules/report/EmployeeLeaveReportModal.vue';
	import EmployeeMonthlyReportModal from '~/components/modules/report/EmployeeMonthlyReportModal.vue';

	definePageMeta({ title: 'Báo cáo' });

	const toast = useToast();

	const {
		attendanceReport,
		attendanceMeta,
		leaveReport,
		loadingAttendance,
		loadingLeave,
		exportingAttendance,
		exportingAttendanceDetail,
		exportingEmployeesMonthly,
		exportingLeave,
		fetchAttendanceReport,
		fetchLeaveReport,
		exportAttendanceExcel,
		exportAttendanceDetailExcel,
		exportEmployeesMonthlyExcel,
		exportLeaveExcel,
	} = useReports();

	const { departments, fetchAll: fetchDepartments } = useDepartment();
	const { leaveTypes, fetchLeaveTypes } = useLeaveTypes();

	const authStore = useAuthStore();
	const { user } = storeToRefs(authStore);
	const isManager = computed(() => user.value?.role === 'MANAGER');
	const managerDepartmentId = computed(() => user.value?.department?.id);

	// ─── Tabs ──────────────────────────────────────────────────────────────────
	type Tab = 'attendance' | 'leave';
	const activeTab = ref<Tab>('attendance');

	// ─── Shared helpers ────────────────────────────────────────────────────────
	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = now.getMonth() + 1;
	const DISPLAY_LIMIT = 100;
	const PAGE_SIZE_OPTIONS: SelectOption[] = [
		{ value: 10, label: '10' },
		{ value: 20, label: '20' },
		{ value: 50, label: '50' },
		{ value: 100, label: '100' },
	];

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

	const departmentOptions = computed(() => {
		if (isManager.value && managerDepartmentId.value) {
			const dep = departments.value.find(d => d.id === managerDepartmentId.value);
			return dep ? [{ value: dep.id, label: dep.name }] : [];
		}
		return [{ value: 0, label: 'Tất cả phòng ban' }, ...departments.value.map(d => ({ value: d.id, label: d.name }))];
	});

	const leaveTypeOptions = computed<SelectOption[]>(() => [
		{ value: undefined, label: 'Tất cả loại phép' },
		...leaveTypes.value.map(t => ({ value: t.id, label: t.name })),
	]);

	// ═══════════════════════════════════════════════════════════════════════════
	// TAB 1 — BẢNG CÔNG
	// ═══════════════════════════════════════════════════════════════════════════
	const attendanceFetched = ref(false);
	const attendanceDirty = ref(false);

	const attendanceFilter = reactive({
		year: currentYear,
		month: currentMonth,
		departmentId: (isManager.value ? managerDepartmentId.value : undefined) as number | undefined,
		search: '',
		page: 1,
		limit: 10,
	});

	// Search input tách khỏi filter.search để debounce raw typing.
	const attendanceSearchInput = ref('');
	let attendanceSearchTimer: ReturnType<typeof setTimeout> | null = null;

	function onAttendanceSearchInput(val: string) {
		attendanceSearchInput.value = val;
		if (attendanceSearchTimer) clearTimeout(attendanceSearchTimer);
		attendanceSearchTimer = setTimeout(() => {
			attendanceFilter.search = val.trim();
			attendanceFilter.page = 1;
			viewAttendanceReport();
		}, 400);
	}

	// Đổi các "heavy" filter (year/month/dept) → dirty, chờ user bấm nút.
	// KHÔNG watch page/limit ở đây để tránh trigger dirty khi phân trang.
	watch(
		() => [attendanceFilter.year, attendanceFilter.month, attendanceFilter.departmentId],
		() => {
			if (attendanceFetched.value) attendanceDirty.value = true;
		},
	);

	// Summary tính trên page hiện tại (BE chưa có endpoint aggregate).
	const attendanceSummary = computed(() => {
		const rows = attendanceReport.value;
		if (!rows.length) return null;
		const n = rows.length;
		const sum = (fn: (r: AttendanceReportResponse) => number) => rows.reduce((s, r) => s + fn(r), 0);
		return {
			avgPresent: (sum(r => r.presentDays + r.lateDays) / n).toFixed(1),
			avgLate: (sum(r => r.lateDays) / n).toFixed(1),
			avgAbsent: (sum(r => r.absentDays) / n).toFixed(1),
			avgRate: (sum(r => r.attendanceRate) / n).toFixed(1),
		};
	});

	const hasAttendanceFilter = computed(() => !!attendanceFilter.search || !!attendanceFilter.departmentId);

	// Fallback về length khi BE chưa trả meta — vẫn hiển thị đầy đủ text.
	const attendanceTotalText = computed(() => String(attendanceMeta.value?.total ?? attendanceReport.value.length));
	const attendancePageRangeText = computed(() => {
		const meta = attendanceMeta.value;
		if (meta) {
			const start = (meta.page - 1) * meta.limit + 1;
			const end = Math.min(meta.page * meta.limit, meta.total);
			return `${start}–${end}`;
		}
		return `1–${attendanceReport.value.length}`;
	});

	async function viewAttendanceReport() {
		try {
			await fetchAttendanceReport({
				year: attendanceFilter.year,
				month: attendanceFilter.month,
				departmentId: attendanceFilter.departmentId,
				search: attendanceFilter.search || undefined,
				page: attendanceFilter.page,
				limit: attendanceFilter.limit,
			});
			attendanceFetched.value = true;
			attendanceDirty.value = false;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi tải báo cáo bảng công');
		}
	}

	function onAttendanceViewClick() {
		attendanceFilter.page = 1;
		viewAttendanceReport();
	}

	function onAttendancePageChange(page: number) {
		attendanceFilter.page = page;
		viewAttendanceReport();
	}

	function onAttendanceLimitChange(limit: string | number | undefined) {
		if (typeof limit !== 'number') return;
		attendanceFilter.limit = limit;
		attendanceFilter.page = 1;
		viewAttendanceReport();
	}

	async function handleExportAttendance() {
		try {
			// BE ignore page/limit ở export nhưng vẫn respect search + các filter khác.
			await exportAttendanceExcel({
				year: attendanceFilter.year,
				month: attendanceFilter.month,
				departmentId: attendanceFilter.departmentId,
				search: attendanceFilter.search || undefined,
			});
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi xuất Excel bảng công');
		}
	}

	async function handleExportAttendanceDetail() {
		try {
			await exportAttendanceDetailExcel({
				year: attendanceFilter.year,
				month: attendanceFilter.month,
				departmentId: attendanceFilter.departmentId,
				search: attendanceFilter.search || undefined,
			});
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi xuất Excel bảng công chi tiết');
		}
	}

	// ─── Export dropdown ───────────────────────────────────────────────────────
	const exportMenuOpen = ref(false);
	const exportMenuRef = ref<HTMLElement | null>(null);

	const isExporting = computed(
		() => exportingAttendance.value || exportingAttendanceDetail.value || exportingEmployeesMonthly.value,
	);
	const canExport = computed(() => attendanceFetched.value && attendanceReport.value.length > 0);

	function toggleExportMenu() {
		if (!canExport.value) return;
		exportMenuOpen.value = !exportMenuOpen.value;
	}

	function runExport(fn: () => Promise<void>) {
		exportMenuOpen.value = false;
		fn();
	}

	function onExportClickOutside(e: MouseEvent) {
		if (!exportMenuOpen.value) return;
		if (!exportMenuRef.value?.contains(e.target as Node)) exportMenuOpen.value = false;
	}

	onMounted(() => document.addEventListener('mousedown', onExportClickOutside));
	onUnmounted(() => document.removeEventListener('mousedown', onExportClickOutside));

	async function handleExportEmployeesMonthly() {
		try {
			await exportEmployeesMonthlyExcel({
				month: attendanceFilter.month,
				year: attendanceFilter.year,
				departmentId: attendanceFilter.departmentId,
				search: attendanceFilter.search || undefined,
			});
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi xuất Excel báo cáo công');
		}
	}

	function rateClass(rate: number): string {
		if (rate >= 90) return 'text-green-600 dark:text-green-400';
		if (rate >= 80) return 'text-orange-500 dark:text-orange-400';
		return 'text-red-600 dark:text-red-400 font-bold';
	}

	// ─── Employee detail modals (chấm công + báo cáo công tháng) ────────────────
	const detailEmployee = ref<AttendanceReportResponse | null>(null);
	const monthlyReportEmployee = ref<AttendanceReportResponse | null>(null);

	function openAttendanceDetail(row: AttendanceReportResponse) {
		detailEmployee.value = row;
	}

	function openMonthlyReport(row: AttendanceReportResponse) {
		monthlyReportEmployee.value = row;
	}

	function attendanceRowActions(row: AttendanceReportResponse): DropdownMenuItem[] {
		return [
			{
				label: 'Chi tiết chấm công',
				icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5',
				action: () => openAttendanceDetail(row),
			},
			{
				label: 'Chi tiết báo cáo công',
				icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
				action: () => openMonthlyReport(row),
			},
		];
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// TAB 2 — NGHỈ PHÉP
	// ═══════════════════════════════════════════════════════════════════════════
	const leaveFetched = ref(false);
	const leaveDirty = ref(false);

	const leaveFilter = reactive({
		year: currentYear,
		month: undefined as number | undefined,
		departmentId: (isManager.value ? managerDepartmentId.value : undefined) as number | undefined,
		leaveTypeId: undefined as number | undefined,
		search: '',
	});

	watch(leaveFilter, () => {
		if (leaveFetched.value) leaveDirty.value = true;
	});

	interface LeaveEmployeeGroup {
		employeeId: number;
		employeeCode: string;
		fullName: string;
		departmentName: string | null;
		rows: LeaveReportResponse[];
		totalRequests: number;
		approvedRequests: number;
		pendingRequests: number;
		totalDaysApproved: number;
	}

	const leaveGroups = computed<LeaveEmployeeGroup[]>(() => {
		const map = new Map<number, LeaveEmployeeGroup>();
		for (const row of leaveReport.value) {
			let group = map.get(row.employeeId);
			if (!group) {
				group = {
					employeeId: row.employeeId,
					employeeCode: row.employeeCode,
					fullName: row.fullName,
					departmentName: row.departmentName,
					rows: [],
					totalRequests: 0,
					approvedRequests: 0,
					pendingRequests: 0,
					totalDaysApproved: 0,
				};
				map.set(row.employeeId, group);
			}
			group.rows.push(row);
			group.totalRequests += row.totalRequests;
			group.approvedRequests += row.approvedRequests;
			group.pendingRequests += row.pendingRequests;
			group.totalDaysApproved += row.totalDaysApproved;
		}
		return Array.from(map.values());
	});

	const leaveRows = computed(() => leaveGroups.value.slice(0, DISPLAY_LIMIT));
	const leaveOverflow = computed(() => leaveGroups.value.length > DISPLAY_LIMIT);

	const detailLeaveEmployee = ref<LeaveEmployeeGroup | null>(null);

	async function viewLeaveReport() {
		try {
			await fetchLeaveReport({
				year: leaveFilter.year,
				month: leaveFilter.month,
				departmentId: leaveFilter.departmentId,
				leaveTypeId: leaveFilter.leaveTypeId,
				search: leaveFilter.search.trim() || undefined,
			});
			leaveFetched.value = true;
			leaveDirty.value = false;
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
				search: leaveFilter.search.trim() || undefined,
			});
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi xuất Excel nghỉ phép');
		}
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
					<UiSelectInput
						:model-value="attendanceFilter.departmentId ?? 0"
						:options="departmentOptions"
						:disabled="isManager"
						placeholder="Tất cả phòng ban"
						@update:model-value="attendanceFilter.departmentId = $event === 0 ? undefined : ($event as number)"
					/>
				</div>
				<div class="w-full sm:w-56">
					<CommonAppInput
						:model-value="attendanceSearchInput"
						placeholder="Tên hoặc mã nhân viên..."
						@update:model-value="onAttendanceSearchInput"
					/>
				</div>
				<div class="relative flex">
					<CommonAppButton :loading="loadingAttendance" :size="'md'" @click="onAttendanceViewClick">
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
							/>
						</svg>
						Xem báo cáo
					</CommonAppButton>
					<span v-if="attendanceDirty" class="absolute -top-1 -right-1 flex h-3 w-3 pointer-events-none">
						<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
						<span class="relative inline-flex rounded-full h-3 w-3 bg-orange-500" />
					</span>
				</div>
				<!-- Export dropdown -->
				<div ref="exportMenuRef" class="relative">
					<CommonAppButton
						variant="primary_outline"
						:loading="isExporting"
						:disabled="!canExport"
						@click="toggleExportMenu"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
							/>
						</svg>
						Xuất báo cáo
						<svg
							class="w-4 h-4 ml-0.5 transition-transform"
							:class="exportMenuOpen ? 'rotate-180' : ''"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
						</svg>
					</CommonAppButton>
					<Transition
						enter-active-class="transition ease-out duration-100"
						enter-from-class="opacity-0 scale-95"
						enter-to-class="opacity-100 scale-100"
						leave-active-class="transition ease-in duration-75"
						leave-from-class="opacity-100 scale-100"
						leave-to-class="opacity-0 scale-95"
					>
						<div
							v-if="exportMenuOpen"
							class="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 z-50 origin-top-right"
						>
							<button
								type="button"
								:disabled="exportingAttendance"
								class="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
								@click="runExport(handleExportAttendance)"
							>
								<span>Xuất tổng hợp</span>
								<svg
									v-if="exportingAttendance"
									class="w-4 h-4 animate-spin text-gray-400"
									fill="none"
									viewBox="0 0 24 24"
								>
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
								</svg>
							</button>
							<button
								type="button"
								:disabled="exportingAttendanceDetail"
								class="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
								@click="runExport(handleExportAttendanceDetail)"
							>
								<span>Xuất chi tiết</span>
								<svg
									v-if="exportingAttendanceDetail"
									class="w-4 h-4 animate-spin text-gray-400"
									fill="none"
									viewBox="0 0 24 24"
								>
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
								</svg>
							</button>
							<button
								type="button"
								:disabled="exportingEmployeesMonthly"
								class="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
								@click="runExport(handleExportEmployeesMonthly)"
							>
								<span>Xuất báo cáo công</span>
								<svg
									v-if="exportingEmployeesMonthly"
									class="w-4 h-4 animate-spin text-gray-400"
									fill="none"
									viewBox="0 0 24 24"
								>
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
								</svg>
							</button>
						</div>
					</Transition>
				</div>
			</div>

			<!-- Dirty filter banner -->
			<div
				v-if="attendanceDirty"
				class="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400"
			>
				<svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
					/>
				</svg>
				Bộ lọc đã thay đổi — nhấn <span class="font-semibold mx-1">Xem báo cáo</span> để cập nhật dữ liệu.
			</div>

			<!-- Summary cards -->
			<div v-if="attendanceSummary" class="grid grid-cols-2 sm:grid-cols-5 gap-3">
				<div class="px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
					<p class="text-xs text-gray-500 dark:text-gray-400">Tổng nhân viên</p>
					<p class="text-xl font-bold text-gray-900 dark:text-white mt-0.5">
						{{ attendanceMeta?.total ?? attendanceReport.length }}
					</p>
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
								<th
									class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
								>
									Hành động
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
							<tr v-else-if="attendanceReport.length === 0">
								<td colspan="10" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
									{{ hasAttendanceFilter ? 'Không tìm thấy nhân viên phù hợp' : 'Chưa có dữ liệu tháng này' }}
								</td>
							</tr>

							<!-- Data rows -->
							<tr
								v-for="row in attendanceReport"
								:key="row.employeeId"
								class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
							>
								<td class="px-4 py-3">
									<span class="font-mono text-xs text-gray-500 dark:text-gray-400">{{ row.employeeCode }}</span>
								</td>
								<td class="px-4 py-3 whitespace-nowrap">
									<div class="font-bold text-gray-900 dark:text-white">{{ row.fullName }}</div>
									<div v-if="row.positionName" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
										{{ row.positionName }}
									</div>
								</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
									{{ row.departmentName ?? '—' }}
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
								<td class="px-4 py-3 text-right">
									<UiDropdownMenu :items="attendanceRowActions(row)" />
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>

			<!-- Pagination bar -->
			<div
				v-if="attendanceFetched && attendanceReport.length > 0"
				class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700"
			>
				<!-- Left: page size selector + range info -->
				<div class="flex flex-wrap items-center gap-3">
					<label class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
						<span>Số dòng / trang</span>
						<div class="w-20">
							<UiSelect
								:model-value="attendanceFilter.limit"
								:options="PAGE_SIZE_OPTIONS"
								@update:model-value="onAttendanceLimitChange"
							/>
						</div>
					</label>
					<span class="text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">
						Hiển thị
						<span class="font-semibold text-gray-700 dark:text-gray-200">
							{{ attendancePageRangeText }}
						</span>
						/
						<span class="font-semibold text-gray-700 dark:text-gray-200">
							{{ attendanceTotalText }}
						</span>
						nhân viên
					</span>
				</div>

				<!-- Right: page controls -->
				<div class="flex items-center gap-2">
					<span class="text-sm text-gray-500 dark:text-gray-400" v-if="attendanceMeta">
						Trang
						<span class="font-semibold text-gray-700 dark:text-gray-200">{{ attendanceMeta.page }}</span>
						/ {{ attendanceMeta.totalPages }}
					</span>
					<CommonAppPagination
						v-if="attendanceMeta && attendanceMeta.totalPages > 1"
						:current-page="attendanceMeta.page"
						:total-pages="attendanceMeta.totalPages"
						@update:current-page="onAttendancePageChange"
					/>
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
					<UiSelectInput
						:model-value="leaveFilter.departmentId ?? 0"
						:options="departmentOptions"
						:disabled="isManager"
						placeholder="Tất cả phòng ban"
						@update:model-value="leaveFilter.departmentId = $event === 0 ? undefined : ($event as number)"
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
				<div class="w-full sm:w-56">
					<CommonAppInput
						v-model="leaveFilter.search"
						placeholder="Tên hoặc mã nhân viên..."
						@keydown.enter="viewLeaveReport"
					/>
				</div>
				<div class="relative">
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
					<span v-if="leaveDirty" class="absolute -top-1 -right-1 flex h-3 w-3 pointer-events-none">
						<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
						<span class="relative inline-flex rounded-full h-3 w-3 bg-orange-500" />
					</span>
				</div>
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

			<!-- Dirty filter banner -->
			<div
				v-if="leaveDirty"
				class="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400"
			>
				<svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
					/>
				</svg>
				Bộ lọc đã thay đổi — nhấn <span class="font-semibold mx-1">Xem báo cáo</span> để cập nhật dữ liệu.
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
				Đang hiển thị {{ DISPLAY_LIMIT }}/{{ leaveGroups.length }} nhân viên. Xuất Excel để xem đầy đủ.
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
									class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
								>
									Số loại phép
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
									Chờ duyệt
								</th>
								<th
									class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
								>
									Tổng ngày đã dùng
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

							<!-- Data rows — grouped by employee -->
							<tr
								v-for="group in leaveRows"
								:key="group.employeeId"
								class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
								@click="detailLeaveEmployee = group"
							>
								<td class="px-4 py-3">
									<span class="font-mono text-xs text-gray-500 dark:text-gray-400">{{ group.employeeCode }}</span>
								</td>
								<td class="px-4 py-3 font-bold text-gray-900 dark:text-white whitespace-nowrap">
									{{ group.fullName }}
								</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
									{{ group.departmentName ?? '—' }}
								</td>
								<td class="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{{ group.rows.length }}</td>
								<td class="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{{ group.totalRequests }}</td>
								<td class="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{{ group.approvedRequests }}</td>
								<td
									class="px-4 py-3 text-right"
									:class="
										group.pendingRequests > 0
											? 'text-orange-500 dark:text-orange-400 font-medium'
											: 'text-gray-500 dark:text-gray-400'
									"
								>
									{{ group.pendingRequests }}
								</td>
								<td class="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
									{{ group.totalDaysApproved }}
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</template>
	</div>

	<Teleport to="body">
		<EmployeeAttendanceDetailModal
			v-if="detailEmployee"
			:employee-id="detailEmployee.employeeId"
			:employee-name="detailEmployee.fullName"
			:employee-code="detailEmployee.employeeCode"
			:initial-year="attendanceFilter.year"
			:initial-month="attendanceFilter.month"
			@close="detailEmployee = null"
		/>
		<EmployeeLeaveReportModal
			v-if="detailLeaveEmployee"
			:employee-id="detailLeaveEmployee.employeeId"
			:employee-code="detailLeaveEmployee.employeeCode"
			:full-name="detailLeaveEmployee.fullName"
			:department-name="detailLeaveEmployee.departmentName"
			:rows="detailLeaveEmployee.rows"
			:year="leaveFilter.year"
			:month="leaveFilter.month"
			@close="detailLeaveEmployee = null"
		/>
		<EmployeeMonthlyReportModal
			v-if="monthlyReportEmployee"
			:employee-id="monthlyReportEmployee.employeeId"
			:employee-name="monthlyReportEmployee.fullName"
			:employee-code="monthlyReportEmployee.employeeCode"
			:initial-year="attendanceFilter.year"
			:initial-month="attendanceFilter.month"
			@close="monthlyReportEmployee = null"
		/>
	</Teleport>
</template>
