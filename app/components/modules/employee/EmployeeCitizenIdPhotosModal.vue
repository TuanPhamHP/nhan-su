<script setup lang="ts">
	const props = defineProps<{
		employeeId: number;
		currentFrontUrl?: string | null;
		currentBackUrl?: string | null;
	}>();

	const emit = defineEmits<{
		uploaded: [];
		close: [];
	}>();

	const toast = useToast();
	const { citizenIdUploading, uploadCitizenIdPhotos } = useEmployeeIdentity();

	const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
	const ACCEPTED_EXT = '.jpg,.jpeg,.png,.webp';
	const MAX_SIZE_MB = 5;
	const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

	const frontFile = ref<File | null>(null);
	const backFile = ref<File | null>(null);
	const frontError = ref<string | null>(null);
	const backError = ref<string | null>(null);
	const frontPreview = ref<string | null>(null);
	const backPreview = ref<string | null>(null);

	function validate(file: File): string | null {
		if (!ACCEPTED_TYPES.includes(file.type)) return 'Chỉ chấp nhận ảnh JPG, PNG hoặc WebP';
		if (file.size > MAX_SIZE_BYTES) return `Ảnh không được vượt quá ${MAX_SIZE_MB}MB`;
		return null;
	}

	function handleFile(side: 'front' | 'back', file: File | null | undefined) {
		if (!file) return;
		const err = validate(file);
		if (side === 'front') {
			frontError.value = err;
			frontFile.value = err ? null : file;
			if (frontPreview.value) URL.revokeObjectURL(frontPreview.value);
			frontPreview.value = err ? null : URL.createObjectURL(file);
		} else {
			backError.value = err;
			backFile.value = err ? null : file;
			if (backPreview.value) URL.revokeObjectURL(backPreview.value);
			backPreview.value = err ? null : URL.createObjectURL(file);
		}
	}

	function onFrontChange(e: Event) {
		const input = e.target as HTMLInputElement;
		handleFile('front', input.files?.[0]);
	}

	function onBackChange(e: Event) {
		const input = e.target as HTMLInputElement;
		handleFile('back', input.files?.[0]);
	}

	const canSubmit = computed(() => !!frontFile.value && !!backFile.value && !citizenIdUploading.value);

	async function submit() {
		if (!frontFile.value || !backFile.value) {
			toast.error('Phải chọn đủ cả ảnh mặt trước và mặt sau');
			return;
		}
		try {
			await uploadCitizenIdPhotos(props.employeeId, frontFile.value, backFile.value);
			emit('uploaded');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Upload ảnh CCCD thất bại');
		}
	}

	onBeforeUnmount(() => {
		if (frontPreview.value) URL.revokeObjectURL(frontPreview.value);
		if (backPreview.value) URL.revokeObjectURL(backPreview.value);
	});
</script>

<template>
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
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
				@click.self="emit('close')"
			>
				<div
					class="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl mx-4"
				>
					<div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
						<h3 class="text-base font-semibold text-gray-900 dark:text-white">Cập nhật ảnh CCCD</h3>
						<button
							type="button"
							class="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
							@click="emit('close')"
						>
							<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<div class="p-6 space-y-5">
						<p class="text-xs text-gray-500 dark:text-gray-400">
							Cần upload đủ cả 2 ảnh (mặt trước và mặt sau) trong 1 lần. Upload lại sẽ thay thế cả 2 ảnh hiện tại.
						</p>

						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div>
								<label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
									Mặt trước <span class="text-red-500">*</span>
								</label>
								<label
									class="flex flex-col items-center justify-center gap-2 h-48 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 hover:border-brand-400 cursor-pointer overflow-hidden relative"
								>
									<img
										v-if="frontPreview"
										:src="frontPreview"
										alt="Preview front"
										class="w-full h-full object-contain"
									/>
									<img
										v-else-if="currentFrontUrl"
										:src="currentFrontUrl"
										alt="Ảnh hiện tại"
										class="w-full h-full object-contain opacity-70"
									/>
									<template v-else>
										<svg class="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
											<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
										</svg>
										<p class="text-xs text-gray-500 dark:text-gray-400">Chọn ảnh mặt trước</p>
									</template>
									<input type="file" class="sr-only" :accept="ACCEPTED_EXT" @change="onFrontChange" />
								</label>
								<p v-if="frontError" class="mt-1 text-xs text-red-500">{{ frontError }}</p>
								<p v-else-if="frontFile" class="mt-1 text-xs text-gray-500 truncate">{{ frontFile.name }}</p>
							</div>

							<div>
								<label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
									Mặt sau <span class="text-red-500">*</span>
								</label>
								<label
									class="flex flex-col items-center justify-center gap-2 h-48 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 hover:border-brand-400 cursor-pointer overflow-hidden relative"
								>
									<img
										v-if="backPreview"
										:src="backPreview"
										alt="Preview back"
										class="w-full h-full object-contain"
									/>
									<img
										v-else-if="currentBackUrl"
										:src="currentBackUrl"
										alt="Ảnh hiện tại"
										class="w-full h-full object-contain opacity-70"
									/>
									<template v-else>
										<svg class="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
											<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
										</svg>
										<p class="text-xs text-gray-500 dark:text-gray-400">Chọn ảnh mặt sau</p>
									</template>
									<input type="file" class="sr-only" :accept="ACCEPTED_EXT" @change="onBackChange" />
								</label>
								<p v-if="backError" class="mt-1 text-xs text-red-500">{{ backError }}</p>
								<p v-else-if="backFile" class="mt-1 text-xs text-gray-500 truncate">{{ backFile.name }}</p>
							</div>
						</div>

						<div class="flex justify-end gap-3 pt-1">
							<CommonAppButton variant="outline" @click="emit('close')">Hủy</CommonAppButton>
							<CommonAppButton :loading="citizenIdUploading" :disabled="!canSubmit" @click="submit">
								Cập nhật ảnh
							</CommonAppButton>
						</div>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>
