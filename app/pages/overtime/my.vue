<script setup lang="ts">
import { format } from 'date-fns';
import { useOvertimeRequestService } from '~/services/overtime-request.service';
import OvertimeStatusBadge from '~/components/modules/overtime/OvertimeStatusBadge.vue';
import OvertimeDetailModal from '~/components/modules/overtime/OvertimeDetailModal.vue';
import type { OvertimeRequestResponse, OvertimeStatus, QueryOvertimeParams } from '~/types/overtime.types';
import type { PaginatedMeta } from '~/types/api.types';
import type { SelectOption } from '~/components/ui/Select.vue';

definePageMeta({ title: 'Đơn OT của tôi' });

const service = useOvertimeRequestService();
const toast = useToast();

// ─── State ────────────────────────────────────────────────────────────────────
const requests = ref<OvertimeRequestResponse[]>([]);
const meta = ref<PaginatedMeta | null>(null);
const loading = ref(false);
const detailTarget = ref<OvertimeRequestResponse | null>(null);
const cancellingId = ref<number | null>(null);

const today = new Date();

const filter = reactive({
	month: today.getMonth() + 1,
	year: today.getFullYear(),
	status: undefined as OvertimeStatus | undefined,
	page: 1,
});

// ─── Summary counts (derived from current page) ────────────────────────────────
const stats = computed(() => ({
	pending: requests.value.filter(r => r.status === 'PENDING').length,
	approved: requests.value.filter(r => r.status === 'APPROVED').length,
	totalHours: requests.value.filter(r => r.status === 'APPROVED').reduce((acc, r) => acc + r.totalHours, 0),
}));

// ─── Options ──────────────────────────────────────────────────────────────────
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

// ─── Fetch ────────────────────────────────────────────────────────────────────
async function fetchRequests() {
	loading.value = true;
	try {
		const params: QueryOvertimeParams = {
			month: filter.month,
			year: filter.year,
			status: filter.status,
			page: filter.page,
			limit: 20,
		};
		const res = await service.findMine(params);
		requests.value = res.data;
		meta.value = res.meta;
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Lỗi tải danh sách đơn OT');
	} finally {
		loading.value = false;
	}
}

function applyFilter() {
	filter.page = 1;
	fetchRequests();
}

