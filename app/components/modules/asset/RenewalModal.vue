<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { todayYmd } from '~/utils/date';
	import { assetNumberField, toAssetNumber } from '~/utils/asset.utils';
	import type { Asset, AssetRenewal, AssetRenewalBody } from '~/types/asset.types';

	const props = defineProps<{
		asset: Asset;
		/** Trang quản lý và trang tự phục vụ gọi hai endpoint khác nhau. */
		submit: (body: AssetRenewalBody) => Promise<AssetRenewal>;
	}>();

	const emit = defineEmits<{
		renewed: [renewal: AssetRenewal];
		close: [];
	}>();

	const toast = useToast();

	const schema = toTypedSchema(
		z.object({
			amount: assetNumberField.refine(v => toAssetNumber(v) != null, 'Nhập số tiền đã trả'),
			currency: z.string().optional(),
			exchangeRate: assetNumberField,
			paidAt: z.string().min(1, 'Chọn ngày thanh toán'),
			seatCount: assetNumberField,
			nextRenewalDate: z.string().optional(),
			note: z.string().optional(),
		}),
	);

	const { handleSubmit, defineField, errors, isSubmitting } = useForm({
		validationSchema: schema,
		initialValues: {
			amount: '',
			currency: props.asset.currency || 'VND',
			exchangeRate: '',
			paidAt: todayYmd(),
			seatCount: props.asset.service?.seatCount != null ? String(props.asset.service.seatCount) : '',
			nextRenewalDate: '',
			note: '',
		},
	});

	const [amount, amountAttrs] = defineField('amount');
	const [currency, currencyAttrs] = defineField('currency');
	const [exchangeRate, exchangeRateAttrs] = defineField('exchangeRate');
	const [paidAt, paidAtAttrs] = defineField('paidAt');
	const [seatCount, seatCountAttrs] = defineField('seatCount');
	const [nextRenewalDate, nextRenewalDateAttrs] = defineField('nextRenewalDate');
	const [note, noteAttrs] = defineField('note');

	const onSubmit = handleSubmit(async v => {
		try {
			const renewal = await props.submit({
				amount: toAssetNumber(v.amount) as number,
				currency: v.currency || undefined,
				exchangeRate: toAssetNumber(v.exchangeRate),
				paidAt: v.paidAt,
				seatCount: toAssetNumber(v.seatCount),
				nextRenewalDate: v.nextRenewalDate || undefined,
				note: v.note || undefined,
			});
			toast.success('Đã ghi nhận gia hạn');
			emit('renewed', renewal);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Ghi nhận gia hạn thất bại');
		}
	});

	const inputCls =
		'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
	const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300';
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-4">
			<div class="my-8 w-full max-w-lg rounded-2xl bg-white shadow-xl dark:bg-gray-900">
				<div class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
					<div>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Ghi nhận gia hạn</h2>
						<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ asset.code }} · {{ asset.name }}</p>
					</div>
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

				<form class="space-y-4 p-6" @submit.prevent="onSubmit">
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div class="space-y-1">
							<label :class="labelCls">Số tiền đã trả <span class="text-red-500">*</span></label>
							<input v-model="amount" v-bind="amountAttrs" type="number" min="0" step="any" :class="inputCls" />
							<p v-if="errors.amount" class="text-xs text-red-500">{{ errors.amount }}</p>
						</div>
						<div class="grid grid-cols-2 gap-3">
							<div class="space-y-1">
								<label :class="labelCls">Tiền tệ</label>
								<input v-model="currency" v-bind="currencyAttrs" type="text" maxlength="3" :class="inputCls" />
							</div>
							<div class="space-y-1">
								<label :class="labelCls">Tỷ giá</label>
								<input v-model="exchangeRate" v-bind="exchangeRateAttrs" type="number" min="0" step="any" :class="inputCls" />
							</div>
						</div>
						<div class="space-y-1">
							<label :class="labelCls">Ngày thanh toán <span class="text-red-500">*</span></label>
							<UiDatePicker v-model="paidAt" v-bind="paidAtAttrs" />
							<p v-if="errors.paidAt" class="text-xs text-red-500">{{ errors.paidAt }}</p>
						</div>
						<div class="space-y-1">
							<label :class="labelCls">Số ghế</label>
							<input v-model="seatCount" v-bind="seatCountAttrs" type="number" min="0" :class="inputCls" />
							<p class="text-xs text-gray-500 dark:text-gray-400">Khác hiện tại thì cập nhật luôn cho dịch vụ.</p>
						</div>
						<div class="space-y-1 sm:col-span-2">
							<label :class="labelCls">Hạn gia hạn kế tiếp</label>
							<UiDatePicker v-model="nextRenewalDate" v-bind="nextRenewalDateAttrs" />
							<p class="text-xs text-gray-500 dark:text-gray-400">
								Bỏ trống thì tính theo chu kỳ và ngày neo. Nhập tay khi kỳ này được khuyến mãi.
							</p>
						</div>
						<div class="space-y-1 sm:col-span-2">
							<label :class="labelCls">Ghi chú</label>
							<textarea v-model="note" v-bind="noteAttrs" rows="2" :class="`${inputCls} resize-none`" />
						</div>
					</div>

					<div class="flex justify-end gap-3 pt-2">
						<CommonAppButton variant="secondary" type="button" @click="emit('close')">Huỷ</CommonAppButton>
						<CommonAppButton variant="primary" type="submit" :loading="isSubmitting">Ghi nhận</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
