<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { useEmployeeProfileService } from '~/services/employee-profile.service';
	import type { Relative } from '~/types/hr-profile.types';

	/**
	 * Form tải tài liệu vào hồ sơ nhân viên (lô 3a).
	 *
	 * Loại giấy tờ lấy từ danh mục, nên công ty thêm loại mới là form có ngay. Bỏ trống ngày
	 * hết hạn thì server tự tính theo thời hạn của loại, vì vậy ô đó chỉ để điền khi giấy tờ
	 * ghi ngày khác với thời hạn mặc định.
	 */
	const props = withDefaults(
		defineProps<{
			employeeId: number;
			canViewRelatives?: boolean;
		}>(),
		{ canViewRelatives: false },
	);

	const emit = defineEmits<{
		uploaded: [];
		close: [];
	}>();

	const toast = useToast();
	const { uploading, uploadDocument } = useEmployeeDocuments();
	const { activeTypes, loading: loadingTypes, fetchTypes } = useEmployeeDocumentTypes();
	const profileService = useEmployeeProfileService();

	const selectedFile = ref<File | null>(null);
	const fileError = ref<string | null>(null);
	const relatives = ref<Relative[]>([]);

	const ACCEPTED_EXT = '.pdf,.docx,.jpg,.jpeg,.png';
	const MAX_SIZE_MB = 10;

	const schema = toTypedSchema(
		z
			.object({
				documentTypeId: z.coerce.number().int().positive('Bạn chọn loại giấy tờ'),
				issuedDate: z.string().optional().or(z.literal('')),
				expiryDate: z.string().optional().or(z.literal('')),
				relativeId: z.coerce.number().int().optional(),
				note: z.string().max(500, 'Tối đa 500 ký tự').optional().or(z.literal('')),
			})
			.refine(v => !v.issuedDate || !v.expiryDate || v.expiryDate >= v.issuedDate, {
				message: 'Ngày hết hạn không được trước ngày cấp',
				path: ['expiryDate'],
			}),
	);

	const { handleSubmit, defineField, errors, values } = useForm({ validationSchema: schema });

	const [documentTypeId] = defineField('documentTypeId');
	const [issuedDate] = defineField('issuedDate');
	const [expiryDate] = defineField('expiryDate');
	const [relativeId] = defineField('relativeId');
	const [note, noteAttrs] = defineField('note');

	const typeOptions = computed(() => activeTypes.value.map(t => ({ value: t.id, label: t.name })));

	const relativeOptions = computed(() => [
		{ value: 0, label: '-- Không gắn thân nhân nào --' },
		...relatives.value.map(r => ({ value: r.id, label: `${r.fullName} (${r.relationshipLabel})` })),
	]);

	const selectedType = computed(() => activeTypes.value.find(t => t.id === Number(values.documentTypeId)) ?? null);

	/** Câu nhắc về thời hạn mặc định, để người dùng biết bỏ trống ngày hết hạn là được. */
	const validityHint = computed(() => {
		const months = selectedType.value?.validityMonths;
		if (!months) return 'Bỏ trống nếu giấy tờ này không có thời hạn.';
		return `Bỏ trống thì hệ thống tính bằng ngày cấp cộng ${months} tháng.`;
	});

	onMounted(async () => {
		try {
			await fetchTypes();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa tải được danh mục loại giấy tờ.');
		}
		// Danh sách thân nhân chỉ để gắn giấy tờ người phụ thuộc. Người xem không có quyền xem
		// thông tin riêng thì bỏ qua hẳn, và lỗi ở đây cũng không chặn việc tải tài liệu.
		if (!props.canViewRelatives) return;
		try {
			relatives.value = await profileService.findRelatives(props.employeeId);
		} catch {
			relatives.value = [];
		}
	});

	const onSubmit = handleSubmit(async v => {
		if (!selectedFile.value) {
			fileError.value = 'Bạn chọn một file để tải lên';
			return;
		}
		try {
			await uploadDocument(props.employeeId, {
				file: selectedFile.value,
				documentTypeId: Number(v.documentTypeId),
				issuedDate: v.issuedDate || undefined,
				expiryDate: v.expiryDate || undefined,
				note: v.note || undefined,
				relativeId: v.relativeId ? Number(v.relativeId) : undefined,
			});
			toast.success('Đã tải tài liệu lên hồ sơ.');
			emit('uploaded');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa tải lên được. Bạn thử lại sau ít phút.');
		}
	});

	const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';
	const inputCls =
		'block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2.5 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500';
</script>

<template>
	<Teleport to="body">
		<div
			class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
			@click.self="emit('close')"
		>
			<div
				class="my-8 w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
			>
				<div class="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-700">
					<h3 class="text-base font-semibold text-gray-900 dark:text-white">Tải lên tài liệu</h3>
					<button
						type="button"
						class="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
						@click="emit('close')"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<form class="space-y-5 p-6" @submit.prevent="onSubmit">
					<div>
						<label :class="labelCls">Loại giấy tờ <span class="text-red-500">*</span></label>
						<UiSelect
							v-model="documentTypeId"
							:options="typeOptions"
							:placeholder="loadingTypes ? 'Đang tải danh mục…' : '-- Chọn loại giấy tờ --'"
							:error="errors.documentTypeId"
							:disabled="loadingTypes"
						/>
						<p v-if="selectedType?.isSensitive" class="mt-1 text-xs text-amber-600 dark:text-amber-400">
							Loại này là thông tin riêng, chỉ người có quyền xem thông tin riêng mới thấy.
						</p>
					</div>

					<UiFileDropzone
						v-model="selectedFile"
						:accept="ACCEPTED_EXT"
						:max-size-mb="MAX_SIZE_MB"
						:error="fileError"
						hint="Chấp nhận PDF, DOCX, JPG, PNG, tối đa 10MB."
						@update:model-value="fileError = null"
					/>

					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<UiDatePicker v-model="issuedDate" label="Ngày cấp" />
						<UiDatePicker v-model="expiryDate" label="Ngày hết hạn" :error="errors.expiryDate" :hint="validityHint" />
					</div>

					<div v-if="canViewRelatives && relatives.length">
						<label :class="labelCls">Thân nhân liên quan</label>
						<UiSelect
							:model-value="relativeId ?? 0"
							:options="relativeOptions"
							@update:model-value="relativeId = $event === 0 ? undefined : (Number($event) as number)"
						/>
						<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
							Dùng cho giấy tờ chứng minh người phụ thuộc, ví dụ giấy khai sinh của con.
						</p>
					</div>

					<div>
						<label :class="labelCls">Ghi chú</label>
						<textarea
							v-model="note"
							v-bind="noteAttrs"
							rows="2"
							:class="[inputCls, errors.note ? 'border-red-400' : '']"
							placeholder="Thông tin cần lưu ý về giấy tờ này"
						/>
						<p v-if="errors.note" class="mt-1 text-xs text-red-500">{{ errors.note }}</p>
					</div>

					<div class="flex justify-end gap-3 pt-1">
						<CommonAppButton type="button" variant="outline" @click="emit('close')">Hủy</CommonAppButton>
						<CommonAppButton type="submit" :loading="uploading" :disabled="!selectedFile">Tải lên</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
