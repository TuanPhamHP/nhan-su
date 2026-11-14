<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { useAssetService } from '~/services/asset.service';
	import { formatDate, todayYmd } from '~/utils/date';
	import type { AssetMaintenance } from '~/types/asset.types';
	import { assetNumberField, toAssetNumber } from '~/utils/asset.utils';

	const props = defineProps<{ maintenance: AssetMaintenance }>();

	const emit = defineEmits<{
		closed: [maintenance: AssetMaintenance];
		close: [];
	}>();

	const toast = useToast();
	const service = useAssetService();

	/** Ngày gửi đi của phiếu, `YYYY-MM-DD`; ngày xong không được trước ngày này. */
	const sentDay = computed(() => props.maintenance.sentAt?.slice(0, 10) ?? '');

	/**
	 * Ngày xong phải nằm trong khoảng từ ngày gửi đi tới hôm nay.
	 *
	 * BE trả 400 `ASSET_MAINTENANCE_DONE_IN_FUTURE` và `ASSET_MAINTENANCE_DONE_BEFORE_SENT` cho
	 * hai trường hợp này. Lịch đã khoá ngày ngoài khoảng, nhưng người dùng vẫn gõ tay được nên
	 * kiểm lại ở đây và báo ngay dưới ô.
	 */
	const schema = toTypedSchema(
		z
			.object({
				outcome: z.string().min(1, 'Chọn kết quả'),
				workDone: z.string().optional(),
				cost: assetNumberField,
				doneAt: z.string().optional(),
			})
			.superRefine((v, ctx) => {
				if (!v.doneAt) return;
				if (v.doneAt > todayYmd()) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ['doneAt'],
						message: 'Ngày xong không được sau hôm nay. Bạn chọn ngày thợ đã làm xong thật.',
					});
				} else if (sentDay.value && v.doneAt < sentDay.value) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ['doneAt'],
						message: `Ngày xong không được trước ngày gửi đi ${formatDate(sentDay.value)}.`,
					});
				}
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

	const isMaintenance = computed(() => props.maintenance.type === 'MAINTENANCE');

	/**
	 * Phiếu bảo dưỡng chỉ có Xong hoặc Huỷ.
	 *
	 * "Không sửa được" là kết quả của việc sửa chữa; gửi nó cho phiếu bảo dưỡng thì BE trả
	 * 400 `ASSET_MAINTENANCE_OUTCOME_INVALID`, nên bỏ hẳn lựa chọn đó khỏi danh sách.
	 */
	const outcomeOptions = computed(() =>
		isMaintenance.value
			? [
					{ value: 'DONE', label: 'Xong' },
					{ value: 'CANCELLED', label: 'Huỷ phiếu' },
				]
			: [
					{ value: 'DONE', label: 'Xong' },
					{ value: 'UNREPAIRABLE', label: 'Không sửa được' },
					{ value: 'CANCELLED', label: 'Huỷ phiếu' },
				],
	);

	/** Nói trước tài sản sẽ về trạng thái nào, theo bảng vòng đời ở bridge doc mục 7. */
	const outcomeHint = computed(() => {
		if (values.outcome === 'UNREPAIRABLE') return 'Tài sản sẽ chuyển sang trạng thái Hỏng.';
		const back = 'Tài sản sẽ về trạng thái trước đó: đang có người giữ thì Đang sử dụng, không thì Sẵn sàng.';
		return isMaintenance.value && values.outcome === 'DONE'
			? `${back} Hạn bảo dưỡng kế tiếp được tính từ ngày xong cộng chu kỳ.`
			: back;
	});

	useEscapeKey(
		() => emit('close'),
		() => !isSubmitting.value,
	);

	const onSubmit = handleSubmit(async v => {
		const code = props.maintenance.asset.code;
		const ticket = isMaintenance.value ? 'phiếu bảo dưỡng' : 'phiếu sửa';
		try {
			const closed = await service.closeMaintenance(props.maintenance.id, {
				outcome: v.outcome as 'DONE' | 'UNREPAIRABLE' | 'CANCELLED',
				workDone: v.workDone || undefined,
				cost: toAssetNumber(v.cost),
				doneAt: v.doneAt || undefined,
			});
			if (v.outcome === 'CANCELLED') {
				toast.success(`Đã huỷ ${ticket} của ${code}, tài sản về trạng thái trước khi mở phiếu.`);
			} else if (v.outcome === 'UNREPAIRABLE') {
				toast.success(`Đã đóng ${ticket} của ${code} với kết quả Không sửa được, tài sản chuyển sang Hỏng.`);
			} else if (isMaintenance.value) {
				toast.success(`Đã đóng ${ticket} của ${code}. Hạn bảo dưỡng kế tiếp được tính lại từ ngày xong.`);
			} else {
				toast.success(`Đã đóng ${ticket} của ${code} với kết quả Xong. Người đang giữ sẽ nhận được thông báo.`);
			}
			emit('closed', closed);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa đóng được phiếu. Bạn thử lại sau ít phút.');
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
							{{ isMaintenance ? 'Đóng phiếu bảo dưỡng' : 'Đóng phiếu sửa' }}
						</h2>
						<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
							{{ maintenance.asset.code }} · {{ maintenance.asset.name }}
						</p>
					</div>
					<button
						type="button"
						class="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
						aria-label="Đóng hộp đóng phiếu"
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
						<p class="text-xs text-gray-500 dark:text-gray-400">
							Trưởng phòng và người giữ tài sản đọc được ô này, nên bạn ghi tiền ở ô Chi phí thực tế thay vì ở
							đây.
						</p>
					</div>

					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div class="space-y-1">
							<label :class="labelCls">Chi phí thực tế</label>
							<input v-model="cost" v-bind="costAttrs" type="number" min="0" step="any" :class="inputCls" />
						</div>
						<div class="space-y-1">
							<label :class="labelCls">Ngày xong</label>
							<UiDatePicker
								v-model="doneAt"
								v-bind="doneAtAttrs"
								:min="sentDay || undefined"
								:max="todayYmd()"
								:error="errors.doneAt"
							/>
							<!-- Câu lỗi do chính UiDatePicker hiện qua `:error`, ở đây chỉ còn câu gợi ý. -->
							<p v-if="!errors.doneAt" class="text-xs text-gray-500 dark:text-gray-400">
								<template v-if="sentDay">Từ ngày gửi đi {{ formatDate(sentDay) }} tới hôm nay.</template>
								<template v-else>Không chọn được ngày sau hôm nay.</template>
							</p>
						</div>
					</div>

					<div class="flex justify-end gap-3 pt-2">
						<CommonAppButton variant="secondary" type="button" @click="emit('close')">Đóng</CommonAppButton>
						<CommonAppButton variant="primary" type="submit" :loading="isSubmitting">Đóng phiếu</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
