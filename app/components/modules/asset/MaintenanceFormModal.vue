<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { useAssetService } from '~/services/asset.service';
	import type { AssetMaintenance, AssetMaintenanceType, AssetVendor } from '~/types/asset.types';
	import { assetNumberField, toAssetNumber } from '~/utils/asset.utils';

	const props = withDefaults(
		defineProps<{
			assetId: number;
			assetLabel: string;
			/** Có phiếu là sửa phiếu đang mở, không có là mở phiếu mới. */
			maintenance?: AssetMaintenance | null;
			/**
				 * Loại phiếu khi mở mới. Phiếu bảo dưỡng là việc theo lịch, đưa tài sản sang
				 * "Đang bảo dưỡng" chứ không phải "Đang sửa"; khi sửa phiếu thì lấy loại của
				 * chính phiếu đó vì BE không cho đổi loại.
				 */
			type?: AssetMaintenanceType;
		}>(),
		{ maintenance: null, type: 'REPAIR' },
	);

	const emit = defineEmits<{
		saved: [maintenance: AssetMaintenance];
		close: [];
	}>();

	const toast = useToast();
	const service = useAssetService();
	const vendors = ref<AssetVendor[]>([]);

	const isEdit = computed(() => !!props.maintenance);
	const kind = computed<AssetMaintenanceType>(() => props.maintenance?.type ?? props.type);
	const isMaintenance = computed(() => kind.value === 'MAINTENANCE');
	const ticketName = computed(() => (isMaintenance.value ? 'phiếu bảo dưỡng' : 'phiếu sửa'));
	const title = computed(() =>
		isEdit.value ? `Cập nhật ${ticketName.value}` : `Mở ${ticketName.value}`,
	);
	const descriptionLabel = computed(() =>
		isMaintenance.value ? 'Nội dung bảo dưỡng' : 'Mô tả hỏng hóc',
	);
	/** Phiếu bảo dưỡng không "sửa" gì, nên đơn vị và ngày gửi đặt tên theo việc chung. */
	const vendorLabel = computed(() => (isMaintenance.value ? 'Đơn vị thực hiện' : 'Đơn vị sửa chữa'));

	const schema = toTypedSchema(
		z.object({
			description: z.string().min(1, 'Nhập nội dung của phiếu'),
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
			cost: m?.cost ?? undefined,
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
		{ value: 'IN_PROGRESS', label: 'Đang xử lý' },
	];

	useEscapeKey(
		() => emit('close'),
		() => !isSubmitting.value,
	);

	/** Danh sách đơn vị tải lỗi thì nói ra, kẻo người dùng tưởng công ty chưa có đơn vị nào. */
	const vendorsError = ref(false);

	onMounted(async () => {
		try {
			vendors.value = await service.findVendors({ isActive: true });
		} catch {
			// Ô chọn đơn vị rỗng, form vẫn gửi được vì đơn vị là tuỳ chọn.
			vendorsError.value = true;
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
				: await service.createMaintenance(props.assetId, { ...base, type: kind.value });
			if (isEdit.value) {
				toast.success(`Đã lưu thay đổi của ${ticketName.value} ${props.assetLabel}.`);
			} else if (isMaintenance.value) {
				toast.success(
					`Đã mở phiếu bảo dưỡng cho ${props.assetLabel}. Tài sản chuyển sang Đang bảo dưỡng, người đang giữ vẫn giữ nguyên.`,
				);
			} else {
				toast.success(
					`Đã mở phiếu sửa cho ${props.assetLabel}. Tài sản chuyển sang Đang sửa, người đang giữ vẫn giữ nguyên.`,
				);
			}
			emit('saved', saved);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa lưu được phiếu. Bạn thử lại sau ít phút.');
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
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ title }}</h2>
						<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ assetLabel }}</p>
					</div>
					<button
						type="button"
						class="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
						:aria-label="`Đóng hộp ${title.toLowerCase()}`"
						@click="emit('close')"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<form class="space-y-4 p-6" @submit.prevent="onSubmit">
					<div class="space-y-1">
						<label :class="labelCls">{{ descriptionLabel }} <span class="text-red-500">*</span></label>
						<textarea v-model="description" v-bind="descriptionAttrs" rows="2" :class="`${inputCls} resize-none`" />
						<p v-if="errors.description" class="text-xs text-red-500">{{ errors.description }}</p>
					</div>

					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div class="space-y-1">
							<label :class="labelCls">{{ vendorLabel }}</label>
							<UiSelectInput v-model="vendorId" v-bind="vendorIdAttrs" :options="vendorOptions" placeholder="Không chọn" />
							<p v-if="vendorsError" class="text-xs text-amber-700 dark:text-amber-400">
								Chưa tải được danh sách đơn vị. Bạn vẫn lưu phiếu được và chọn đơn vị sau.
							</p>
						</div>
						<div v-if="isEdit" class="space-y-1">
							<label :class="labelCls">Trạng thái</label>
							<UiSelect v-model="status" v-bind="statusAttrs" :options="statusOptions" />
						</div>
						<div class="space-y-1">
							<label :class="labelCls">Ngày gửi đi</label>
							<UiDatePicker v-model="sentAt" v-bind="sentAtAttrs" />
						</div>
						<div class="space-y-1">
							<label :class="labelCls">Dự kiến xong</label>
							<UiDatePicker v-model="expectedDoneAt" v-bind="expectedDoneAtAttrs" />
						</div>
						<div class="space-y-1">
							<label :class="labelCls">Chi phí dự kiến</label>
							<UiNumberInput v-model="cost" v-bind="costAttrs" :decimals="2" :min="0" :input-class="inputCls" />
							<p class="text-xs text-gray-500 dark:text-gray-400">Chi phí này không cộng vào nguyên giá.</p>
						</div>
						<label class="flex items-center gap-2 pt-6">
							<input v-model="underWarranty" v-bind="underWarrantyAttrs" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
							<span class="text-sm text-gray-700 dark:text-gray-300">Còn bảo hành</span>
						</label>
						<div v-if="isEdit" class="space-y-1 sm:col-span-2">
							<label :class="labelCls">Đã làm gì</label>
							<textarea v-model="workDone" v-bind="workDoneAttrs" rows="2" :class="`${inputCls} resize-none`" />
							<p class="text-xs text-gray-500 dark:text-gray-400">
								Trưởng phòng và người giữ tài sản đọc được ô này, nên bạn ghi tiền ở ô chi phí thay vì ở đây.
							</p>
						</div>
					</div>

					<p v-if="!isEdit" class="text-xs text-gray-500 dark:text-gray-400">
						<template v-if="isMaintenance">
							Mở phiếu sẽ chuyển tài sản sang trạng thái Đang bảo dưỡng. Người đang giữ vẫn giữ nguyên,
							và đóng phiếu xong hạn bảo dưỡng kế tiếp được tính lại từ ngày đóng.
						</template>
						<template v-else>
							Mở phiếu sẽ chuyển tài sản sang trạng thái Đang sửa. Người đang giữ vẫn giữ nguyên.
						</template>
					</p>

					<div class="flex justify-end gap-3 pt-2">
						<CommonAppButton variant="secondary" type="button" @click="emit('close')">Đóng</CommonAppButton>
						<CommonAppButton variant="primary" type="submit" :loading="isSubmitting">
							{{ isEdit ? 'Lưu thay đổi' : 'Mở phiếu' }}
						</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
