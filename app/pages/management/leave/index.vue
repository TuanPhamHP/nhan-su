<script setup lang="ts">
	import { format, startOfMonth, endOfMonth } from 'date-fns';
	import { useLeaveRequestService } from '~/services/leave-request.service';
	import { useLeaveTypeService } from '~/services/leave-type.service';
	import { useLeaveBalanceService } from '~/services/leave-balance.service';
	import { useDepartmentService } from '~/services/department.service';
	import LeaveStatusBadge from '~/components/modules/leave/LeaveStatusBadge.vue';
	import RejectModal from '~/components/modules/leave/RejectModal.vue';
	import LeaveDetailModal from '~/components/modules/leave/LeaveDetailModal.vue';
	import LeaveTypeFormModal from '~/components/modules/leave/LeaveTypeFormModal.vue';
	import BulkInitModal from '~/components/modules/leave/BulkInitModal.vue';
	import AddBalanceModal from '~/components/modules/leave/AddBalanceModal.vue';
	import EmployeeBalanceDetailModal from '~/components/modules/leave/EmployeeBalanceDetailModal.vue';
	import type {
		LeaveRequest,
		LeaveType,
		LeaveBalance,
		LeaveRequestSummary,
		LeaveStatus,
		QueryLeaveRequestParams,
		EmployeeBalanceGroup,
		QueryEmployeeBalanceParams,
	} from '~/types/leave.types';
	import type { DepartmentSummary } from '~/types/department.types';
	import type { PaginatedMeta } from '~/types/api.types';
	import type { SelectOption } from '~/components/ui/Select.vue';

	definePageMeta({ title: 'Nghỉ phép' });

	const toast = useToast();
	const { user } = useAuth();
	const route = useRoute();
	const router = useRouter();
	const leaveRequestService = useLeaveRequestService();
	const leaveTypeService = useLeaveTypeService();
	const leaveBalanceService = useLeaveBalanceService();
	const departmentService = useDepartmentService();

	const isManager = computed(() => user.value?.role === 'MANAGER');
	const managerDepartmentId = computed(() => user.value?.department?.id);

	// ─── Tabs ─────────────────────────────────────────────────────────────────────
	type Tab = 'requests' | 'types' | 'balances';
	const activeTab = ref<Tab>('requests');

	// ─── Shared: leave types ──────────────────────────────────────────────────────
	const leaveTypes = ref<LeaveType[]>([]);

	async function loadLeaveTypes() {
		try {
			leaveTypes.value = await leaveTypeService.findAll();
		} catch {
			// non-critical
		}
	}

	// ─── Shared: departments ──────────────────────────────────────────────────────
	const departments = ref<DepartmentSummary[]>([]);

	async function loadDepartments() {
		try {
			const res = await departmentService.findAll({ isActive: true, pagination: false });
			departments.value = res.data;
		} catch {
			// non-critical
		}
	}

	// ═══════════════════════════════════════════════════════════════════════════════
	// TAB 1 — ĐƠN NGHỈ PHÉP
	// ═══════════════════════════════════════════════════════════════════════════════
	const requests = ref<LeaveRequest[]>([]);
	const requestsLoading = ref(false);
	const requestsMeta = ref<PaginatedMeta | null>(null);
	const summary = ref<LeaveRequestSummary | null>(null);

	const today = new Date();
	const requestFilter = reactive({
		departmentId: (isManager.value ? managerDepartmentId.value : undefined) as number | undefined,
		leaveTypeId: undefined as number | undefined,
		status: 'PENDING' as LeaveStatus | undefined,
		startDate: format(startOfMonth(today), 'yyyy-MM-dd'),
		endDate: format(endOfMonth(today), 'yyyy-MM-dd'),
		page: 1,
	});

	async function fetchSummary() {
		try {
			summary.value = await leaveRequestService.getSummary();
		} catch {
			// non-critical — summary cards hidden if null
		}
	}

	async function fetchRequests() {
		requestsLoading.value = true;
		try {
			const params: QueryLeaveRequestParams = {
				departmentId: requestFilter.departmentId,
				leaveTypeId: requestFilter.leaveTypeId,
				status: requestFilter.status,
				startDate: requestFilter.startDate || undefined,
				endDate: requestFilter.endDate || undefined,
				page: requestFilter.page,
				limit: 20,
			};
			const res = await leaveRequestService.findAll(params);
			requests.value = res.data;
			requestsMeta.value = res.meta;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi tải danh sách đơn nghỉ phép');
		} finally {
			requestsLoading.value = false;
		}
	}

	function applyRequestFilter() {
		requestFilter.page = 1;
		fetchRequests();
	}

	// ─── Approve ──────────────────────────────────────────────────────────────────
	const approvingId = ref<number | null>(null);

	async function handleApprove(req: LeaveRequest): Promise<boolean> {
		if (!confirm(`Duyệt đơn nghỉ phép của ${req.employee.fullName}?`)) return false;
		approvingId.value = req.id;
		try {
			const updated = await leaveRequestService.approve(req.id);
			const idx = requests.value.findIndex(r => r.id === updated.id);
			if (idx !== -1) requests.value.splice(idx, 1, updated);
			toast.success('Đã duyệt đơn nghỉ phép');
			fetchSummary();
			return true;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
			return false;
		} finally {
			approvingId.value = null;
		}
	}

	async function handleApproveFromDetail() {
		if (!detailTarget.value) return;
		const ok = await handleApprove(detailTarget.value);
		if (ok) detailTarget.value = null;
	}

	function handleRejectFromDetail() {
		if (!detailTarget.value) return;
		rejectTarget.value = detailTarget.value;
		detailTarget.value = null;
	}

	// ─── Reject ───────────────────────────────────────────────────────────────────
	const rejectTarget = ref<LeaveRequest | null>(null);

	function onRejected() {
		rejectTarget.value = null;
		fetchRequests();
		fetchSummary();
	}

	// ─── Detail ───────────────────────────────────────────────────────────────────
	const detailTarget = ref<LeaveRequest | null>(null);

	async function openByQueryId() {
		const raw = route.query.open_id;
		if (!raw) return;
		const id = Number(raw);
		if (!id || Number.isNaN(id)) return;

		// Clear query string trước để tránh F5 mở lại
		router.replace({ path: '/management/leave' });

		try {
			const req = await leaveRequestService.findOne(id);
			detailTarget.value = req;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không thể mở chi tiết đơn nghỉ phép');
		}
	}

	// ─── Helpers ──────────────────────────────────────────────────────────────────
	function formatDate(d: string) {
		return format(new Date(d), 'dd/MM/yyyy');
	}

	function truncate(text: string | null, len = 60) {
		if (!text) return '—';
		return text.length > len ? text.slice(0, len) + '…' : text;
	}

	const departmentOptions = computed(() => [
		{ value: 0, label: 'Tất cả phòng ban' },
		...departments.value.map(d => ({ value: d.id, label: d.name })),
	]);

	const leaveTypeOptions = computed<SelectOption[]>(() => [
		{ value: undefined, label: 'Tất cả loại đơn' },
		...leaveTypes.value.map(t => ({ value: t.id, label: t.name })),
	]);

	const statusOptions: SelectOption[] = [
		{ value: undefined, label: 'Tất cả trạng thái' },
		{ value: 'PENDING', label: 'Chờ duyệt' },
		{ value: 'APPROVED', label: 'Đã duyệt' },
		{ value: 'REJECTED', label: 'Từ chối' },
		{ value: 'CANCELLED', label: 'Đã thu hồi' },
	];

	// ═══════════════════════════════════════════════════════════════════════════════
	// TAB 2 — LOẠI PHÉP
	// ═══════════════════════════════════════════════════════════════════════════════
	const leaveTypesLoading = ref(false);
	const leaveTypeFormTarget = ref<LeaveType | undefined>(undefined);
	const showLeaveTypeForm = ref(false);

	function openCreateLeaveType() {
		leaveTypeFormTarget.value = undefined;
		showLeaveTypeForm.value = true;
	}

	function openEditLeaveType(lt: LeaveType) {
		leaveTypeFormTarget.value = lt;
		showLeaveTypeForm.value = true;
	}

	function onLeaveTypeSaved(lt: LeaveType) {
		showLeaveTypeForm.value = false;
		const idx = leaveTypes.value.findIndex(t => t.id === lt.id);
		if (idx !== -1) leaveTypes.value.splice(idx, 1, lt);
		else leaveTypes.value.push(lt);
	}

	async function handleDeactivateLeaveType(lt: LeaveType) {
		const action = lt.isActive ? 'vô hiệu hóa' : 'kích hoạt lại';
		if (
			!confirm(
				`${action.charAt(0).toUpperCase() + action.slice(1)} loại phép "${lt.name}"?\n\nLoại phép này sẽ không còn dùng được. Các đơn đang pending/approved sẽ không bị ảnh hưởng.`,
			)
		)
			return;
		leaveTypesLoading.value = true;
		try {
			await leaveTypeService.deactivate(lt.id);
			const idx = leaveTypes.value.findIndex(t => t.id === lt.id);
			if (idx !== -1) leaveTypes.value[idx].isActive = false;
			toast.success(`Đã ${action} loại phép`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
		} finally {
			leaveTypesLoading.value = false;
		}
	}

	// ═══════════════════════════════════════════════════════════════════════════════
	// TAB 3 — SỐ DƯ PHÉP
	// ═══════════════════════════════════════════════════════════════════════════════
	const employeeGroups = ref<EmployeeBalanceGroup[]>([]);
	const balancesLoading = ref(false);
	const balancesMeta = ref<PaginatedMeta | null>(null);
	const currentYear = new Date().getFullYear();

	const balanceFilter = reactive({
		year: currentYear,
		departmentId: (isManager.value ? managerDepartmentId.value : undefined) as number | undefined,
		search: '',
		page: 1,
	});

	const showBulkInit = ref(false);
	const showAddBalance = ref(false);
	const detailGroup = ref<EmployeeBalanceGroup | null>(null);

	const limitedLeaveTypes = computed(() => leaveTypes.value.filter(t => t.daysPerYear !== null));

	const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

	let searchTimeout: ReturnType<typeof setTimeout> | null = null;

	function onBalanceSearchInput() {
		if (searchTimeout) clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			balanceFilter.page = 1;
			fetchBalances();
		}, 300);
	}

	async function fetchBalances() {
		balancesLoading.value = true;
		try {
			const params: QueryEmployeeBalanceParams = {
				year: balanceFilter.year,
				departmentId: balanceFilter.departmentId,
				search: balanceFilter.search || undefined,
				page: balanceFilter.page,
				limit: 20,
			};
			const res = await leaveBalanceService.findByEmployee(params);
			employeeGroups.value = res.data;
			balancesMeta.value = res.meta;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi tải số dư phép');
		} finally {
			balancesLoading.value = false;
		}
	}

	function applyBalanceFilter() {
		balanceFilter.page = 1;
		fetchBalances();
	}

	function onBulkInitDone(created: number, skipped: number) {
		showBulkInit.value = false;
		fetchBalances();
		toast.success(`Đã tạo ${created} balance mới, bỏ qua ${skipped} đã tồn tại`);
	}

	function onBalanceCreated(_balance: LeaveBalance) {
		showAddBalance.value = false;
		fetchBalances();
	}

	function onDetailUpdated() {
		detailGroup.value = null;
		fetchBalances();
	}

	// ─── Lifecycle ────────────────────────────────────────────────────────────────
	onMounted(() => {
		loadLeaveTypes();
		loadDepartments();
		fetchRequests();
		fetchSummary();
		openByQueryId();
	});

	watch(activeTab, tab => {
		if (tab === 'balances' && employeeGroups.value.length === 0) fetchBalances();
	});
