<script setup lang="ts">
	import { format } from 'date-fns';
	import { useViolationRequestService } from '~/services/violation-request.service';
	import { useDepartmentService } from '~/services/department.service';
	import ViolationStatusBadge from '~/components/modules/violation/ViolationStatusBadge.vue';
	import ViolationRejectModal from '~/components/modules/violation/ViolationRejectModal.vue';
	import ViolationDetailModal from '~/components/modules/violation/ViolationDetailModal.vue';
	import type {
		ViolationRequest,
		ViolationRequestType,
		ViolationRequestStatus,
		QueryViolationRequestParams,
	} from '~/types/violation.types';
	import type { DepartmentSummary } from '~/types/department.types';
	import type { PaginatedMeta } from '~/types/api.types';
	import type { SelectOption } from '~/components/ui/Select.vue';
	import { isManagementRole } from '~/utils/role';
	import {
		VIOLATION_TYPE_OPTIONS,
		VIOLATION_STATUS_OPTIONS,
		violationTypeLabel,
		violationTypeClass,
	} from '~/utils/violation.utils';

	definePageMeta({ title: 'Quản lý vi phạm' });

	const toast = useToast();
	const route = useRoute();
	const router = useRouter();
	const { user } = useAuth();
	const violationService = useViolationRequestService();
	const departmentService = useDepartmentService();

	const canManage = computed(() => isManagementRole(user.value?.role));

	// ─── Options ──────────────────────────────────────────────────────────────────
	const today = new Date();
	const currentMonth = today.getMonth() + 1;
	const currentYear = today.getFullYear();

	const monthOptionsRequired = computed<SelectOption[]>(() =>
		Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Tháng ${i + 1}` })),
	);

	const yearOptions = computed<SelectOption[]>(() =>
		[currentYear - 1, currentYear, currentYear + 1].map(y => ({ value: y, label: String(y) })),
	);

	const typeOptions = VIOLATION_TYPE_OPTIONS;
	const statusOptions = VIOLATION_STATUS_OPTIONS;

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

	// ─── Requests ─────────────────────────────────────────────────────────────────
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

	async function handleApprove(req: ViolationRequest): Promise<boolean> {
		if (!confirm(`Duyệt phiếu vi phạm của ${req.employee.fullName}?`)) return false;
		approvingId.value = req.id;
		try {
			const updated = await violationService.approve(req.id);
			const idx = allRequests.value.findIndex(r => r.id === updated.id);
			if (idx !== -1) allRequests.value.splice(idx, 1, updated);
			toast.success('Đã duyệt phiếu vi phạm');
			return true;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
			return false;
		} finally {
			approvingId.value = null;
		}
	}

	async function handleApproveFromDetail() {
		if (!detailRequest.value) return;
		const ok = await handleApprove(detailRequest.value);
		if (ok) detailRequest.value = null;
	}

	function handleRejectFromDetail() {
		if (!detailRequest.value) return;
		rejectTarget.value = detailRequest.value;
		detailRequest.value = null;
	}

	// ─── Detail modal ─────────────────────────────────────────────────────────────
	const detailRequest = ref<ViolationRequest | null>(null);

	async function openByQueryId() {
		const raw = route.query.open_id;
		if (!raw) return;
		const id = Number(raw);
		if (!id || Number.isNaN(id)) return;

		router.replace({ path: '/management/violations' });

		try {
			detailRequest.value = await violationService.findById(id);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không thể mở chi tiết phiếu vi phạm');
		}
	}

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
		if (user.value.role === 'ADMIN') return true;
		if (req.assignedReviewer !== null) {
			return req.assignedReviewer.id === user.value.id;
		}
		return user.value.role === 'HR';
	}


	// ─── Lifecycle ────────────────────────────────────────────────────────────────
	onMounted(() => {
		if (!canManage.value) {
			navigateTo('/violations/my');
			return;
		}
		loadDepartments();
		fetchAllRequests();
		openByQueryId();
	});
</script>

<template>
	<div class="space-y-5">
		<!-- Page header -->
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
			<div>
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Quản lý vi phạm chuyên cần</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Xem xét và duyệt phiếu giải trình vi phạm chấm công</p>
			</div>
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
				<UiSelectInput
					:model-value="mgmtFilter.departmentId ?? 0"
					:options="departmentOptions"
					placeholder="Tất cả phòng ban"
					@update:model-value="mgmtFilter.departmentId = $event === 0 ? undefined : ($event as number)"
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

		<!-- Table -->
		<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								Nhân viên
							</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								Loại
							</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								Ngày VP
							</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								Hạn nộp
							</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								Lý do
							</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								Trạng thái
							</th>
							<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
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
							<td class="px-4 py-3">
								<p class="font-medium text-gray-900 dark:text-white">{{ req.employee.fullName }}</p>
								<p class="text-xs text-gray-400 dark:text-gray-500">{{ req.employee.employeeCode }}</p>
							</td>
							<td class="px-4 py-3">
								<div class="flex items-center gap-1.5 flex-wrap">
									<span :class="['inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', violationTypeClass(req.type)]">
										{{ req.typeLabel || violationTypeLabel(req.type) }}
									</span>
									<span
										v-if="req.isViolationFlagged"
										class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
									>
										⚠️ Vi phạm KL
									</span>
								</div>
							</td>
							<td class="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
								{{ formatDate(req.violationDate) }}
							</td>
							<td class="px-4 py-3 whitespace-nowrap">
								<span
									:class="[
										'text-xs',
										req.deadlinePassed ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400',
									]"
								>
									{{ formatDate(req.deadline) }}
								</span>
							</td>
							<td class="px-4 py-3 max-w-[180px]">
								<UiTooltip v-if="req.reason.length > 55" :label="req.reason">
									<span class="text-gray-600 dark:text-gray-400 cursor-default">{{ truncate(req.reason) }}</span>
								</UiTooltip>
								<span v-else class="text-gray-600 dark:text-gray-400">{{ req.reason }}</span>
							</td>
							<td class="px-4 py-3">
								<ViolationStatusBadge :status="req.status" />
							</td>
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
	</div>

	<!-- Modals -->
	<Teleport to="body">
		<ViolationRejectModal
			v-if="rejectTarget"
			:violation-request="rejectTarget"
			@rejected="onRejected"
			@close="rejectTarget = null"
		/>
		<ViolationDetailModal
			v-if="detailRequest"
			:violation-request="detailRequest"
			:approving="approvingId === detailRequest.id"
			@approve="handleApproveFromDetail"
			@reject="handleRejectFromDetail"
			@close="detailRequest = null"
		/>
	</Teleport>
</template>
