<script setup lang="ts">
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useDepartmentService } from '~/services/department.service';
import OvertimeStatusBadge from '~/components/modules/overtime/OvertimeStatusBadge.vue';
import OvertimeDetailModal from '~/components/modules/overtime/OvertimeDetailModal.vue';
import RejectOvertimeModal from '~/components/modules/overtime/RejectOvertimeModal.vue';
import type { OvertimeRequestResponse, OvertimeStatus, QueryOvertimeParams } from '~/types/overtime.types';
import type { DepartmentSummary } from '~/types/department.types';
import type { SelectOption } from '~/components/ui/Select.vue';

definePageMeta({ title: 'Quản lý OT' });

const toast = useToast();
const { user } = useAuth();
const {
	requests,
	requestsMeta,
	loading,
	reportData,
	reportLoading,
	fetchAll,
	fetchReport,
	exportReport,
	approve,
} = useOvertimeRequests();
const departmentService = useDepartmentService();

const canApprove = computed(() => user.value?.role === 'ADMIN' || user.value?.role === 'MANAGER' || user.value?.role === 'CHIEF');

// ─── Tabs ─────────────────────────────────────────────────────────────────────
type Tab = 'requests' | 'report';
const activeTab = ref<Tab>('requests');

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

const departmentOptions = computed(() => [
	{ value: 0, label: 'Tất cả phòng ban' },
	...departments.value.map(d => ({ value: d.id, label: d.name })),
]);

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — ĐƠN OT
// ═══════════════════════════════════════════════════════════════════════════════
const today = new Date();

const requestFilter = reactive({
	month: today.getMonth() + 1,
	year: today.getFullYear(),
	departmentId: undefined as number | undefined,
	status: undefined as OvertimeStatus | undefined,
	search: '',
	page: 1,
});

// Summary counts derived from current page — refreshed on every fetch
const summaryPending = ref(0);
const summaryApproved = ref(0);
const summaryTotalHours = ref(0);

async function fetchRequests() {
	const params: QueryOvertimeParams = {
		month: requestFilter.month,
		year: requestFilter.year,
		departmentId: requestFilter.departmentId,
		status: requestFilter.status,
		page: requestFilter.page,
		limit: 20,
	};
	await fetchAll(params);
	// Recompute summary from full result (approximate based on visible page)
	summaryPending.value = requests.value.filter(r => r.status === 'PENDING').length;
	summaryApproved.value = requests.value.filter(r => r.status === 'APPROVED').length;
	summaryTotalHours.value = requests.value
		.filter(r => r.status === 'APPROVED')
		.reduce((acc, r) => acc + r.totalHours, 0);
}

function applyRequestFilter() {
	requestFilter.page = 1;
	fetchRequests();
}

const filteredRequests = computed(() => {
	const q = requestFilter.search.trim().toLowerCase();
	if (!q) return requests.value;
	return requests.value.filter(
		r =>
			r.employee.fullName.toLowerCase().includes(q) ||
			r.employee.employeeCode.toLowerCase().includes(q),
	);
});

// Month selector helpers
const monthOptions: SelectOption[] = Array.from({ length: 12 }, (_, i) => ({
	value: i + 1,
	label: `Tháng ${i + 1}`,
}));

const yearOptions: SelectOption[] = [-1, 0, 1].map(offset => ({
	value: today.getFullYear() + offset,
	label: String(today.getFullYear() + offset),
}));

const statusOptions: SelectOption[] = [
	{ value: undefined, label: 'Tất cả trạng thái' },
	{ value: 'PENDING', label: 'Chờ duyệt' },
	{ value: 'APPROVED', label: 'Đã duyệt' },
	{ value: 'REJECTED', label: 'Từ chối' },
	{ value: 'CANCELLED', label: 'Đã thu hồi' },
	{ value: 'AUTO_CANCELLED', label: 'Hết hạn' },
];

// ─── Approve ──────────────────────────────────────────────────────────────────
const approvingId = ref<number | null>(null);

async function handleApprove(req: OvertimeRequestResponse) {
	if (!confirm(`Duyệt đơn OT ${req.hoursDisplay} ngày ${format(new Date(req.overtimeDate), 'dd/MM/yyyy')} của ${req.employee.fullName}?`)) return;
	approvingId.value = req.id;
	try {
		const updated = await approve(req.id);
		const idx = requests.value.findIndex(r => r.id === updated.id);
		if (idx !== -1) requests.value.splice(idx, 1, updated);
		toast.success('Đã duyệt đơn OT');
		fetchRequests();
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	} finally {
		approvingId.value = null;
	}
}

