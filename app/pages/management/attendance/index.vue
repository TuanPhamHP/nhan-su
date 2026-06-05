<script setup lang="ts">
	import AttendanceTable from '~/components/modules/attendance/AttendanceTable.vue';
	import AttendancePhotoModal from '~/components/modules/attendance/AttendancePhotoModal.vue';
	import ManualEditModal from '~/components/modules/attendance/ManualEditModal.vue';
	import MakeupRequestModal from '~/components/modules/attendance/MakeupRequestModal.vue';
	import type { AttendanceRecordDetail, AttendanceStatus, QueryAttendanceParams } from '~/types/attendance.types';
	import type { DepartmentSummary } from '~/types/department.types';
	import type { EmployeeSummary } from '~/types/employee.types';
	import { useDepartmentService } from '~/services/department.service';
	import { useAttendanceService } from '~/services/attendance.service';
	import { useEmployeeService } from '~/services/employee.service';
	import { calcAttendanceSummary } from '~/utils/attendance.utils';
	import type { PaginatedMeta } from '~/types/api.types';
	import type { SelectOption } from '~/components/ui/Select.vue';

	definePageMeta({ title: 'Chấm công' });

	const toast = useToast();
	const { user } = useAuth();
	const attendanceService = useAttendanceService();
	const departmentService = useDepartmentService();
	const employeeService = useEmployeeService();

	const isManager = computed(() => user.value?.role === 'MANAGER');
	const managerDepartmentId = computed(() => user.value?.department?.id);

	// ─── Tabs ───────────────────────────────────────────────────────────────
	type Tab = 'today' | 'history';
	const activeTab = ref<Tab>('today');

	// ─── Departments ─────────────────────────────────────────────────────────
	const departments = ref<DepartmentSummary[]>([]);

	async function loadDepartments() {
		try {
			const res = await departmentService.findAll({ isActive: true, pagination: false });
			departments.value = res.data;
		} catch {
			// non-critical, ignore silently
		}
	}

	// ─── Employees ───────────────────────────────────────────────────────────
	const employees = ref<EmployeeSummary[]>([]);

	async function loadEmployees() {
		try {
			const res = await employeeService.findAll({ pagination: false });
			employees.value = res.data;
		} catch {
			// non-critical, ignore silently
		}
	}

	// ─── Select options ───────────────────────────────────────────────────────
	const departmentOptions = computed(() => [
		{ value: 0, label: 'Tất cả phòng ban' },
		...departments.value.map(d => ({ value: d.id, label: d.name })),
	]);

	const statusOptions: SelectOption[] = [
		{ value: undefined, label: 'Tất cả trạng thái' },
		{ value: 'PRESENT', label: 'Có mặt' },
		{ value: 'LATE', label: 'Đi muộn' },
		{ value: 'ABSENT', label: 'Vắng' },
		{ value: 'LEAVE', label: 'Nghỉ phép' },
	];

	const employeeOptions = computed(() => [
		{ label: 'Tất cả nhân viên', value: 0 },
		...employees.value
			.filter(e => !isManager.value || !managerDepartmentId.value || e.department?.id === managerDepartmentId.value)
			.map(e => ({
				label: `${e.fullName} (${e.employeeCode})`,
				value: e.id,
			})),
	]);

	// ─── Tab 1: Today ────────────────────────────────────────────────────────
	const todayRecords = ref<AttendanceRecordDetail[]>([]);
	const todayLoading = ref(false);
	const todayDepartmentId = ref<number | undefined>(isManager.value ? managerDepartmentId.value : undefined);
	const todaySearch = ref('');
	const todayStatusFilter = ref<AttendanceStatus | null>(null);
	let refreshTimer: ReturnType<typeof setInterval> | null = null;

	function toggleStatusFilter(status: AttendanceStatus) {
		todayStatusFilter.value = todayStatusFilter.value === status ? null : status;
	}

	const today = new Date().toISOString().split('T')[0];

	async function fetchToday() {
		todayLoading.value = true;
		try {
			const params: QueryAttendanceParams = {
				date: today,
				limit: 100,
				...(todayDepartmentId.value ? { departmentId: todayDepartmentId.value } : {}),
			};
			const res = await attendanceService.findAll(params);
			todayRecords.value = res.data;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi tải dữ liệu chấm công hôm nay');
		} finally {
			todayLoading.value = false;
		}
	}

	const todaySearchRecords = computed(() => {
		if (!todaySearch.value.trim()) return todayRecords.value;
		const q = todaySearch.value.trim().toLowerCase();
		return todayRecords.value.filter(
			r => r.employee?.fullName.toLowerCase().includes(q) || r.employee?.employeeCode.toLowerCase().includes(q),
		);
	});

	const todayFilteredRecords = computed(() => {
		if (!todayStatusFilter.value) return todaySearchRecords.value;
		return todaySearchRecords.value.filter(r => r.status === todayStatusFilter.value);
	});

	const todaySummary = computed(() => calcAttendanceSummary(todaySearchRecords.value));

	watch(todayDepartmentId, () => fetchToday());

	// ─── Tab 2: History ──────────────────────────────────────────────────────
	const historyRecords = ref<AttendanceRecordDetail[]>([]);
	const historyLoading = ref(false);
	const historyMeta = ref<PaginatedMeta | null>(null);

	const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

	const historyFilter = reactive({
		startDate: firstDayOfMonth,
		endDate: today,
		departmentId: (isManager.value ? managerDepartmentId.value : undefined) as number | undefined,
		status: undefined as AttendanceStatus | undefined,
		employeeId: undefined as number | undefined,
		page: 1,
	});

	async function fetchHistory() {
		historyLoading.value = true;
		try {
			const params: QueryAttendanceParams = {
				startDate: historyFilter.startDate || undefined,
				endDate: historyFilter.endDate || undefined,
				departmentId: historyFilter.departmentId,
				status: historyFilter.status,
				employeeId: historyFilter.employeeId,
				page: historyFilter.page,
				limit: 20,
			};
			const res = await attendanceService.findAll(params);
			historyRecords.value = res.data;
			historyMeta.value = res.meta;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi tải lịch sử chấm công');
		} finally {
			historyLoading.value = false;
		}
	}

	function applyHistoryFilter() {
		historyFilter.page = 1;
		fetchHistory();
	}

	function goToPage(page: number) {
		historyFilter.page = page;
		fetchHistory();
	}

	// ─── Modals ──────────────────────────────────────────────────────────────
	const photoModalRecord = ref<AttendanceRecordDetail | null>(null);
	const editModalRecord = ref<AttendanceRecordDetail | null>(null);
	const makeupModalRecord = ref<AttendanceRecordDetail | null>(null);

	function onEditRecord(record: AttendanceRecordDetail) {
		if (record.isLocked) {
			makeupModalRecord.value = record;
		} else {
			editModalRecord.value = record;
		}
	}

	function onManualEditUpdated(updated: AttendanceRecordDetail) {
		const replaceIn = (list: AttendanceRecordDetail[]) => {
			const idx = list.findIndex(r => r.id === updated.id);
			if (idx !== -1) list.splice(idx, 1, updated);
		};
		replaceIn(todayRecords.value);
		replaceIn(historyRecords.value);
		editModalRecord.value = null;
	}

	function onMakeupSubmitted() {
		makeupModalRecord.value = null;
		if (activeTab.value === 'today') fetchToday();
		else fetchHistory();
	}

	// ─── Lifecycle ───────────────────────────────────────────────────────────
	onMounted(() => {
		loadDepartments();
		loadEmployees();
		fetchToday();
		refreshTimer = setInterval(fetchToday, 5 * 60 * 1000);
	});

	onUnmounted(() => {
		if (refreshTimer) clearInterval(refreshTimer);
	});