// ─── Cancel ───────────────────────────────────────────────────────────────────
async function handleCancel(req: OvertimeRequestResponse) {
	if (!confirm(`Thu hồi đơn OT ngày ${formatDate(req.overtimeDate)}?`)) return;
	cancellingId.value = req.id;
	try {
		const updated = await service.cancel(req.id);
		const idx = requests.value.findIndex(r => r.id === updated.id);
		if (idx !== -1) requests.value.splice(idx, 1, updated);
		toast.success('Đã thu hồi đơn OT');
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	} finally {
		cancellingId.value = null;
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d: string) {
	return format(new Date(d), 'dd/MM/yyyy');
}

function formatTime(d: string) {
	return format(new Date(d), 'HH:mm');
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(fetchRequests);
</script>

<template>
	<div class="space-y-5">
		<!-- Header -->
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Đơn OT của tôi</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Xem và quản lý các đơn làm thêm giờ của bạn</p>
			</div>
			<NuxtLink to="/overtime/create">
				<CommonAppButton>
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
					</svg>
					Tạo đơn OT
				</CommonAppButton>
			</NuxtLink>
		</div>

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
					<p class="text-lg font-bold text-gray-900 dark:text-white leading-tight">{{ stats.pending }}</p>
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
					<p class="text-lg font-bold text-gray-900 dark:text-white leading-tight">{{ stats.approved }}</p>
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
					<p class="text-lg font-bold text-gray-900 dark:text-white leading-tight">{{ stats.totalHours.toFixed(1) }}h</p>
				</div>
			</div>
		</div>

		<!-- Filter -->
		<div class="flex flex-wrap items-center gap-3">
			<div class="w-36">
				<UiSelect
					:model-value="filter.month"
					:options="monthOptions"
					placeholder="Tháng"
					@update:model-value="filter.month = $event as number"
				/>
			</div>
			<div class="w-32">
				<UiSelect
					:model-value="filter.year"
					:options="yearOptions"
					placeholder="Năm"
					@update:model-value="filter.year = $event as number"
				/>
			</div>
			<div class="w-44">
				<UiSelect
					:model-value="filter.status"
					:options="statusOptions"
					placeholder="Tất cả trạng thái"
					@update:model-value="filter.status = $event as OvertimeStatus | undefined"
				/>
			</div>
			<CommonAppButton :loading="loading" @click="applyFilter">
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
				</svg>
				Lọc
			</CommonAppButton>
		</div>

		<!-- Table -->
		<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ngày OT</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Thời gian</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Số giờ</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Lý do</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Người duyệt</th>
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
							<td colspan="7" class="px-4 py-12 text-center">
								<div class="flex flex-col items-center gap-3">
									<svg class="w-10 h-10 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
										<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
									<p class="text-sm text-gray-400 dark:text-gray-500">Chưa có đơn OT nào trong tháng này</p>
									<NuxtLink to="/overtime/create">
										<CommonAppButton size="sm">Tạo đơn OT đầu tiên</CommonAppButton>
									</NuxtLink>
								</div>
							</td>
						</tr>
						<tr
							v-for="req in requests"
							:key="req.id"
							class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
						>
							<!-- Ngày OT -->
							<td class="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap font-medium">
								{{ formatDate(req.overtimeDate) }}
							</td>

							<!-- Thời gian -->
							<td class="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
								{{ formatTime(req.startTime) }} → {{ formatTime(req.endTime) }}
							</td>

							<!-- Số giờ -->
							<td class="px-4 py-3">
								<span class="font-medium text-gray-900 dark:text-white">{{ req.hoursDisplay }}</span>
							</td>

							<!-- Lý do -->
							<td class="px-4 py-3 max-w-[200px]">
								<span class="text-gray-600 dark:text-gray-400 line-clamp-2">{{ req.reason }}</span>
							</td>

							<!-- Người duyệt -->
							<td class="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
								<span v-if="req.reviewedBy">{{ req.reviewedBy.fullName }}</span>
								<span v-else-if="req.assignedApprover" class="italic">{{ req.assignedApprover.fullName }}</span>
								<span v-else class="italic text-gray-400">—</span>
							</td>

							<!-- Trạng thái -->
							<td class="px-4 py-3">
								<div class="flex flex-col gap-1">
									<OvertimeStatusBadge :status="req.status" />
									<span
										v-if="req.status === 'PENDING' && req.autoExpireAt"
										class="text-xs text-orange-500 dark:text-orange-400"
									>
										Hết hạn: {{ formatDate(req.autoExpireAt) }}
									</span>
								</div>
							</td>

							<!-- Thao tác -->
							<td class="px-4 py-3">
								<div class="flex items-center justify-end gap-1.5">
									<!-- Thu hồi — chỉ khi PENDING -->
									<CommonAppButton
										v-if="req.canBeCancelled"
										size="sm"
										variant="outline"
										:loading="cancellingId === req.id"
										@click="handleCancel(req)"
									>
										Thu hồi
									</CommonAppButton>

									<!-- Xem chi tiết -->
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
		<div v-if="meta && meta.totalPages > 1" class="flex items-center justify-between pt-1">
			<p class="text-sm text-gray-500 dark:text-gray-400">
				Tổng <strong class="text-gray-700 dark:text-gray-300">{{ meta.total }}</strong> đơn
			</p>
			<CommonAppPagination
				:current-page="filter.page"
				:total-pages="meta.totalPages"
				@update:current-page="p => { filter.page = p; fetchRequests(); }"
			/>
		</div>
	</div>

	<!-- Modal -->
	<Teleport to="body">
		<OvertimeDetailModal v-if="detailTarget" :request="detailTarget" @close="detailTarget = null" />
	</Teleport>
</template>
