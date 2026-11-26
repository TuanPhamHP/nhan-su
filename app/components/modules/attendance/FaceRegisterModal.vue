<script setup lang="ts">
	import type { MyFaceStatusResponseDto } from '~/types/attendance.types';
	import { faceRegisterFailure } from '~/utils/attendance-face.utils';

	/**
	 * Bước đăng ký khuôn mặt lần đầu, dùng ở màn chấm công và thẻ "Khuôn mặt chấm công" ở hồ sơ.
	 *
	 * Nút gửi chỉ mở khi đã tick ô đồng ý: máy chủ cũng từ chối nếu thiếu (`FACE_CONSENT_REQUIRED`),
	 * nhưng chặn ở đây thì người dùng không tốn một lần gửi ảnh. Ảnh chưa đạt thì câu của máy chủ
	 * hiện ngay dưới camera và camera vẫn chạy để chụp lại luôn.
	 *
	 * `registered` mang trạng thái mới; mang `null` khi máy chủ báo đã đăng ký từ trước (ở máy
	 * khác), lúc đó nơi gọi tự kiểm lại.
	 */
	const emit = defineEmits<{
		registered: [status: MyFaceStatusResponseDto | null];
		close: [];
	}>();

	const toast = useToast();
	const { saving, registerMine } = useAttendanceFace();
	const camera = useFrontCamera();

	const videoRef = ref<HTMLVideoElement | null>(null);
	const consent = ref(false);
	const inlineError = ref<string | null>(null);
	/** Ảnh chọn tay, chỉ dùng khi không mở được camera. */
	const pickedPhoto = ref<File | null>(null);

	const cameraFailed = computed(() => camera.status.value === 'denied' || camera.status.value === 'unavailable');
	const hasSource = computed(() => camera.status.value === 'ready' || (cameraFailed.value && !!pickedPhoto.value));
	const canSubmit = computed(() => consent.value && hasSource.value && !saving.value);

	async function submit(): Promise<void> {
		if (!canSubmit.value) return;
		inlineError.value = null;
		const photo = cameraFailed.value ? pickedPhoto.value : videoRef.value ? await camera.capture(videoRef.value) : null;
		if (!photo) {
			inlineError.value = 'Chưa chụp được ảnh. Bạn thử lại.';
			return;
		}
		try {
			const status = await registerMine(photo);
			camera.stop();
			toast.success('Đã đăng ký khuôn mặt');
			emit('registered', status);
		} catch (e) {
			const failure = faceRegisterFailure(e);
			if (failure.kind === 'already') {
				camera.stop();
				toast.info(failure.message);
				emit('registered', null);
			} else if (failure.kind === 'toast') {
				toast.error(failure.message);
			} else {
				inlineError.value = failure.message;
			}
		}
	}

	function close(): void {
		camera.stop();
		emit('close');
	}

	onMounted(() => {
		if (videoRef.value) camera.start(videoRef.value);
	});
</script>

<template>
	<Teleport to="body">
		<div
			class="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="face-register-title"
		>
			<div
				class="flex max-h-full w-full flex-col overflow-y-auto rounded-t-2xl bg-white shadow-xl dark:bg-gray-900 sm:max-w-md sm:rounded-2xl"
				data-testid="face-register"
			>
				<div class="flex items-start justify-between gap-3 px-5 pt-5">
					<div>
						<h3 id="face-register-title" class="text-base font-semibold text-gray-900 dark:text-white">
							Đăng ký khuôn mặt
						</h3>
						<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
							Chụp một ảnh thẳng mặt. Từ lần sau, máy chủ so ảnh chấm công với ảnh này.
						</p>
					</div>
					<button
						type="button"
						class="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
						aria-label="Đóng"
						@click="close"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<div class="space-y-4 px-5 py-4">
					<!-- Camera với khung oval -->
					<div
						v-show="!cameraFailed"
						class="relative mx-auto aspect-[3/4] w-full max-w-[18rem] overflow-hidden rounded-2xl bg-black"
					>
						<video
							ref="videoRef"
							autoplay
							playsinline
							muted
							class="h-full w-full -scale-x-100 object-cover"
						/>
						<div
							class="pointer-events-none absolute left-1/2 top-[45%] h-[68%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.45)]"
						/>
						<p
							v-if="camera.status.value === 'starting'"
							class="absolute inset-x-0 bottom-3 text-center text-xs text-white/90"
						>
							Đang mở camera...
						</p>
					</div>

					<!-- Không mở được camera: chọn ảnh chụp thẳng mặt -->
					<div v-if="cameraFailed" class="space-y-2">
						<p class="text-sm text-amber-700 dark:text-amber-400">
							{{
								camera.status.value === 'denied'
									? 'Trình duyệt đang chặn camera. Bạn cho phép camera rồi mở lại, hoặc chọn một ảnh chụp thẳng mặt.'
									: 'Không mở được camera. Bạn chọn một ảnh chụp thẳng mặt.'
							}}
						</p>
						<UiFileDropzone v-model="pickedPhoto" accept="image/jpeg,image/png" :max-size-mb="5" />
					</div>

					<ul class="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
						<li>Nhìn thẳng vào camera</li>
						<li>Đủ sáng</li>
						<li>Chỉ một người trong khung</li>
					</ul>

					<p
						v-if="inlineError"
						class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
						role="alert"
						data-testid="face-register-error"
					>
						{{ inlineError }}
					</p>

					<label class="flex cursor-pointer items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300">
						<input
							v-model="consent"
							type="checkbox"
							class="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
							data-testid="face-consent"
						/>
						<span>Tôi đồng ý cho công ty dùng ảnh khuôn mặt của tôi để chấm công</span>
					</label>
				</div>

				<div class="flex gap-3 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
					<CommonAppButton variant="secondary" class="flex-1" :disabled="saving" @click="close">Để sau</CommonAppButton>
					<CommonAppButton
						variant="primary"
						class="flex-1"
						:disabled="!canSubmit"
						:loading="saving"
						data-testid="face-register-submit"
						@click="submit"
					>
						{{ cameraFailed ? 'Gửi ảnh' : 'Chụp và đăng ký' }}
					</CommonAppButton>
				</div>
			</div>
		</div>
	</Teleport>
</template>
