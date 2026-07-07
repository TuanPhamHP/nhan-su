<script setup lang="ts">
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useDepartmentService } from '~/services/department.service';
import OnlineWorkStatusBadge from '~/components/modules/online-work/OnlineWorkStatusBadge.vue';
import OnlineWorkDetailModal from '~/components/modules/online-work/OnlineWorkDetailModal.vue';
import RejectOnlineWorkModal from '~/components/modules/online-work/RejectOnlineWorkModal.vue';
import type { OnlineWorkRequestResponse, OnlineWorkStatus, QueryOnlineWorkParams } from '~/types/online-work-request.types';
import type { DepartmentSummary } from '~/types/department.types';
import type { SelectOption } from '~/components/ui/Select.vue';
import { isManagementRole } from '~/utils/role';

definePageMeta({ title: 'Làm việc online' });

const toast = useToast();
const { user } = useAuth();
const {
	requests, requestsMeta, loading,
	pending, pendingLoading,
	reportData, reportLoading,
	fetchAll, fetchPendingForMe,
	approve, fetchReport, exportReport,
} = useOnlineWorkRequests();
const departmentService = useDepartmentService();

// ─── Roles ────────────────────────────────────────────────────────────────────
const canApprove = computed(() => isManagementRole(user.value?.role));
const canViewAll = computed(() => isManagementRole(user.value?.role));

// ─── Tabs ─────────────────────────────────────────────────────────────────────
type Tab = 'pending' | 'all' | 'report';
const activeTab = ref<Tab>(canApprove.value ? 'pending' : 'all');

// ─── Departments ──────────────────────────────────────────────────────────────
const departments = ref<DepartmentSummary[]>([]);

async function loadDepartments() {
	try {
		const res = await departmentService.findAll({ isActive: true, pagination: false });
		departments.value = res.data;
	} catch {
		// non-critical
	}
}

const departmentOptions = computed(() => [
	{ value: 0, label: 'Tất cả phòng ban' },
	...departments.value.map(d => ({ value: d.id, label: d.name })),
]);

const today = new Date();

const monthOptions: SelectOption[] = Array.from({ length: 12 }, (_, i) => ({
	value: i + 1,
	label: `Tháng ${i + 1}`,
}));

const yearOptions: SelectOption[] = [-1, 0, 1].map(off => ({
	value: today.getFullYear() + off,
	label: String(today.getFullYear() + off),
}));

