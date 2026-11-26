<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { useKpiService } from '~/services/kpi.service';
	import type { KpiGradeScale } from '~/types/kpi.types';
	import { taskErrorInfo, vnToday } from '~/utils/tasks.utils';

	/**
	 * Thêm thang xếp loại (F-27, T-18): ngày áp dụng và các mức từ cao xuống thấp, mức cuối từ 0. Thang mới chỉ
	 * dùng cho kỳ mở sau ngày áp dụng; kỳ đang mở giữ thang cũ. Lỗi (trùng tên, trùng ngưỡng, thiếu mức 0) hiện
	 * câu của máy chủ (`KPI_GRADE_SCALE_INVALID`).
	 */
	const props = defineProps<{ base?: KpiGradeScale | null }>();
	const emit = defineEmits<{ close: []; saved: [scale: KpiGradeScale] }>();

	const service = useKpiService();
	const toast = useToast();
	const schema = toTypedSchema(z.object({ effectiveFrom: z.string({ required_error: 'Chọn ngày áp dụng' }).min(1, 'Chọn ngày áp dụng') }));
	const { defineField, errors, handleSubmit, isSubmitting } = useForm({ validationSchema: schema, initialValues: { effectiveFrom: vnToday() } });
	const [effectiveFrom] = defineField('effectiveFrom');

	const rows = ref<Array<{ label: string; minScore: number | undefined }>>(
		(props.base?.grades ?? [
			{ label: 'A', minScore: 110 },
			{ label: 'B', minScore: 95 },
			{ label: 'C', minScore: 80 },
			{ label: 'D', minScore: 0 },
		]).map(g => ({ label: g.label, minScore: g.minScore })),
	);
	const rowError = ref('');
	const serverError = ref('');

	const onSubmit = handleSubmit(async v => {
		rowError.value = '';
		serverError.value = '';
		if (rows.value.some(r => !r.label.trim() || r.minScore == null)) {
			rowError.value = 'Mỗi mức cần tên và điểm từ';
			return;
		}
		const grades = rows.value.map(r => ({ label: r.label.trim(), minScore: r.minScore as number })).sort((a, b) => b.minScore - a.minScore);
		try {
			const saved = await service.createGradeScale({ effectiveFrom: v.effectiveFrom, grades });
			toast.success('Đã thêm thang xếp loại');
			emit('saved', saved);
		} catch (err) {
			const info = taskErrorInfo(err, 'Chưa lưu được thang.');
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
				class="flex max-h-[92vh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl dark:bg-gray-900"
				role="dialog"
				aria-modal="true"
				aria-label="Thêm thang xếp loại"
				data-testid="kpi-grade-form"
				@submit.prevent="onSubmit"
			>
				<div class="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Thêm thang xếp loại</h2>
					<button type="button" class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Đóng" @click="emit('close')">
						<Icon name="heroicons:x-mark" class="h-5 w-5" />
					</button>
				</div>
				<div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
					<UiDatePicker v-model="effectiveFrom" label="Áp dụng từ ngày *" :error="errors.effectiveFrom" />
					<p class="text-xs text-gray-500">Kỳ mở từ ngày này dùng thang mới. Kỳ đang mở vẫn giữ thang cũ.</p>
					<div class="space-y-2">
						<div v-for="(r, i) in rows" :key="i" class="grid grid-cols-[5rem_minmax(0,1fr)_auto] items-end gap-2">
							<div>
								<label v-if="i === 0" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Mức</label>
								<input
									v-model="r.label"
									type="text"
									maxlength="10"
									:aria-label="`Tên mức ${i + 1}`"
									class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
								/>
							</div>
							<UiNumberInput v-model="r.minScore" :decimals="1" :label="i === 0 ? 'Từ điểm' : undefined" />
							<button
								type="button"
								class="mb-1 rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-rose-600 disabled:opacity-30 dark:hover:bg-gray-800"
								aria-label="Bỏ mức"
								:disabled="rows.length <= 2"
								@click="rows.splice(i, 1)"
							>
								<Icon name="heroicons:trash" class="h-4 w-4" />
							</button>
						</div>
						<button type="button" class="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300" :disabled="rows.length >= 10" @click="rows.push({ label: '', minScore: undefined })">
							+ Thêm mức
						</button>
						<p v-if="rowError" class="text-xs text-rose-600">{{ rowError }}</p>
					</div>
					<p v-if="serverError" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300" role="alert" data-testid="kpi-grade-error">{{ serverError }}</p>
				</div>
				<div class="flex justify-end gap-3 border-t border-gray-200 px-5 py-3 dark:border-gray-700">
					<CommonAppButton variant="secondary" :disabled="isSubmitting" @click="emit('close')">Huỷ</CommonAppButton>
					<CommonAppButton type="submit" :loading="isSubmitting" data-testid="kpi-grade-save">Thêm thang</CommonAppButton>
				</div>
			</form>
		</div>
	</Teleport>
</template>
