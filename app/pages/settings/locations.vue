<script setup lang="ts">
import type { Map as LeafletMap, Circle, Marker } from 'leaflet';
import type { CheckInLocation, CreateCheckInLocationDto } from '~/types/check-in-location.types';
import type { EmployeeSummary } from '~/types/employee.types';
import { useEmployeeService } from '~/services/employee.service';

definePageMeta({ title: 'Địa điểm chấm công' });

const toast = useToast();
const { locations, loading, locationEmployeesMap, fetchLocations, createLocation, deactivateLocation, assignEmployee, removeEmployee } = useCheckInLocation();
const employeeService = useEmployeeService();

// --- Selection ---
const selectedLocationId = ref<number | null>(null);
const selectedLocation = computed(() =>
	selectedLocationId.value ? locations.value.find(l => l.id === selectedLocationId.value) ?? null : null,
);
const assignedEmployees = computed(() =>
	selectedLocationId.value ? locationEmployeesMap.value[selectedLocationId.value] ?? [] : [],
);

// --- Add modal ---
const showAddModal = ref(false);
const addForm = ref({ name: '', radiusMeters: 100, latitude: 0, longitude: 0 });
const addFormErrors = ref({ name: '', location: '' });
const submittingAdd = ref(false);

// --- Deactivate confirm ---
const deactivateTargetId = ref<number | null>(null);
const deactivating = ref(false);

// --- Employee search ---
const employeeSearch = ref('');
const employeeSearchResults = ref<EmployeeSummary[]>([]);
const searchingEmployees = ref(false);
const assigningEmployeeId = ref<number | null>(null);
const removingEmployeeId = ref<number | null>(null);

// --- Geocoding search (Nominatim) ---
interface GeoResult {
	lat: string;
	lon: string;
	display_name: string;
}
const geoQuery = ref('');
const geoResults = ref<GeoResult[]>([]);
const searchingGeo = ref(false);
let geoTimer: ReturnType<typeof setTimeout>;

const availableEmployees = computed(() => {
	const assignedIds = new Set(assignedEmployees.value.map(e => e.id));
	return employeeSearchResults.value.filter(e => !assignedIds.has(e.id));
});

// --- Map refs and instances ---
const mainMapRef = ref<HTMLDivElement | null>(null);
const modalMapRef = ref<HTMLDivElement | null>(null);

type LeafletLib = typeof import('leaflet');
let leaflet: LeafletLib | null = null;
let mainMap: LeafletMap | null = null;
let modalMap: LeafletMap | null = null;
const locationCircles = new Map<number, Circle>();
let addMarker: Marker | null = null;
let addPreviewCircle: Circle | null = null;

const HANOI: [number, number] = [21.0285, 105.8542];

// --- Leaflet helpers ---
function makePinIcon(L: LeafletLib) {
	return L.divIcon({
		className: '',
		html: '<div style="width:14px;height:14px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div>',
		iconSize: [14, 14],
		iconAnchor: [7, 7],
	});
}

function renderMainCircles() {
	if (!mainMap || !leaflet) return;
	locationCircles.forEach(c => c.remove());
	locationCircles.clear();

	locations.value.forEach(loc => {
		const isSelected = loc.id === selectedLocationId.value;
		const circle = leaflet!.circle([loc.latitude, loc.longitude], {
			radius: loc.radiusMeters,
			color: isSelected ? '#1d4ed8' : loc.isActive ? '#3b82f6' : '#9ca3af',
			fillColor: isSelected ? '#1d4ed8' : loc.isActive ? '#3b82f6' : '#9ca3af',
			fillOpacity: isSelected ? 0.25 : 0.15,
			weight: isSelected ? 3 : 2,
		})
			.addTo(mainMap!)
			.bindPopup(`<strong>${loc.name}</strong><br/>${loc.radiusMeters}m`);

		circle.on('click', () => selectLocation(loc));
		locationCircles.set(loc.id, circle);
	});
}

function highlightCircle(locationId: number) {
	locationCircles.forEach((circle, id) => {
		const loc = locations.value.find(l => l.id === id);
		if (!loc) return;
		const isSelected = id === locationId;
		circle.setStyle({
			color: isSelected ? '#1d4ed8' : loc.isActive ? '#3b82f6' : '#9ca3af',
			fillColor: isSelected ? '#1d4ed8' : loc.isActive ? '#3b82f6' : '#9ca3af',
			fillOpacity: isSelected ? 0.25 : 0.15,
			weight: isSelected ? 3 : 2,
		});
	});
}