// ─── Reject ───────────────────────────────────────────────────────────────────
const rejectTarget = ref<OvertimeRequestResponse | null>(null);

function onRejected() {
	rejectTarget.value = null;
	fetchRequests();
}

// ─── Detail ───────────────────────────────────────────────────────────────────
const detailTarget = ref<OvertimeRequestResponse | null>(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d: string) {
	return format(new Date(d), 'dd/MM/yyyy');
}

function formatTime(d: string) {
	return format(new Date(d), 'HH:mm');
}

function truncate(text: string, len = 60) {
	return text.length > len ? text.slice(0, len) + '…' : text;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — BÁO CÁO OT
// ═══════════════════════════════════════════════════════════════════════════════
const reportFilter = reactive({
	month: today.getMonth() + 1,
	year: today.getFullYear(),
	departmentId: undefined as number | undefined,
});
const exportingReport = ref(false);

async function fetchOvertimeReport() {
	try {
		await fetchReport({
			month: reportFilter.month,
			year: reportFilter.year,
			departmentId: reportFilter.departmentId,
		});
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Lỗi tải báo cáo OT');
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
		a.download = `bao-cao-ot-${reportFilter.month}-${reportFilter.year}.xlsx`;
		a.click();
		URL.revokeObjectURL(url);
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Xuất Excel thất bại');
	} finally {
		exportingReport.value = false;
	}
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(() => {
	loadDepartments();
	fetchRequests();
});

watch(activeTab, tab => {
	if (tab === 'report' && reportData.value.length === 0) fetchOvertimeReport();
});
</script>

<template>
	<div class="space-y-5">
		<!-- Page header -->
		<div>
			<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Quản lý OT</h1>
			<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Duyệt đơn làm thêm giờ và xem báo cáo OT</p>
		</div>

		<!-- Tabs -->
		<div class="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
			<button
				v-for="tab in [
					{ key: 'requests', label: 'Đơn OT' },
					{ key: 'report', label: 'Báo cáo OT' },
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

		<!-- ══════════════════════════════ TAB 1: ĐƠN OT ══════════════════════════════ -->
		<template v-if="activeTab === 'requests'">
			<!-- Summary cards -->
			<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
				<div class="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
					<div class="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
						<svg class="w-4 h-4 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<div>
						<p class="text-xs text-gray-500 dark:text-gray-400">Chờ duyệt</p>
						<p class="text-lg font-bold text-gray-900 dark:text-white leading-tight">{{ summaryPending }}</p>
					</div>
				</div>

				<div class="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
					<div class="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
						<svg class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<div>
						<p class="text-xs text-gray-500 dark:text-gray-400">Đã duyệt</p>
						<p class="text-lg font-bold text-gray-900 dark:text-white leading-tight">{{ summaryApproved }}</p>
					</div>
				</div>

				<div class="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
					<div class="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
						<svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<div>
						<p class="text-xs text-gray-500 dark:text-gray-400">Tổng giờ OT</p>
						<p class="text-lg font-bold text-gray-900 dark:text-white leading-tight">{{ summaryTotalHours.toFixed(1) }}h</p>
					</div>
				</div>
			</div>

			<!-- Filter bar -->
			<div class="flex flex-col sm:flex-row flex-wrap gap-3">
				<div class="w-full sm:w-36">
					<UiSelect
						:model-value="requestFilter.month"
						:options="monthOptions"
						placeholder="Tháng"
						@update:model-value="requestFilter.month = $event as number"
					/>
				</div>
				<div class="w-full sm:w-32">
					<UiSelect
						:model-value="requestFilter.year"
						:options="yearOptions"
						placeholder="Năm"
						@update:model-value="requestFilter.year = $event as number"
					/>
				</div>
				<div class="w-full sm:w-44">
					<UiSelectInput
						:model-value="requestFilter.departmentId ?? 0"
						:options="departmentOptions"
						placeholder="Tất cả phòng ban"
						@update:model-value="requestFilter.departmentId = $event === 0 ? undefined : ($event as number)"
					/>
				</div>
				<div class="w-full sm:w-44">
					<UiSelect
						:model-value="requestFilter.status"
						:options="statusOptions"
						placeholder="Tất cả trạng thái"
						@update:model-value="requestFilter.status = $event as OvertimeStatus | undefined"
					/>
				</div>
				<input
					v-model="requestFilter.search"
					type="text"
					placeholder="Tìm nhân viên..."
					class="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors w-full sm:w-48"
				/>
				<CommonAppButton :loading="loading" @click="applyRequestFilter">
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
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ngày OT</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Thời gian</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Số giờ</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Lý do</th>
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
							<tr v-else-if="filteredRequests.length === 0">
								<td colspan="7" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
									Không có đơn OT nào
								</td>
							</tr>
							<tr
								v-for="req in filteredRequests"
								:key="req.id"
								class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
							>
								<!-- Nhân viên -->
								<td class="px-4 py-3">
									<p class="font-medium text-gray-900 dark:text-white">{{ req.employee.fullName }}</p>
									<p class="text-xs text-gray-400 dark:text-gray-500">{{ req.employee.employeeCode }}</p>
									<p v-if="req.employee.department" class="text-xs text-gray-400 dark:text-gray-500">{{ req.employee.department }}</p>
								</td>

								<!-- Ngày OT -->
								<td class="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
									{{ formatDate(req.overtimeDate) }}
								</td>

								<!-- Thời gian -->
								<td class="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
									{{ formatTime(req.startTime) }} → {{ formatTime(req.endTime) }}
								</td>

								<!-- Số giờ -->
								<td class="px-4 py-3">
									<span class="font-medium text-gray-900 dark:text-white">{{ req.hoursDisplay }}</span>
								</td>

								<!-- Lý do -->
								<td class="px-4 py-3 max-w-[180px]">
									<UiTooltip v-if="req.reason.length > 60" :label="req.reason">
										<span class="text-gray-600 dark:text-gray-400 cursor-default">{{ truncate(req.reason) }}</span>
									</UiTooltip>
									<span v-else class="text-gray-600 dark:text-gray-400">{{ req.reason }}</span>
								</td>

								<!-- Trạng thái -->
								<td class="px-4 py-3">
									<OvertimeStatusBadge :status="req.status" />
								</td>

								<!-- Thao tác -->
								<td class="px-4 py-3">
									<div class="flex items-center justify-end gap-1.5">
										<template v-if="req.status === 'PENDING' && canApprove">
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
					:current-page="requestFilter.page"
					:total-pages="requestsMeta.totalPages"
					@update:current-page="p => { requestFilter.page = p; fetchRequests(); }"
				/>
			</div>
		</template>

		<!-- ══════════════════════════════ TAB 2: BÁO CÁO OT ══════════════════════════════ -->
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
					<CommonAppButton :loading="reportLoading" @click="fetchOvertimeReport">
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

			<!-- Report table -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Mã NV</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Họ tên</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Phòng ban</th>
								<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tổng đơn</th>
								<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Đã duyệt</th>
								<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tổng giờ OT</th>
								<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Đang chờ</th>
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
								:key="row.employeeId"
								class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
							>
								<td class="px-4 py-3">
									<span class="font-mono text-xs text-gray-500 dark:text-gray-400">{{ row.employeeCode }}</span>
								</td>
								<td class="px-4 py-3 font-medium text-gray-900 dark:text-white">{{ row.fullName }}</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-400">{{ row.departmentName ?? '—' }}</td>
								<td class="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{{ row.totalRequests }}</td>
								<td class="px-4 py-3 text-right">
									<span class="text-green-600 dark:text-green-400 font-medium">{{ row.approvedRequests }}</span>
								</td>
								<td class="px-4 py-3 text-right">
									<span class="font-semibold text-gray-900 dark:text-white">{{ row.totalApprovedHours.toFixed(1) }}h</span>
								</td>
								<td class="px-4 py-3 text-right">
									<span
										:class="row.pendingRequests > 0 ? 'text-orange-500 dark:text-orange-400 font-medium' : 'text-gray-400'"
									>
										{{ row.pendingRequests }}
									</span>
								</td>
								<td class="px-4 py-3 text-right">
									<span
										:class="row.rejectedRequests > 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400'"
									>
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
		<RejectOvertimeModal
			v-if="rejectTarget"
			:request="rejectTarget"
			@rejected="onRejected"
			@close="rejectTarget = null"
		/>
		<OvertimeDetailModal
			v-if="detailTarget"
			:request="detailTarget"
			@close="detailTarget = null"
		/>
	</Teleport>
</template>
