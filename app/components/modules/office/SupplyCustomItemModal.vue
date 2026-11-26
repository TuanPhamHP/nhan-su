<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import QtyInput from '~/components/modules/office/QtyInput.vue';
	import { SUPPLY_NOTE_MAX } from '~/composables/useMySupplies';
	import { QTY_INTEGER_MESSAGE, officeErrorCode, officeErrorMessage } from '~/utils/office.utils';

	/**
	 * Thêm mặt hàng không có trong danh mục: tên, đơn vị, số lượng và ghi chú.
	 *
	 * Giới hạn độ dài theo đúng API (tên 200, đơn vị 30, ghi chú 500). Cùng tên và đơn vị với một dòng
	 * ngoài danh mục đang có thì máy chủ cộng vào dòng đó; tên trùng mặt hàng của danh mục thì máy chủ
	 * từ chối kèm tên đúng, câu đó đặt ngay dưới ô tên để người dùng quay về danh mục.
	 */
	const props = defineProps<{
		/** Tên điền sẵn, lấy từ từ khoá người dùng vừa tìm mà không thấy. */
		initialName?: string;
		submit: (body: { name: string; unit: string; qty: number; note?: string }) => Promise<void>;
	}>();

	const emit = defineEmits<{ close: [] }>();

	const toast = useToast();

	const schema = toTypedSchema(
		z.object({
			name: z.string({ message: 'Bạn ghi tên mặt hàng, ví dụ Pin 3A.' }).trim().min(1, 'Bạn ghi tên mặt hàng, ví dụ Pin 3A.').max(200),
			unit: z.string({ message: 'Bạn ghi đơn vị, ví dụ Đôi, Hộp, Chiếc.' }).trim().min(1, 'Bạn ghi đơn vị, ví dụ Đôi, Hộp, Chiếc.').max(30),
			qty: z
				.number({ message: 'Bạn nhập số lượng cần xin, ví dụ 2.' })
				.int(QTY_INTEGER_MESSAGE)
				.min(1, 'Số lượng ít nhất là 1.')
				.max(100000, 'Số lượng tối đa 100.000.'),
			note: z.string().max(SUPPLY_NOTE_MAX).optional(),
		}),
	);

	const { handleSubmit, defineField, errors, isSubmitting, setFieldError } = useForm({
		validationSchema: schema,
		initialValues: { name: props.initialName ?? '', unit: '', qty: undefined, note: '' },
	});

	const [name, nameAttrs] = defineField('name');
	const [unit, unitAttrs] = defineField('unit');
	const [qty] = defineField('qty');
	const [note, noteAttrs] = defineField('note');
	/** Ô số đang giữ chữ gõ sai: chặn gửi tới khi người dùng sửa lại. */
	const qtyInvalid = ref(false);
	const formError = ref('');

	useEscapeKey(
		() => emit('close'),
		() => !isSubmitting.value,
	);

	const onSubmit = handleSubmit(async values => {
		if (qtyInvalid.value) {
			setFieldError('qty', QTY_INTEGER_MESSAGE);
			return;
		}
		formError.value = '';
		try {
			await props.submit({ name: values.name, unit: values.unit, qty: values.qty, note: values.note?.trim() || undefined });
			toast.success(`Đã thêm ${values.name} vào phiếu.`);
			emit('close');
		} catch (e) {
			const code = officeErrorCode(e);
			if (code === 'OFFICE_SUPPLY_LINE_IN_CATALOG') {
				setFieldError('name', officeErrorMessage(e, 'Mặt hàng này đã có trong danh mục, bạn tìm trong danh sách.'));
			} else if (code === 'OFFICE_SUPPLY_LINE_INVALID') {
				formError.value = officeErrorMessage(e, 'Số hoặc ghi chú sau khi cộng vào dòng đang có vượt giới hạn.');
			} else {
				toast.error(officeErrorMessage(e, 'Chưa thêm được mặt hàng ngoài danh mục. Bạn thử lại sau ít phút.'));
			}
		}
	});

	const inputClass =
		'h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
</script>

<template>
	<Teleport to="body">
		<div
			class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="supply-custom-title"
			@click.self="emit('close')"
		>
			<form
				class="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
				@submit.prevent="onSubmit"
			>
				<div class="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
					<h2 id="supply-custom-title" class="text-base font-semibold text-gray-900 dark:text-white">
						Thêm mặt hàng ngoài danh mục
					</h2>
					<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
						Chỉ dùng khi không tìm thấy mặt hàng trong danh mục. HCNS nhập đơn giá khi chốt phiếu.
					</p>
				</div>

				<div class="space-y-3 px-5 py-4">
					<div>
						<label for="supply-custom-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
							Tên mặt hàng <span class="text-rose-500">*</span>
						</label>
						<input
							id="supply-custom-name"
							v-model="name"
							v-bind="nameAttrs"
							type="text"
							maxlength="200"
							autofocus
							:class="['mt-1', inputClass]"
							placeholder="VD: Pin 3A"
						/>
						<p v-if="errors.name" class="mt-1 text-xs text-rose-600 dark:text-rose-400">{{ errors.name }}</p>
					</div>

					<div class="grid grid-cols-2 gap-3">
						<div>
							<label for="supply-custom-unit" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Đơn vị <span class="text-rose-500">*</span>
							</label>
							<input
								id="supply-custom-unit"
								v-model="unit"
								v-bind="unitAttrs"
								type="text"
								maxlength="30"
								:class="['mt-1', inputClass]"
								placeholder="VD: Đôi"
							/>
							<p v-if="errors.unit" class="mt-1 text-xs text-rose-600 dark:text-rose-400">{{ errors.unit }}</p>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Số lượng <span class="text-rose-500">*</span>
							</label>
							<QtyInput
								v-model="qty"
								v-model:invalid="qtyInvalid"
								class="mt-1 [&_input]:h-9 [&_input]:py-1"
								:max="100000"
								:error="errors.qty"
								placeholder="VD: 2"
								aria-label="Số lượng mặt hàng ngoài danh mục"
								@save="onSubmit"
							/>
						</div>
					</div>

					<div>
						<label for="supply-custom-note" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
							Ghi chú
						</label>
						<textarea
							id="supply-custom-note"
							v-model="note"
							v-bind="noteAttrs"
							rows="2"
							:maxlength="SUPPLY_NOTE_MAX"
							class="mt-1 w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							placeholder="Không bắt buộc"
						/>
					</div>

					<p v-if="formError" role="alert" class="text-sm text-rose-600 dark:text-rose-400">{{ formError }}</p>
				</div>

				<div class="flex justify-end gap-3 border-t border-gray-200 px-5 py-3 dark:border-gray-700">
					<CommonAppButton variant="outline" :disabled="isSubmitting" @click="emit('close')">Thôi</CommonAppButton>
					<CommonAppButton variant="primary" type="submit" :loading="isSubmitting">Thêm vào phiếu</CommonAppButton>
				</div>
			</form>
		</div>
	</Teleport>
</template>