</script>

<template>
	<div class="space-y-5">
		<!-- Page header -->
		<div>
			<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Nghỉ phép</h1>
			<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Quản lý đơn nghỉ phép, loại phép và số dư phép</p>
		</div>

		<!-- Tabs -->
		<div class="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
			<button
				v-for="tab in [
					{ key: 'requests', label: 'Đơn nghỉ phép' },
					{ key: 'types', label: 'Loại phép' },
					{ key: 'balances', label: 'Số dư phép' },
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

		<!-- ══════════════════════════════ TAB 1: ĐƠN NGHỈ PHÉP ══════════════════════════════ -->
		<template v-if="activeTab === 'requests'">
			<!-- Summary cards -->
			<div v-if="summary" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
				<div
					class="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700"
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
						<p class="text-xs text-gray-500 dark:text-gray-400">Chờ duyệt</p>
						<p class="text-lg font-bold text-gray-900 dark:text-white leading-tight">{{ summary.pending }}</p>
					</div>
				</div>

				<div
					class="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700"
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
						<p class="text-xs text-gray-500 dark:text-gray-400">Đã duyệt tháng này</p>
						<p class="text-lg font-bold text-gray-900 dark:text-white leading-tight">{{ summary.approvedThisMonth }}</p>
					</div>
				</div>

				<div
					class="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700"
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
						<p class="text-xs text-gray-500 dark:text-gray-400">Từ chối</p>
						<p class="text-lg font-bold text-gray-900 dark:text-white leading-tight">{{ summary.rejected }}</p>
					</div>
				</div>

				<div
					class="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700"
				>
					<div class="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
						<svg
							class="w-4 h-4 text-gray-500 dark:text-gray-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
						</svg>
					</div>
					<div>
						<p class="text-xs text-gray-500 dark:text-gray-400">Đã thu hồi</p>
						<p class="text-lg font-bold text-gray-900 dark:text-white leading-tight">{{ summary.cancelled }}</p>
					</div>
				</div>
			</div>

			<!-- Filter bar -->
			<div class="flex flex-col sm:flex-row flex-wrap gap-3">
				<div v-if="!isManager" class="w-full sm:w-44">
					<label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Phòng ban</label>
					<UiSelectInput
						:model-value="requestFilter.departmentId ?? 0"
						:options="departmentOptions"
						placeholder="Tất cả phòng ban"
						@update:model-value="(v) => { requestFilter.departmentId = v === 0 ? undefined : (v as number); applyRequestFilter(); }"
					/>
				</div>
				<div class="w-full sm:w-44">
					<label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Loại đơn</label>
					<UiSelect
						:model-value="requestFilter.leaveTypeId"
						:options="leaveTypeOptions"
						placeholder="Tất cả loại đơn"
						@update:model-value="(v) => { requestFilter.leaveTypeId = v as number | undefined; applyRequestFilter(); }"
					/>
				</div>
				<div class="w-full sm:w-44">
					<label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Trạng thái</label>
					<UiSelect
						:model-value="requestFilter.status"
						:options="statusOptions"
						placeholder="Tất cả trạng thái"
						@update:model-value="(v) => { requestFilter.status = v as LeaveStatus | undefined; applyRequestFilter(); }"
					/>
				</div>
				<div>
					<label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Khoảng thời gian</label>
					<div class="flex items-center gap-2">
						<input
							v-model="requestFilter.startDate"
							type="date"
							class="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
							@change="applyRequestFilter"
						/>
						<span class="text-gray-400 text-sm">→</span>
						<input
							v-model="requestFilter.endDate"
							type="date"
							class="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
							@change="applyRequestFilter"
						/>
					</div>
				</div>
			</div>

			<!-- Table -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
								<th
									class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
								>
									Nhân viên
								</th>
								<th
									class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
								>
									Loại phép
								</th>
								<th
									class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
								>
									Thời gian
								</th>
								<th
									class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
								>
									Lý do
								</th>
								<th
									class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
								>
									Trạng thái
								</th>
								<th
									class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
								>
									Thao tác
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr v-if="requestsLoading">
								<td colspan="6" class="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
									<svg class="animate-spin w-5 h-5 mx-auto text-brand-500" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
									</svg>
								</td>
							</tr>
							<tr v-else-if="requests.length === 0">
								<td colspan="6" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
									Không có đơn nghỉ phép nào
								</td>
							</tr>
							<tr
								v-for="req in requests"
								:key="req.id"
								class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
							>
								<!-- Nhân viên -->
								<td class="px-4 py-3">
									<p class="font-medium text-gray-900 dark:text-white">{{ req.employee.fullName }}</p>
									<p class="text-xs text-gray-400 dark:text-gray-500">{{ req.employee.employeeCode }}</p>
								</td>

								<!-- Loại phép -->
								<td class="px-4 py-3">
									<div class="flex items-center gap-1.5">
										<p class="text-gray-700 dark:text-gray-300">{{ req.leaveType.name }}</p>
										<span
											v-if="req.leaveCode"
											:class="[
												'text-xs font-bold px-1.5 py-0.5 rounded',
												req.leaveCode === 'P'
													? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
													: req.leaveCode === 'KL'
														? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
														: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
											]"
										>
											{{ req.leaveCode }}
										</span>
									</div>
									<span
										v-if="req.halfDayPeriod"
										class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 mt-0.5"
									>
										Nửa ngày · {{ req.halfDayPeriod === 'MORNING' ? 'Sáng' : 'Chiều' }}
									</span>
									<span
										v-else-if="req.lateMinutes"
										class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 mt-0.5"
									>
										Đi muộn · {{ req.lateMinutes }} phút
									</span>
									<span
										v-else-if="req.earlyMinutes"
										class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 mt-0.5"
									>
										Về sớm · {{ req.earlyMinutes }} phút
									</span>
								</td>

								<!-- Thời gian -->
								<td class="px-4 py-3">
									<p class="text-gray-700 dark:text-gray-300 whitespace-nowrap">
										{{ formatDate(req.startDate) }}
										<template v-if="req.startDate !== req.endDate"> → {{ formatDate(req.endDate) }}</template>
									</p>
									<p v-if="req.totalDays > 0" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
										{{ req.totalDays }} ngày
									</p>
								</td>

								<!-- Lý do -->
								<td class="px-4 py-3 max-w-[200px]">
									<UiTooltip v-if="req.reason && req.reason.length > 60" :label="req.reason">
										<span class="text-gray-600 dark:text-gray-400 cursor-default">{{ truncate(req.reason) }}</span>
									</UiTooltip>
									<span v-else class="text-gray-600 dark:text-gray-400">{{ req.reason ?? '—' }}</span>
								</td>

								<!-- Trạng thái -->
								<td class="px-4 py-3">
									<LeaveStatusBadge :status="req.status" />
								</td>

								<!-- Thao tác -->
								<td class="px-4 py-3">
									<div class="flex items-center justify-end gap-1.5">
										<template v-if="req.status === 'PENDING' && (req.assignedApprover?.id === user?.id || user?.role === 'ADMIN')">
											<CommonAppButton
												size="sm"
												variant="primary"
												:loading="approvingId === req.id"
												@click="handleApprove(req)"
											>
												Duyệt
											</CommonAppButton>
											<CommonAppButton size="sm" variant="danger" @click="rejectTarget = req">Từ chối</CommonAppButton>
										</template>
										<button
											class="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
											title="Xem chi tiết"
											@click="detailTarget = req"
										>
											<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
												/>
												<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
											</svg>
										</button>
									</div>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>

			<!-- Pagination -->
			<div v-if="requestsMeta && requestsMeta.totalPages > 1" class="flex items-center justify-between pt-1">
				<p class="text-sm text-gray-500 dark:text-gray-400">
					Tổng <strong class="text-gray-700 dark:text-gray-300">{{ requestsMeta.total }}</strong> đơn
				</p>
				<CommonAppPagination
					:current-page="requestFilter.page"
					:total-pages="requestsMeta.totalPages"
					@update:current-page="
						p => {
							requestFilter.page = p;
							fetchRequests();
						}
					"
				/>
			</div>
		</template>

		<!-- ══════════════════════════════ TAB 2: LOẠI PHÉP ══════════════════════════════ -->
		<template v-else-if="activeTab === 'types'">
			<!-- Header -->
			<div class="flex items-center justify-between">
				<h2 class="text-base font-semibold text-gray-900 dark:text-white">Quản lý loại phép</h2>
				<CommonAppButton @click="openCreateLeaveType">
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
					</svg>
					Thêm loại phép
				</CommonAppButton>
			</div>

			<!-- Table -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
								<th
									class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
								>
									Tên loại phép
								</th>
								<th
									class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
								>
									Mã
								</th>
								<th
									class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
								>
									Ngày/năm
								</th>
								<th
									class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
								>
									Có lương
								</th>
								<th
									class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
								>
									Trạng thái
								</th>
								<th
									class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
								>
									Thao tác
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr v-if="leaveTypes.length === 0">
								<td colspan="6" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
									Chưa có loại phép nào
								</td>
							</tr>
							<tr
								v-for="lt in leaveTypes"
								:key="lt.id"
								class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
							>
								<td class="px-4 py-3 font-medium text-gray-900 dark:text-white">{{ lt.name }}</td>
								<td class="px-4 py-3">
									<span
										class="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-mono text-xs"
									>
										{{ lt.code }}
									</span>
								</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-400">
									{{ lt.daysPerYear !== null ? lt.daysPerYear : 'Không giới hạn' }}
								</td>
								<td class="px-4 py-3">
									<svg
										v-if="lt.isPaid"
										class="w-5 h-5 text-green-500"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
									</svg>
									<svg
										v-else
										class="w-5 h-5 text-red-400"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</td>
								<td class="px-4 py-3">
									<span
										:class="[
											'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
											lt.isActive
												? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
												: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
										]"
									>
										{{ lt.isActive ? 'Đang dùng' : 'Vô hiệu' }}
									</span>
								</td>
								<td class="px-4 py-3">
									<div class="flex items-center justify-end gap-1">
										<button
											class="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
											title="Chỉnh sửa"
											@click="openEditLeaveType(lt)"
										>
											<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
												/>
											</svg>
										</button>
										<button
											v-if="lt.isActive"
											class="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
											title="Vô hiệu hóa"
											@click="handleDeactivateLeaveType(lt)"
										>
											<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
												/>
											</svg>
										</button>
									</div>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</template>

		<!-- ══════════════════════════════ TAB 3: SỐ DƯ PHÉP ══════════════════════════════ -->
		<template v-else-if="activeTab === 'balances'">
			<!-- Header & controls -->
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
				<h2 class="text-base font-semibold text-gray-900 dark:text-white">Số dư phép năm {{ balanceFilter.year }}</h2>
				<div class="flex flex-wrap items-end gap-2">
					<!-- Search -->
					<div>
						<label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tìm kiếm</label>
						<div class="relative">
							<svg
								class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
							</svg>
							<input
								v-model="balanceFilter.search"
								type="text"
								placeholder="Tìm nhân viên..."
								class="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-44 focus:outline-none focus:ring-1 focus:ring-brand-400"
								@input="onBalanceSearchInput"
							/>
						</div>
					</div>

					<!-- Department filter -->
					<div v-if="!isManager" class="w-44">
						<label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Phòng ban</label>
						<UiSelectInput
							:model-value="balanceFilter.departmentId ?? 0"
							:options="departmentOptions"
							placeholder="Tất cả phòng ban"
							@update:model-value="(v) => { balanceFilter.departmentId = v === 0 ? undefined : (v as number); applyBalanceFilter(); }"
						/>
					</div>

					<!-- Year selector -->
					<div>
						<label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Năm</label>
						<div class="flex gap-1">
							<button
								v-for="yr in yearOptions"
								:key="yr"
								:class="[
									'px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors',
									balanceFilter.year === yr
										? 'bg-brand-600 text-white border-brand-600'
										: 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-brand-400 hover:text-brand-600',
								]"
								@click="
									balanceFilter.year = yr;
									applyBalanceFilter();
								"
							>
								{{ yr }}
							</button>
						</div>
					</div>

					<CommonAppButton variant="secondary" @click="showBulkInit = true">
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5"
							/>
						</svg>
						Khởi tạo hàng loạt
					</CommonAppButton>
					<CommonAppButton @click="showAddBalance = true">
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
						</svg>
						Thêm thủ công
					</CommonAppButton>
				</div>
			</div>

			<!-- Table grouped by employee -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
									Nhân viên
								</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
									Phòng ban
								</th>
								<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
									Số loại phép
								</th>
								<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
									Thao tác
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr v-if="balancesLoading">
								<td colspan="4" class="px-4 py-8 text-center">
									<svg class="animate-spin w-5 h-5 mx-auto text-brand-500" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
									</svg>
								</td>
							</tr>
							<tr v-else-if="employeeGroups.length === 0">
								<td colspan="4" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
									Không có dữ liệu số dư phép
								</td>
							</tr>
							<tr
								v-for="group in employeeGroups"
								:key="group.employee.id"
								class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
							>
								<td class="px-4 py-3">
									<p class="font-medium text-gray-900 dark:text-white">{{ group.employee.fullName }}</p>
									<p class="text-xs text-gray-400 dark:text-gray-500">{{ group.employee.employeeCode }}</p>
								</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-400 text-sm">
									{{ group.employee.department?.name ?? '—' }}
								</td>
								<td class="px-4 py-3 text-right">
									<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
										{{ group.balances.length }} loại
									</span>
								</td>
								<td class="px-4 py-3 text-right">
									<button
										class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50 dark:text-brand-400 dark:hover:text-brand-300 dark:hover:bg-brand-900/20 rounded-lg transition-colors"
										@click="detailGroup = group"
									>
										Xem chi tiết
										<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
										</svg>
									</button>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>

			<!-- Pagination -->
			<div v-if="balancesMeta && balancesMeta.totalPages > 1" class="flex items-center justify-between pt-1">
				<p class="text-sm text-gray-500 dark:text-gray-400">
					Tổng <strong class="text-gray-700 dark:text-gray-300">{{ balancesMeta.total }}</strong> nhân viên
				</p>
				<CommonAppPagination
					:current-page="balanceFilter.page"
					:total-pages="balancesMeta.totalPages"
					@update:current-page="
						p => {
							balanceFilter.page = p;
							fetchBalances();
						}
					"
				/>
			</div>
		</template>
	</div>

	<!-- ─── Modals ─────────────────────────────────────────────────────────── -->
	<Teleport to="body">
		<RejectModal
			v-if="rejectTarget"
			:leave-request="rejectTarget"
			@rejected="onRejected"
			@close="rejectTarget = null"
		/>
		<LeaveDetailModal
			v-if="detailTarget"
			:leave-request="detailTarget"
			:approving="approvingId === detailTarget.id"
			@approve="handleApproveFromDetail"
			@reject="handleRejectFromDetail"
			@close="detailTarget = null"
		/>
		<LeaveTypeFormModal
			v-if="showLeaveTypeForm"
			:edit-target="leaveTypeFormTarget"
			@saved="onLeaveTypeSaved"
			@close="showLeaveTypeForm = false"
		/>
		<BulkInitModal v-if="showBulkInit" :leave-types="leaveTypes" @done="onBulkInitDone" @close="showBulkInit = false" />
		<AddBalanceModal
			v-if="showAddBalance"
			:leave-types="leaveTypes"
			@created="onBalanceCreated"
			@close="showAddBalance = false"
		/>
		<EmployeeBalanceDetailModal
			v-if="detailGroup"
			:group="detailGroup"
			:year="balanceFilter.year"
			:leave-types="leaveTypes"
			@updated="onDetailUpdated"
			@close="detailGroup = null"
		/>
	</Teleport>
</template>
