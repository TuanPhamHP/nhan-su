<script setup lang="ts">
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useBusinessTripService } from '~/services/business-trip.service';
import TripStatusBadge from '~/components/modules/business-trip/TripStatusBadge.vue';
import RejectTripModal from '~/components/modules/business-trip/RejectTripModal.vue';
import TripReportModal from '~/components/modules/business-trip/TripReportModal.vue';
import TransportModal from '~/components/modules/business-trip/TransportModal.vue';
import type { BusinessTripResponse, TripRouteResponse } from '~/types/business-trip.types';

definePageMeta({ title: 'Chi tiết đơn công tác' });

const route = useRoute();
const router = useRouter();
const toast = useToast();
const service = useBusinessTripService();
const { user } = useAuth();
const imageViewer = useImageViewerStore();

const isImageUrl = (url: string) => /\.(jpg|jpeg|png|webp|gif|bmp|svg)(\?|$)/i.test(url);

const tripId = computed(() => Number(route.params.id));

const trip = ref<BusinessTripResponse | null>(null);
const loading = ref(false);
const rejectTarget = ref<BusinessTripResponse | null>(null);
const reportOpen = ref(false);
const transportRoute = ref<TripRouteResponse | null>(null);

const isHrOrAdmin = computed(() => !!user.value && ['HR', 'ADMIN'].includes(user.value.role));
const isAdmin = computed(() => user.value?.role === 'ADMIN');

const canApproveNow = computed(() => !!trip.value && (trip.value.canApprove || (isAdmin.value && trip.value.status === 'PENDING')));
const canCancelNow = computed(() => !!trip.value && (trip.value.canCancel || (isAdmin.value && ['DRAFT', 'PENDING'].includes(trip.value.status))));

const allTicketImageUrls = computed<string[]>(() => {
	if (!trip.value) return [];
	const urls: string[] = [];
	for (const r of trip.value.routes) {
		for (const t of r.transports) {
			if (t.ticketImageUrl && isImageUrl(t.ticketImageUrl)) urls.push(t.ticketImageUrl);
		}
	}
	return urls;
});

const reportImageUrls = computed<string[]>(() =>
	(trip.value?.report?.attachmentUrls ?? []).filter(isImageUrl),
);

function openTicket(url: string) {
	if (!isImageUrl(url)) {
		window.open(url, '_blank', 'noopener');
		return;
	}
	const list = allTicketImageUrls.value;
	const idx = list.indexOf(url);
	imageViewer.open(list, idx >= 0 ? idx : 0);
}

function openAttachment(url: string) {
	if (!isImageUrl(url)) {
		window.open(url, '_blank', 'noopener');
		return;
	}
	const list = reportImageUrls.value;
	const idx = list.indexOf(url);
	imageViewer.open(list, idx >= 0 ? idx : 0);
}

const transportLabels: Record<string, string> = {
	PLANE: 'Máy bay',
	TRAIN: 'Tàu hoả',
	CAR: 'Xe ô tô',
	OTHER: 'Khác',
};

async function loadTrip() {
	if (!tripId.value) return;
	loading.value = true;
	try {
		trip.value = await service.findOne(tripId.value);
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Không tải được đơn công tác');
	} finally {
		loading.value = false;
	}
}

async function handleApprove() {
	if (!trip.value) return;
	if (!confirm(`Duyệt đơn công tác "${trip.value.title}"?`)) return;
	try {
		trip.value = await service.approve(trip.value.id);
		toast.success('Đã duyệt đơn công tác');
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	}
}

function openReject() {
	rejectTarget.value = trip.value;
}

function onRejected(updated: BusinessTripResponse) {
	trip.value = updated;
	rejectTarget.value = null;
	toast.success('Đã từ chối đơn công tác');
}

async function handleCancel() {
	if (!trip.value) return;
	if (!confirm(`Huỷ đơn công tác "${trip.value.title}"?`)) return;
	try {
		trip.value = await service.cancel(trip.value.id);
		toast.success('Đã huỷ đơn công tác');
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	}
}

function onReportSaved(updated: BusinessTripResponse) {
	trip.value = updated;
	reportOpen.value = false;
}

function onTransportSaved(updated: BusinessTripResponse) {
	trip.value = updated;
	transportRoute.value = null;
	toast.success('Đã cập nhật phương tiện');
}

function fmtDate(d: string) {
	return format(new Date(d), 'dd/MM/yyyy', { locale: vi });
}