async function initMainMap() {
	await nextTick();
	if (!mainMapRef.value || !leaflet) return;
	mainMap = leaflet.map(mainMapRef.value, { zoomControl: true }).setView(HANOI, 13);
	leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
		maxZoom: 19,
	}).addTo(mainMap);
	renderMainCircles();
}

async function initModalMap() {
	await nextTick();
	if (!modalMapRef.value || !leaflet) return;
	if (modalMap) { modalMap.remove(); modalMap = null; }
	modalMap = leaflet.map(modalMapRef.value).setView(HANOI, 13);
	leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
		maxZoom: 19,
	}).addTo(modalMap);

	modalMap.on('click', (e) => {
		const { lat, lng } = e.latlng;
		addForm.value.latitude = lat;
		addForm.value.longitude = lng;
		addFormErrors.value.location = '';
		placeModalMarker(lat, lng);
	});
}

function placeModalMarker(lat: number, lng: number) {
	if (!modalMap || !leaflet) return;
	if (addMarker) addMarker.remove();
	if (addPreviewCircle) addPreviewCircle.remove();

	addMarker = leaflet.marker([lat, lng], { icon: makePinIcon(leaflet), draggable: true }).addTo(modalMap);
	addMarker.on('dragend', (e) => {
		const pos = (e.target as Marker).getLatLng();
		addForm.value.latitude = pos.lat;
		addForm.value.longitude = pos.lng;
		renderPreviewCircle(pos.lat, pos.lng, addForm.value.radiusMeters);
	});

	renderPreviewCircle(lat, lng, addForm.value.radiusMeters);
}

function renderPreviewCircle(lat: number, lng: number, radius: number) {
	if (!modalMap || !leaflet) return;
	if (addPreviewCircle) addPreviewCircle.remove();
	addPreviewCircle = leaflet.circle([lat, lng], {
		radius,
		color: '#3b82f6',
		fillColor: '#3b82f6',
		fillOpacity: 0.2,
		weight: 2,
		dashArray: '6 4',
	}).addTo(modalMap);
}

// --- Location actions ---
function selectLocation(loc: CheckInLocation) {
	selectedLocationId.value = loc.id;
	highlightCircle(loc.id);
	if (mainMap) {
		mainMap.setView([loc.latitude, loc.longitude], Math.max(mainMap.getZoom(), 15), { animate: true });
	}
}

// --- Add location ---
function openAddModal() {
	addForm.value = { name: '', radiusMeters: 100, latitude: 0, longitude: 0 };
	addFormErrors.value = { name: '', location: '' };
	addMarker = null;
	addPreviewCircle = null;
	showAddModal.value = true;
}

function closeAddModal() {
	showAddModal.value = false;
	if (modalMap) { modalMap.remove(); modalMap = null; }
	geoQuery.value = '';
	geoResults.value = [];
}

function validateAddForm(): boolean {
	let valid = true;
	addFormErrors.value = { name: '', location: '' };
	if (!addForm.value.name.trim() || addForm.value.name.trim().length < 2) {
		addFormErrors.value.name = 'Tên phải có ít nhất 2 ký tự';
		valid = false;
	}
	if (addForm.value.latitude === 0 && addForm.value.longitude === 0) {
		addFormErrors.value.location = 'Vui lòng click trên bản đồ để chọn vị trí';
		valid = false;
	}
	return valid;
}

async function submitAddLocation() {
	if (!validateAddForm()) return;
	submittingAdd.value = true;
	try {
		const dto: CreateCheckInLocationDto = {
			name: addForm.value.name.trim(),
			latitude: addForm.value.latitude,
			longitude: addForm.value.longitude,
			radiusMeters: addForm.value.radiusMeters,
		};
		const created = await createLocation(dto);
		toast.success('Đã thêm địa điểm chấm công');
		closeAddModal();
		await nextTick();
		selectLocation(created);
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Lỗi thêm địa điểm');
	} finally {
		submittingAdd.value = false;
	}
}

