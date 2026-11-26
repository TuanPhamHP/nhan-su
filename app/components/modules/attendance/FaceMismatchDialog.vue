<script setup lang="ts">
	/**
	 * Hộp thoại khi check-in hoặc check-out bị từ chối vì khuôn mặt.
	 *
	 * Câu chính là `message` của máy chủ, hiện nguyên văn. "Chụp lại" ẩn khi hết lượt thử trong
	 * ngày; "Vẫn xác nhận" gửi lại chính ảnh vừa chụp kèm `confirmFaceMismatch`, việc đó nơi gọi lo.
	 */
	const props = defineProps<{
		message: string;
		/** null khi máy chủ không gửi số lượt. */
		attemptsLeft: number | null;
		canRetake: boolean;
		busy: boolean;
	}>();

	const emit = defineEmits<{
		retake: [];
		confirm: [];
		close: [];
	}>();

	const attemptsText = computed(() => {
		if (props.attemptsLeft === null) return null;
		if (props.attemptsLeft <= 0) return 'Hôm nay bạn đã hết lượt chụp lại.';
		return `Bạn còn ${props.attemptsLeft} lượt chụp lại hôm nay.`;
	});
</script>

<template>
	<Teleport to="body">
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="face-mismatch-title"
			data-testid="face-mismatch"
		>
			<div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800">
				<div class="mb-1 flex justify-end">
					<button
						type="button"
						class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
						aria-label="Đóng"
						:disabled="busy"
						@click="emit('close')"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
				<div class="mb-5 text-center">
					<div
						class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30"
					>
						<svg class="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0"
							/>
						</svg>
					</div>
					<h3 id="face-mismatch-title" class="text-base font-semibold text-gray-900 dark:text-white">
						Chưa xác nhận được khuôn mặt
					</h3>
					<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">{{ message }}</p>
					<p v-if="attemptsText" class="mt-2 text-sm font-medium text-amber-700 dark:text-amber-400">
						{{ attemptsText }}
					</p>
				</div>

				<div class="flex flex-col gap-2 sm:flex-row-reverse">
					<CommonAppButton
						variant="primary"
						class="flex-1"
						:loading="busy"
						data-testid="face-confirm"
						@click="emit('confirm')"
					>
						Vẫn xác nhận
					</CommonAppButton>
					<CommonAppButton
						v-if="canRetake"
						variant="secondary"
						class="flex-1"
						:disabled="busy"
						data-testid="face-retake"
						@click="emit('retake')"
					>
						Chụp lại
					</CommonAppButton>
				</div>
				<p class="mt-3 text-center text-xs text-gray-400 dark:text-gray-500">
					Bấm Vẫn xác nhận thì ảnh vừa chụp được gửi để phòng nhân sự xem lại.
				</p>
			</div>
		</div>
	</Teleport>
</template>
