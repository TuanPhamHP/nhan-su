<script setup lang="ts">
import { format } from 'date-fns';
import { useBusinessTripService } from '~/services/business-trip.service';
import TripStatusBadge from '~/components/modules/business-trip/TripStatusBadge.vue';
import RejectTripModal from '~/components/modules/business-trip/RejectTripModal.vue';
import type { BusinessTripResponse, BusinessTripStatus, QueryBusinessTripsParams } from '~/types/business-trip.types';
import type { PaginatedMeta } from '~/types/api.types';
import type { SelectOption } from '~/components/ui/Select.vue';

definePageMeta({ title: 'Quản lý đơn công tác' });

const toast = useToast();
const router = useRouter();
const { user } = useAuth();
const service = useBusinessTripService();
const metaDataStore = useMetaDataStore();
const { businessTripStatuses } = storeToRefs(metaDataStore);

const isAdmin = computed(() => user.value?.role === 'ADMIN');

const trips = ref<BusinessTripResponse[]>([]);
const meta = ref<PaginatedMeta | null>(null);
const loading = ref(false);
const filter = reactive<QueryBusinessTripsParams>({ page: 1, limit: 20, status: undefined });

async function fetchTrips() {
	loading.value = true;
	try {
		const res = await service.findAll({ ...filter, status: filter.status || undefined });
		trips.value = res.data;
		meta.value = res.meta;
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Lỗi tải danh sách đơn công tác');
	} finally {
		loading.value = false;
	}
}

// ─── Actions ──────────────────────────────────────────────────────────────────
const rejectTarget = ref<BusinessTripResponse | null>(null);

async function handleApprove(trip: BusinessTripResponse) {
	if (!confirm(`Duyệt đơn công tác "${trip.title}"?`)) return;
	try {
		const updated = await service.approve(trip.id);
		toast.success('Đã duyệt đơn công tác');
		replaceInList(updated);
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	}
}

function onRejected(updated: BusinessTripResponse) {
	rejectTarget.value = null;
	replaceInList(updated);
	toast.success('Đã từ chối đơn công tác');
}

async function handleCancel(trip: BusinessTripResponse) {
	if (!confirm(`Huỷ đơn công tác "${trip.title}"?`)) return;
	try {
		const updated = await service.cancel(trip.id);
		toast.success('Đã huỷ đơn công tác');
		replaceInList(updated);
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	}
}

function replaceInList(updated: BusinessTripResponse) {
	const idx = trips.value.findIndex(t => t.id === updated.id);
	if (idx !== -1) trips.value.splice(idx, 1, updated);
}

function fmtDate(d: string) {
	return format(new Date(d), 'dd/MM/yyyy');
}

function firstRouteSummary(trip: BusinessTripResponse): string {
	const r = trip.routes?.[0];
	if (!r) return trip.destination;
	return `${r.pickupPoint} → ${r.dropPoint}`;
}

const statusOptions = computed<SelectOption[]>(() => [
	{ value: undefined, label: 'Tất cả trạng thái' },
	...businessTripStatuses.value.map(s => ({ value: s.value, label: s.label })),
]);

function onStatusChange(value: BusinessTripStatus | undefined) {
	filter.status = value;
	filter.page = 1;
	fetchTrips();
}

function goToDetail(trip: BusinessTripResponse) {
	router.push(`/business-trips/${trip.id}`);
}

onMounted(() => {
	fetchTrips();
	metaDataStore.load().catch(() => {});
});
</script>

<template>
	<div class="space-y-5">
		<!-- Header -->
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Quản lý đơn công tác</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Danh sách toàn bộ đơn công tác trong hệ thống</p>
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

		<!-- Filters -->
		<div class="flex flex-wrap items-end gap-3">
			<div class="w-full sm:w-52">
				<label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Trạng thái</label>
				<UiSelect
					:model-value="filter.status"
					:options="statusOptions"
					placeholder="Tất cả trạng thái"
					@update:model-value="onStatusChange($event as BusinessTripStatus | undefined)"
				/>
			</div>
			<CommonAppButton variant="secondary" :loading="loading" class="!py-2.5" @click="fetchTrips">
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
				</svg>
				Làm mới
			</CommonAppButton>
		</div>

		<!-- List -->
		<div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
			<div v-for="i in 3" :key="i" class="h-40 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
		</div>
		<div
			v-else-if="trips.length === 0"
			class="py-16 text-center text-sm text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700"
		>
			Chưa có đơn công tác nào
		</div>
		<div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
			<div
				v-for="trip in trips"
				:key="trip.id"
				class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3 hover:border-brand-300 dark:hover:border-brand-600 hover:shadow-sm transition-all cursor-pointer"
				@click="goToDetail(trip)"
			>
				<div class="flex items-start justify-between gap-2">
					<div class="flex-1 min-w-0">
						<p class="text-sm font-semibold text-gray-900 dark:text-white truncate">{{ trip.title }}</p>
						<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{{ firstRouteSummary(trip) }}</p>
						<p class="text-xs text-gray-400 mt-1">
							{{ trip.employee.fullName }} · {{ trip.employee.employeeCode }}
						</p>
					</div>
					<TripStatusBadge :status="trip.status" />
				</div>

				<div class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
					<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
					</svg>
					{{ fmtDate(trip.startDate) }} → {{ fmtDate(trip.endDate) }}
					<span class="text-brand-600 dark:text-brand-400 font-medium">· {{ trip.totalDays }} ngày</span>
				</div>

				<!-- Actions: Approve/Reject nếu có quyền duyệt -->
				<div
					v-if="trip.canApprove || (isAdmin && trip.status === 'PENDING')"
					class="flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-800"
					@click.stop
				>
					<CommonAppButton size="sm" variant="primary" class="flex-1" @click="handleApprove(trip)">Duyệt</CommonAppButton>
					<CommonAppButton size="sm" variant="danger" class="flex-1" @click="rejectTarget = trip">Từ chối</CommonAppButton>
				</div>

				<!-- Actions: Xem chi tiết + Huỷ (khi HR/Admin có quyền huỷ) -->
				<div
					v-else
					class="flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-800"
					@click.stop
				>
					<NuxtLink :to="`/business-trips/${trip.id}`" class="flex-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline">
						Xem chi tiết
					</NuxtLink>
					<button
						v-if="trip.canCancel || (isAdmin && ['DRAFT', 'PENDING'].includes(trip.status))"
						class="text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
						@click="handleCancel(trip)"
					>
						Huỷ
					</button>
				</div>
			</div>
		</div>

		<!-- Pagination -->
		<div v-if="meta && meta.totalPages > 1" class="flex items-center justify-between">
			<p class="text-sm text-gray-500 dark:text-gray-400">Tổng <strong>{{ meta.total }}</strong> đơn</p>
			<CommonAppPagination
				:current-page="filter.page ?? 1"
				:total-pages="meta.totalPages"
				@update:current-page="p => { filter.page = p; fetchTrips(); }"
			/>
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

			<RejectTripModal
				v-if="rejectTarget"
				:trip="rejectTarget"
				@rejected="onRejected"
				@close="rejectTarget = null"
			/>
		</Teleport>
	</div>
</template>
