<script setup lang="ts">
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useOnlineWorkRequestService } from '~/services/online-work-request.service';
import OnlineWorkStatusBadge from '~/components/modules/online-work/OnlineWorkStatusBadge.vue';
import OnlineWorkDetailModal from '~/components/modules/online-work/OnlineWorkDetailModal.vue';
import type { OnlineWorkRequestResponse, OnlineWorkStatus } from '~/types/online-work-request.types';
import type { PaginatedMeta } from '~/types/api.types';
import type { SelectOption } from '~/components/ui/Select.vue';

definePageMeta({ title: 'Đơn làm online của tôi' });

const service = useOnlineWorkRequestService();
const toast = useToast();

// ─── State ────────────────────────────────────────────────────────────────────
const requests = ref<OnlineWorkRequestResponse[]>([]);
const meta = ref<PaginatedMeta | null>(null);
const loading = ref(false);
const detailTarget = ref<OnlineWorkRequestResponse | null>(null);
const cancellingId = ref<number | null>(null);

const today = new Date();

const filter = reactive({
	month: today.getMonth() + 1,
	year: today.getFullYear(),
	status: undefined as OnlineWorkStatus | undefined,
	page: 1,
});

// ─── Summary (derived from current page) ──────────────────────────────────────
const stats = computed(() => ({
	pending: requests.value.filter(r => r.status.startsWith('PENDING')).length,
	completed: requests.value.filter(r => r.status === 'COMPLETED').length,
	totalDaysApproved: requests.value
		.filter(r => r.status === 'COMPLETED')
		.reduce((acc, r) => acc + r.totalDays, 0),
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
	{ value: 'PENDING_L1', label: 'Chờ duyệt cấp 1' },
	{ value: 'PENDING_L2', label: 'Chờ duyệt cấp 2' },
	{ value: 'PENDING_L3', label: 'Chờ Giám đốc' },
	{ value: 'COMPLETED', label: 'Hoàn thành' },
	{ value: 'REJECTED', label: 'Bị từ chối' },
	{ value: 'CANCELLED', label: 'Đã huỷ' },
];

// ─── Fetch ────────────────────────────────────────────────────────────────────
async function fetchRequests() {
	loading.value = true;
	try {
		const monthStart = format(new Date(filter.year, filter.month - 1, 1), 'yyyy-MM-dd');
		const monthEnd = format(endOfMonth(new Date(filter.year, filter.month - 1)), 'yyyy-MM-dd');
		const res = await service.findMine({
			startDate: monthStart,
			endDate: monthEnd,
			status: filter.status,
			page: filter.page,
			limit: 20,
		});
		requests.value = res.data;
		meta.value = res.meta;
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Lỗi tải danh sách đơn');
	} finally {
		loading.value = false;
	}
}

function applyFilter() {
	filter.page = 1;
	fetchRequests();
}

// ─── Cancel ───────────────────────────────────────────────────────────────────
async function handleCancel(req: OnlineWorkRequestResponse) {
	if (!confirm(`Huỷ đơn làm online từ ${formatDate(req.startDate)} đến ${formatDate(req.endDate)}?`)) return;
	cancellingId.value = req.id;
	try {
		const updated = await service.cancel(req.id);
		const idx = requests.value.findIndex(r => r.id === updated.id);
		if (idx !== -1) requests.value.splice(idx, 1, updated);
		toast.success('Đã huỷ đơn làm online');
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

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(fetchRequests);
</script>

<template>
	<div class="space-y-5">
		<!-- Header -->
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Đơn làm online của tôi</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Xem và quản lý các đơn đăng ký làm việc tại nhà</p>
			</div>
			<NuxtLink to="/online-work/create">
				<CommonAppButton>
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
					</svg>
					Tạo đơn làm online
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
					<p class="text-xs text-gray-500 dark:text-gray-400">Hoàn thành</p>
					<p class="text-lg font-bold text-gray-900 dark:text-white leading-tight">{{ stats.completed }}</p>
				</div>
			</div>

			<div class="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
				<div class="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center flex-shrink-0">
					<svg class="w-4 h-4 text-sky-600 dark:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
					</svg>
				</div>
				<div>
					<p class="text-xs text-gray-500 dark:text-gray-400">Ngày đã duyệt</p>
					<p class="text-lg font-bold text-gray-900 dark:text-white leading-tight">{{ stats.totalDaysApproved }}</p>
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
			<div class="w-48">
				<UiSelect
					:model-value="filter.status"
					:options="statusOptions"
					placeholder="Tất cả trạng thái"
					@update:model-value="filter.status = $event as OnlineWorkStatus | undefined"
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
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Từ ngày</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Đến ngày</th>
							<th class="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Số ngày</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Lý do</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Người duyệt</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Trạng thái</th>
							<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Thao tác</th>
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
										<path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
									</svg>
									<p class="text-sm text-gray-400 dark:text-gray-500">Chưa có đơn làm online nào trong tháng này</p>
									<NuxtLink to="/online-work/create">
										<CommonAppButton size="sm">Tạo đơn đầu tiên</CommonAppButton>
									</NuxtLink>
								</div>
							</td>
						</tr>

						<tr
							v-for="req in requests"
							:key="req.id"
							class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
						>
							<!-- Từ ngày -->
							<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-medium">
								{{ formatDate(req.startDate) }}
							</td>

							<!-- Đến ngày -->
							<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
								{{ formatDate(req.endDate) }}
							</td>

							<!-- Số ngày -->
							<td class="px-4 py-3 text-center">
								<span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300">
									{{ req.totalDays }}
								</span>
							</td>

							<!-- Lý do -->
							<td class="px-4 py-3 max-w-[180px]">
								<span class="text-gray-600 dark:text-gray-400 line-clamp-2">{{ req.reason }}</span>
							</td>

							<!-- Người duyệt hiện tại -->
							<td class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
								<template v-if="req.status === 'PENDING_L1' && req.approverL1">
									{{ req.approverL1.fullName }}
								</template>
								<template v-else-if="req.status === 'PENDING_L2' && req.approverL2">
									{{ req.approverL2.fullName }}
								</template>
								<template v-else-if="req.status === 'PENDING_L3'">
									<span class="italic">Giám đốc</span>
								</template>
								<template v-else-if="req.status === 'COMPLETED' && req.approvedL3By">
									{{ req.approvedL3By.fullName }}
								</template>
								<template v-else-if="req.status === 'COMPLETED' && req.approvedL1By">
									{{ req.approvedL1By.fullName }}
								</template>
								<template v-else-if="req.status === 'REJECTED' && req.rejectedBy">
									{{ req.rejectedBy.fullName }}
								</template>
								<template v-else>
									<span class="text-gray-300 dark:text-gray-600">—</span>
								</template>
							</td>

							<!-- Trạng thái -->
							<td class="px-4 py-3 whitespace-nowrap">
								<OnlineWorkStatusBadge :status="req.status" :reject-level="req.rejectLevel" />
							</td>

							<!-- Thao tác -->
							<td class="px-4 py-3">
								<div class="flex items-center justify-end gap-1.5">
									<!-- Huỷ — chỉ khi canBeCancelled (PENDING_L1) -->
									<CommonAppButton
										v-if="req.canBeCancelled"
										size="sm"
										variant="outline"
										:loading="cancellingId === req.id"
										@click="handleCancel(req)"
									>
										Huỷ
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

	<!-- Detail modal -->
	<Teleport to="body">
		<OnlineWorkDetailModal v-if="detailTarget" :request="detailTarget" @close="detailTarget = null" />
	</Teleport>
</template>
