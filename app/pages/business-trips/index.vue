<script setup lang="ts">
import { format } from 'date-fns';
import { useBusinessTripService } from '~/services/business-trip.service';
import TripStatusBadge from '~/components/modules/business-trip/TripStatusBadge.vue';
import TripDetailModal from '~/components/modules/business-trip/TripDetailModal.vue';
import TripReportModal from '~/components/modules/business-trip/TripReportModal.vue';
import RejectTripModal from '~/components/modules/business-trip/RejectTripModal.vue';
import type { BusinessTripResponse, BusinessTripStatus, QueryBusinessTripsParams } from '~/types/business-trip.types';
import type { PaginatedMeta } from '~/types/api.types';
import type { SelectOption } from '~/components/ui/Select.vue';

definePageMeta({ title: 'Đơn công tác' });

const toast = useToast();
const { user } = useAuth();
const service = useBusinessTripService();

const canApprove = computed(() => ['ADMIN', 'MANAGER', 'CHIEF', 'HR'].includes(user.value?.role ?? ''));

type Tab = 'my' | 'pending';
const activeTab = ref<Tab>('my');

// ─── My trips ─────────────────────────────────────────────────────────────────
const myTrips = ref<BusinessTripResponse[]>([]);
const myMeta = ref<PaginatedMeta | null>(null);
const myLoading = ref(false);
const myFilter = reactive<QueryBusinessTripsParams>({ page: 1, limit: 20, status: undefined });

async function fetchMyTrips() {
	myLoading.value = true;
	try {
		const res = await service.findMe({ ...myFilter, status: myFilter.status || undefined });
		myTrips.value = res.data;
		myMeta.value = res.meta;
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Lỗi tải đơn công tác');
	} finally {
		myLoading.value = false;
	}
}

// ─── Pending ──────────────────────────────────────────────────────────────────
const pendingTrips = ref<BusinessTripResponse[]>([]);
const pendingLoading = ref(false);

async function fetchPendingForMe() {
	pendingLoading.value = true;
	try {
		pendingTrips.value = await service.findPendingForMe();
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Lỗi tải đơn chờ duyệt');
	} finally {
		pendingLoading.value = false;
	}
}

// ─── Detail modal ─────────────────────────────────────────────────────────────
const detailTrip = ref<BusinessTripResponse | null>(null);
const rejectTarget = ref<BusinessTripResponse | null>(null);
const reportTarget = ref<BusinessTripResponse | null>(null);

async function handleApprove(trip: BusinessTripResponse) {
	if (!confirm(`Duyệt đơn công tác "${trip.title}"?`)) return;
	try {
		const updated = await service.approve(trip.id);
		toast.success('Đã duyệt đơn công tác');
		replaceInList(updated);
		if (detailTrip.value?.id === updated.id) detailTrip.value = updated;
		fetchPendingForMe();
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	}
}

function onRejected(updated: BusinessTripResponse) {
	rejectTarget.value = null;
	replaceInList(updated);
	if (detailTrip.value?.id === updated.id) detailTrip.value = updated;
	fetchPendingForMe();
	toast.success('Đã từ chối đơn công tác');
}

function onReportSaved(updated: BusinessTripResponse) {
	reportTarget.value = null;
	replaceInList(updated);
	if (detailTrip.value?.id === updated.id) detailTrip.value = updated;
}

function replaceInList(updated: BusinessTripResponse) {
	const myIdx = myTrips.value.findIndex(t => t.id === updated.id);
	if (myIdx !== -1) myTrips.value.splice(myIdx, 1, updated);
	const pIdx = pendingTrips.value.findIndex(t => t.id === updated.id);
	if (pIdx !== -1) pendingTrips.value.splice(pIdx, 1, updated);
}

function fmtDate(d: string) {
	return format(new Date(d), 'dd/MM/yyyy');
}

const statusOptions: SelectOption[] = [
	{ value: undefined, label: 'Tất cả trạng thái' },
	{ value: 'DRAFT', label: 'Nháp' },
	{ value: 'PENDING', label: 'Chờ duyệt' },
	{ value: 'APPROVED', label: 'Đã duyệt' },
	{ value: 'IN_PROGRESS', label: 'Đang công tác' },
	{ value: 'COMPLETED', label: 'Hoàn thành' },
	{ value: 'REJECTED', label: 'Từ chối' },
];

function onStatusChange(value: BusinessTripStatus | undefined) {
	myFilter.status = value;
	myFilter.page = 1;
	fetchMyTrips();
}

onMounted(() => {
	fetchMyTrips();
	if (canApprove.value) fetchPendingForMe();
});

watch(activeTab, tab => {
	if (tab === 'pending' && pendingTrips.value.length === 0) fetchPendingForMe();
});
</script>

