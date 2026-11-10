<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import { ASSET_DOCUMENT_TYPE_LABELS, type AssetDocument, type AssetDocumentType } from '~/types/asset.types';

	const props = withDefaults(
		defineProps<{
			/** Gắn vào tài sản nào. Một hoá đơn mua nhiều máy gửi một lần với nhiều id. */
			assetIds?: number[];
			/** Gắn vào một lần gia hạn (bắt buộc ở route tự phục vụ của người phụ trách). */
			renewalId?: number;
			maintenanceId?: number;
			assignmentId?: number;
			/** Người phụ trách dịch vụ upload qua route riêng của mình. */
			serviceId?: number | null;
		}>(),
		{ assetIds: () => [], renewalId: undefined, maintenanceId: undefined, assignmentId: undefined, serviceId: null },
	);

	const emit = defineEmits<{
		uploaded: [doc: AssetDocument];
		close: [];
	}>();

	const toast = useToast();
	const service = useAssetService();

	const file = ref<File | null>(null);
	const fileError = ref<string | null>(null);
	const docType = ref<AssetDocumentType>('INVOICE');
	const number = ref('');
	const issuedDate = ref('');
	const amount = ref('');
	const uploading = ref(false);

	/** Trần dung lượng theo từng loại giấy tờ, lấy từ bridge doc mục 5.6. */
	const MAX_MB: Record<AssetDocumentType, number> = {
		PURCHASE_CONTRACT: 20,
		SERVICE_CONTRACT: 20,
		OTHER: 20,
		INVOICE: 10,
		WARRANTY: 10,
		HANDOVER_RECORD: 10,
		REPAIR_QUOTE: 10,
		DISPOSAL_RECORD: 10,
		CONDITION_PHOTO: 5,
	};
	const ACCEPT = '.pdf,.jpg,.jpeg,.png,.heic,.xml,.docx,.xlsx';

	const typeOptions = Object.entries(ASSET_DOCUMENT_TYPE_LABELS).map(([value, label]) => ({ value, label }));
	const maxMb = computed(() => MAX_MB[docType.value]);

	// Đổi loại giấy tờ có thể làm file đang chọn vượt trần mới — trần theo từng loại nên
	// `UiFileDropzone` không tự biết, phải kiểm lại ở đây.
	watch(docType, () => {
		if (file.value && file.value.size > maxMb.value * 1024 * 1024) {
			fileError.value = `Loại giấy tờ này tối đa ${maxMb.value} MB`;
			file.value = null;
		}
	});

	async function upload() {
		if (!file.value || uploading.value) return;
		uploading.value = true;
		try {
			const body = {
				file: file.value,
				type: docType.value,
				number: number.value || undefined,
				issuedDate: issuedDate.value || undefined,
				amount: amount.value ? Number(amount.value) : undefined,
				assetIds: props.assetIds.length ? props.assetIds : undefined,
				renewalId: props.renewalId,
				maintenanceId: props.maintenanceId,
				assignmentId: props.assignmentId,
			};
			const doc =
				props.serviceId != null && props.renewalId != null
					? await service.uploadMyServiceDocument(props.serviceId, { ...body, renewalId: props.renewalId })
					: await service.uploadDocument(body);
			toast.success('Đã tải giấy tờ lên');
			emit('uploaded', doc);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Tải giấy tờ thất bại');
		} finally {
			uploading.value = false;
		}
	}

	const inputCls =
		'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
	const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300';
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-4">
			<div class="my-8 w-full max-w-lg rounded-2xl bg-white shadow-xl dark:bg-gray-900">
				<div class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Tải giấy tờ lên</h2>
					<button
						type="button"
						class="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
						aria-label="Đóng"
						@click="emit('close')"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<div class="space-y-4 p-6">
					<div class="space-y-1">
						<label :class="labelCls">Loại giấy tờ</label>
						<UiSelect v-model="docType" :options="typeOptions" />
					</div>

					<div class="space-y-1.5">
						<label :class="labelCls">File <span class="text-red-500">*</span></label>
						<UiFileDropzone
							v-model="file"
							:accept="ACCEPT"
							:max-size-mb="maxMb"
							:disabled="uploading"
							:error="fileError"
							@update:model-value="fileError = null"
						/>
					</div>

					<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<div class="space-y-1">
							<label :class="labelCls">Số hiệu</label>
							<input v-model="number" type="text" :class="inputCls" />
						</div>
						<div class="space-y-1">
							<label :class="labelCls">Ngày phát hành</label>
							<UiDatePicker v-model="issuedDate" />
						</div>
						<div class="space-y-1">
							<label :class="labelCls">Số tiền</label>
							<input v-model="amount" type="number" min="0" step="any" :class="inputCls" />
						</div>
					</div>

					<p v-if="assetIds.length > 1" class="text-xs text-gray-500 dark:text-gray-400">
						Giấy tờ này sẽ gắn cho {{ assetIds.length }} tài sản cùng lúc.
					</p>

					<div class="flex justify-end gap-3 pt-2">
						<CommonAppButton variant="secondary" type="button" @click="emit('close')">Huỷ</CommonAppButton>
						<CommonAppButton variant="primary" :disabled="!file" :loading="uploading" @click="upload">
							Tải lên
						</CommonAppButton>
					</div>
				</div>
			</div>
		</div>
	</Teleport>
</template>
