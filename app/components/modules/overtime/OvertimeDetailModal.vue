<script setup lang="ts">
import { format, differenceInDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import OvertimeStatusBadge from '~/components/modules/overtime/OvertimeStatusBadge.vue';
import { useOvertimeRequestService } from '~/services/overtime-request.service';
import { getRateBadge, rateBadgeClass, rateBadgeClassCompact } from '~/utils/overtime.utils';
import type { OvertimeRequestResponse, OtLocationCheckType } from '~/types/overtime.types';

const props = defineProps<{ request: OvertimeRequestResponse }>();
const emit = defineEmits<{ close: []; refresh: [] }>();

const toast = useToast();
const service = useOvertimeRequestService();

// Reactive "now" — cập nhật mỗi phút để check window
const now = ref(new Date());
let tickId: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
	tickId = setInterval(() => (now.value = new Date()), 60_000);
});
onBeforeUnmount(() => {
	if (tickId) clearInterval(tickId);
});

function formatDate(d: string) {
	return format(new Date(d), 'dd/MM/yyyy');
}

function formatDateTime(d: string) {
	return format(new Date(d), 'HH:mm dd/MM/yyyy', { locale: vi });
}

function formatTime(d: string) {
	return format(new Date(d), 'HH:mm');
}

const rateBadge = computed(() => getRateBadge(props.request));
const isOvernight = computed(() => formatDate(props.request.startTime) !== formatDate(props.request.endTime));

const daysUntilExpire = computed(() => {
	if (props.request.status !== 'PENDING') return null;
	const days = differenceInDays(new Date(props.request.autoExpireAt), new Date());
	return days;
});

// ─── Location check window helpers ───────────────────────────────────────────
const isInStartWindow = computed(() => {
	const start = new Date(props.request.startTime).getTime();
	const t = now.value.getTime();
	return t >= start - 30 * 60 * 1000 && t <= start + 30 * 60 * 1000;
});

const isInEndWindow = computed(() => {
	const end = new Date(props.request.endTime).getTime();
	const t = now.value.getTime();
	return t >= end - 30 * 60 * 1000 && t <= end + 30 * 60 * 1000;
});

const showLocationSection = computed(
	() => props.request.workMode === 'OFFLINE' && props.request.status === 'APPROVED',
);

// ─── Check location handler (Geolocation API) ────────────────────────────────
const isCheckingLocation = ref(false);
const checkingType = ref<OtLocationCheckType | null>(null);

