<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { useKpiService } from '~/services/kpi.service';
	import type { KpiGradeScale, KpiPeriodDetail } from '~/types/kpi.types';
	import { kpiNum, kpiPeriodStartError } from '~/utils/kpi.utils';
	import { formatDate } from '~/utils/date';
	import { taskErrorInfo, vnToday } from '~/utils/tasks.utils';

	/**
	 * Mở kỳ đánh giá (F-22): tháng bắt đầu ngày 1, quý ngày 1 tháng 1, 4, 7, 10. Thang bỏ trống thì máy chủ lấy
	 * thang có ngày áp dụng gần nhất. Mở xong máy chủ trả chi tiết kỳ kèm danh sách "chưa có phiếu".
	 */
	const props = defineProps<{ scales: KpiGradeScale[] }>();
	const emit = defineEmits<{ close: []; opened: [period: KpiPeriodDetail] }>();

	const service = useKpiService();
	const toast = useToast();
	const firstOfMonth = `${vnToday().slice(0, 8)}01`;

	const schema = toTypedSchema(
		z
			.object({
				type: z.enum(['MONTH', 'QUARTER']),
				startDate: z.string({ required_error: 'Chọn ngày đầu kỳ' }).min(1, 'Chọn ngày đầu kỳ'),
				gradeScaleId: z.string(),
				feedbackDays: z.number({ required_error: 'Nhập số ngày' }).int('Số ngày là số nguyên').min(1, 'Ít nhất 1 ngày').max(30, 'Tối đa 30 ngày'),
			})
			.superRefine((v, ctx) => {
				const msg = kpiPeriodStartError(v.type, v.startDate);
				if (msg) ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg, path: ['startDate'] });
			}),
	);
	const { defineField, errors, handleSubmit, isSubmitting } = useForm({
		validationSchema: schema,
		initialValues: { type: 'MONTH' as 'MONTH' | 'QUARTER', startDate: firstOfMonth, gradeScaleId: '', feedbackDays: 3 },
	});
	const [type] = defineField('type');
	const [startDate] = defineField('startDate');
	const [gradeScaleId] = defineField('gradeScaleId');
	const [feedbackDays] = defineField('feedbackDays');
	const serverError = ref('');

	const scaleOptions = computed(() => [
		{ value: '', label: 'Thang áp dụng mới nhất' },
		...props.scales.map(s => ({
			value: String(s.id),
			label: `Từ ${s.effectiveFrom <= '2000-12-31' ? 'đầu' : formatDate(s.effectiveFrom)}: ${s.grades.map(g => `${g.label} ${kpiNum(g.minScore)}`).join(', ')}`,
		})),
	]);

	const onSubmit = handleSubmit(async v => {
		serverError.value = '';
		try {
			const period = await service.openPeriod({
				type: v.type,
				startDate: v.startDate,
				gradeScaleId: v.gradeScaleId ? Number(v.gradeScaleId) : undefined,
				feedbackDays: v.feedbackDays,
			});
			toast.success(`Đã mở ${period.name}, tạo ${period.total} phiếu`);
			emit('opened', period);
		} catch (err) {
			const info = taskErrorInfo(err, 'Chưa mở được kỳ.');
			serverError.value = info.message;
			toast.error(info.message);
		}
	});
	useEscapeKey(() => emit('close'), () => !isSubmitting.value);
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" @click.self="emit('close')">
			<form
				class="w-full max-w-md rounded-t-2xl bg-white shadow-xl sm:rounded-2xl dark:bg-gray-900"
				role="dialog"
				aria-modal="true"
				aria-label="Mở kỳ đánh giá"
				data-testid="kpi-open-period-form"
				@submit.prevent="onSubmit"
			>
				<div class="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Mở kỳ đánh giá</h2>
					<button type="button" class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Đóng" @click="emit('close')">
						<Icon name="heroicons:x-mark" class="h-5 w-5" />
					</button>
				</div>
				<div class="space-y-4 px-5 py-4">
					<UiSelect v-model="type" label="Loại kỳ" :options="[{ value: 'MONTH', label: 'Tháng' }, { value: 'QUARTER', label: 'Quý' }]" data-testid="kpi-period-type" />
					<UiDatePicker v-model="startDate" label="Ngày đầu kỳ *" :error="errors.startDate" data-testid="kpi-period-start" />
					<p class="-mt-2 text-xs text-gray-500">Tháng bắt đầu ngày 1. Quý bắt đầu ngày 1 tháng 1, 4, 7 hoặc 10. Kết quả năm tự tính từ các kỳ đã công bố.</p>
					<UiSelect v-model="gradeScaleId" label="Thang xếp loại" :options="scaleOptions" />
					<UiNumberInput v-model="feedbackDays" label="Số ngày nhân viên được phản hồi" :error="errors.feedbackDays" />
					<p v-if="serverError" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300" role="alert" data-testid="kpi-open-period-error">{{ serverError }}</p>
				</div>
				<div class="flex justify-end gap-3 border-t border-gray-200 px-5 py-3 dark:border-gray-700">
					<CommonAppButton variant="secondary" :disabled="isSubmitting" @click="emit('close')">Huỷ</CommonAppButton>
					<CommonAppButton type="submit" :loading="isSubmitting" data-testid="kpi-open-period-save">Mở kỳ</CommonAppButton>
				</div>
			</form>
		</div>
	</Teleport>
</template>
