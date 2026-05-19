<script setup lang="ts">
import type { Map as LeafletMap, Marker, Circle } from 'leaflet';
import type { CheckInLocation, UpdateCheckInLocationDto } from '~/types/check-in-location.types';

const props = defineProps<{
	location: CheckInLocation;
}>();

const emit = defineEmits<{
	close: [];
	updated: [dto: UpdateCheckInLocationDto];
}>();

const form = ref({
	name: props.location.name,
	radiusMeters: props.location.radiusMeters,
	latitude: props.location.latitude,
	longitude: props.location.longitude,
});
const formErrors = ref({ name: '' });
const submitting = ref(false);

const colorMode = useColorMode();
const radiusFillStyle = computed(() => {
	const pct = ((form.value.radiusMeters - 10) / (500 - 10)) * 100;
	const track = colorMode.value === 'dark' ? '#374151' : '#e5e7eb';
	return { background: `linear-gradient(to right, #2563eb ${pct}%, ${track} ${pct}%)` };
});

// --- Geocoding ---
interface GeoResult { lat: string; lon: string; display_name: string }
const geoQuery = ref('');
const geoResults = ref<GeoResult[]>([]);
const searchingGeo = ref(false);
let geoTimer: ReturnType<typeof setTimeout>;

// --- Map ---
const mapRef = ref<HTMLDivElement | null>(null);
type LeafletLib = typeof import('leaflet');
let leaflet: LeafletLib | null = null;
let map: LeafletMap | null = null;
let marker: Marker | null = null;
let previewCircle: Circle | null = null;

function makePinIcon(L: LeafletLib) {
	return L.divIcon({
		className: '',
		html: '<div style="width:14px;height:14px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div>',
		iconSize: [14, 14],
		iconAnchor: [7, 7],
	});
}

function renderPreviewCircle(lat: number, lng: number, radius: number) {
	if (!map || !leaflet) return;
	previewCircle?.remove();
	previewCircle = leaflet.circle([lat, lng], {
		radius,
		color: '#3b82f6',
		fillColor: '#3b82f6',
		fillOpacity: 0.2,
		weight: 2,
		dashArray: '6 4',
	}).addTo(map);
}

function placeMarker(lat: number, lng: number) {
	if (!map || !leaflet) return;
	marker?.remove();
	marker = leaflet.marker([lat, lng], { icon: makePinIcon(leaflet), draggable: true }).addTo(map);
	marker.on('dragend', (e) => {
		const pos = (e.target as Marker).getLatLng();
		form.value.latitude = pos.lat;
		form.value.longitude = pos.lng;
		renderPreviewCircle(pos.lat, pos.lng, form.value.radiusMeters);
	});
	renderPreviewCircle(lat, lng, form.value.radiusMeters);
}

async function initMap() {
	await nextTick();
	if (!mapRef.value || !leaflet) return;
	map = leaflet.map(mapRef.value).setView([props.location.latitude, props.location.longitude], 16);
	leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
		maxZoom: 19,
	}).addTo(map);
	map.on('click', (e) => {
		const { lat, lng } = e.latlng;
		form.value.latitude = lat;
		form.value.longitude = lng;
		placeMarker(lat, lng);
	});
	placeMarker(props.location.latitude, props.location.longitude);
}

// --- Geocoding ---
function onGeoInput(val: string) {
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
	geoQuery.value = '';
	geoResults.value = [];
	form.value.latitude = lat;
	form.value.longitude = lng;
	map?.setView([lat, lng], 17, { animate: true });
	placeMarker(lat, lng);
}

// --- Radius watcher ---
watch(() => form.value.radiusMeters, (radius) => {
	renderPreviewCircle(form.value.latitude, form.value.longitude, radius);
});

// --- Submit ---
function validate(): boolean {
	formErrors.value.name = '';
	if (!form.value.name.trim() || form.value.name.trim().length < 2) {
		formErrors.value.name = 'Tên phải có ít nhất 2 ký tự';
		return false;
	}
	return true;
}

async function submit() {
	if (!validate()) return;
	submitting.value = true;
	try {
		const dto: UpdateCheckInLocationDto = {
			name: form.value.name.trim(),
			radiusMeters: form.value.radiusMeters,
			latitude: form.value.latitude,
			longitude: form.value.longitude,
		};
		emit('updated', dto);
	} finally {
		submitting.value = false;
	}
}

onMounted(async () => {
	leaflet = await import('leaflet');
	await initMap();
});

onUnmounted(() => {
	map?.remove();
});
</script>

<template>
	<div class="fixed inset-0 z-[1000] flex flex-col bg-white dark:bg-gray-900">
		<!-- Header -->
		<div class="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
			<svg class="w-5 h-5 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
				<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 7.125L18 8.625" />
			</svg>
			<h2 class="text-base font-semibold text-gray-900 dark:text-white flex-1">Chỉnh sửa địa điểm</h2>
			<button
				class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
				@click="emit('close')"
			>
				<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Body -->
		<div class="flex-1 flex overflow-hidden">
			<!-- Map -->
			<div class="flex-1 relative">
				<ClientOnly>
					<div ref="mapRef" class="w-full h-full" />
				</ClientOnly>

				<!-- Geocoding search bar -->
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
								@input="onGeoInput(($event.target as HTMLInputElement).value)"
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
				<div class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg px-4 py-2 text-xs text-gray-600 dark:text-gray-300 shadow pointer-events-none z-[1000]">
					Click trên bản đồ để đổi vị trí · Kéo marker để điều chỉnh
				</div>
			</div>

			<!-- Form sidebar -->
			<div class="w-80 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 flex flex-col overflow-y-auto">
				<div class="p-6 space-y-5 flex-1">
					<!-- Name -->
					<CommonAppInput
						v-model="form.name"
						label="Tên địa điểm"
						placeholder="VD: Văn phòng Hà Nội"
						required
						:error="formErrors.name"
					/>

					<!-- Radius slider -->
					<div class="flex flex-col gap-2">
						<label class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Bán kính chấp nhận
							<span class="text-brand-600 dark:text-brand-400 font-semibold ml-1">{{ form.radiusMeters }}m</span>
						</label>
						<input
							v-model.number="form.radiusMeters"
							type="range"
							min="10"
							max="500"
							step="10"
							:style="radiusFillStyle"
							class="w-full appearance-none cursor-pointer rounded-full [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#2563eb] [&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#2563eb] [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
						/>
						<div class="flex justify-between text-xs text-gray-400 dark:text-gray-500">
							<span>10m</span>
							<span>500m</span>
						</div>
					</div>

					<!-- Coordinates feedback -->
					<div class="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2.5">
						<svg class="w-4 h-4 flex-shrink-0 mt-0.5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
							<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
						</svg>
						<span class="font-mono text-[11px]">{{ form.latitude.toFixed(5) }}, {{ form.longitude.toFixed(5) }}</span>
					</div>
				</div>

				<!-- Submit -->
				<div class="p-6 border-t border-gray-100 dark:border-gray-800 flex gap-3">
					<CommonAppButton variant="outline" @click="emit('close')">Hủy</CommonAppButton>
					<CommonAppButton :loading="submitting" @click="submit">
						Lưu thay đổi
					</CommonAppButton>
				</div>
			</div>
		</div>
	</div>
</template>
