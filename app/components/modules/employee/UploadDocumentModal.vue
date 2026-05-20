<script setup lang="ts">
import { useForm } from 'vee-validate';
import type { DocumentType } from '~/types/employee.types';

const props = defineProps<{
	employeeId: number;
}>();

const emit = defineEmits<{
	uploaded: [];
	close: [];
}>();

const toast = useToast();
const { uploading, uploadDocument } = useEmployeeDocuments();

const isDragging = ref(false);
const selectedFile = ref<File | null>(null);
const fileError = ref<string | null>(null);
const uploadProgress = ref(0);

const ACCEPTED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'];
const ACCEPTED_EXT = ['.pdf', '.docx', '.jpg', '.jpeg', '.png'];
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const typeOptions: { value: DocumentType; label: string }[] = [
	{ value: 'ID_CARD', label: 'CCCD / Hộ chiếu' },
	{ value: 'CONTRACT', label: 'Hợp đồng lao động' },
	{ value: 'OTHER', label: 'Tài liệu khác' },
];

const { handleSubmit, defineField, errors } = useForm<{ type: DocumentType }>({
	validationSchema: {
		type: (v: string) => !!v || 'Vui lòng chọn loại tài liệu',
	},
});

const [type] = defineField('type');

function formatSize(bytes: number) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFile(file: File): string | null {
	if (!ACCEPTED_TYPES.includes(file.type) && !ACCEPTED_EXT.some(ext => file.name.toLowerCase().endsWith(ext))) {
		return 'Chỉ chấp nhận file PDF, DOCX, JPG, PNG';
	}
	if (file.size > MAX_SIZE_BYTES) {
		return `File không được vượt quá ${MAX_SIZE_MB}MB`;
	}
	return null;
}

function setFile(file: File) {
	const err = validateFile(file);
	if (err) {
		fileError.value = err;
		selectedFile.value = null;
	} else {
		fileError.value = null;
		selectedFile.value = file;
	}
}

function onFileInput(e: Event) {
	const input = e.target as HTMLInputElement;
	if (input.files?.[0]) setFile(input.files[0]);
}

function onDrop(e: DragEvent) {
	isDragging.value = false;
	const file = e.dataTransfer?.files?.[0];
	if (file) setFile(file);
}

function clearFile() {
	selectedFile.value = null;
	fileError.value = null;
}

const onSubmit = handleSubmit(async values => {
	if (!selectedFile.value) {
		fileError.value = 'Vui lòng chọn file';
		return;
	}

	uploadProgress.value = 30;
	try {
		uploadProgress.value = 60;
		await uploadDocument(props.employeeId, selectedFile.value, values.type);
		uploadProgress.value = 100;
		toast.success('Đã tải lên tài liệu thành công');
		emit('uploaded');
	} catch (e) {
		uploadProgress.value = 0;
		toast.error(e instanceof Error ? e.message : 'Tải lên thất bại');
	}
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
				<div class="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4">
					<!-- Modal header -->
					<div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
						<h3 class="text-base font-semibold text-gray-900 dark:text-white">Tải lên tài liệu</h3>
						<button
							type="button"
							class="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
							@click="emit('close')"
						>
							<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<!-- Form -->
					<form class="p-6 space-y-5" @submit.prevent="onSubmit">
						<!-- Document type -->
						<div>
							<label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
								Loại tài liệu <span class="text-red-500">*</span>
							</label>
							<UiSelect
								v-model="type"
								:options="typeOptions"
								placeholder="-- Chọn loại tài liệu --"
								:error="errors.type"
							/>
						</div>

						<!-- File upload area -->
						<div>
							<label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
								File <span class="text-red-500">*</span>
							</label>

							<!-- Selected file preview -->
							<div v-if="selectedFile" class="flex items-center gap-3 px-4 py-3 rounded-lg border border-brand-200 dark:border-brand-700 bg-brand-50 dark:bg-brand-900/20">
								<svg class="w-8 h-8 text-brand-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
									<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
								</svg>
								<div class="flex-1 min-w-0">
									<p class="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{{ selectedFile.name }}</p>
									<p class="text-xs text-gray-500 dark:text-gray-400">{{ formatSize(selectedFile.size) }}</p>
								</div>
								<button
									type="button"
									class="p-1 rounded text-gray-400 hover:text-red-500 transition-colors"
									@click="clearFile"
								>
									<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>

							<!-- Drop zone -->
							<label
								v-else
								class="flex flex-col items-center justify-center gap-2 px-4 py-8 rounded-lg border-2 border-dashed transition-colors cursor-pointer"
								:class="isDragging
									? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
									: 'border-gray-300 dark:border-gray-600 hover:border-brand-400 hover:bg-gray-50 dark:hover:bg-gray-800'"
								@dragover.prevent="isDragging = true"
								@dragleave="isDragging = false"
								@drop.prevent="onDrop"
							>
								<svg class="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
									<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
								</svg>
								<p class="text-sm text-gray-600 dark:text-gray-300 font-medium">Kéo thả hoặc nhấn để chọn file</p>
								<p class="text-xs text-gray-400 dark:text-gray-500">Chấp nhận PDF, DOCX, JPG, PNG — tối đa 10MB</p>
								<input
									type="file"
									class="sr-only"
									:accept="ACCEPTED_EXT.join(',')"
									@change="onFileInput"
								/>
							</label>

							<p v-if="fileError" class="mt-1 text-xs text-red-500">{{ fileError }}</p>
						</div>

						<!-- Progress bar -->
						<div v-if="uploading || uploadProgress > 0" class="space-y-1">
							<div class="flex justify-between text-xs text-gray-500 dark:text-gray-400">
								<span>Đang tải lên...</span>
								<span>{{ uploadProgress }}%</span>
							</div>
							<div class="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
								<div
									class="h-full bg-brand-500 rounded-full transition-all duration-300"
									:style="{ width: `${uploadProgress}%` }"
								/>
							</div>
						</div>

						<!-- Actions -->
						<div class="flex justify-end gap-3 pt-1">
							<CommonAppButton type="button" variant="outline" @click="emit('close')">Hủy</CommonAppButton>
							<CommonAppButton type="submit" :loading="uploading" :disabled="!selectedFile">
								Tải lên
							</CommonAppButton>
						</div>
					</form>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>
