<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { useAssetService } from '~/services/asset.service';
	import { todayYmd } from '~/utils/date';
	import type { AssetMaintenance } from '~/types/asset.types';
	import { assetNumberField, toAssetNumber } from '~/utils/asset.utils';

	const props = defineProps<{ maintenance: AssetMaintenance }>();

	const emit = defineEmits<{
		closed: [maintenance: AssetMaintenance];
		close: [];
	}>();

	const toast = useToast();
	const service = useAssetService();

	const schema = toTypedSchema(
		z.object({
			outcome: z.string().min(1, 'Chọn kết quả'),
			workDone: z.string().optional(),
			cost: assetNumberField,
			doneAt: z.string().optional(),
		}),
	);

	const { handleSubmit, defineField, errors, isSubmitting, values } = useForm({
		validationSchema: schema,
		initialValues: {
			outcome: 'DONE',
			workDone: props.maintenance.workDone ?? '',
			cost: props.maintenance.cost != null ? String(props.maintenance.cost) : '',
			doneAt: todayYmd(),
		},
	});

	const [outcome, outcomeAttrs] = defineField('outcome');
	const [workDone, workDoneAttrs] = defineField('workDone');
	const [cost, costAttrs] = defineField('cost');
	const [doneAt, doneAtAttrs] = defineField('doneAt');

	const outcomeOptions = [
		{ value: 'DONE', label: 'Xong' },
		{ value: 'UNREPAIRABLE', label: 'Không sửa được' },
		{ value: 'CANCELLED', label: 'Huỷ phiếu' },
	];

	/** Nói trước tài sản sẽ về trạng thái nào, theo bảng vòng đời ở bridge doc mục 7. */
	const outcomeHint = computed(() => {
		if (values.outcome === 'UNREPAIRABLE') return 'Tài sản sẽ chuyển sang trạng thái Hỏng.';
		return 'Tài sản sẽ về trạng thái trước khi sửa: đang có người giữ thì Đang dùng, không thì Sẵn sàng.';
	});

	const onSubmit = handleSubmit(async v => {
		try {
			const closed = await service.closeMaintenance(props.maintenance.id, {
				outcome: v.outcome as 'DONE' | 'UNREPAIRABLE' | 'CANCELLED',
				workDone: v.workDone || undefined,
				cost: toAssetNumber(v.cost),
				doneAt: v.doneAt || undefined,
			});
			toast.success('Đã đóng phiếu sửa');
			emit('closed', closed);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Đóng phiếu thất bại');
		}
	});

	const inputCls =
		'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
	const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300';
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-4">
			<div class="my-8 w-full max-w-md rounded-2xl bg-white shadow-xl dark:bg-gray-900">
				<div class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
					<div>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Đóng phiếu sửa chữa</h2>
						<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
							{{ maintenance.asset.code }} · {{ maintenance.asset.name }}
						</p>
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
					<div class="space-y-1">
						<label :class="labelCls">Kết quả <span class="text-red-500">*</span></label>
						<UiSelect v-model="outcome" v-bind="outcomeAttrs" :options="outcomeOptions" />
						<p v-if="errors.outcome" class="text-xs text-red-500">{{ errors.outcome }}</p>
						<p class="text-xs text-gray-500 dark:text-gray-400">{{ outcomeHint }}</p>
					</div>

					<div class="space-y-1">
						<label :class="labelCls">Đã làm gì</label>
						<textarea v-model="workDone" v-bind="workDoneAttrs" rows="2" :class="`${inputCls} resize-none`" />
					</div>

					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-1">
							<label :class="labelCls">Chi phí thực tế</label>
							<input v-model="cost" v-bind="costAttrs" type="number" min="0" step="any" :class="inputCls" />
						</div>
						<div class="space-y-1">
							<label :class="labelCls">Ngày xong</label>
							<UiDatePicker v-model="doneAt" v-bind="doneAtAttrs" />
						</div>
					</div>

					<div class="flex justify-end gap-3 pt-2">
						<CommonAppButton variant="secondary" type="button" @click="emit('close')">Huỷ</CommonAppButton>
						<CommonAppButton variant="primary" type="submit" :loading="isSubmitting">Đóng phiếu</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
