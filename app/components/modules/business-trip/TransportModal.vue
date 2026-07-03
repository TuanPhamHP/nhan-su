<script setup lang="ts">
import { useBusinessTripService } from '~/services/business-trip.service';
import type {
	BusinessTripResponse,
	CreateTripTransportDto,
	TripRouteResponse,
	TransportType,
} from '~/types/business-trip.types';

const props = defineProps<{ route: TripRouteResponse }>();
const emit = defineEmits<{
	saved: [trip: BusinessTripResponse];
	close: [];
}>();

const toast = useToast();
const service = useBusinessTripService();

const transportOptions: { value: TransportType; label: string }[] = [
	{ value: 'PLANE', label: 'Máy bay' },
	{ value: 'TRAIN', label: 'Tàu hoả' },
	{ value: 'CAR', label: 'Xe ô tô' },
	{ value: 'OTHER', label: 'Khác' },
];

interface TransportRow {
	transportType: TransportType;
	pickupLocation: string;
	dropLocation: string;
	pickupTime: string;
	dropTime: string;
	licensePlate: string;
	driverPhone: string;
	flightNumber: string;
	checkInTime: string;
	ticketImageUrl: string;
	note: string;
}

function makeEmpty(): TransportRow {
	return {
		transportType: 'CAR',
		pickupLocation: '',
		dropLocation: '',
		pickupTime: '',
		dropTime: '',
		licensePlate: '',
		driverPhone: '',
		flightNumber: '',
		checkInTime: '',
		ticketImageUrl: '',
		note: '',
	};
}

function isoOrEmptyToInput(iso: string | null): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	// convert to yyyy-MM-ddTHH:mm (local)
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function inputToIso(input: string): string | undefined {
	if (!input) return undefined;
	const d = new Date(input);
	if (Number.isNaN(d.getTime())) return undefined;
	return d.toISOString();
}

const isSelfTransport = ref(props.route.isSelfTransport);
const transports = ref<TransportRow[]>(
	props.route.transports.length > 0
		? props.route.transports.map(t => ({
			transportType: t.transportType,
			pickupLocation: t.pickupLocation ?? '',
			dropLocation: t.dropLocation ?? '',
			pickupTime: isoOrEmptyToInput(t.pickupTime),
			dropTime: isoOrEmptyToInput(t.dropTime),
			licensePlate: t.licensePlate ?? '',
			driverPhone: t.driverPhone ?? '',
			flightNumber: t.flightNumber ?? '',
			checkInTime: isoOrEmptyToInput(t.checkInTime),
			ticketImageUrl: t.ticketImageUrl ?? '',
			note: t.note ?? '',
		}))
		: [makeEmpty()],
);

function addTransport() {
	transports.value.push(makeEmpty());
}

function removeTransport(index: number) {
	if (transports.value.length <= 1) return;
	transports.value.splice(index, 1);
}

const saving = ref(false);

async function save() {
	saving.value = true;
	try {
		let updated: BusinessTripResponse;
		if (isSelfTransport.value) {
			updated = await service.updateRouteTransport(props.route.id, { isSelfTransport: true });
		} else {
			if (transports.value.length === 0) {
				toast.error('Cần tối thiểu 1 phương tiện');
				return;
			}
			const payload: CreateTripTransportDto[] = transports.value.map((t, idx) => ({
				order: idx + 1,
				transportType: t.transportType,
				pickupLocation: t.pickupLocation.trim() || undefined,
				dropLocation: t.dropLocation.trim() || undefined,
				pickupTime: inputToIso(t.pickupTime),
				dropTime: inputToIso(t.dropTime),
				licensePlate: t.licensePlate.trim() || undefined,
				driverPhone: t.driverPhone.trim() || undefined,
				flightNumber: t.flightNumber.trim() || undefined,
				checkInTime: inputToIso(t.checkInTime),
				ticketImageUrl: t.ticketImageUrl.trim() || undefined,
				note: t.note.trim() || undefined,
			}));
			updated = await service.updateRouteTransport(props.route.id, { transports: payload });
		}
		emit('saved', updated);
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	} finally {
		saving.value = false;
	}
}
</script>

