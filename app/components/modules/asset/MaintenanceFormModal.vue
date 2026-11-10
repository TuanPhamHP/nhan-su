<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { useAssetService } from '~/services/asset.service';
	import type { AssetMaintenance, AssetVendor } from '~/types/asset.types';
	import { assetNumberField, toAssetNumber } from '~/utils/asset.utils';

	const props = withDefaults(
		defineProps<{
			assetId: number;
			assetLabel: string;
			/** Có phiếu là sửa phiếu đang mở, không có là mở phiếu mới. */
			maintenance?: AssetMaintenance | null;
		}>(),
		{ maintenance: null },
	);

	const emit = defineEmits<{
		saved: [maintenance: AssetMaintenance];
		close: [];
	}>();

	const toast = useToast();
	const service = useAssetService();
	const vendors = ref<AssetVendor[]>([]);

	const isEdit = computed(() => !!props.maintenance);

	const schema = toTypedSchema(
		z.object({
			description: z.string().min(1, 'Mô tả hỏng hóc'),
			vendorId: z.number().optional(),
			underWarranty: z.boolean().optional(),
			cost: assetNumberField,
			sentAt: z.string().optional(),
			expectedDoneAt: z.string().optional(),
			workDone: z.string().optional(),
			status: z.string().optional(),
		}),
	);

	const m = props.maintenance;
	const { handleSubmit, defineField, errors, isSubmitting } = useForm({
		validationSchema: schema,
		initialValues: {
			description: m?.description ?? '',
			vendorId: m?.vendor?.id,
			underWarranty: m?.underWarranty ?? false,
			cost: m?.cost != null ? String(m.cost) : '',
			sentAt: m?.sentAt ?? '',
			expectedDoneAt: m?.expectedDoneAt ?? '',
			workDone: m?.workDone ?? '',
			status: m?.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'OPEN',
		},
	});

	const [description, descriptionAttrs] = defineField('description');
	const [vendorId, vendorIdAttrs] = defineField('vendorId');
	const [underWarranty, underWarrantyAttrs] = defineField('underWarranty');
	const [cost, costAttrs] = defineField('cost');
	const [sentAt, sentAtAttrs] = defineField('sentAt');
	const [expectedDoneAt, expectedDoneAtAttrs] = defineField('expectedDoneAt');
	const [workDone, workDoneAttrs] = defineField('workDone');
	const [status, statusAttrs] = defineField('status');

	const vendorOptions = computed(() => [
		{ value: 0, label: 'Không chọn' },
		...vendors.value.map(v => ({ value: v.id, label: v.name })),
	]);
	const statusOptions = [
		{ value: 'OPEN', label: 'Mới mở' },
		{ value: 'IN_PROGRESS', label: 'Đang sửa' },
	];

	onMounted(async () => {
		try {
			vendors.value = await service.findVendors({ isActive: true });
		} catch {
			// ô chọn nhà cung cấp rỗng, form vẫn gửi được
		}
	});

	const onSubmit = handleSubmit(async v => {
		try {
			const base = {
				description: v.description,
				vendorId: v.vendorId || undefined,
				underWarranty: v.underWarranty ?? false,
				cost: toAssetNumber(v.cost),
				sentAt: v.sentAt || undefined,
				expectedDoneAt: v.expectedDoneAt || undefined,
			};
			const saved = props.maintenance
				? await service.updateMaintenance(props.maintenance.id, {
						...base,
						workDone: v.workDone || undefined,
						status: (v.status as 'OPEN' | 'IN_PROGRESS') ?? undefined,
					})
				: await service.createMaintenance(props.assetId, base);
			toast.success(props.maintenance ? 'Đã lưu phiếu sửa' : 'Đã mở phiếu sửa');
			emit('saved', saved);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lưu phiếu sửa thất bại');
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
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">
							{{ isEdit ? 'Sửa phiếu sửa chữa' : 'Mở phiếu sửa chữa' }}
						</h2>
						<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ assetLabel }}</p>
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
						<label :class="labelCls">Mô tả hỏng hóc <span class="text-red-500">*</span></label>
						<textarea v-model="description" v-bind="descriptionAttrs" rows="2" :class="`${inputCls} resize-none`" />
						<p v-if="errors.description" class="text-xs text-red-500">{{ errors.description }}</p>
					</div>

					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div class="space-y-1">
							<label :class="labelCls">Đơn vị sửa</label>
							<UiSelectInput v-model="vendorId" v-bind="vendorIdAttrs" :options="vendorOptions" placeholder="Không chọn" />
						</div>
						<div v-if="isEdit" class="space-y-1">
							<label :class="labelCls">Trạng thái</label>
							<UiSelect v-model="status" v-bind="statusAttrs" :options="statusOptions" />
						</div>
						<div class="space-y-1">
							<label :class="labelCls">Ngày gửi sửa</label>
							<UiDatePicker v-model="sentAt" v-bind="sentAtAttrs" />
						</div>
						<div class="space-y-1">
							<label :class="labelCls">Dự kiến xong</label>
							<UiDatePicker v-model="expectedDoneAt" v-bind="expectedDoneAtAttrs" />
						</div>
						<div class="space-y-1">
							<label :class="labelCls">Chi phí dự kiến</label>
							<input v-model="cost" v-bind="costAttrs" type="number" min="0" step="any" :class="inputCls" />
							<p class="text-xs text-gray-500 dark:text-gray-400">Chi phí sửa không cộng vào nguyên giá.</p>
						</div>
						<label class="flex items-center gap-2 pt-6">
							<input v-model="underWarranty" v-bind="underWarrantyAttrs" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
							<span class="text-sm text-gray-700 dark:text-gray-300">Còn bảo hành</span>
						</label>
						<div v-if="isEdit" class="space-y-1 sm:col-span-2">
							<label :class="labelCls">Đã làm gì</label>
							<textarea v-model="workDone" v-bind="workDoneAttrs" rows="2" :class="`${inputCls} resize-none`" />
						</div>
					</div>

					<p v-if="!isEdit" class="text-xs text-gray-500 dark:text-gray-400">
						Mở phiếu sẽ chuyển tài sản sang trạng thái Đang sửa. Người đang giữ vẫn giữ nguyên.
					</p>

					<div class="flex justify-end gap-3 pt-2">
						<CommonAppButton variant="secondary" type="button" @click="emit('close')">Huỷ</CommonAppButton>
						<CommonAppButton variant="primary" type="submit" :loading="isSubmitting">
							{{ isEdit ? 'Lưu' : 'Mở phiếu' }}
						</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