const statusOptions: SelectOption[] = [
	{ value: undefined, label: 'Tất cả trạng thái' },
	{ value: 'PENDING_L1', label: 'Chờ cấp 1' },
	{ value: 'PENDING_L2', label: 'Chờ cấp 2' },
	{ value: 'PENDING_L3', label: 'Chờ Giám đốc' },
	{ value: 'COMPLETED', label: 'Hoàn thành' },
	{ value: 'REJECTED', label: 'Từ chối' },
	{ value: 'CANCELLED', label: 'Đã huỷ' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — CHỜ TÔI DUYỆT
// ═══════════════════════════════════════════════════════════════════════════════
const approvingId = ref<number | null>(null);
const rejectTarget = ref<OnlineWorkRequestResponse | null>(null);

async function handleApprove(req: OnlineWorkRequestResponse): Promise<boolean> {
	const label = req.statusLabel;
	if (!confirm(`Duyệt đơn làm online của ${req.employee.fullName} (${label})?`)) return false;
	approvingId.value = req.id;
	try {
		await approve(req.id);
		toast.success('Đã duyệt đơn thành công');
		await fetchPendingForMe();
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

function onRejected() {
	rejectTarget.value = null;
	fetchPendingForMe();
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — TẤT CẢ ĐƠN
// ═══════════════════════════════════════════════════════════════════════════════
const detailTarget = ref<OnlineWorkRequestResponse | null>(null);

const allFilter = reactive({
	status: undefined as OnlineWorkStatus | undefined,
	departmentId: undefined as number | undefined,
	startDate: format(startOfMonth(today), 'yyyy-MM-dd'),
	endDate: format(endOfMonth(today), 'yyyy-MM-dd'),
	page: 1,
});

async function fetchAllRequests() {
	const params: QueryOnlineWorkParams = {
		status: allFilter.status,
		departmentId: allFilter.departmentId,
		startDate: allFilter.startDate || undefined,
		endDate: allFilter.endDate || undefined,
		page: allFilter.page,
		limit: 20,
	};
	await fetchAll(params);
}

function applyAllFilter() {
	allFilter.page = 1;
	fetchAllRequests();
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — BÁO CÁO
// ═══════════════════════════════════════════════════════════════════════════════
const reportFilter = reactive({
	month: today.getMonth() + 1,
	year: today.getFullYear(),
	departmentId: undefined as number | undefined,
});
const exportingReport = ref(false);

async function fetchOnlineReport() {
	try {
		await fetchReport({
			month: reportFilter.month,
			year: reportFilter.year,
			departmentId: reportFilter.departmentId,
		});
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Lỗi tải báo cáo');
	}
}

async function handleExportReport() {
	exportingReport.value = true;
	try {
		const blob = await exportReport({
			month: reportFilter.month,
			year: reportFilter.year,
			departmentId: reportFilter.departmentId,
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `bao-cao-online-${reportFilter.month}-${reportFilter.year}.xlsx`;
		a.click();
		URL.revokeObjectURL(url);
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Xuất Excel thất bại');
	} finally {
		exportingReport.value = false;
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d: string) {
	return format(new Date(d), 'dd/MM/yyyy');
}

function truncate(text: string, len = 60) {
	return text.length > len ? text.slice(0, len) + '…' : text;
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
	await loadDepartments();
	if (canApprove.value) fetchPendingForMe();
	if (canViewAll.value) fetchAllRequests();
});

watch(activeTab, tab => {
	if (tab === 'report' && reportData.value.length === 0) fetchOnlineReport();
});
</script>

<template>
	<div class="space-y-5">
		<!-- Page header -->
		<div>
			<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Làm việc online</h1>
			<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Duyệt và theo dõi đơn đăng ký làm việc từ xa</p>
		</div>

		<!-- Tabs -->
		<div class="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
			<button
				v-if="canApprove"
				class="relative px-4 py-1.5 text-sm font-medium rounded-lg transition-all"
				:class="
					activeTab === 'pending'
						? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
						: 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
				"
				@click="activeTab = 'pending'"
			>
				Chờ tôi duyệt
				<span
					v-if="pending.length > 0"
					class="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-orange-500 text-white"
				>
					{{ pending.length > 9 ? '9+' : pending.length }}
				</span>
			</button>

			<button
				v-if="canViewAll"
				class="px-4 py-1.5 text-sm font-medium rounded-lg transition-all"
				:class="
					activeTab === 'all'
						? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
						: 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
				"
				@click="activeTab = 'all'"
			>
				Tất cả đơn
			</button>

			<button
				v-if="canViewAll"
				class="px-4 py-1.5 text-sm font-medium rounded-lg transition-all"
				:class="
					activeTab === 'report'
						? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
						: 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
				"
				@click="activeTab = 'report'"
			>
				Báo cáo
			</button>
		</div>

		<!-- ══════════════════ TAB 1: CHỜ TÔI DUYỆT ══════════════════ -->
		<template v-if="activeTab === 'pending'">
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nhân viên</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Phòng ban</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Từ ngày</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Đến ngày</th>
								<th class="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Số ngày</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Kịch bản</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Bước hiện tại</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Lý do</th>
								<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Thao tác</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr v-if="pendingLoading">
								<td colspan="9" class="px-4 py-8 text-center">
									<svg class="animate-spin w-5 h-5 mx-auto text-brand-500" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
									</svg>
								</td>
							</tr>
							<tr v-else-if="pending.length === 0">
								<td colspan="9" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
									Không có đơn nào chờ duyệt
								</td>
							</tr>
							<tr
								v-for="req in pending"
								:key="req.id"
								class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
							>
								<td class="px-4 py-3">
									<p class="font-medium text-gray-900 dark:text-white">{{ req.employee.fullName }}</p>
									<p class="text-xs text-gray-400 dark:text-gray-500">{{ req.employee.employeeCode }}</p>
								</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-400">{{ req.employee.department ?? '—' }}</td>
								<td class="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{{ formatDate(req.startDate) }}</td>
								<td class="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{{ formatDate(req.endDate) }}</td>
								<td class="px-4 py-3 text-center">
									<span class="font-medium text-gray-900 dark:text-white">{{ req.totalDays }}</span>
								</td>
								<td class="px-4 py-3">
									<span
										:class="[
											'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
											req.requiresMultiLevel
												? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
												: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
										]"
									>
										{{ req.requiresMultiLevel ? '3 cấp' : '1 cấp' }}
									</span>
								</td>
								<td class="px-4 py-3">
									<span class="text-xs text-gray-600 dark:text-gray-400">{{ req.statusLabel }}</span>
								</td>
								<td class="px-4 py-3 max-w-[180px]">
									<UiTooltip v-if="req.reason.length > 50" :label="req.reason">
										<span class="text-gray-600 dark:text-gray-400 cursor-default">{{ truncate(req.reason, 50) }}</span>
									</UiTooltip>
									<span v-else class="text-gray-600 dark:text-gray-400">{{ req.reason }}</span>
								</td>
								<td class="px-4 py-3">
									<div class="flex items-center justify-end gap-1.5">
										<CommonAppButton
											size="sm"
											variant="primary"
											:loading="approvingId === req.id"
											@click="handleApprove(req)"
										>
											Duyệt
										</CommonAppButton>
										<CommonAppButton size="sm" variant="danger" @click="rejectTarget = req">
											Từ chối
										</CommonAppButton>
										<button
											class="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
											title="Xem chi tiết"
											@click="detailTarget = req"
										>
											<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
												<path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
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
		</template>

		<!-- ══════════════════ TAB 2: TẤT CẢ ĐƠN ══════════════════ -->
		<template v-else-if="activeTab === 'all'">
			<!-- Filter -->
			<div class="flex flex-col sm:flex-row flex-wrap gap-3">
				<div class="w-full sm:w-44">
					<UiSelect
						:model-value="allFilter.status"
						:options="statusOptions"
						placeholder="Tất cả trạng thái"
						@update:model-value="allFilter.status = $event as OnlineWorkStatus | undefined"
					/>
				</div>
				<div class="w-full sm:w-44">
					<UiSelectInput
						:model-value="allFilter.departmentId ?? 0"
						:options="departmentOptions"
						placeholder="Tất cả phòng ban"
						@update:model-value="allFilter.departmentId = $event === 0 ? undefined : ($event as number)"
					/>
				</div>
				<div class="flex items-center gap-2">
					<input
						v-model="allFilter.startDate"
						type="date"
						class="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors"
					/>
					<span class="text-gray-400 text-sm">→</span>
					<input
						v-model="allFilter.endDate"
						type="date"
						class="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors"
					/>
				</div>
				<CommonAppButton :loading="loading" @click="applyAllFilter">
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
					</svg>
					Tìm kiếm
				</CommonAppButton>
			</div>

			<!-- Table -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nhân viên</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Phòng ban</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Thời gian</th>
								<th class="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Số ngày</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Kịch bản</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Trạng thái</th>
								<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Thao tác</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr v-if="loading">
								<td colspan="7" class="px-4 py-8 text-center">
									<svg class="animate-spin w-5 h-5 mx-auto text-brand-500" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
									</svg>
								</td>
							</tr>
							<tr v-else-if="requests.length === 0">
								<td colspan="7" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
									Không có đơn nào
								</td>
							</tr>
							<tr
								v-for="req in requests"
								:key="req.id"
								class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
								@click="detailTarget = req"
							>
								<td class="px-4 py-3">
									<p class="font-medium text-gray-900 dark:text-white">{{ req.employee.fullName }}</p>
									<p class="text-xs text-gray-400 dark:text-gray-500">{{ req.employee.employeeCode }}</p>
								</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-400">{{ req.employee.department ?? '—' }}</td>
								<td class="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
									{{ formatDate(req.startDate) }}
									<template v-if="req.startDate !== req.endDate"> → {{ formatDate(req.endDate) }}</template>
								</td>
								<td class="px-4 py-3 text-center font-medium text-gray-900 dark:text-white">{{ req.totalDays }}</td>
								<td class="px-4 py-3">
									<span
										:class="[
											'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
											req.requiresMultiLevel
												? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
												: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
										]"
									>
										{{ req.requiresMultiLevel ? '3 cấp' : '1 cấp' }}
									</span>
								</td>
								<td class="px-4 py-3">
									<OnlineWorkStatusBadge :status="req.status" :reject-level="req.rejectLevel" />
								</td>
								<td class="px-4 py-3" @click.stop>
									<div class="flex justify-end">
										<button
											class="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
											title="Xem chi tiết"
											@click="detailTarget = req"
										>
											<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
												<path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
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
					:current-page="allFilter.page"
					:total-pages="requestsMeta.totalPages"
					@update:current-page="p => { allFilter.page = p; fetchAllRequests(); }"
				/>
			</div>
		</template>

		<!-- ══════════════════ TAB 3: BÁO CÁO ══════════════════ -->
		<template v-else-if="activeTab === 'report'">
			<!-- Filter & export -->
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
				<div class="flex flex-wrap items-center gap-2">
					<div class="w-36">
						<UiSelect
							:model-value="reportFilter.month"
							:options="monthOptions"
							placeholder="Tháng"
							@update:model-value="reportFilter.month = $event as number"
						/>
					</div>
					<div class="w-32">
						<UiSelect
							:model-value="reportFilter.year"
							:options="yearOptions"
							placeholder="Năm"
							@update:model-value="reportFilter.year = $event as number"
						/>
					</div>
					<div class="w-44">
						<UiSelectInput
							:model-value="reportFilter.departmentId ?? 0"
							:options="departmentOptions"
							placeholder="Tất cả phòng ban"
							@update:model-value="reportFilter.departmentId = $event === 0 ? undefined : ($event as number)"
						/>
					</div>
					<CommonAppButton :loading="reportLoading" @click="fetchOnlineReport">
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
						</svg>
						Xem báo cáo
					</CommonAppButton>
				</div>
				<CommonAppButton variant="secondary" :loading="exportingReport" @click="handleExportReport">
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
					</svg>
					Xuất Excel
				</CommonAppButton>
			</div>

			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Mã NV</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Họ tên</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Phòng ban</th>
								<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tổng đơn</th>
								<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Hoàn thành</th>
								<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ngày đã duyệt</th>
								<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Chờ duyệt</th>
								<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Từ chối</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr v-if="reportLoading">
								<td colspan="8" class="px-4 py-8 text-center">
									<svg class="animate-spin w-5 h-5 mx-auto text-brand-500" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
									</svg>
								</td>
							</tr>
							<tr v-else-if="reportData.length === 0">
								<td colspan="8" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
									Không có dữ liệu báo cáo
								</td>
							</tr>
							<tr
								v-for="row in reportData"
								:key="row.employeeCode"
								class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
							>
								<td class="px-4 py-3">
									<span class="font-mono text-xs text-gray-500 dark:text-gray-400">{{ row.employeeCode }}</span>
								</td>
								<td class="px-4 py-3 font-medium text-gray-900 dark:text-white">{{ row.fullName }}</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-400">{{ row.departmentName }}</td>
								<td class="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{{ row.totalRequests }}</td>
								<td class="px-4 py-3 text-right">
									<span class="text-green-600 dark:text-green-400 font-medium">{{ row.completedRequests }}</span>
								</td>
								<td class="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">{{ row.totalDaysApproved }}</td>
								<td class="px-4 py-3 text-right">
									<span :class="row.pendingRequests > 0 ? 'text-orange-500 dark:text-orange-400 font-medium' : 'text-gray-400'">
										{{ row.pendingRequests }}
									</span>
								</td>
								<td class="px-4 py-3 text-right">
									<span :class="row.rejectedRequests > 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400'">
										{{ row.rejectedRequests }}
									</span>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</template>
	</div>

	<!-- ─── Modals ─────────────────────────────────────────────────────────── -->
	<Teleport to="body">
		<RejectOnlineWorkModal
			v-if="rejectTarget"
			:request="rejectTarget"
			@rejected="onRejected"
			@close="rejectTarget = null"
		/>
		<OnlineWorkDetailModal
			v-if="detailTarget"
			:request="detailTarget"
			:approving="approvingId === detailTarget.id"
			@approve="handleApproveFromDetail"
			@reject="handleRejectFromDetail"
			@close="detailTarget = null"
		/>
	</Teleport>
</template>
