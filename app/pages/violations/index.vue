<script setup lang="ts">
	import { format } from 'date-fns';
	import { useViolationRequestService } from '~/services/violation-request.service';
	import { useDepartmentService } from '~/services/department.service';
	import ViolationStatusBadge from '~/components/modules/violation/ViolationStatusBadge.vue';
	import ViolationRequestModal from '~/components/modules/violation/ViolationRequestModal.vue';
	import ViolationRejectModal from '~/components/modules/violation/ViolationRejectModal.vue';
	import ViolationDetailModal from '~/components/modules/violation/ViolationDetailModal.vue';
	import type {
		ViolationRequest,
		ViolationCounter,
		ViolationRequestType,
		ViolationRequestStatus,
		QueryViolationRequestParams,
	} from '~/types/violation.types';
	import type { DepartmentSummary } from '~/types/department.types';
	import type { PaginatedMeta } from '~/types/api.types';
	import type { SelectOption } from '~/components/ui/Select.vue';

	definePageMeta({ title: 'Phiếu vi phạm' });

	const toast = useToast();
	const { user } = useAuth();
	const violationService = useViolationRequestService();
	const departmentService = useDepartmentService();

	// ─── Role ─────────────────────────────────────────────────────────────────────
	const canManage = computed(() => ['HR', 'ADMIN', 'MANAGER'].includes(user.value?.role ?? ''));

	// ─── Tabs ─────────────────────────────────────────────────────────────────────
	type Tab = 'mine' | 'manage';
	const activeTab = ref<Tab>('mine');

	// ─── Shared options ──────────────────────────────────────────────────────────
	const today = new Date();
	const currentMonth = today.getMonth() + 1;
	const currentYear = today.getFullYear();

	const monthOptions = computed<SelectOption[]>(() => [
		{ value: undefined, label: 'Tất cả tháng' },
		...Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Tháng ${i + 1}` })),
	]);

	const monthOptionsRequired = computed<SelectOption[]>(() =>
		Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Tháng ${i + 1}` })),
	);

	const yearOptions = computed<SelectOption[]>(() =>
		[currentYear - 1, currentYear, currentYear + 1].map(y => ({ value: y, label: String(y) })),
	);

	const typeOptions: SelectOption[] = [
		{ value: undefined, label: 'Tất cả loại' },
		{ value: 'FORGOT_CHECKIN', label: 'Quên chấm công' },
		{ value: 'LATE', label: 'Đi muộn' },
		{ value: 'EARLY', label: 'Về sớm' },
	];

	const statusOptions: SelectOption[] = [
		{ value: undefined, label: 'Tất cả trạng thái' },
		{ value: 'PENDING', label: 'Chờ duyệt' },
		{ value: 'APPROVED', label: 'Đã duyệt' },
		{ value: 'REJECTED', label: 'Từ chối' },
		{ value: 'CANCELLED', label: 'Đã thu hồi' },
	];

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

	const departmentOptions = computed<SelectOption[]>(() => [
		{ value: undefined, label: 'Tất cả phòng ban' },
		...departments.value.map(d => ({ value: d.id, label: d.name })),
	]);

	// ═══════════════════════════════════════════════════════════════════════════════
	// TAB 1 — ĐƠN CỦA TÔI
	// ═══════════════════════════════════════════════════════════════════════════════
	const myRequests = ref<ViolationRequest[]>([]);
	const myLoading = ref(false);
	const myMeta = ref<PaginatedMeta | null>(null);
	const counter = ref<ViolationCounter | null>(null);

	const myFilter = reactive({
		month: undefined as number | undefined,
		year: undefined as number | undefined,
		type: undefined as ViolationRequestType | undefined,
		status: undefined as ViolationRequestStatus | undefined,
		page: 1,
	});

	async function fetchCounter() {
		try {
			counter.value = await violationService.getMyStatus(currentMonth, currentYear);
		} catch {
			// non-critical
		}
	}

	async function fetchMyRequests() {
		myLoading.value = true;
		try {
			const params: QueryViolationRequestParams = {
				month: myFilter.month,
				year: myFilter.year,
				type: myFilter.type,
				status: myFilter.status,
				page: myFilter.page,
				limit: 20,
			};
			const res = await violationService.findMe(params);
			myRequests.value = res.data;
			myMeta.value = res.meta;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi tải danh sách phiếu');
		} finally {
			myLoading.value = false;
		}
	}

	function applyMyFilter() {
		myFilter.page = 1;
		fetchMyRequests();
	}

	// ─── Create modal ─────────────────────────────────────────────────────────────
	const showCreateModal = ref(false);

	function openCreateModal() {
		if (counter.value?.isBlocked) return;
		showCreateModal.value = true;
	}

	function onSubmitted(req: ViolationRequest) {
		showCreateModal.value = false;
		myRequests.value.unshift(req);
		fetchCounter();
	}

	// ─── Cancel ───────────────────────────────────────────────────────────────────
	const cancellingId = ref<number | null>(null);

	async function handleCancel(req: ViolationRequest) {
		if (!confirm('Thu hồi phiếu này?')) return;
		cancellingId.value = req.id;
		try {
			const updated = await violationService.cancel(req.id);
			const idx = myRequests.value.findIndex(r => r.id === updated.id);
			if (idx !== -1) myRequests.value.splice(idx, 1, updated);
			toast.success('Đã thu hồi phiếu');
			fetchCounter();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
		} finally {
			cancellingId.value = null;
		}
	}

	// ═══════════════════════════════════════════════════════════════════════════════
	// TAB 2 — QUẢN LÝ VI PHẠM
	// ═══════════════════════════════════════════════════════════════════════════════
	const allRequests = ref<ViolationRequest[]>([]);
	const allLoading = ref(false);
	const allMeta = ref<PaginatedMeta | null>(null);

	const mgmtFilter = reactive({
		month: currentMonth,
		year: currentYear,
		departmentId: undefined as number | undefined,
		type: undefined as ViolationRequestType | undefined,
		status: undefined as ViolationRequestStatus | undefined,
		page: 1,
	});

	async function fetchAllRequests() {
		allLoading.value = true;
		try {
			const params: QueryViolationRequestParams = {
				month: mgmtFilter.month,
				year: mgmtFilter.year,
				departmentId: mgmtFilter.departmentId,
				type: mgmtFilter.type,
				status: mgmtFilter.status,
				page: mgmtFilter.page,
				limit: 20,
			};
			const res = await violationService.findAll(params);
			allRequests.value = res.data;
			allMeta.value = res.meta;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi tải danh sách phiếu');
		} finally {
			allLoading.value = false;
		}
	}

	function applyMgmtFilter() {
		mgmtFilter.page = 1;
		fetchAllRequests();
	}

	// ─── Approve ──────────────────────────────────────────────────────────────────
	const approvingId = ref<number | null>(null);

	async function handleApprove(req: ViolationRequest) {
		if (!confirm(`Duyệt phiếu vi phạm của ${req.employee.fullName}?`)) return;
		approvingId.value = req.id;
		try {
			const updated = await violationService.approve(req.id);
			const idx = allRequests.value.findIndex(r => r.id === updated.id);
			if (idx !== -1) allRequests.value.splice(idx, 1, updated);
			toast.success('Đã duyệt phiếu vi phạm');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
		} finally {
			approvingId.value = null;
		}
	}

	// ─── Detail modal ─────────────────────────────────────────────────────────────
	const detailRequest = ref<ViolationRequest | null>(null);

	// ─── Reject ───────────────────────────────────────────────────────────────────
	const rejectTarget = ref<ViolationRequest | null>(null);

	function onRejected() {
		rejectTarget.value = null;
		fetchAllRequests();
	}

	// ─── Export ───────────────────────────────────────────────────────────────────
	const exportingReport = ref(false);

	async function handleExport() {
		exportingReport.value = true;
		try {
			const blob = await violationService.exportReport({
				month: mgmtFilter.month,
				year: mgmtFilter.year,
				departmentId: mgmtFilter.departmentId,
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `vi-pham-${String(mgmtFilter.month).padStart(2, '0')}-${mgmtFilter.year}.xlsx`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Xuất báo cáo thất bại');
		} finally {
			exportingReport.value = false;
		}
	}

	// ─── Helpers ──────────────────────────────────────────────────────────────────
	function formatDate(d: string) {
		return format(new Date(d), 'dd/MM/yyyy');
	}

	function truncate(text: string | null, len = 55) {
		if (!text) return '—';
		return text.length > len ? text.slice(0, len) + '…' : text;
	}

	function canReview(req: ViolationRequest): boolean {
		if (!user.value) return false;
		if (req.assignedReviewer !== null) {
			return req.assignedReviewer.id === user.value.id;
		}
		return ['HR', 'ADMIN'].includes(user.value.role);
	}

	const typeLabelMap: Record<ViolationRequestType, string> = {
		FORGOT_CHECKIN: 'Quên chấm công',
		LATE: 'Đi muộn',
		EARLY: 'Về sớm',
	};

	const typeClassMap: Record<ViolationRequestType, string> = {
		FORGOT_CHECKIN: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
		LATE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
		EARLY: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
	};

	// ─── Lifecycle ────────────────────────────────────────────────────────────────
	onMounted(() => {
		fetchCounter();
		fetchMyRequests();
		if (canManage.value) loadDepartments();
	});

	watch(activeTab, tab => {
		if (tab === 'manage' && allRequests.value.length === 0) fetchAllRequests();
	});
</script>

<template>
	<div class="space-y-5">
		<!-- Page header -->
		<div>
			<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Phiếu vi phạm chuyên cần</h1>
			<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Giải trình vi phạm chấm công: quên chấm, đi muộn, về sớm</p>
		</div>

		<!-- Tabs -->
		<div class="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
			<button
				class="px-4 py-1.5 text-sm font-medium rounded-lg transition-all"
				:class="
					activeTab === 'mine'
						? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
						: 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
				"
				@click="activeTab = 'mine'"
			>
				Đơn của tôi
			</button>
			<button
				v-if="canManage"
				class="px-4 py-1.5 text-sm font-medium rounded-lg transition-all"
				:class="
					activeTab === 'manage'
						? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
						: 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
				"
				@click="activeTab = 'manage'"
			>
				Quản lý vi phạm
			</button>
		</div>

		<!-- ══════════════════════════════ TAB 1: ĐƠN CỦA TÔI ══════════════════════════════ -->
		<template v-if="activeTab === 'mine'">
			<!-- Quota bar -->
			<div
				v-if="counter"
				class="p-4 rounded-xl border"
				:class="
					counter.isBlocked
						? 'bg-red-50 border-red-300 dark:bg-red-900/10 dark:border-red-700'
						: 'bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-700'
				"
			>
				<p v-if="counter.isBlocked" class="text-red-700 dark:text-red-400 font-semibold text-sm">
					❌ Bạn đã hết số lần giải trình vi phạm chuyên cần trong tháng (Tối đa 5 lần). Hệ thống không cho phép tạo thêm
					đơn.
				</p>
				<div v-else>
					<div class="flex justify-between items-center mb-2">
						<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Số lần đã dùng tháng {{ currentMonth }}/{{ currentYear }}
						</span>
						<span
							class="text-sm font-bold"
							:class="counter.remaining <= 1 ? 'text-red-600 dark:text-red-400' : 'text-blue-700 dark:text-blue-300'"
						>
							{{ counter.usedCount }}/5
						</span>
					</div>
					<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
						<div
							class="h-2 rounded-full transition-all"
							:class="
								counter.usedCount >= 4 ? 'bg-red-500' : counter.usedCount >= 3 ? 'bg-orange-500' : 'bg-blue-500'
							"
							:style="`width: ${(counter.usedCount / 5) * 100}%`"
						/>
					</div>
					<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
						Còn lại {{ counter.remaining }} lần trong tháng này
					</p>
				</div>
			</div>

			<!-- Header & create button -->
			<div class="flex items-center justify-between">
				<h2 class="text-base font-semibold text-gray-900 dark:text-white">Danh sách phiếu của tôi</h2>
				<CommonAppButton :disabled="counter?.isBlocked" @click="openCreateModal">
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
					</svg>
					Tạo phiếu
				</CommonAppButton>
			</div>

			<!-- Filter -->
			<div class="flex flex-col sm:flex-row flex-wrap gap-3">
				<div class="w-full sm:w-36">
					<UiSelect
						:model-value="myFilter.month"
						:options="monthOptions"
						placeholder="Tất cả tháng"
						@update:model-value="myFilter.month = $event as number | undefined"
					/>
				</div>
				<div class="w-full sm:w-28">
					<UiSelect
						:model-value="myFilter.year"
						:options="yearOptions"
						placeholder="Năm"
						@update:model-value="myFilter.year = $event as number | undefined"
					/>
				</div>
				<div class="w-full sm:w-44">
					<UiSelect
						:model-value="myFilter.type"
						:options="typeOptions"
						placeholder="Tất cả loại"
						@update:model-value="myFilter.type = $event as ViolationRequestType | undefined"
					/>
				</div>
				<div class="w-full sm:w-44">
					<UiSelect
						:model-value="myFilter.status"
						:options="statusOptions"
						placeholder="Tất cả trạng thái"
						@update:model-value="myFilter.status = $event as ViolationRequestStatus | undefined"
					/>
				</div>
				<CommonAppButton :loading="myLoading" @click="applyMyFilter">
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
						/>
					</svg>
					Tìm
				</CommonAppButton>
			</div>

			<!-- My requests table -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
								<th
									class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
								>
									Loại vi phạm
								</th>
								<th
									class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
								>
									Ngày vi phạm
								</th>
								<th
									class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
								>
									Hạn nộp
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
							<tr v-if="myLoading">
								<td colspan="5" class="px-4 py-8 text-center">
									<svg class="animate-spin w-5 h-5 mx-auto text-brand-500" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
									</svg>
								</td>
							</tr>
							<tr v-else-if="myRequests.length === 0">
								<td colspan="5" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
									Chưa có phiếu vi phạm nào
								</td>
							</tr>
							<tr
								v-for="req in myRequests"
								:key="req.id"
								class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
							>
								<!-- Loại vi phạm -->
								<td class="px-4 py-3">
									<div class="flex items-center gap-2 flex-wrap">
										<span
											:class="['inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', typeClassMap[req.type]]"
										>
											{{ typeLabelMap[req.type] }}
										</span>
										<span
											v-if="req.isViolationFlagged"
											class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
											title="Vi phạm kỷ luật"
										>
											⚠️ Vi phạm KL
										</span>
									</div>
								</td>

								<!-- Ngày vi phạm -->
								<td class="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
									{{ formatDate(req.violationDate) }}
								</td>

								<!-- Hạn nộp -->
								<td class="px-4 py-3 whitespace-nowrap">
									<span
										:class="[
											'text-xs',
											req.deadlinePassed
												? 'text-red-600 dark:text-red-400 font-medium'
												: 'text-gray-500 dark:text-gray-400',
										]"
									>
										{{ formatDate(req.deadline) }}
										<span v-if="req.deadlinePassed" class="ml-1">(Quá hạn)</span>
									</span>
								</td>

								<!-- Trạng thái -->
								<td class="px-4 py-3">
									<ViolationStatusBadge :status="req.status" />
								</td>

								<!-- Thao tác -->
								<td class="px-4 py-3">
									<div class="flex items-center justify-end gap-1.5">
										<button
											class="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-colors"
											title="Xem chi tiết"
											@click="detailRequest = req"
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
										<CommonAppButton
											v-if="req.status === 'PENDING'"
											size="sm"
											variant="outline"
											:loading="cancellingId === req.id"
											@click="handleCancel(req)"
										>
											Thu hồi
										</CommonAppButton>
									</div>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>

			<!-- Pagination -->
			<div v-if="myMeta && myMeta.totalPages > 1" class="flex items-center justify-between pt-1">
				<p class="text-sm text-gray-500 dark:text-gray-400">
					Tổng <strong class="text-gray-700 dark:text-gray-300">{{ myMeta.total }}</strong> phiếu
				</p>
				<CommonAppPagination
					:current-page="myFilter.page"
					:total-pages="myMeta.totalPages"
					@update:current-page="
						p => {
							myFilter.page = p;
							fetchMyRequests();
						}
					"
				/>
			</div>
		</template>

		<!-- ══════════════════════════════ TAB 2: QUẢN LÝ VI PHẠM ══════════════════════════════ -->
		<template v-else-if="activeTab === 'manage' && canManage">
			<!-- Header & export -->
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
				<h2 class="text-base font-semibold text-gray-900 dark:text-white">
					Phiếu vi phạm tháng {{ mgmtFilter.month }}/{{ mgmtFilter.year }}
				</h2>
				<CommonAppButton variant="secondary" :loading="exportingReport" @click="handleExport">
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
						/>
					</svg>
					Xuất báo cáo tháng
				</CommonAppButton>
			</div>

			<!-- Filter -->
			<div class="flex flex-col sm:flex-row flex-wrap gap-3">
				<div class="w-full sm:w-36">
					<UiSelect
						:model-value="mgmtFilter.month"
						:options="monthOptionsRequired"
						@update:model-value="mgmtFilter.month = $event as number"
					/>
				</div>
				<div class="w-full sm:w-28">
					<UiSelect
						:model-value="mgmtFilter.year"
						:options="yearOptions"
						@update:model-value="mgmtFilter.year = $event as number"
					/>
				</div>
				<div class="w-full sm:w-44">
					<UiSelect
						:model-value="mgmtFilter.departmentId"
						:options="departmentOptions"
						placeholder="Tất cả phòng ban"
						@update:model-value="mgmtFilter.departmentId = $event as number | undefined"
					/>
				</div>
				<div class="w-full sm:w-44">
					<UiSelect
						:model-value="mgmtFilter.type"
						:options="typeOptions"
						placeholder="Tất cả loại"
						@update:model-value="mgmtFilter.type = $event as ViolationRequestType | undefined"
					/>
				</div>
				<div class="w-full sm:w-44">
					<UiSelect
						:model-value="mgmtFilter.status"
						:options="statusOptions"
						placeholder="Tất cả trạng thái"
						@update:model-value="mgmtFilter.status = $event as ViolationRequestStatus | undefined"
					/>
				</div>
				<CommonAppButton :loading="allLoading" @click="applyMgmtFilter">
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

			<!-- Management table -->
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
									Loại
								</th>
								<th
									class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
								>
									Ngày VP
								</th>
								<th
									class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
								>
									Hạn nộp
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
							<tr v-if="allLoading">
								<td colspan="7" class="px-4 py-8 text-center">
									<svg class="animate-spin w-5 h-5 mx-auto text-brand-500" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
									</svg>
								</td>
							</tr>
							<tr v-else-if="allRequests.length === 0">
								<td colspan="7" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
									Không có phiếu vi phạm nào
								</td>
							</tr>
							<tr
								v-for="req in allRequests"
								:key="req.id"
								class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
							>
								<!-- Nhân viên -->
								<td class="px-4 py-3">
									<p class="font-medium text-gray-900 dark:text-white">{{ req.employee.fullName }}</p>
									<p class="text-xs text-gray-400 dark:text-gray-500">{{ req.employee.employeeCode }}</p>
								</td>

								<!-- Loại -->
								<td class="px-4 py-3">
									<div class="flex items-center gap-1.5 flex-wrap">
										<span
											:class="['inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', typeClassMap[req.type]]"
										>
											{{ typeLabelMap[req.type] }}
										</span>
										<span
											v-if="req.isViolationFlagged"
											class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
										>
											⚠️ Vi phạm KL
										</span>
									</div>
								</td>

								<!-- Ngày VP -->
								<td class="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
									{{ formatDate(req.violationDate) }}
								</td>

								<!-- Hạn nộp -->
								<td class="px-4 py-3 whitespace-nowrap">
									<span
										:class="[
											'text-xs',
											req.deadlinePassed
												? 'text-red-600 dark:text-red-400 font-medium'
												: 'text-gray-500 dark:text-gray-400',
										]"
									>
										{{ formatDate(req.deadline) }}
									</span>
								</td>

								<!-- Lý do -->
								<td class="px-4 py-3 max-w-[180px]">
									<UiTooltip v-if="req.reason.length > 55" :label="req.reason">
										<span class="text-gray-600 dark:text-gray-400 cursor-default">{{ truncate(req.reason) }}</span>
									</UiTooltip>
									<span v-else class="text-gray-600 dark:text-gray-400">{{ req.reason }}</span>
								</td>

								<!-- Trạng thái -->
								<td class="px-4 py-3">
									<ViolationStatusBadge :status="req.status" />
								</td>

								<!-- Thao tác -->
								<td class="px-4 py-3">
									<div class="flex items-center justify-end gap-1.5">
										<button
											class="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-colors"
											title="Xem chi tiết"
											@click="detailRequest = req"
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
										<template v-if="req.status === 'PENDING' && canReview(req)">
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
									</div>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>

			<!-- Pagination -->
			<div v-if="allMeta && allMeta.totalPages > 1" class="flex items-center justify-between pt-1">
				<p class="text-sm text-gray-500 dark:text-gray-400">
					Tổng <strong class="text-gray-700 dark:text-gray-300">{{ allMeta.total }}</strong> phiếu
				</p>
				<CommonAppPagination
					:current-page="mgmtFilter.page"
					:total-pages="allMeta.totalPages"
					@update:current-page="
						p => {
							mgmtFilter.page = p;
							fetchAllRequests();
						}
					"
				/>
			</div>
		</template>
	</div>

	<!-- ─── Modals ─────────────────────────────────────────────────────────────── -->
	<Teleport to="body">
		<ViolationRequestModal
			v-if="showCreateModal && counter"
			:counter="counter"
			@submitted="onSubmitted"
			@close="showCreateModal = false"
		/>
		<ViolationRejectModal
			v-if="rejectTarget"
			:violation-request="rejectTarget"
			@rejected="onRejected"
			@close="rejectTarget = null"
		/>
		<ViolationDetailModal
			v-if="detailRequest"
			:violation-request="detailRequest"
			@close="detailRequest = null"
		/>
	</Teleport>
</template>
