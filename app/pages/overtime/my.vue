<script setup lang="ts">
import { format } from 'date-fns';
import { useOvertimeRequestService } from '~/services/overtime-request.service';
import OvertimeStatusBadge from '~/components/modules/overtime/OvertimeStatusBadge.vue';
import OvertimeDetailModal from '~/components/modules/overtime/OvertimeDetailModal.vue';
import OvertimeRequestCard from '~/components/modules/overtime/OvertimeRequestCard.vue';
import type { OvertimeRequestResponse, OvertimeStatus, QueryOvertimeParams } from '~/types/overtime.types';
import type { PaginatedMeta } from '~/types/api.types';
import type { SelectOption } from '~/components/ui/Select.vue';
import { getRateBadge, rateBadgeClassCompact } from '~/utils/overtime.utils';

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
	if (!confirm(`Thu hồi đơn OT ngày ${formatDate(req.startTime)}?`)) return;
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

function isOvernight(req: OvertimeRequestResponse): boolean {
	return formatDate(req.startTime) !== formatDate(req.endTime);
}

function isInWindow(time: string, windowMinutes: number) {
	const t = new Date(time).getTime();
	const diff = Math.abs(t - Date.now());
	return diff <= windowMinutes * 60 * 1000;
}

// ─── Pending location check (OFFLINE + APPROVED, chưa resolve, trong window ±30p) ──
const pendingLocationCheck = computed(() =>
	requests.value.filter(
		r =>
			r.workMode === 'OFFLINE' &&
			r.status === 'APPROVED' &&
			!r.locationStatus.isResolved &&
			((isInWindow(r.startTime, 30) && !r.locationStatus.start.checkedAt) ||
				(isInWindow(r.endTime, 30) && !r.locationStatus.end.checkedAt)),
	),
);

// ─── Detail open + refresh ────────────────────────────────────────────────────
function openDetail(req: OvertimeRequestResponse) {
	detailTarget.value = req;
}

async function handleRefreshDetail() {
	if (!detailTarget.value) return;
	try {
		const fresh = await service.findOne(detailTarget.value.id);
		const idx = requests.value.findIndex(r => r.id === fresh.id);
		if (idx !== -1) requests.value.splice(idx, 1, fresh);
		detailTarget.value = fresh;
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Không thể tải lại chi tiết đơn');
	}
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
			<div class="hidden sm:block">
				<NuxtLink to="/overtime/create">
					<CommonAppButton>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
						</svg>
						Tạo đơn OT
					</CommonAppButton>
				</NuxtLink>
			</div>
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

		<!-- Pending location check banner -->
		<div
			v-if="pendingLocationCheck.length"
			class="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center gap-3"
		>
			<span class="text-xl">📍</span>
			<div class="flex-1 min-w-0">
				<p class="text-sm font-medium text-blue-800 dark:text-blue-300">Cần xác nhận vị trí OT</p>
				<p class="text-xs text-blue-600 dark:text-blue-400">
					Bạn có {{ pendingLocationCheck.length }} đơn OT offline đang trong thời gian xác nhận vị trí.
				</p>
			</div>
			<button
				class="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 whitespace-nowrap"
				@click="openDetail(pendingLocationCheck[0]!)"
			>
				Xác nhận ngay →
			</button>
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

		<!-- Card list — mobile only -->
		<div class="sm:hidden space-y-3 min-h-[75vh]">
			<!-- Loading -->
			<div v-if="loading" class="space-y-3">
				<div
					v-for="i in 4"
					:key="i"
					class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse space-y-3"
				>
					<div class="flex justify-between">
						<div class="space-y-1.5">
							<div class="h-3 w-16 bg-gray-100 dark:bg-gray-800 rounded" />
							<div class="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
						</div>
						<div class="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
					</div>
					<div class="h-3 w-40 bg-gray-100 dark:bg-gray-800 rounded" />
					<div class="h-3 w-3/4 bg-gray-100 dark:bg-gray-800 rounded" />
				</div>
			</div>

			<!-- Empty -->
			<div v-else-if="requests.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
				<div class="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
					<svg class="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</div>
				<p class="text-sm font-medium text-gray-600 dark:text-gray-300">Chưa có đơn OT nào</p>
				<p class="text-xs text-gray-400 dark:text-gray-500 mt-1">trong tháng này</p>
			</div>

			<!-- Cards -->
			<OvertimeRequestCard
				v-for="req in requests"
				v-else
				:key="req.id"
				:request="req"
				:cancelling="cancellingId === req.id"
				@cancel="handleCancel(req)"
				@view="openDetail(req)"
			/>
		</div>

		<!-- Table — desktop only -->
		<div class="hidden sm:block bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ngày OT</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Thời gian</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Số giờ</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Hệ số</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Địa điểm</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Lý do</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Người duyệt</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Trạng thái</th>
							<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Thao tác</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
						<tr v-if="loading">
							<td colspan="9" class="px-4 py-8 text-center">
								<svg class="animate-spin w-5 h-5 mx-auto text-brand-500" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
								</svg>
							</td>
						</tr>
						<tr v-else-if="requests.length === 0">
							<td colspan="9" class="px-4 py-12 text-center">
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
								{{ formatDate(req.startTime) }}
								<span
									v-if="isOvernight(req)"
									class="ml-1 text-xs font-normal text-gray-400"
									:title="`Kết thúc ${formatDate(req.endTime)}`"
								>
									→ {{ formatDate(req.endTime) }}
								</span>
							</td>

							<!-- Thời gian -->
							<td class="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
								{{ formatTime(req.startTime) }} → {{ formatTime(req.endTime) }}
							</td>

							<!-- Số giờ -->
							<td class="px-4 py-3">
								<span class="font-medium text-gray-900 dark:text-white">{{ req.hoursDisplay }}</span>
								<span
									v-if="req.totalPaidHours && req.totalPaidHours !== req.totalHours"
									class="ml-1 text-xs text-gray-400"
									:title="`Giờ trả lương (đã nhân hệ số): ${req.totalPaidHours.toFixed(1)}h`"
								>
									({{ req.totalPaidHours.toFixed(1) }}h trả lương)
								</span>
							</td>

							<!-- Hệ số -->
							<td class="px-4 py-3">
								<span
									:class="['text-xs font-semibold px-1.5 py-0.5 rounded whitespace-nowrap', rateBadgeClassCompact(getRateBadge(req).maxRate)]"
									:title="getRateBadge(req).isMulti ? getRateBadge(req).segments.map(s => `${s.segmentDate}: ${s.hours}h × ${s.otRateLabel}`).join('\n') : undefined"
								>
									{{ getRateBadge(req).label }}
								</span>
							</td>

							<!-- Địa điểm -->
							<td class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
								<span v-if="req.location" class="inline-flex items-center gap-1">
									<span>📍</span>{{ req.location.name }}
								</span>
								<span v-else class="text-gray-400">—</span>
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
										@click="openDetail(req)"
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
		<OvertimeDetailModal
			v-if="detailTarget"
			:request="detailTarget"
			@close="detailTarget = null"
			@refresh="handleRefreshDetail"
		/>

		<!-- FAB mobile -->
		<NuxtLink
			to="/overtime/create"
			class="sm:hidden fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 text-white flex items-center justify-center shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
			aria-label="Tạo đơn OT"
		>
			<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
			</svg>
		</NuxtLink>
	</Teleport>
</template>
