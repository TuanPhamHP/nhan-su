<script setup lang="ts">
	import { format } from 'date-fns';
	import { useViolationRequestService } from '~/services/violation-request.service';
	import ViolationStatusBadge from '~/components/modules/violation/ViolationStatusBadge.vue';
	import ViolationRequestModal from '~/components/modules/violation/ViolationRequestModal.vue';
	import ViolationDetailModal from '~/components/modules/violation/ViolationDetailModal.vue';
	import type {
		ViolationRequest,
		ViolationCounter,
		ViolationRequestType,
		ViolationRequestStatus,
		QueryViolationRequestParams,
	} from '~/types/violation.types';
	import type { PaginatedMeta } from '~/types/api.types';
	import type { SelectOption } from '~/components/ui/Select.vue';

	definePageMeta({ title: 'Đơn xin chỉnh công' });

	const toast = useToast();
	const violationService = useViolationRequestService();

	const today = new Date();
	const currentMonth = today.getMonth() + 1;
	const currentYear = today.getFullYear();

	// ─── Options ──────────────────────────────────────────────────────────────────
	const monthOptions = computed<SelectOption[]>(() => [
		{ value: undefined, label: 'Tất cả tháng' },
		...Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Tháng ${i + 1}` })),
	]);

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

	// ─── My requests ──────────────────────────────────────────────────────────────
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

	// ─── Detail modal ─────────────────────────────────────────────────────────────
	const detailRequest = ref<ViolationRequest | null>(null);

	// ─── Helpers ──────────────────────────────────────────────────────────────────
	function formatDate(d: string) {
		return format(new Date(d), 'dd/MM/yyyy');
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
	});
</script>

<template>
	<div class="space-y-5">
		<!-- Page header -->
		<div>
			<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Đơn xin chỉnh công</h1>
			<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Giải trình vi phạm chấm công: quên chấm, đi muộn, về sớm</p>
		</div>

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
				❌ Bạn đã hết số lần giải trình vi phạm chuyên cần trong tháng (Tối đa 5 lần). Hệ thống không cho phép tạo thêm đơn.
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
						:class="counter.usedCount >= 4 ? 'bg-red-500' : counter.usedCount >= 3 ? 'bg-orange-500' : 'bg-blue-500'"
						:style="`width: ${(counter.usedCount / 5) * 100}%`"
					/>
				</div>
				<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Còn lại {{ counter.remaining }} lần trong tháng này</p>
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

		<!-- Table -->
		<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								Loại vi phạm
							</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								Ngày vi phạm
							</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								Hạn nộp
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
							<td class="px-4 py-3">
								<div class="flex items-center gap-2 flex-wrap">
									<span :class="['inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', typeClassMap[req.type]]">
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
									<span v-if="req.deadlinePassed" class="ml-1">(Quá hạn)</span>
								</span>
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
	</div>

	<!-- Modals -->
	<Teleport to="body">
		<ViolationRequestModal
			v-if="showCreateModal && counter"
			:counter="counter"
			@submitted="onSubmitted"
			@close="showCreateModal = false"
		/>
		<ViolationDetailModal
			v-if="detailRequest"
			:violation-request="detailRequest"
			@close="detailRequest = null"
		/>
	</Teleport>
</template>
