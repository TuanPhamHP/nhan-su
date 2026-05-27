<script setup lang="ts">
	import { useAttendanceService } from '~/services/attendance.service';
	import type { AttendanceRecordDetail, CheckAttendanceResponseDto } from '~/types/attendance.types';
	import { formatVNTime } from '~/utils/attendance.utils';

	definePageMeta({ title: 'Check-in / Check-out' });

	const attendanceService = useAttendanceService();
	const toast = useToast();

	// ─── Clock ────────────────────────────────────────────────────────────────────
	const currentTime = ref(new Date());
	let clockTimer: ReturnType<typeof setInterval> | null = null;

	const timeDisplay = computed(() => {
		const d = currentTime.value;
		return [
			String(d.getHours()).padStart(2, '0'),
			String(d.getMinutes()).padStart(2, '0'),
			String(d.getSeconds()).padStart(2, '0'),
		].join(':');
	});

	const dateDisplay = computed(() => {
		const d = currentTime.value;
		const days = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
		const dd = String(d.getDate()).padStart(2, '0');
		const mm = String(d.getMonth() + 1).padStart(2, '0');
		return `${days[d.getDay()]} - ${dd}/${mm}/${d.getFullYear()}`;
	});

	// ─── Location ─────────────────────────────────────────────────────────────────
	type LocationStatus = 'getting' | 'verified' | 'out_of_range' | 'no_shift' | 'no_location' | 'error';
	type PermissionLevel = 'unknown' | 'denied' | 'permanently_denied';

	// Nếu lỗi trả về trong < ngưỡng này (ms), browser không hiện prompt → chặn vĩnh viễn
	const PERM_PROMPT_MIN_MS = 1000;

	const locationStatus = ref<LocationStatus>('getting');
	const locationInfo = ref<CheckAttendanceResponseDto | null>(null);
	const currentCoords = ref<{ latitude: number; longitude: number } | null>(null);
	const locationPermission = ref<PermissionLevel>('unknown');
	const cameraPermission = ref<PermissionLevel>('unknown');
	const isRequestingLocation = ref(false);
	const isRequestingCamera = ref(false);
	let watchId: number | null = null;
	let lastVerifyTime = 0;

	function startLocationWatch() {
		if (!navigator.geolocation) {
			locationStatus.value = 'error';
			return;
		}
		watchId = navigator.geolocation.watchPosition(
			async pos => {
				locationPermission.value = 'unknown';
				currentCoords.value = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
				await verifyLocation(pos.coords.latitude, pos.coords.longitude);
			},
			err => {
				locationStatus.value = 'error';
				// watchPosition: nếu bị từ chối thì set denied, requestLocationPermission sẽ xác định permanent
				if (err.code === 1) locationPermission.value = 'denied';
			},
			{ enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 },
		);
	}

	async function requestLocationPermission() {
		if (isRequestingLocation.value) return;
		isRequestingLocation.value = true;
		locationStatus.value = 'getting';
		const requestedAt = Date.now();

		await new Promise<void>(resolve => {
			navigator.geolocation.getCurrentPosition(
				async pos => {
					locationPermission.value = 'unknown';
					currentCoords.value = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
					await verifyLocation(pos.coords.latitude, pos.coords.longitude);
					if (watchId !== null) {
						navigator.geolocation.clearWatch(watchId);
						watchId = null;
					}
					startLocationWatch();
					resolve();
				},
				err => {
					locationStatus.value = 'error';
					if (err.code === 1) {
						// Lỗi về nhanh → browser không hiện prompt → bị chặn vĩnh viễn
						locationPermission.value =
							Date.now() - requestedAt < PERM_PROMPT_MIN_MS ? 'permanently_denied' : 'denied';
					}
					resolve();
				},
				{ enableHighAccuracy: false, timeout: 15000 },
			);
		});

		isRequestingLocation.value = false;
	}

	async function requestCameraPermission() {
		if (isRequestingCamera.value) return;
		isRequestingCamera.value = true;
		const requestedAt = Date.now();
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
			cameraPermission.value = 'unknown';
			stream.getTracks().forEach(t => t.stop());
			toast.success('Đã cấp quyền camera. Hãy thử check-in lại!');
		} catch (err) {
			const domErr = err as DOMException;
			if (domErr.name === 'NotAllowedError' || domErr.name === 'PermissionDeniedError') {
				cameraPermission.value =
					Date.now() - requestedAt < PERM_PROMPT_MIN_MS ? 'permanently_denied' : 'denied';
				if (cameraPermission.value === 'permanently_denied') fileInputRef.value?.click();
			}
		} finally {
			isRequestingCamera.value = false;
		}
	}

	async function verifyLocation(lat: number, lon: number) {
		const now = Date.now();
		if (now - lastVerifyTime < 10000) return;
		lastVerifyTime = now;
		try {
			const result = await attendanceService.checkAttendance(lat, lon);
			if (!result) {
				locationStatus.value = 'no_location';
				locationInfo.value = null;
				return;
			}
			locationInfo.value = result;
			if (!result.isAvailableShift) {
				locationStatus.value = 'no_shift';
			} else {
				locationStatus.value = result.isInRange ? 'verified' : 'out_of_range';
			}
		} catch {
			locationStatus.value = 'error';
		}
	}

	// ─── Today's record ────────────────────────────────────────────────────────────
	const todayRecord = ref<AttendanceRecordDetail | null>(null);
	const loadingRecord = ref(false);

	async function loadTodayRecord() {
		loadingRecord.value = true;
		try {
			const today = new Date();
			const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
			const result = await attendanceService.findMyHistory({ date: dateStr, limit: 1 });
			todayRecord.value = result.data[0] ?? null;
		} finally {
			loadingRecord.value = false;
		}
	}

	const hasCheckedIn = computed(() => !!todayRecord.value?.checkInAt);
	const hasCheckedOut = computed(() => !!todayRecord.value?.checkOutAt);
	const isCompleted = computed(() => hasCheckedIn.value && hasCheckedOut.value);
	const isProcessing = ref(false);
	const canAct = computed(() => locationStatus.value === 'verified' && !isProcessing.value && !loadingRecord.value);

	const apiCanCheckIn = computed(() => locationInfo.value?.canCheckIn ?? false);
	const apiCanCheckOut = computed(() => locationInfo.value?.canCheckOut ?? false);
	const canCheckInAction = computed(() => canAct.value && apiCanCheckIn.value);
	const canCheckOutAction = computed(() => canAct.value && apiCanCheckOut.value);
	// Hiện check-out block khi: API xác nhận canCheckOut HOẶC canCheckIn=false (đã check-in rồi).
	// Trước khi có phản hồi API, dùng hasCheckedIn làm fallback.
	const showCheckOutBlock = computed(() => {
		if (!locationInfo.value) return hasCheckedIn.value;
		return !apiCanCheckIn.value || apiCanCheckOut.value;
	});

	// ─── Camera ───────────────────────────────────────────────────────────────────
	const showCamera = ref(false);
	const videoRef = ref<HTMLVideoElement | null>(null);
	const canvasRef = ref<HTMLCanvasElement | null>(null);
	const fileInputRef = ref<HTMLInputElement | null>(null);
	const cameraStream = ref<MediaStream | null>(null);
	let pendingAction: 'check-in' | 'check-out' | null = null;

	async function openCamera(action: 'check-in' | 'check-out') {
		pendingAction = action;

		if (!navigator.mediaDevices?.getUserMedia) {
			fileInputRef.value?.click();
			return;
		}

		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } },
				audio: false,
			});
			cameraPermission.value = 'unknown';
			cameraStream.value = stream;
			showCamera.value = true;
			await nextTick();
			if (videoRef.value) {
				videoRef.value.srcObject = stream;
				await videoRef.value.play();
			}
		} catch (err) {
			const domErr = err as DOMException;
			if (domErr.name === 'NotAllowedError' || domErr.name === 'PermissionDeniedError') {
				await checkCameraPermission();
				// Nếu chặn vĩnh viễn, dùng file input như fallback cuối
				if (cameraPermission.value === 'permanently_denied') fileInputRef.value?.click();
			} else {
				// Lỗi khác (camera đang dùng, không có thiết bị...) → file input
				fileInputRef.value?.click();
			}
		}
	}

	function stopCamera() {
		cameraStream.value?.getTracks().forEach(t => t.stop());
		cameraStream.value = null;
		showCamera.value = false;
	}

	function captureFromCamera() {
		if (!videoRef.value || !canvasRef.value) return;
		const canvas = canvasRef.value;
		const video = videoRef.value;
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		canvas.getContext('2d')?.drawImage(video, 0, 0);
		canvas.toBlob(blob => {
			if (!blob) return;
			stopCamera();
			submitAction(new File([blob], 'selfie.jpg', { type: 'image/jpeg' }));
		}, 'image/jpeg', 0.85);
	}

	function onFileInputChange(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		(e.target as HTMLInputElement).value = '';
		submitAction(file);
	}

	// ─── Confirmation modal ───────────────────────────────────────────────────────
	const showConfirmCheckOut = ref(false);

	function initiateCheckIn() {
		if (!canCheckInAction.value) return;
		openCamera('check-in');
	}

	function initiateCheckOut() {
		if (!canCheckOutAction.value) return;
		showConfirmCheckOut.value = true;
	}

	function onConfirmCheckOut() {
		showConfirmCheckOut.value = false;
		openCamera('check-out');
	}

	// ─── Success modal ─────────────────────────────────────────────────────────────
	const showSuccess = ref(false);
	const successAction = ref<'check-in' | 'check-out'>('check-in');

	// ─── Submit ───────────────────────────────────────────────────────────────────
	async function submitAction(photo: File) {
		if (!currentCoords.value || !pendingAction) return;
		isProcessing.value = true;
		const action = pendingAction;
		pendingAction = null;
		try {
			if (action === 'check-in') {
				const result = await attendanceService.checkIn({
					latitude: currentCoords.value.latitude,
					longitude: currentCoords.value.longitude,
					photo,
				});
				todayRecord.value = result;
				successAction.value = 'check-in';
			} else {
				const result = await attendanceService.checkOut(photo);
				todayRecord.value = result;
				successAction.value = 'check-out';
			}
			showSuccess.value = true;
			toast.success(action === 'check-in' ? 'Check-in thành công' : 'Check-out thành công');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
		} finally {
			isProcessing.value = false;
		}
	}

	// ─── Lifecycle ─────────────────────────────────────────────────────────────────
	onMounted(() => {
		clockTimer = setInterval(() => {
			currentTime.value = new Date();
		}, 1000);
		loadTodayRecord();
		startLocationWatch();
	});

	onUnmounted(() => {
		if (clockTimer) clearInterval(clockTimer);
		if (watchId !== null) navigator.geolocation.clearWatch(watchId);
		stopCamera();
	});