<template>
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
		<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
				<div>
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Cập nhật phương tiện</h2>
					<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
						Chặng: {{ route.pickupPoint }} → {{ route.dropPoint }}
					</p>
				</div>
				<button
					type="button"
					class="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
					@click="emit('close')"
				>
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="flex-1 overflow-y-auto p-6 space-y-4">
				<label class="flex items-center gap-2 p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 cursor-pointer">
					<input v-model="isSelfTransport" type="checkbox" class="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
					<span class="text-sm text-amber-800 dark:text-amber-300">Nhân viên tự túc di chuyển (xoá toàn bộ phương tiện của chặng này)</span>
				</label>

				<div v-if="!isSelfTransport" class="space-y-4">
					<div class="flex items-center justify-between">
						<p class="text-sm font-semibold text-gray-700 dark:text-gray-300">Danh sách phương tiện</p>
						<button type="button" class="text-sm text-brand-600 dark:text-brand-400 hover:underline" @click="addTransport">+ Thêm phương tiện</button>
					</div>

					<div v-for="(t, idx) in transports" :key="idx" class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
						<div class="flex items-center justify-between">
							<p class="text-sm font-semibold text-gray-700 dark:text-gray-300">#{{ idx + 1 }}</p>
							<button v-if="transports.length > 1" type="button" class="text-xs text-gray-500 hover:text-red-500 transition-colors" @click="removeTransport(idx)">
								Xoá
							</button>
						</div>

						<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<div class="space-y-1">
								<label class="block text-xs font-medium text-gray-700 dark:text-gray-300">Loại phương tiện</label>
								<select v-model="t.transportType" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors">
									<option v-for="opt in transportOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
								</select>
							</div>
							<div class="space-y-1">
								<label class="block text-xs font-medium text-gray-700 dark:text-gray-300">Ghi chú</label>
								<input v-model="t.note" type="text" placeholder="VD: Xe công ty" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors" />
							</div>
						</div>

						<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<div class="space-y-1">
								<label class="block text-xs font-medium text-gray-700 dark:text-gray-300">Điểm đón</label>
								<input v-model="t.pickupLocation" type="text" placeholder="VD: Văn phòng HCM" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors" />
							</div>
							<div class="space-y-1">
								<label class="block text-xs font-medium text-gray-700 dark:text-gray-300">Điểm đến</label>
								<input v-model="t.dropLocation" type="text" placeholder="VD: Sân bay Tân Sơn Nhất" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors" />
							</div>
						</div>

						<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<div class="space-y-1">
								<label class="block text-xs font-medium text-gray-700 dark:text-gray-300">Giờ đón</label>
								<input v-model="t.pickupTime" type="datetime-local" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors" />
							</div>
							<div class="space-y-1">
								<label class="block text-xs font-medium text-gray-700 dark:text-gray-300">Giờ đến</label>
								<input v-model="t.dropTime" type="datetime-local" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors" />
							</div>
						</div>

						<!-- PLANE-specific -->
						<div v-if="t.transportType === 'PLANE'" class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
							<div class="space-y-1">
								<label class="block text-xs font-medium text-gray-700 dark:text-gray-300">Số hiệu chuyến bay</label>
								<input v-model="t.flightNumber" type="text" placeholder="VD: VN123" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors" />
							</div>
							<div class="space-y-1">
								<label class="block text-xs font-medium text-gray-700 dark:text-gray-300">Giờ check-in</label>
								<input v-model="t.checkInTime" type="datetime-local" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors" />
							</div>
						</div>

						<!-- CAR-specific -->
						<div v-if="t.transportType === 'CAR'" class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
							<div class="space-y-1">
								<label class="block text-xs font-medium text-gray-700 dark:text-gray-300">Biển số xe</label>
								<input v-model="t.licensePlate" type="text" placeholder="VD: 51G-12345" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors" />
							</div>
							<div class="space-y-1">
								<label class="block text-xs font-medium text-gray-700 dark:text-gray-300">SĐT tài xế</label>
								<input v-model="t.driverPhone" type="tel" placeholder="VD: 0901234567" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors" />
							</div>
						</div>

						<div class="space-y-1 pt-2 border-t border-gray-100 dark:border-gray-800">
							<label class="block text-xs font-medium text-gray-700 dark:text-gray-300">URL ảnh vé / chứng từ</label>
							<input v-model="t.ticketImageUrl" type="url" placeholder="https://..." class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors" />
							<p class="text-xs text-gray-400">Dán URL ảnh đã upload lên storage (BE sẽ tự sign khi hiển thị).</p>
						</div>
					</div>
				</div>
			</div>

			<div class="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
				<CommonAppButton variant="secondary" type="button" @click="emit('close')">Huỷ</CommonAppButton>
				<CommonAppButton type="button" :loading="saving" @click="save">Lưu</CommonAppButton>
			</div>
		</div>
	</div>
</template>
