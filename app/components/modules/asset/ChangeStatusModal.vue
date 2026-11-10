<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { useAssetService } from '~/services/asset.service';
	import { todayYmd } from '~/utils/date';
	import type { Asset } from '~/types/asset.types';

	const props = defineProps<{ asset: Asset }>();

	const emit = defineEmits<{
		changed: [asset: Asset];
		close: [];
	}>();

	const toast = useToast();
	const service = useAssetService();

	/**
	 * Bản đầu chỉ có hai thao tác đổi trạng thái tay: thiết bị báo Mất, dịch vụ báo Huỷ.
	 * Nơi gọi đã gác theo `kind` nên ở đây chỉ cần suy ra đích đến.
	 */
	const isService = computed(() => props.asset.kind === 'SERVICE');
	const targetStatus = computed<'LOST' | 'CANCELLED'>(() => (isService.value ? 'CANCELLED' : 'LOST'));

	const schema = toTypedSchema(
		z.object({
			reason: z.string().min(1, 'Nhập lý do'),
			date: z.string().optional(),
		}),
	);

	const { handleSubmit, defineField, errors, isSubmitting } = useForm({
		validationSchema: schema,
		initialValues: { reason: '', date: todayYmd() },
	});

	const [reason, reasonAttrs] = defineField('reason');
	const [date, dateAttrs] = defineField('date');

	const onSubmit = handleSubmit(async v => {
		try {
			const updated = await service.changeStatus(props.asset.id, {
				status: targetStatus.value,
				date: v.date || undefined,
				reason: v.reason,
			});
			toast.success(isService.value ? 'Đã huỷ dịch vụ' : 'Đã đánh dấu mất');
			emit('changed', updated);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Đổi trạng thái thất bại');
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
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">
							{{ isService ? 'Huỷ dịch vụ' : 'Đánh dấu mất' }}
						</h2>
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
					<p class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
						<template v-if="isService">Dịch vụ còn ghế đang dùng thì phải thu hết ghế trước.</template>
						<template v-else>
							Đánh dấu mất sẽ đóng lần cấp phát đang mở và dừng trích khấu hao từ ngày bên dưới.
						</template>
					</p>

					<div v-if="!isService" class="space-y-1">
						<label :class="labelCls">Ngày mất</label>
						<UiDatePicker v-model="date" v-bind="dateAttrs" />
					</div>

					<div class="space-y-1">
						<label :class="labelCls">Lý do <span class="text-red-500">*</span></label>
						<textarea v-model="reason" v-bind="reasonAttrs" rows="3" :class="`${inputCls} resize-none`" />
						<p v-if="errors.reason" class="text-xs text-red-500">{{ errors.reason }}</p>
					</div>

					<div class="flex justify-end gap-3 pt-2">
						<CommonAppButton variant="secondary" type="button" @click="emit('close')">Huỷ</CommonAppButton>
						<CommonAppButton variant="danger" type="submit" :loading="isSubmitting">
							{{ isService ? 'Huỷ dịch vụ' : 'Đánh dấu mất' }}
						</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