<template>
	<div class="space-y-5">
		<!-- Header -->
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Công tác</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Quản lý đơn công tác</p>
			</div>
			<div class="hidden sm:block">
				<NuxtLink to="/business-trips/create">
					<CommonAppButton>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
						</svg>
						Tạo đơn công tác
					</CommonAppButton>
				</NuxtLink>
			</div>
		</div>

		<!-- Tabs -->
		<div class="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
			<button
				:class="['px-4 py-1.5 text-sm font-medium rounded-lg transition-all', activeTab === 'my' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200']"
				@click="activeTab = 'my'"
			>
				Đơn của tôi
			</button>
			<button
				v-if="canApprove"
				:class="['px-4 py-1.5 text-sm font-medium rounded-lg transition-all', activeTab === 'pending' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200']"
				@click="activeTab = 'pending'"
			>
				Chờ tôi duyệt
				<span v-if="pendingTrips.length > 0" class="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-orange-500 text-white rounded-full">{{ pendingTrips.length }}</span>
			</button>
		</div>

		<!-- TAB 1: Đơn của tôi -->
		<template v-if="activeTab === 'my'">
			<!-- Filter -->
			<div class="flex flex-wrap items-center gap-3">
				<div class="w-44">
					<UiSelect
						:model-value="myFilter.status"
						:options="statusOptions"
						placeholder="Tất cả trạng thái"
						@update:model-value="onStatusChange($event as BusinessTripStatus | undefined)"
					/>
				</div>
				<CommonAppButton variant="secondary" :loading="myLoading" @click="fetchMyTrips">
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
					</svg>
					Làm mới
				</CommonAppButton>
			</div>

			<!-- Cards -->
			<div v-if="myLoading" class="flex justify-center py-12">
				<svg class="animate-spin w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
				</svg>
			</div>
			<div v-else-if="myTrips.length === 0" class="py-16 text-center text-sm text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
				Chưa có đơn công tác nào
			</div>
			<div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				<div
					v-for="trip in myTrips"
					:key="trip.id"
					class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3 hover:border-brand-300 dark:hover:border-brand-600 hover:shadow-sm transition-all"
				>
					<div class="flex items-start justify-between gap-2">
						<div class="flex-1 min-w-0">
							<p class="text-sm font-semibold text-gray-900 dark:text-white truncate">{{ trip.title }}</p>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ trip.destination }}</p>
						</div>
						<TripStatusBadge :status="trip.status" />
					</div>

					<div class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
						<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
						</svg>
						{{ fmtDate(trip.startDate) }} → {{ fmtDate(trip.endDate) }}
						<span class="text-brand-600 dark:text-brand-400 font-medium">({{ trip.totalDays }} ngày)</span>
					</div>

					<div v-if="trip.canAddReport" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
						<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
						</svg>
						Cần báo cáo
					</div>

					<div class="flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
						<button
							class="flex-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
							@click="detailTrip = trip"
						>
							Xem chi tiết
						</button>
						<button
							v-if="trip.canAddReport"
							class="flex-1 text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline"
							@click="reportTarget = trip"
						>
							{{ trip.report ? 'Cập nhật báo cáo' : 'Thêm báo cáo' }}
						</button>
					</div>
				</div>
			</div>

			<!-- Pagination -->
			<div v-if="myMeta && myMeta.totalPages > 1" class="flex items-center justify-between">
				<p class="text-sm text-gray-500 dark:text-gray-400">Tổng <strong>{{ myMeta.total }}</strong> đơn</p>
				<CommonAppPagination
					:current-page="myFilter.page ?? 1"
					:total-pages="myMeta.totalPages"
					@update:current-page="p => { myFilter.page = p; fetchMyTrips(); }"
				/>
			</div>
		</template>

		<!-- TAB 2: Chờ tôi duyệt -->
		<template v-else-if="activeTab === 'pending'">
			<div v-if="pendingLoading" class="flex justify-center py-12">
				<svg class="animate-spin w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
				</svg>
			</div>
			<div v-else-if="pendingTrips.length === 0" class="py-16 text-center text-sm text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
				Không có đơn nào chờ bạn duyệt
			</div>
			<div v-else class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden min-h-[75vh] sm:min-h-0">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nhân viên</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tiêu đề / Điểm đến</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Thời gian</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Trạng thái</th>
							<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Thao tác</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
						<tr v-for="trip in pendingTrips" :key="trip.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
							<td class="px-4 py-3">
								<p class="font-medium text-gray-900 dark:text-white">{{ trip.employee.fullName }}</p>
								<p class="text-xs text-gray-400">{{ trip.employee.employeeCode }}</p>
							</td>
							<td class="px-4 py-3">
								<p class="font-medium text-gray-900 dark:text-white">{{ trip.title }}</p>
								<p class="text-xs text-gray-400">{{ trip.destination }}</p>
							</td>
							<td class="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
								{{ fmtDate(trip.startDate) }} → {{ fmtDate(trip.endDate) }}
								<p class="text-xs text-brand-600 dark:text-brand-400">{{ trip.totalDays }} ngày</p>
							</td>
							<td class="px-4 py-3"><TripStatusBadge :status="trip.status" /></td>
							<td class="px-4 py-3">
								<div class="flex items-center justify-end gap-1.5">
									<button class="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors" title="Xem" @click="detailTrip = trip">
										<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
									</button>
									<CommonAppButton v-if="trip.canApprove" size="sm" variant="primary" @click="handleApprove(trip)">Duyệt</CommonAppButton>
									<CommonAppButton v-if="trip.canApprove" size="sm" variant="danger" @click="rejectTarget = trip">Từ chối</CommonAppButton>
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</template>
	</div>

	<Teleport to="body">
		<!-- FAB mobile -->
		<NuxtLink
			to="/business-trips/create"
			class="sm:hidden fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 text-white flex items-center justify-center shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
			aria-label="Tạo đơn công tác"
		>
			<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
			</svg>
		</NuxtLink>

		<TripDetailModal
			v-if="detailTrip"
			:trip="detailTrip"
			@close="detailTrip = null"
			@approve="t => handleApprove(t)"
			@reject="t => { rejectTarget = t; detailTrip = null; }"
			@add-report="t => { reportTarget = t; detailTrip = null; }"
		/>
		<RejectTripModal
			v-if="rejectTarget"
			:trip="rejectTarget"
			@rejected="onRejected"
			@close="rejectTarget = null"
		/>
		<TripReportModal
			v-if="reportTarget"
			:trip-id="reportTarget.id"
			:existing-report="reportTarget.report"
			@saved="onReportSaved"
			@close="reportTarget = null"
		/>
	</Teleport>
</template>