</script>

<template>
	<div class="max-w-lg mx-auto py-8 px-4">
		<!-- Date header -->
		<p class="text-center text-sm text-gray-500 dark:text-gray-400 mb-6">{{ dateDisplay }}</p>

		<!-- Check-in status bar -->
		<div
			v-if="hasCheckedIn"
			class="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 mb-3"
		>
			<svg class="w-5 h-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<div>
				<p class="text-sm font-medium text-green-800 dark:text-green-300">
					Đã check-in lúc {{ formatVNTime(todayRecord!.checkInAt) }}
				</p>
				<p v-if="todayRecord?.location" class="text-xs text-green-600 dark:text-green-400">
					{{ todayRecord.location.name }}
				</p>
			</div>
		</div>

		<div
			v-if="hasCheckedOut"
			class="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 mb-3"
		>
			<svg class="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
			</svg>
			<p class="text-sm font-medium text-blue-800 dark:text-blue-300">
				Đã check-out lúc {{ formatVNTime(todayRecord!.checkOutAt) }}
			</p>
		</div>

		<!-- Main clock card -->
		<div
			class="border-2 border-dashed rounded-2xl p-8 mb-4 text-center transition-colors"
			:class="{
				'border-green-400 bg-green-50/40 dark:border-green-600 dark:bg-green-900/10': locationStatus === 'verified',
				'border-yellow-300 bg-yellow-50/40 dark:border-yellow-600 dark:bg-yellow-900/10': locationStatus === 'getting',
				'border-orange-300 bg-orange-50/40 dark:border-orange-700 dark:bg-orange-900/10': locationPermission !== 'unknown',
				'border-gray-200 bg-gray-50/40 dark:border-gray-700 dark:bg-gray-800/20':
					locationPermission === 'unknown' && ['out_of_range', 'no_shift', 'no_location', 'error'].includes(locationStatus),
			}"
		>
			<!-- Big clock -->
			<p class="text-5xl font-bold tracking-tight text-gray-900 dark:text-white font-mono tabular-nums mb-5">
				{{ timeDisplay }}
			</p>

			<!-- Location status row -->
			<div class="flex items-center justify-center gap-2">
				<template v-if="locationStatus === 'getting'">
					<svg class="w-4 h-4 text-yellow-500 animate-spin" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
					</svg>
					<span class="text-sm text-yellow-600 dark:text-yellow-400">Đang lấy vị trí...</span>
				</template>

				<template v-else-if="locationStatus === 'verified'">
					<svg class="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span class="text-sm font-medium text-green-700 dark:text-green-400">{{ locationInfo?.name }}</span>
					<span v-if="locationInfo?.distance != null" class="text-xs text-green-500">({{ locationInfo.distance }}m)</span>
				</template>

				<template v-else-if="locationStatus === 'out_of_range'">
					<svg class="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
						<path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
					</svg>
					<span class="text-sm text-red-600 dark:text-red-400">Ngoài vị trí cho phép</span>
					<span v-if="locationInfo?.distance != null" class="text-xs text-red-400">({{ locationInfo.distance }}m)</span>
				</template>

				<template v-else-if="locationStatus === 'no_shift'">
					<svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span class="text-sm text-gray-500 dark:text-gray-400">Không có ca hôm nay</span>
				</template>

				<!-- error state — phân biệt permission denied vs lỗi khác -->
				<template v-else>
					<template v-if="locationPermission !== 'unknown'">
						<svg class="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
						</svg>
						<span class="text-sm text-orange-600 dark:text-orange-400">Chưa cấp quyền vị trí</span>
					</template>
					<template v-else>
						<svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
						</svg>
						<span class="text-sm text-gray-500 dark:text-gray-400">Không thể lấy vị trí</span>
					</template>
				</template>
			</div>

			<p v-if="locationStatus === 'out_of_range'" class="text-xs text-red-500 mt-2">
				Vui lòng đến vị trí quy định của công ty
			</p>
		</div>

		<!-- Location permission banner -->
		<div
			v-if="locationPermission !== 'unknown'"
			class="border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 mb-4"
		>
			<div class="flex items-start gap-3 mb-3">
				<svg class="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
				</svg>
				<div>
					<p class="text-sm font-semibold text-orange-800 dark:text-orange-300">Quyền truy cập vị trí bị từ chối</p>
					<p class="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
						<template v-if="locationPermission === 'permanently_denied'">
							Trình duyệt đã chặn vĩnh viễn. Vào <strong>Cài đặt trình duyệt → Quyền riêng tư → Vị trí</strong> để cấp quyền, sau đó tải lại trang.
						</template>
						<template v-else>
							Ứng dụng cần quyền vị trí để xác nhận điểm chấm công hợp lệ.
						</template>
					</p>
				</div>
			</div>
			<button
				v-if="locationPermission === 'denied'"
				:disabled="isRequestingLocation"
				class="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2"
				:class="isRequestingLocation ? 'bg-orange-400 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-700'"
				@click="requestLocationPermission"
			>
				<svg v-if="isRequestingLocation" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
				</svg>
				{{ isRequestingLocation ? 'Đang xin quyền...' : 'Cho phép truy cập vị trí' }}
			</button>
		</div>

		<!-- Action area -->
		<template v-if="!isCompleted">
			<div class="space-y-3">
				<!-- Check-in block: luôn hiển thị, disabled khi không được phép -->
				<button
					:disabled="!canCheckInAction"
					class="w-full py-4 rounded-xl text-lg font-semibold transition-colors"
					:class="
						canCheckInAction
							? 'bg-green-600 hover:bg-green-700 active:bg-green-800 text-white cursor-pointer'
							: 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
					"
					@click="initiateCheckIn"
				>
					{{ isProcessing && !apiCanCheckOut ? 'Đang xử lý...' : 'Check-in' }}
				</button>

				<!-- Check-out block: hiện khi canCheckOut=true hoặc canCheckIn=false -->
				<button
					v-if="showCheckOutBlock"
					:disabled="!canCheckOutAction"
					class="w-full py-4 rounded-xl text-lg font-semibold transition-colors"
					:class="
						canCheckOutAction
							? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white cursor-pointer'
							: 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
					"
					@click="initiateCheckOut"
				>
					{{ isProcessing && apiCanCheckOut ? 'Đang xử lý...' : 'Check-out' }}
				</button>

				<p v-if="locationStatus === 'out_of_range'" class="text-center text-xs text-gray-500">
					Vui lòng đến vị trí quy định của công ty
				</p>
			</div>

			<!-- Camera permission banner -->
			<div
				v-if="cameraPermission !== 'unknown'"
				class="border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 mt-4"
			>
				<div class="flex items-start gap-3 mb-3">
					<svg class="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
						<path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
					</svg>
					<div>
						<p class="text-sm font-semibold text-orange-800 dark:text-orange-300">Quyền truy cập camera bị từ chối</p>
						<p class="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
							<template v-if="cameraPermission === 'permanently_denied'">
								Trình duyệt đã chặn vĩnh viễn. Vào <strong>Cài đặt trình duyệt → Quyền riêng tư → Camera</strong> để cấp quyền, sau đó tải lại trang.
								<br />Camera bị chặn vĩnh viễn — bạn có thể tải ảnh lên thủ công thay thế.
							</template>
							<template v-else>
								Ứng dụng cần camera để chụp ảnh xác nhận khi chấm công.
							</template>
						</p>
					</div>
				</div>
				<button
					v-if="cameraPermission === 'denied'"
					:disabled="isRequestingCamera"
					class="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2"
					:class="isRequestingCamera ? 'bg-orange-400 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-700'"
					@click="requestCameraPermission"
				>
					<svg v-if="isRequestingCamera" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
					</svg>
					{{ isRequestingCamera ? 'Đang xin quyền...' : 'Cho phép truy cập camera' }}
				</button>
			</div>
		</template>

		<!-- Completed state -->
		<div v-else class="flex flex-col items-center py-6 gap-2">
			<div class="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
				<svg class="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
				</svg>
			</div>
			<p class="text-gray-700 dark:text-gray-300 font-medium">Đã hoàn thành chấm công hôm nay</p>
			<p class="text-sm text-gray-500">
				{{ formatVNTime(todayRecord?.checkInAt ?? null) }} → {{ formatVNTime(todayRecord?.checkOutAt ?? null) }}
			</p>
		</div>

		<!-- Hidden file input (fallback khi getUserMedia không khả dụng) -->
		<input ref="fileInputRef" type="file" accept="image/*" capture="user" class="hidden" @change="onFileInputChange" />

		<!-- Camera modal -->
		<Teleport to="body">
			<div v-if="showCamera" class="fixed inset-0 z-50 flex flex-col bg-black">
				<div class="flex-1 relative overflow-hidden flex items-center justify-center">
					<video ref="videoRef" autoplay playsinline muted class="h-full max-h-full w-full object-cover" style="transform: scaleX(-1)" />
				</div>
				<canvas ref="canvasRef" class="hidden" />
				<div class="py-6 px-8 flex items-center justify-between bg-black">
					<button class="px-5 py-2.5 text-sm text-white border border-white/30 rounded-lg hover:bg-white/10" @click="stopCamera">
						Hủy
					</button>
					<button
						class="w-16 h-16 rounded-full bg-white border-[5px] border-gray-400 hover:bg-gray-100 active:scale-95 transition-transform flex-shrink-0"
						@click="captureFromCamera"
					/>
					<div class="w-20" />
				</div>
			</div>
		</Teleport>

		<!-- Check-out confirmation modal -->
		<Teleport to="body">
			<div
				v-if="showConfirmCheckOut"
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
				@click.self="showConfirmCheckOut = false"
			>
				<div class="bg-white dark:bg-gray-800 rounded-2xl p-6 mx-4 w-full max-w-sm shadow-xl">
					<div class="flex justify-end mb-1">
						<button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" @click="showConfirmCheckOut = false">
							<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
					<div class="text-center mb-5">
						<div class="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
							<svg class="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
						</div>
						<h3 class="text-base font-semibold text-gray-900 dark:text-white">Xác nhận CHECK-OUT</h3>
					</div>
					<div class="bg-gray-50 dark:bg-gray-700/50 rounded-xl px-4 py-3 mb-5 text-sm text-gray-600 dark:text-gray-300 space-y-1">
						<p>Thời gian: <span class="font-medium">{{ timeDisplay }}</span></p>
						<p v-if="locationInfo">Vị trí: <span class="font-medium">{{ locationInfo.name }}</span></p>
					</div>
					<div class="flex gap-3">
						<button
							class="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
							@click="showConfirmCheckOut = false"
						>
							Hủy
						</button>
						<button
							class="flex-1 py-2.5 rounded-xl text-sm font-medium bg-green-600 hover:bg-green-700 text-white"
							@click="onConfirmCheckOut"
						>
							Xác nhận
						</button>
					</div>
				</div>
			</div>
		</Teleport>

		<!-- Success modal -->
		<Teleport to="body">
			<div v-if="showSuccess" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
				<div class="bg-white dark:bg-gray-800 rounded-2xl p-8 mx-4 w-full max-w-xs text-center shadow-xl">
					<div class="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
						<svg class="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
						</svg>
					</div>
					<h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-1">
						{{ successAction === 'check-in' ? 'Check-in thành công!' : 'Check-out thành công!' }}
					</h3>
					<p class="text-sm text-gray-500 mb-6">{{ timeDisplay }}</p>
					<button
						class="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-sm font-semibold text-white"
						@click="showSuccess = false"
					>
						Đóng
					</button>
				</div>
			</div>
		</Teleport>
	</div>
</template>