function fmtDateTime(d: string) {
	return format(new Date(d), 'dd/MM/yyyy HH:mm', { locale: vi });
}

function fmtCurrency(n: number) {
	return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
}

onMounted(loadTrip);
watch(tripId, loadTrip);
</script>

<template>
	<div class="max-w-4xl mx-auto space-y-6">
		<!-- Back -->
		<div class="flex items-center gap-3">
			<button
				type="button"
				class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
				@click="router.back()"
			>
				<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
				</svg>
			</button>
			<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Chi tiết đơn công tác</h1>
		</div>

		<!-- Loading skeleton -->
		<div v-if="loading" class="space-y-4">
			<div class="h-32 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
			<div class="h-48 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
			<div class="h-48 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
		</div>

		<template v-else-if="trip">
			<!-- Header actions -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div class="flex-1 min-w-0 space-y-2">
						<div class="flex flex-wrap items-center gap-2">
							<h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ trip.title }}</h2>
							<TripStatusBadge :status="trip.status" />
							<span
								v-if="trip.autoApproved"
								class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
							>
								Tự động duyệt
							</span>
						</div>
						<p class="text-sm text-gray-500 dark:text-gray-400">Điểm đến chính: <span class="text-gray-700 dark:text-gray-300">{{ trip.destination }}</span></p>
					</div>

					<div class="flex flex-wrap gap-2">
						<CommonAppButton v-if="canApproveNow" variant="primary" @click="handleApprove">Duyệt</CommonAppButton>
						<CommonAppButton v-if="canApproveNow" variant="danger" @click="openReject">Từ chối</CommonAppButton>
						<CommonAppButton v-if="trip.canAddReport" @click="reportOpen = true">
							{{ trip.report ? 'Cập nhật báo cáo' : 'Nộp báo cáo kết quả' }}
						</CommonAppButton>
						<CommonAppButton v-if="canCancelNow" variant="danger" @click="handleCancel">Huỷ đơn</CommonAppButton>
					</div>
				</div>
			</div>

			<!-- Info -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
				<h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Thông tin chuyến công tác</h3>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div>
						<p class="text-xs text-gray-500 dark:text-gray-400">Thời gian</p>
						<p class="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{{ fmtDate(trip.startDate) }} → {{ fmtDate(trip.endDate) }}</p>
						<p class="text-xs text-brand-600 dark:text-brand-400 mt-0.5">{{ trip.totalDays }} ngày làm việc</p>
					</div>
					<div>
						<p class="text-xs text-gray-500 dark:text-gray-400">Chi phí dự kiến</p>
						<p class="text-sm text-gray-700 dark:text-gray-300 mt-0.5">
							{{ trip.estimatedCost !== null ? fmtCurrency(trip.estimatedCost) : '—' }}
						</p>
					</div>
					<div class="sm:col-span-2">
						<p class="text-xs text-gray-500 dark:text-gray-400">Mục đích</p>
						<p class="text-sm text-gray-700 dark:text-gray-300 mt-0.5 whitespace-pre-line">{{ trip.purpose }}</p>
					</div>
					<div>
						<p class="text-xs text-gray-500 dark:text-gray-400">Người đi</p>
						<p class="text-sm font-medium text-gray-900 dark:text-white mt-0.5">{{ trip.employee.fullName }}</p>
						<p class="text-xs text-gray-400">{{ trip.employee.employeeCode }} · {{ trip.employee.department ?? '—' }}</p>
						<p v-if="trip.createdForEmployee" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
							HR tạo hộ · người tạo đơn: {{ trip.createdForEmployee.fullName }}
						</p>
					</div>
					<div v-if="trip.approver || trip.autoApproved">
						<p class="text-xs text-gray-500 dark:text-gray-400">Người duyệt</p>
						<template v-if="trip.autoApproved && !trip.approver">
							<p class="text-sm font-medium text-gray-900 dark:text-white mt-0.5">HR tự duyệt</p>
						</template>
						<template v-else-if="trip.approver">
							<p class="text-sm font-medium text-gray-900 dark:text-white mt-0.5">{{ trip.approver.fullName }}</p>
						</template>
						<p v-if="trip.approvedAt" class="text-xs text-gray-400 mt-0.5">Duyệt lúc {{ fmtDateTime(trip.approvedAt) }}</p>
						<p v-if="trip.rejectedAt" class="text-xs text-red-500 mt-0.5">Từ chối lúc {{ fmtDateTime(trip.rejectedAt) }}</p>
					</div>
					<div v-if="trip.companions?.length" class="sm:col-span-2">
						<p class="text-xs text-gray-500 dark:text-gray-400">Người đi cùng</p>
						<p class="text-sm text-gray-700 dark:text-gray-300 mt-0.5">
							{{ trip.companions.length }} người
						</p>
					</div>
				</div>

				<div v-if="trip.rejectNote" class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
					<p class="text-xs font-medium text-red-700 dark:text-red-400">Lý do từ chối</p>
					<p class="text-sm text-red-600 dark:text-red-300 mt-1 whitespace-pre-line">{{ trip.rejectNote }}</p>
				</div>
			</div>

			<!-- Routes timeline -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
				<h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Lộ trình di chuyển</h3>

				<div class="space-y-4">
					<div
						v-for="route in trip.routes"
						:key="route.id"
						class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3"
					>
						<div class="flex items-center justify-between gap-2">
							<p class="text-sm font-semibold text-gray-800 dark:text-gray-200">
								Chặng {{ route.order }}: <span class="font-normal">{{ route.pickupPoint }} → {{ route.dropPoint }}</span>
							</p>
							<span
								v-if="route.isSelfTransport"
								class="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
							>
								Tự túc di chuyển
							</span>
						</div>

						<p class="text-xs text-gray-500 dark:text-gray-400">
							<template v-if="route.desiredTime">
								<template v-if="route.desiredTimeType === 'ARRIVAL'">📍 Cần có mặt lúc <strong>{{ fmtDateTime(route.desiredTime) }}</strong></template>
								<template v-else>🚗 Cần xe đón lúc <strong>{{ fmtDateTime(route.desiredTime) }}</strong></template>
							</template>
							<template v-else>Chưa có thông tin thời gian</template>
						</p>

						<!-- Transports sub-section -->
						<div v-if="!route.isSelfTransport" class="pt-3 border-t border-gray-100 dark:border-gray-800">
							<div class="flex items-center justify-between mb-2">
								<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Phương tiện</p>
								<button
									v-if="isHrOrAdmin && trip.status === 'APPROVED'"
									type="button"
									class="text-xs text-brand-600 dark:text-brand-400 hover:underline"
									@click="transportRoute = route"
								>
									Cập nhật phương tiện
								</button>
							</div>

							<div v-if="route.transports.length === 0" class="text-xs text-gray-400 italic">
								{{ isHrOrAdmin && trip.status === 'APPROVED' ? 'Chưa cập nhật — bấm "Cập nhật phương tiện"' : 'HR chưa cập nhật phương tiện' }}
							</div>

							<div v-else class="space-y-2">
								<div
									v-for="tp in route.transports"
									:key="tp.id"
									class="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 space-y-1"
								>
									<div class="flex items-center justify-between">
										<p class="text-sm font-medium text-gray-800 dark:text-gray-200">
											<span class="text-xs text-gray-400">#{{ tp.order }}</span>
											{{ transportLabels[tp.transportType] }}
											<span v-if="tp.flightNumber" class="ml-1 text-xs text-brand-600 dark:text-brand-400">{{ tp.flightNumber }}</span>
										</p>
									</div>
									<p v-if="tp.pickupLocation || tp.dropLocation" class="text-xs text-gray-600 dark:text-gray-400">
										{{ tp.pickupLocation ?? '—' }} → {{ tp.dropLocation ?? '—' }}
									</p>
									<p v-if="tp.pickupTime || tp.dropTime" class="text-xs text-gray-600 dark:text-gray-400">
										{{ tp.pickupTime ? fmtDateTime(tp.pickupTime) : '—' }} → {{ tp.dropTime ? fmtDateTime(tp.dropTime) : '—' }}
									</p>
									<p v-if="tp.checkInTime" class="text-xs text-gray-600 dark:text-gray-400">
										Check-in: {{ fmtDateTime(tp.checkInTime) }}
									</p>
									<p v-if="tp.licensePlate || tp.driverPhone" class="text-xs text-gray-600 dark:text-gray-400">
										<template v-if="tp.licensePlate">Biển số: {{ tp.licensePlate }}</template>
										<template v-if="tp.driverPhone"> · SĐT tài xế: {{ tp.driverPhone }}</template>
									</p>
									<button
										v-if="tp.ticketImageUrl"
										type="button"
										class="inline-flex items-center gap-1 mt-1 text-xs text-brand-600 dark:text-brand-400 hover:underline"
										@click="openTicket(tp.ticketImageUrl!)"
									>
										<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
											<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
										</svg>
										Xem ảnh vé
									</button>
									<p v-if="tp.note" class="text-xs text-gray-500 dark:text-gray-400 italic">{{ tp.note }}</p>
								</div>
							</div>
						</div>

						<div v-else-if="isHrOrAdmin && trip.status === 'APPROVED'" class="pt-3 border-t border-gray-100 dark:border-gray-800">
							<button type="button" class="text-xs text-brand-600 dark:text-brand-400 hover:underline" @click="transportRoute = route">
								Đổi sang có phương tiện
							</button>
						</div>
					</div>
				</div>
			</div>

			<!-- Report section -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
				<div class="flex items-center justify-between">
					<h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Báo cáo kết quả</h3>
					<span
						v-if="trip.report"
						:class="[
							'text-xs font-medium px-2 py-0.5 rounded-full',
							trip.report.status === 'SUBMITTED'
								? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
								: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
						]"
					>
						{{ trip.report.status === 'SUBMITTED' ? 'Đã nộp' : 'Nháp' }}
					</span>
				</div>

				<div v-if="!trip.report && trip.canAddReport" class="py-8 flex flex-col items-center text-center gap-2">
					<p class="text-sm text-gray-500 dark:text-gray-400">Chưa có báo cáo. Hoàn tất chuyến đi và nộp báo cáo kết quả.</p>
					<CommonAppButton @click="reportOpen = true">Nộp báo cáo</CommonAppButton>
				</div>

				<div v-else-if="!trip.report" class="py-8 text-center text-sm text-gray-400 italic">
					Chưa có báo cáo
				</div>

				<div v-else class="space-y-3">
					<div>
						<p class="text-xs text-gray-500 dark:text-gray-400">Tóm tắt</p>
						<p class="text-sm text-gray-700 dark:text-gray-300 mt-0.5 whitespace-pre-line">{{ trip.report.summary }}</p>
					</div>
					<div>
						<p class="text-xs text-gray-500 dark:text-gray-400">Kết quả đạt được</p>
						<p class="text-sm text-gray-700 dark:text-gray-300 mt-0.5 whitespace-pre-line">{{ trip.report.results }}</p>
					</div>
					<div v-if="trip.report.actualCost !== null" class="grid grid-cols-2 gap-3">
						<div>
							<p class="text-xs text-gray-500 dark:text-gray-400">Chi phí thực tế</p>
							<p class="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{{ fmtCurrency(trip.report.actualCost) }}</p>
						</div>
					</div>
					<div v-if="trip.report.issues">
						<p class="text-xs text-gray-500 dark:text-gray-400">Vấn đề phát sinh</p>
						<p class="text-sm text-gray-700 dark:text-gray-300 mt-0.5 whitespace-pre-line">{{ trip.report.issues }}</p>
					</div>
					<div v-if="trip.report.attachmentUrls?.length">
						<p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Ảnh / tài liệu đính kèm</p>
						<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
							<button
								v-for="(url, idx) in trip.report.attachmentUrls"
								:key="idx"
								type="button"
								class="block aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-brand-400 transition-colors group"
								@click="openAttachment(url)"
							>
								<img
									:src="url"
									:alt="`Đính kèm ${idx + 1}`"
									class="w-full h-full object-cover group-hover:scale-105 transition-transform"
									@error="($event.target as HTMLImageElement).style.display = 'none'"
								/>
							</button>
						</div>
					</div>
				</div>
			</div>
		</template>

		<div v-else class="py-16 text-center text-sm text-gray-400">Không tìm thấy đơn công tác</div>

		<Teleport to="body">
			<RejectTripModal
				v-if="rejectTarget"
				:trip="rejectTarget"
				@rejected="onRejected"
				@close="rejectTarget = null"
			/>
			<TripReportModal
				v-if="reportOpen && trip"
				:trip-id="trip.id"
				:existing-report="trip.report"
				@saved="onReportSaved"
				@close="reportOpen = false"
			/>
			<TransportModal
				v-if="transportRoute"
				:route="transportRoute"
				@saved="onTransportSaved"
				@close="transportRoute = null"
			/>
		</Teleport>
	</div>
</template>