function handleCheckLocation(checkType: OtLocationCheckType) {
	if (!navigator.geolocation) {
		toast.error('Trình duyệt không hỗ trợ GPS');
		return;
	}
	isCheckingLocation.value = true;
	checkingType.value = checkType;

	navigator.geolocation.getCurrentPosition(
		async position => {
			try {
				const result = await service.checkLocation(props.request.id, {
					latitude: position.coords.latitude,
					longitude: position.coords.longitude,
					checkType,
				});
				if (result.isValid) {
					toast.success(`Vị trí hợp lệ — ${result.locationName ?? 'Trong phạm vi'}`);
				} else if (result.locationName === null && result.distanceMeters === -1) {
					toast.warning('Địa điểm OT không còn hoạt động. Hệ thống đã ghi nhận.');
				} else {
					toast.warning('Vị trí ngoài phạm vi. Hệ thống đã ghi nhận.');
				}
				emit('refresh');
			} catch (err) {
				toast.error(err instanceof Error ? err.message : 'Không thể xác nhận vị trí. Thử lại sau.');
			} finally {
				isCheckingLocation.value = false;
				checkingType.value = null;
			}
		},
		error => {
			isCheckingLocation.value = false;
			checkingType.value = null;
			if (error.code === error.PERMISSION_DENIED) {
				toast.error('Vui lòng cho phép truy cập vị trí trong cài đặt trình duyệt');
			} else {
				toast.error('Không lấy được vị trí GPS. Kiểm tra kết nối.');
			}
		},
		{ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
	);
}

// ─── Timeline ─────────────────────────────────────────────────────────────────
const timelineSteps = computed(() => {
	const req = props.request;
	const steps: Array<{
		label: string;
		at: string | null;
		by: string | null;
		icon: string;
		done: boolean;
	}> = [{ label: 'Đã gửi', at: req.createdAt, by: req.employee.fullName, icon: 'submitted', done: true }];

	if (req.status === 'APPROVED') {
		steps.push({ label: 'Đã duyệt', at: req.reviewedAt, by: req.reviewedBy?.fullName ?? null, icon: 'APPROVED', done: true });
	} else if (req.status === 'REJECTED') {
		steps.push({ label: 'Từ chối', at: req.reviewedAt, by: req.reviewedBy?.fullName ?? null, icon: 'REJECTED', done: true });
	} else if (req.status === 'CANCELLED') {
		steps.push({ label: 'Đã thu hồi', at: null, by: null, icon: 'CANCELLED', done: true });
	} else if (req.status === 'AUTO_CANCELLED') {
		steps.push({ label: 'Hết hạn (tự động huỷ)', at: req.autoExpireAt, by: null, icon: 'AUTO_CANCELLED', done: true });
	} else {
		steps.push({ label: 'Chờ duyệt', at: null, by: req.assignedApprover?.fullName ?? null, icon: 'PENDING', done: false });
	}

	return steps;
});
</script>

<template>
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
		<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
				<div class="flex items-center gap-3">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Chi tiết đơn OT</h2>
					<OvertimeStatusBadge :status="request.status" />
				</div>
				<button
					class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
					@click="emit('close')"
				>
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Body -->
			<div class="overflow-y-auto flex-1 px-6 py-4 space-y-5">
				<!-- OT Rate + WorkMode badges -->
				<div class="flex items-center gap-2 flex-wrap">
					<span
						:class="['inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold', rateBadgeClass(rateBadge.maxRate)]"
					>
						⏱ {{ rateBadge.label }}
					</span>

					<span
						:class="[
							'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm',
							request.workMode === 'OFFLINE'
								? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
								: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
						]"
					>
						{{ request.workMode === 'OFFLINE' ? '🏢 Tại văn phòng' : '🏠 Online' }}
					</span>

					<span
						v-if="request.finalWorkMode && request.finalWorkMode !== request.workMode"
						class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
					>
						⚠️ Đã chuyển sang {{ request.finalWorkMode === 'ONLINE' ? 'Online' : 'Văn phòng' }}
					</span>
				</div>

				<!-- Basic info -->
				<div class="space-y-3 text-sm">
					<div class="flex justify-between">
						<span class="text-gray-500 dark:text-gray-400">Nhân viên</span>
						<span class="font-medium text-gray-900 dark:text-white">
							{{ request.employee.fullName }}
							<span class="text-gray-400 text-xs ml-1">({{ request.employee.employeeCode }})</span>
						</span>
					</div>
					<div v-if="request.employee.department" class="flex justify-between">
						<span class="text-gray-500 dark:text-gray-400">Phòng ban</span>
						<span class="font-medium text-gray-900 dark:text-white">{{ request.employee.department }}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-500 dark:text-gray-400">Ngày OT</span>
						<span class="font-medium text-gray-900 dark:text-white">
							{{ formatDate(request.startTime) }}
							<span v-if="isOvernight" class="text-xs font-normal text-gray-400">
								→ {{ formatDate(request.endTime) }}
							</span>
						</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-500 dark:text-gray-400">Thời gian</span>
						<span class="font-medium text-gray-900 dark:text-white">
							{{ formatTime(request.startTime) }} → {{ formatTime(request.endTime) }}
						</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-500 dark:text-gray-400">Số giờ OT</span>
						<span class="font-medium text-gray-900 dark:text-white">{{ request.hoursDisplay }}</span>
					</div>
					<div v-if="request.totalPaidHours != null" class="flex justify-between">
						<span class="text-gray-500 dark:text-gray-400">Giờ trả lương</span>
						<span class="font-medium text-green-600 dark:text-green-400">
							{{ request.totalPaidHours.toFixed(1) }} giờ
							<span class="text-xs font-normal text-gray-400 ml-1">(đã nhân hệ số)</span>
						</span>
					</div>

					<!-- Segments breakdown — chỉ show khi span nhiều ngày -->
					<div v-if="rateBadge.isMulti" class="rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 p-3">
						<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Chi tiết theo ngày</p>
						<ul class="space-y-1.5">
							<li
								v-for="(seg, idx) in rateBadge.segments"
								:key="idx"
								class="flex items-center justify-between text-xs"
							>
								<span class="text-gray-600 dark:text-gray-300">{{ formatDate(seg.segmentDate) }}</span>
								<span class="flex items-center gap-2">
									<span class="text-gray-900 dark:text-white font-medium">{{ seg.hours.toFixed(1) }}h</span>
									<span
										:class="['px-1.5 py-0.5 rounded text-[10px] font-semibold', rateBadgeClassCompact(seg.otRate)]"
									>
										{{ seg.otRateLabel }}
									</span>
								</span>
							</li>
						</ul>
					</div>
					<div v-if="request.location" class="flex justify-between">
						<span class="text-gray-500 dark:text-gray-400">Địa điểm OT</span>
						<span class="font-medium text-gray-900 dark:text-white flex items-center gap-1">
							<span>📍</span>{{ request.location.name }}
						</span>
					</div>
					<div class="flex justify-between gap-4">
						<span class="text-gray-500 dark:text-gray-400 flex-shrink-0">Lý do</span>
						<span class="font-medium text-gray-900 dark:text-white text-right">{{ request.reason }}</span>
					</div>
					<!-- Expire warning -->
					<div
						v-if="daysUntilExpire !== null"
						:class="[
							'rounded-lg px-3 py-2.5',
							daysUntilExpire <= 1
								? 'bg-red-50 dark:bg-red-900/20'
								: 'bg-amber-50 dark:bg-amber-900/20',
						]"
					>
						<p
							:class="[
								'text-xs font-medium',
								daysUntilExpire <= 1
									? 'text-red-600 dark:text-red-400'
									: 'text-amber-600 dark:text-amber-400',
							]"
						>
							Tự động huỷ sau:
							{{ daysUntilExpire <= 0 ? 'hôm nay' : `${daysUntilExpire} ngày` }} nếu chưa được duyệt
						</p>
					</div>

					<!-- Review note -->
					<div v-if="request.reviewNote" class="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2.5">
						<p class="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Lý do từ chối</p>
						<p class="text-sm text-red-700 dark:text-red-300">{{ request.reviewNote }}</p>
					</div>
				</div>

				<!-- Location check section — chỉ hiện khi OFFLINE + APPROVED -->
				<div
					v-if="showLocationSection"
					:class="[
						'border rounded-xl p-4',
						request.locationStatus.isResolved
							? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
							: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
					]"
				>
					<h4 class="font-medium text-sm mb-3 flex items-center gap-2 text-gray-900 dark:text-white">
						📍 Xác nhận vị trí làm việc
						<span v-if="request.locationStatus.isResolved" class="text-xs font-normal text-gray-400 dark:text-gray-500">
							(Đã hoàn tất)
						</span>
					</h4>

					<div class="grid grid-cols-2 gap-3">
						<!-- START check -->
						<div
							:class="[
								'rounded-lg p-3 border text-center',
								request.locationStatus.start.isValid === true
									? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
									: request.locationStatus.start.isValid === false
										? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
										: 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700',
							]"
						>
							<p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Trước khi bắt đầu</p>
							<p class="text-xs text-gray-400 dark:text-gray-500 mb-2">{{ formatTime(request.startTime) }}</p>

							<template v-if="request.locationStatus.start.isValid === true">
								<p class="text-green-600 dark:text-green-400 text-sm font-medium">✓ Hợp lệ</p>
								<p v-if="request.locationStatus.start.checkedAt" class="text-xs text-gray-400 dark:text-gray-500">
									{{ formatDateTime(request.locationStatus.start.checkedAt) }}
								</p>
							</template>
							<template v-else-if="request.locationStatus.start.isValid === false">
								<p class="text-red-600 dark:text-red-400 text-sm font-medium">✗ Ngoài phạm vi</p>
								<p v-if="request.locationStatus.start.checkedAt" class="text-xs text-gray-400 dark:text-gray-500">
									{{ formatDateTime(request.locationStatus.start.checkedAt) }}
								</p>
							</template>
							<template v-else>
								<button
									v-if="isInStartWindow && !request.locationStatus.isResolved"
									:disabled="isCheckingLocation"
									class="mt-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg disabled:opacity-50 transition-colors"
									@click="handleCheckLocation('START')"
								>
									{{ isCheckingLocation && checkingType === 'START' ? 'Đang kiểm tra…' : 'Xác nhận ngay' }}
								</button>
								<p v-else class="text-xs text-gray-400 dark:text-gray-500">Chưa xác nhận</p>
							</template>
						</div>

						<!-- END check -->
						<div
							:class="[
								'rounded-lg p-3 border text-center',
								request.locationStatus.end.isValid === true
									? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
									: request.locationStatus.end.isValid === false
										? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
										: 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700',
							]"
						>
							<p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Trước khi kết thúc</p>
							<p class="text-xs text-gray-400 dark:text-gray-500 mb-2">{{ formatTime(request.endTime) }}</p>

							<template v-if="request.locationStatus.end.isValid === true">
								<p class="text-green-600 dark:text-green-400 text-sm font-medium">✓ Hợp lệ</p>
								<p v-if="request.locationStatus.end.checkedAt" class="text-xs text-gray-400 dark:text-gray-500">
									{{ formatDateTime(request.locationStatus.end.checkedAt) }}
								</p>
							</template>
							<template v-else-if="request.locationStatus.end.isValid === false">
								<p class="text-red-600 dark:text-red-400 text-sm font-medium">✗ Ngoài phạm vi</p>
								<p v-if="request.locationStatus.end.checkedAt" class="text-xs text-gray-400 dark:text-gray-500">
									{{ formatDateTime(request.locationStatus.end.checkedAt) }}
								</p>
							</template>
							<template v-else>
								<button
									v-if="isInEndWindow && !request.locationStatus.isResolved"
									:disabled="isCheckingLocation"
									class="mt-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg disabled:opacity-50 transition-colors"
									@click="handleCheckLocation('END')"
								>
									{{ isCheckingLocation && checkingType === 'END' ? 'Đang kiểm tra…' : 'Xác nhận ngay' }}
								</button>
								<p v-else class="text-xs text-gray-400 dark:text-gray-500">Chưa xác nhận</p>
							</template>
						</div>
					</div>

					<!-- Kết quả cuối cùng -->
					<div
						v-if="request.locationStatus.isResolved"
						class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-center"
					>
						<p
							:class="[
								'text-sm font-medium',
								request.finalWorkMode === 'OFFLINE'
									? 'text-green-600 dark:text-green-400'
									: 'text-orange-600 dark:text-orange-400',
							]"
						>
							{{
								request.finalWorkMode === 'OFFLINE'
									? '✓ Xác nhận làm việc tại văn phòng'
									: '→ Đã chuyển sang hình thức Online'
							}}
						</p>
					</div>
				</div>

				<!-- Timeline -->
				<div class="border-t border-gray-100 dark:border-gray-800 pt-4">
					<p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Lịch sử xử lý</p>
					<div class="space-y-0">
						<div v-for="(step, idx) in timelineSteps" :key="idx" class="flex gap-3">
							<div class="flex flex-col items-center">
								<div
									:class="[
										'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2',
										step.icon === 'submitted' || step.icon === 'APPROVED'
											? 'bg-green-100 border-green-500 dark:bg-green-900/30 dark:border-green-600'
											: step.icon === 'REJECTED'
												? 'bg-red-100 border-red-500 dark:bg-red-900/30 dark:border-red-600'
												: step.icon === 'CANCELLED' || step.icon === 'AUTO_CANCELLED'
													? 'bg-gray-100 border-gray-400 dark:bg-gray-700 dark:border-gray-500'
													: 'bg-orange-100 border-orange-400 dark:bg-orange-900/30 dark:border-orange-500',
									]"
								>
									<svg
										v-if="step.icon === 'submitted' || step.icon === 'APPROVED'"
										class="w-4 h-4 text-green-600 dark:text-green-400"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2.5"
									>
										<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
									</svg>
									<svg
										v-else-if="step.icon === 'REJECTED'"
										class="w-4 h-4 text-red-600 dark:text-red-400"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2.5"
									>
										<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
									</svg>
									<svg
										v-else-if="step.icon === 'CANCELLED' || step.icon === 'AUTO_CANCELLED'"
										class="w-4 h-4 text-gray-500 dark:text-gray-400"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
									</svg>
									<svg
										v-else
										class="w-4 h-4 text-orange-500 dark:text-orange-400"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
								</div>
								<div v-if="idx < timelineSteps.length - 1" class="w-0.5 h-8 bg-gray-200 dark:bg-gray-700 mt-1" />
							</div>

							<div class="pb-4 flex-1 min-w-0">
								<p class="text-sm font-medium text-gray-900 dark:text-white">{{ step.label }}</p>
								<p v-if="step.by" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
									<span v-if="!step.done">Người duyệt: </span>{{ step.by }}
								</p>
								<p v-if="step.at" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{{ formatDateTime(step.at) }}</p>
								<p v-else-if="!step.done && !step.by" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Đang chờ xử lý</p>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
				<CommonAppButton variant="outline" full-width @click="emit('close')">Đóng</CommonAppButton>
			</div>
		</div>
	</div>
</template>