</script>

<template>
	<div class="space-y-5">
		<!-- Page header -->
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Chấm công</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Theo dõi chấm công nhân viên</p>
			</div>
		</div>

		<!-- Tabs -->
		<div class="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
			<button
				v-for="tab in [
					{ key: 'today', label: 'Hôm nay' },
					{ key: 'history', label: 'Lịch sử' },
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

		<!-- ═══════════════════════════════════════ TAB 1: HÔM NAY ══════════════════════════════════════════ -->
		<template v-if="activeTab === 'today'">
			<!-- Filter bar -->
			<div class="flex flex-col sm:flex-row gap-3">
				<!-- Department dropdown -->
				<select
					v-model="todayDepartmentId"
					:disabled="isManager"
					class="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors w-full sm:w-48 disabled:opacity-60 disabled:cursor-not-allowed"
				>
					<option :value="undefined">Tất cả phòng ban</option>
					<option v-for="dept in departments" :key="dept.id" :value="dept.id">{{ dept.name }}</option>
				</select>

				<!-- Search input -->
				<div class="relative flex-1 sm:max-w-xs">
					<svg
						class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
						/>
					</svg>
					<input
						v-model="todaySearch"
						type="text"
						placeholder="Tìm tên hoặc mã nhân viên..."
						class="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
					/>
				</div>

				<!-- Auto-refresh indicator -->
				<div class="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 self-center">
					<span class="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
					Tự động cập nhật mỗi 5 phút
				</div>
			</div>

			<!-- Summary badges -->
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
				<div
					class="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer transition-all hover:shadow-md select-none"
					:class="{ 'ring-2 ring-green-500 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20': todayStatusFilter === 'PRESENT' }"
					@click="toggleStatusFilter('PRESENT')"
				>
					<div
						class="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0"
					>
						<svg
							class="w-4 h-4 text-green-600 dark:text-green-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					</div>
					<div>
						<p class="text-xs text-gray-500 dark:text-gray-400">Có mặt</p>
						<p class="text-lg font-bold text-gray-900 dark:text-white leading-tight">{{ todaySummary.present }}</p>
					</div>
				</div>

				<div
					class="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer transition-all hover:shadow-md select-none"
					:class="{ 'ring-2 ring-orange-500 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20': todayStatusFilter === 'LATE' }"
					@click="toggleStatusFilter('LATE')"
				>
					<div
						class="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0"
					>
						<svg
							class="w-4 h-4 text-orange-600 dark:text-orange-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<div>
						<p class="text-xs text-gray-500 dark:text-gray-400">Đi muộn</p>
						<p class="text-lg font-bold text-gray-900 dark:text-white leading-tight">{{ todaySummary.late }}</p>
					</div>
				</div>

				<div
					class="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer transition-all hover:shadow-md select-none"
					:class="{ 'ring-2 ring-red-500 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20': todayStatusFilter === 'ABSENT' }"
					@click="toggleStatusFilter('ABSENT')"
				>
					<div class="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
						<svg
							class="w-4 h-4 text-red-600 dark:text-red-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</div>
					<div>
						<p class="text-xs text-gray-500 dark:text-gray-400">Vắng</p>
						<p class="text-lg font-bold text-gray-900 dark:text-white leading-tight">{{ todaySummary.absent }}</p>
					</div>
				</div>

				<div
					class="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer transition-all hover:shadow-md select-none"
					:class="{ 'ring-2 ring-blue-500 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20': todayStatusFilter === 'LEAVE' }"
					@click="toggleStatusFilter('LEAVE')"
				>
					<div
						class="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0"
					>
						<svg
							class="w-4 h-4 text-blue-600 dark:text-blue-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
							/>
						</svg>
					</div>
					<div>
						<p class="text-xs text-gray-500 dark:text-gray-400">Nghỉ phép</p>
						<p class="text-lg font-bold text-gray-900 dark:text-white leading-tight">{{ todaySummary.onLeave }}</p>
					</div>
				</div>
			</div>

			<!-- Today table -->
			<AttendanceTable
				:records="todayFilteredRecords"
				:loading="todayLoading"
				:show-date-column="false"
				@view-photo="photoModalRecord = $event"
				@edit="onEditRecord"
			/>
		</template>

		<!-- ═══════════════════════════════════════ TAB 2: LỊCH SỬ ══════════════════════════════════════════ -->
		<template v-else-if="activeTab === 'history'">
			<!-- Filter bar -->
			<div class="flex flex-col sm:flex-row sm:items-center flex-wrap gap-3">
				<!-- Date range -->
				<div class="w-full sm:w-60">
					<UiDateRangePicker
						:from-date="historyFilter.startDate || ''"
						:to-date="historyFilter.endDate || ''"
						@update:from-date="historyFilter.startDate = $event"
						@update:to-date="historyFilter.endDate = $event"
					/>
				</div>

				<!-- Department -->
				<div class="w-full sm:w-44">
					<UiSelectInput
						:model-value="historyFilter.departmentId ?? 0"
						:options="departmentOptions"
						:disabled="isManager"
						placeholder="Tất cả phòng ban"
						@update:model-value="historyFilter.departmentId = $event === 0 ? undefined : ($event as number)"
					/>
				</div>

				<!-- Status -->
				<div class="w-full sm:w-40">
					<UiSelect
						:model-value="historyFilter.status"
						:options="statusOptions"
						placeholder="Tất cả trạng thái"
						@update:model-value="historyFilter.status = $event as AttendanceStatus | undefined"
					/>
				</div>

				<!-- Employee -->
				<div class="w-full sm:w-52">
					<UiSelectInput
						:model-value="historyFilter.employeeId ?? 0"
						:options="employeeOptions"
						placeholder="Tất cả nhân viên"
						search-placeholder="Tìm nhân viên..."
						@update:model-value="historyFilter.employeeId = $event === 0 ? undefined : ($event as number)"
					/>
				</div>

				<!-- Search button -->
				<CommonAppButton :loading="historyLoading" @click="applyHistoryFilter">
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
						/>
					</svg>
					Tìm kiếm
				</CommonAppButton>
			</div>

			<!-- History table -->
			<AttendanceTable
				:records="historyRecords"
				:loading="historyLoading"
				:show-date-column="true"
				@view-photo="photoModalRecord = $event"
				@edit="onEditRecord"
			/>

			<!-- Pagination -->
			<div v-if="historyMeta && historyMeta.totalPages > 1" class="flex items-center justify-between pt-2">
				<p class="text-sm text-gray-500 dark:text-gray-400">
					Tổng <strong class="text-gray-700 dark:text-gray-300">{{ historyMeta.total }}</strong> bản ghi
				</p>
				<div class="flex items-center gap-1">
					<button
						class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
						:disabled="historyFilter.page <= 1"
						@click="goToPage(historyFilter.page - 1)"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
						</svg>
					</button>

					<template v-for="p in historyMeta.totalPages" :key="p">
						<button
							v-if="Math.abs(p - historyFilter.page) <= 2 || p === 1 || p === historyMeta.totalPages"
							class="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors"
							:class="
								p === historyFilter.page
									? 'bg-brand-600 text-white'
									: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
							"
							@click="goToPage(p)"
						>
							{{ p }}
						</button>
						<span
							v-else-if="
								(p === historyFilter.page - 3 && p > 1) || (p === historyFilter.page + 3 && p < historyMeta.totalPages)
							"
							class="w-8 h-8 flex items-center justify-center text-gray-400"
						>
							…
						</span>
					</template>

					<button
						class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
						:disabled="historyFilter.page >= historyMeta.totalPages"
						@click="goToPage(historyFilter.page + 1)"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
						</svg>
					</button>
				</div>
			</div>
		</template>
	</div>

	<!-- ─── Modals ─────────────────────────────────────────────────────────── -->
	<Teleport to="body">
		<!-- Photo modal -->
		<AttendancePhotoModal
			v-if="photoModalRecord"
			:check-in-photo-url="photoModalRecord.checkInPhotoUrl"
			:check-out-photo-url="photoModalRecord.checkOutPhotoUrl"
			:employee-name="photoModalRecord.employee?.fullName ?? '—'"
			:date="photoModalRecord.date"
			@close="photoModalRecord = null"
		/>

		<!-- Manual edit modal -->
		<ManualEditModal
			v-if="editModalRecord"
			:record="editModalRecord"
			@updated="onManualEditUpdated"
			@close="editModalRecord = null"
		/>

		<!-- Makeup request modal -->
		<MakeupRequestModal
			v-if="makeupModalRecord"
			:record="makeupModalRecord"
			@submitted="onMakeupSubmitted"
			@close="makeupModalRecord = null"
		/>
	</Teleport>
</template>