// --- Deactivate ---
async function confirmDeactivate() {
	if (!deactivateTargetId.value) return;
	deactivating.value = true;
	try {
		const id = deactivateTargetId.value;
		await deactivateLocation(id);
		toast.success('Đã vô hiệu hóa địa điểm');
		deactivateTargetId.value = null;
		if (selectedLocationId.value === id) selectedLocationId.value = null;
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Lỗi vô hiệu hóa địa điểm');
	} finally {
		deactivating.value = false;
	}
}

// --- Employee search ---
let searchTimer: ReturnType<typeof setTimeout>;
function onEmployeeSearchInput(val: string) {
	employeeSearch.value = val;
	clearTimeout(searchTimer);
	if (!val.trim()) { employeeSearchResults.value = []; return; }
	searchTimer = setTimeout(async () => {
		searchingEmployees.value = true;
		try {
			const res = await employeeService.findAll({ search: val.trim(), limit: 20 });
			employeeSearchResults.value = res.data;
		} catch {
			employeeSearchResults.value = [];
		} finally {
			searchingEmployees.value = false;
		}
	}, 400);
}

async function onAssignEmployee(emp: EmployeeSummary) {
	if (!selectedLocationId.value) return;
	assigningEmployeeId.value = emp.id;
	try {
		await assignEmployee(selectedLocationId.value, emp);
		toast.success(`Đã gán ${emp.fullName} vào địa điểm`);
		employeeSearch.value = '';
		employeeSearchResults.value = [];
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Lỗi gán nhân viên');
	} finally {
		assigningEmployeeId.value = null;
	}
}

async function onRemoveEmployee(employeeId: number) {
	if (!selectedLocationId.value) return;
	removingEmployeeId.value = employeeId;
	try {
		await removeEmployee(selectedLocationId.value, employeeId);
		toast.success('Đã xóa nhân viên khỏi địa điểm');
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Lỗi xóa nhân viên');
	} finally {
		removingEmployeeId.value = null;
	}
}

