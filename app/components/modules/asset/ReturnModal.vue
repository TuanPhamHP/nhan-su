<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { useAssetService } from '~/services/asset.service';
	import { todayYmd } from '~/utils/date';
	import { ASSET_CONDITION_LABELS, type AssetAssignment } from '~/types/asset.types';
	import { asAssetEnum, ASSET_CONDITION_CODES } from '~/utils/asset.utils';

	const props = defineProps<{ assignment: AssetAssignment }>();

	const emit = defineEmits<{
		returned: [assignment: AssetAssignment];
		close: [];
	}>();

	const toast = useToast();
	const service = useAssetService();

	const holderName = computed(() => {
		if (props.assignment.employee) return props.assignment.employee.fullName;
		if (props.assignment.department) {
			const dept = props.assignment.department.name;
			const who = props.assignment.responsible?.fullName;
			return who ? `${dept} (${who})` : dept;
		}
		return 'người đang giữ';
	});

	const schema = toTypedSchema(
		z.object({
			returnedAt: z.string().min(1, 'Chọn ngày thu hồi'),
			condition: z.string().optional(),
			note: z.string().optional(),
		}),
	);

	const { handleSubmit, defineField, errors, isSubmitting, values } = useForm({
		validationSchema: schema,
		initialValues: { returnedAt: todayYmd() },
	});

	const [returnedAt, returnedAtAttrs] = defineField('returnedAt');
	const [condition, conditionAttrs] = defineField('condition');
	const [note, noteAttrs] = defineField('note');

	const conditionOptions = [
		{ value: '', label: 'Không ghi tình trạng' },
		...Object.entries(ASSET_CONDITION_LABELS).map(([value, label]) => ({ value, label })),
	];

	/** Thu hồi với tình trạng Hỏng thì tài sản về trạng thái Hỏng, không về Sẵn sàng. */
	const willMarkBroken = computed(() => values.condition === 'BROKEN');

	const onSubmit = handleSubmit(async v => {
		try {
			const updated = await service.returnAssignment(props.assignment.id, {
				returnedAt: v.returnedAt,
				condition: asAssetEnum(v.condition, ASSET_CONDITION_CODES),
				note: v.note || undefined,
			});
			toast.success('Đã thu hồi tài sản');
			emit('returned', updated);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Thu hồi thất bại');
		}
	});
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-4">
			<div class="my-8 w-full max-w-md rounded-2xl bg-white shadow-xl dark:bg-gray-900">
				<div class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
					<div>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Thu hồi tài sản</h2>
						<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
							{{ assignment.asset.code }} · {{ assignment.asset.name }}
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
					<p class="text-sm text-gray-600 dark:text-gray-400">
						Thu hồi từ <strong class="text-gray-900 dark:text-white">{{ holderName }}</strong>.
					</p>

					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
							Ngày thu hồi <span class="text-red-500">*</span>
						</label>
						<UiDatePicker v-model="returnedAt" v-bind="returnedAtAttrs" />
						<p v-if="errors.returnedAt" class="text-xs text-red-500">{{ errors.returnedAt }}</p>
					</div>

					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Tình trạng khi thu</label>
						<UiSelect v-model="condition" v-bind="conditionAttrs" :options="conditionOptions" />
						<p v-if="willMarkBroken" class="text-xs text-amber-600 dark:text-amber-400">
							Tài sản sẽ chuyển sang trạng thái Hỏng, không cấp phát tiếp được cho đến khi sửa xong.
						</p>
					</div>

					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Ghi chú</label>
						<textarea
							v-model="note"
							v-bind="noteAttrs"
							rows="2"
							placeholder="Ghi chú thu hồi..."
							class="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						/>
					</div>

					<div class="flex justify-end gap-3 pt-2">
						<CommonAppButton variant="secondary" type="button" @click="emit('close')">Huỷ</CommonAppButton>
						<CommonAppButton variant="primary" type="submit" :loading="isSubmitting">Thu hồi</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