// --- Geocoding ---
function onGeoSearchInput(val: string) {
	geoQuery.value = val;
	clearTimeout(geoTimer);
	if (!val.trim()) { geoResults.value = []; return; }
	geoTimer = setTimeout(async () => {
		searchingGeo.value = true;
		try {
			const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=5&countrycodes=vn`;
			const res = await fetch(url, { headers: { 'User-Agent': 'HR-System/1.0' } });
			geoResults.value = await res.json() as GeoResult[];
		} catch {
			geoResults.value = [];
		} finally {
			searchingGeo.value = false;
		}
	}, 500);
}

function selectGeoResult(result: GeoResult) {
	const lat = parseFloat(result.lat);
	const lng = parseFloat(result.lon);
	geoResults.value = [];
	geoQuery.value = '';
	addForm.value.latitude = lat;
	addForm.value.longitude = lng;
	addFormErrors.value.location = '';
	if (modalMap) modalMap.setView([lat, lng], 17, { animate: true });
	placeModalMarker(lat, lng);
}

// --- Watchers ---
watch(locations, () => { renderMainCircles(); }, { deep: true });

watch(() => addForm.value.radiusMeters, (radius) => {
	if ((addForm.value.latitude !== 0 || addForm.value.longitude !== 0) && modalMap && leaflet) {
		renderPreviewCircle(addForm.value.latitude, addForm.value.longitude, radius);
	}
});

watch(showAddModal, async (val) => {
	if (val) await initModalMap();
});

// --- Init ---
onMounted(async () => {
	leaflet = await import('leaflet');
	await fetchLocations();
	await initMainMap();
});

onUnmounted(() => {
	mainMap?.remove();
	modalMap?.remove();
});
</script>

<template>
	<div class="flex -m-6 overflow-hidden" style="height: calc(100vh - 4rem)">
		<!-- Left: location list -->
		<div class="w-80 flex-shrink-0 flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
			<div class="flex items-center gap-2 px-4 pt-5 pb-3 flex-shrink-0">
				<h1 class="text-base font-semibold text-gray-900 dark:text-white flex-1">Địa điểm chấm công</h1>
				<button
					class="w-8 h-8 flex items-center justify-center rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition-colors"
					title="Thêm địa điểm"
					@click="openAddModal"
				>
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
					</svg>
				</button>
			</div>

			<div class="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
				<!-- Loading skeleton -->
				<div v-if="loading" class="space-y-2 pt-1">
					<div v-for="i in 4" :key="i" class="rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
						<div class="flex items-start justify-between mb-2">
							<div class="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded" />
							<div class="h-4 w-14 bg-gray-100 dark:bg-gray-800 rounded" />
						</div>
						<div class="h-3 w-20 bg-gray-100 dark:bg-gray-800 rounded" />
					</div>
				</div>

				<!-- Empty state -->
				<div v-else-if="!locations.length" class="flex flex-col items-center justify-center py-16 text-center">
					<div class="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
						<svg class="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
							<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
						</svg>
					</div>
					<p class="text-sm font-medium text-gray-600 dark:text-gray-300">Chưa có địa điểm nào</p>
					<p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Nhấn + để thêm địa điểm mới</p>
				</div>

				<!-- Location cards -->
				<button
					v-for="loc in locations"
					:key="loc.id"
					:class="[
						'w-full text-left rounded-xl border p-4 transition-all',
						selectedLocationId === loc.id
							? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-700'
							: 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900',
					]"
					@click="selectLocation(loc)"
				>
					<div class="flex items-start justify-between gap-2 mb-2">
						<p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ loc.name }}</p>
						<span
							:class="[
								'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0',
								loc.isActive
									? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
									: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
							]"
						>
							{{ loc.isActive ? 'Hoạt động' : 'Vô hiệu' }}
						</span>
					</div>
					<div class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
						<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
						</svg>
						Bán kính {{ loc.radiusMeters }}m
					</div>
					<div v-if="loc.isActive" class="mt-3 flex justify-end">
						<button
							class="text-[11px] text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
							@click.stop="deactivateTargetId = loc.id"
						>
							Vô hiệu hóa
						</button>
					</div>
				</button>
			</div>
		</div>

		<!-- Middle: map -->
		<div class="flex-1 flex flex-col min-w-0 overflow-hidden">
			<ClientOnly>
				<div ref="mainMapRef" class="flex-1 min-h-0" />
			</ClientOnly>
		</div>

		<!-- Right: detail panel -->
		<div class="w-80 flex-shrink-0 flex flex-col bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700">
			<!-- Empty state -->
			<div v-if="!selectedLocation" class="flex-1 flex items-center justify-center">
				<div class="text-center px-6">
					<div class="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
						<svg class="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
							<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
						</svg>
					</div>
					<p class="text-sm font-medium text-gray-600 dark:text-gray-300">Chọn địa điểm để xem chi tiết</p>
				</div>
			</div>

			<!-- Location detail -->
			<template v-else>
				<!-- Info section -->
				<div class="p-5 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white mb-1 break-words">
						{{ selectedLocation.name }}
					</h2>
					<div class="space-y-1.5 mt-2">
						<p class="text-xs text-gray-500 dark:text-gray-400">
							Bán kính:
							<span class="font-semibold text-gray-700 dark:text-gray-300">{{ selectedLocation.radiusMeters }}m</span>
						</p>
						<p class="text-xs text-gray-400 dark:text-gray-500 font-mono">
							{{ selectedLocation.latitude.toFixed(5) }}, {{ selectedLocation.longitude.toFixed(5) }}
						</p>
					</div>
					<span
						:class="[
							'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-3',
							selectedLocation.isActive
								? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
								: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
						]"
					>
						{{ selectedLocation.isActive ? 'Đang hoạt động' : 'Vô hiệu hóa' }}
					</span>
				</div>

				<!-- Employee section -->
				<div class="flex-1 flex flex-col overflow-hidden p-4">
					<p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Gán nhân viên</p>

					<!-- Search input -->
					<div class="relative mb-3 flex-shrink-0">
						<div class="relative">
							<svg
								class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="1.5"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
							</svg>
							<input
								:value="employeeSearch"
								type="text"
								placeholder="Tìm để gán nhân viên..."
								class="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-500 transition-colors"
								@input="onEmployeeSearchInput(($event.target as HTMLInputElement).value)"
							/>
						</div>

						<!-- Dropdown results -->
						<div
							v-if="employeeSearch && (searchingEmployees || availableEmployees.length > 0)"
							class="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 max-h-44 overflow-y-auto"
						>
							<div v-if="searchingEmployees" class="flex items-center justify-center py-5">
								<svg class="animate-spin w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
								</svg>
							</div>
							<template v-else>
								<div
									v-for="emp in availableEmployees"
									:key="emp.id"
									class="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
									@click="onAssignEmployee(emp)"
								>
									<div class="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center flex-shrink-0">
										<span class="text-xs font-bold text-brand-700 dark:text-brand-400">{{ emp.fullName.charAt(0) }}</span>
									</div>
									<div class="flex-1 min-w-0">
										<p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ emp.fullName }}</p>
										<p class="text-xs text-gray-400 dark:text-gray-500 truncate">{{ emp.employeeCode }}</p>
									</div>
									<div v-if="assigningEmployeeId === emp.id" class="flex-shrink-0">
										<svg class="animate-spin w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24">
											<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
											<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
										</svg>
									</div>
									<svg v-else class="w-4 h-4 text-brand-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
									</svg>
								</div>
								<div v-if="!availableEmployees.length" class="text-xs text-gray-400 px-3 py-3 text-center">
									Không tìm thấy hoặc đã gán tất cả
								</div>
							</template>
						</div>
					</div>

					<!-- Assigned employees list -->
					<div class="flex-1 overflow-y-auto">
						<div v-if="!assignedEmployees.length" class="flex flex-col items-center justify-center h-20 text-center">
							<p class="text-xs text-gray-400 dark:text-gray-500">Chưa có nhân viên nào được gán</p>
							<p class="text-[11px] text-gray-300 dark:text-gray-600 mt-0.5">(Chỉ lưu trong phiên làm việc)</p>
						</div>
						<div v-else class="space-y-0.5">
							<div
								v-for="emp in assignedEmployees"
								:key="emp.id"
								class="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/40 group"
							>
								<div class="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center flex-shrink-0">
									<span class="text-xs font-bold text-brand-700 dark:text-brand-400">{{ emp.fullName.charAt(0) }}</span>
								</div>
								<div class="flex-1 min-w-0">
									<p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ emp.fullName }}</p>
									<p class="text-xs text-gray-400 dark:text-gray-500 truncate">{{ emp.employeeCode }}</p>
								</div>
								<button
									:class="[
										'flex-shrink-0 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors',
										'opacity-0 group-hover:opacity-100',
										removingEmployeeId === emp.id ? 'opacity-100' : '',
									]"
									:disabled="removingEmployeeId === emp.id"
									@click="onRemoveEmployee(emp.id)"
								>
									<svg v-if="removingEmployeeId === emp.id" class="animate-spin w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
									</svg>
									<svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>
						</div>
					</div>
				</div>
			</template>
		</div>
	</div>

	<!-- Add location modal -->
	<Teleport to="body">
		<Transition
			enter-active-class="transition ease-out duration-200"
			enter-from-class="opacity-0 scale-95"
			enter-to-class="opacity-100 scale-100"
			leave-active-class="transition ease-in duration-150"
			leave-from-class="opacity-100 scale-100"
			leave-to-class="opacity-0 scale-95"
		>
			<div v-if="showAddModal" class="fixed inset-0 z-[1000] flex flex-col bg-white dark:bg-gray-900">
				<!-- Modal header -->
				<div class="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
					<svg class="w-5 h-5 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
						<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
					</svg>
					<h2 class="text-base font-semibold text-gray-900 dark:text-white flex-1">Thêm địa điểm chấm công</h2>
					<button
						class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
						@click="closeAddModal"
					>
						<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<!-- Modal body -->
				<div class="flex-1 flex overflow-hidden">
					<!-- Map -->
					<div class="flex-1 relative">
						<ClientOnly>
							<div ref="modalMapRef" class="w-full h-full" />
						</ClientOnly>

						<!-- Geocoding search bar (floating, above Leaflet panes) -->
						<div class="absolute top-3 left-3 right-3 z-[1001] pointer-events-none">
							<div class="relative max-w-sm pointer-events-auto">
								<div class="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-600 px-3 py-2.5">
									<svg
										v-if="!searchingGeo"
										class="w-4 h-4 text-gray-400 flex-shrink-0"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="1.5"
									>
										<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
									</svg>
									<svg v-else class="animate-spin w-4 h-4 text-brand-600 flex-shrink-0" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
									</svg>
									<input
										:value="geoQuery"
										type="text"
										placeholder="Tìm kiếm địa điểm trên bản đồ..."
										class="flex-1 text-sm bg-transparent text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none"
										@input="onGeoSearchInput(($event.target as HTMLInputElement).value)"
									/>
									<button
										v-if="geoQuery"
										class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
										@click="geoQuery = ''; geoResults = []"
									>
										<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								</div>

								<!-- Geocoding results dropdown -->
								<div
									v-if="geoResults.length"
									class="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg max-h-60 overflow-y-auto"
								>
									<button
										v-for="(result, idx) in geoResults"
										:key="idx"
										class="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
										@click="selectGeoResult(result)"
									>
										<svg class="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
											<path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
											<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
										</svg>
										<span class="text-sm text-gray-700 dark:text-gray-300 leading-snug">{{ result.display_name }}</span>
									</button>
								</div>
							</div>
						</div>

						<!-- Hint -->
						<div
							class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg px-4 py-2 text-xs text-gray-600 dark:text-gray-300 shadow pointer-events-none z-[1000]"
						>
							Click trên bản đồ để đặt vị trí · Kéo marker để điều chỉnh
						</div>
					</div>

					<!-- Form sidebar -->
					<div class="w-80 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 flex flex-col overflow-y-auto">
						<div class="p-6 space-y-5 flex-1">
							<!-- Name -->
							<CommonAppInput
								v-model="addForm.name"
								label="Tên địa điểm"
								placeholder="VD: Văn phòng Hà Nội"
								required
								:error="addFormErrors.name"
							/>

							<!-- Radius slider -->
							<div class="flex flex-col gap-2">
								<label class="text-sm font-medium text-gray-700 dark:text-gray-300">
									Bán kính chấp nhận
									<span class="text-brand-600 dark:text-brand-400 font-semibold ml-1">{{ addForm.radiusMeters }}m</span>
								</label>
								<input
									v-model.number="addForm.radiusMeters"
									type="range"
									min="10"
									max="500"
									step="10"
									class="w-full h-2 rounded-lg appearance-none cursor-pointer accent-brand-600"
								/>
								<div class="flex justify-between text-xs text-gray-400 dark:text-gray-500">
									<span>10m</span>
									<span>500m</span>
								</div>
							</div>

							<!-- Coordinates feedback -->
							<div
								v-if="addFormErrors.location"
								class="flex items-center gap-2 text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2.5"
							>
								<svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
								</svg>
								{{ addFormErrors.location }}
							</div>
							<div
								v-else-if="addForm.latitude !== 0 || addForm.longitude !== 0"
								class="flex items-start gap-2 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2.5"
							>
								<svg class="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								<span>
									Đã chọn vị trí<br />
									<span class="font-mono text-[11px]">{{ addForm.latitude.toFixed(5) }}, {{ addForm.longitude.toFixed(5) }}</span>
								</span>
							</div>
							<div v-else class="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2.5">
								Chưa chọn vị trí — click trên bản đồ để đặt điểm
							</div>
						</div>

						<!-- Submit -->
						<div class="p-6 border-t border-gray-100 dark:border-gray-800 flex gap-3">
							<CommonAppButton variant="outline" @click="closeAddModal">Hủy</CommonAppButton>
							<CommonAppButton :loading="submittingAdd" @click="submitAddLocation">
								Thêm địa điểm
							</CommonAppButton>
						</div>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>

	<!-- Deactivate confirm modal -->
	<Teleport to="body">
		<Transition
			enter-active-class="transition ease-out duration-150"
			enter-from-class="opacity-0"
			enter-to-class="opacity-100"
			leave-active-class="transition ease-in duration-100"
			leave-from-class="opacity-100"
			leave-to-class="opacity-0"
		>
			<div
				v-if="deactivateTargetId"
				class="fixed inset-0 z-[1001] flex items-center justify-center bg-black/50 backdrop-blur-sm"
				@click.self="deactivateTargetId = null"
			>
				<div class="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl border border-gray-200 dark:border-gray-700">
					<div class="flex items-start gap-4">
						<div class="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
							<svg class="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
							</svg>
						</div>
						<div>
							<h3 class="font-semibold text-gray-900 dark:text-white">Vô hiệu hóa địa điểm</h3>
							<p class="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
								Nhân viên sẽ không thể check-in tại địa điểm này. Dữ liệu không bị xóa.
							</p>
						</div>
					</div>
					<div class="flex justify-end gap-3 mt-6">
						<CommonAppButton variant="outline" @click="deactivateTargetId = null">Hủy</CommonAppButton>
						<CommonAppButton variant="danger" :loading="deactivating" @click="confirmDeactivate">
							Vô hiệu hóa
						</CommonAppButton>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>
