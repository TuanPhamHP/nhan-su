<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { useKpiService } from '~/services/kpi.service';
	import type { KpiBand, KpiDirection, KpiIndicator, UpdateKpiIndicatorBody } from '~/types/kpi.types';
	import { KPI_DIRECTION_LABELS, KPI_HINTS } from '~/utils/kpi.utils';
	import { taskErrorInfo } from '~/utils/tasks.utils';

	/**
	 * Thêm, sửa một chỉ tiêu (F-20, bridge mục 5). Chỉ tạo được chỉ tiêu nhập tay. Chỉ tiêu tự động chỉ đổi mức
	 * trần, sàn, bảng mốc và bật tắt: tên, đơn vị, kiểu khoá sẵn kèm câu giải thích (máy chủ cũng chặn bằng
	 * `KPI_INDICATOR_AUTO_LOCKED`). Lỗi nghiệp vụ (tên trùng, sàn không nhỏ hơn trần, thiếu mốc) hiện câu của
	 * máy chủ.
	 */
	const props = defineProps<{ indicator?: KpiIndicator | null }>();
	const emit = defineEmits<{ close: []; saved: [indicator: KpiIndicator] }>();

	const service = useKpiService();
	const toast = useToast();
	const isAuto = computed(() => props.indicator?.source === 'AUTO');

	const schema = toTypedSchema(
		z.object({
			name: z.string({ required_error: 'Nhập tên chỉ tiêu' }).trim().min(1, 'Nhập tên chỉ tiêu').max(150, 'Tên tối đa 150 ký tự'),
			unit: z.string({ required_error: 'Nhập đơn vị' }).trim().min(1, 'Nhập đơn vị, ví dụ %, điểm, việc').max(30, 'Đơn vị tối đa 30 ký tự'),
			direction: z.enum(['HIGHER', 'LOWER', 'PASS_FAIL', 'BANDS']),
			manualScale: z.boolean(),
			capPercent: z.number().min(0, 'Mức trần không âm').max(1000, 'Mức trần tối đa 1000%').optional(),
			floorPercent: z.number().min(0, 'Mức sàn không âm').max(1000, 'Mức sàn tối đa 1000%').optional(),
		}),
	);
	const { defineField, errors, handleSubmit, isSubmitting } = useForm({
		validationSchema: schema,
		initialValues: {
			name: props.indicator?.name ?? '',
			unit: props.indicator?.unit ?? (props.indicator ? '' : 'điểm'),
			direction: (props.indicator?.direction ?? 'HIGHER') as KpiDirection,
			manualScale: props.indicator?.manualScale ?? false,
			capPercent: props.indicator?.capPercent ?? undefined,
			floorPercent: props.indicator?.floorPercent ?? undefined,
		},
	});
	const [name] = defineField('name');
	const [unit] = defineField('unit');
	const [direction] = defineField('direction');
	const [manualScale] = defineField('manualScale');
	const [capPercent] = defineField('capPercent');
	const [floorPercent] = defineField('floorPercent');

	const bands = ref<Array<{ upTo: number | undefined; percent: number | undefined }>>(
		(props.indicator?.bands ?? [
			{ upTo: 10, percent: 100 },
			{ upTo: 20, percent: 80 },
			{ upTo: null, percent: 0 },
		]).map(b => ({ upTo: b.upTo ?? undefined, percent: b.percent })),
	);
	const bandError = ref('');
	const serverError = ref('');
	const isActive = ref(props.indicator?.isActive ?? true);

	const directionOptions = (Object.keys(KPI_DIRECTION_LABELS) as KpiDirection[]).map(k => ({ value: k, label: KPI_DIRECTION_LABELS[k] }));
	const usesRatio = computed(() => direction.value === 'HIGHER' || direction.value === 'LOWER');
	watch(direction, d => {
		if (d !== 'HIGHER') manualScale.value = false;
	});
	watch(manualScale, m => {
		if (m) unit.value = 'điểm';
	});

	function addBand() {
		bands.value.splice(Math.max(bands.value.length - 1, 0), 0, { upTo: undefined, percent: undefined });
	}

	function buildBands(): KpiBand[] | null {
		bandError.value = '';
		const out: KpiBand[] = [];
		for (const [i, b] of bands.value.entries()) {
			const last = i === bands.value.length - 1;
			if (b.percent == null) {
				bandError.value = 'Mỗi mốc cần tỷ lệ hoàn thành';
				return null;
			}
			if (!last && b.upTo == null) {
				bandError.value = 'Mỗi mốc (trừ mốc cuối) cần giá trị "tới"';
				return null;
			}
			out.push({ upTo: last ? null : (b.upTo as number), percent: b.percent });
		}
		return out;
	}

	const onSubmit = handleSubmit(async v => {
		serverError.value = '';
		let body: UpdateKpiIndicatorBody;
		if (isAuto.value) {
			body = { isActive: isActive.value };
			if (v.direction === 'BANDS') {
				const b = buildBands();
				if (!b) return;
				body.bands = b;
			} else {
				body.capPercent = v.capPercent ?? null;
				body.floorPercent = v.floorPercent ?? null;
			}
		} else {
			body = { name: v.name.trim(), unit: v.unit.trim(), direction: v.direction, manualScale: v.manualScale };
			if (v.direction === 'BANDS') {
				const b = buildBands();
				if (!b) return;
				body.bands = b;
			} else if (usesRatio.value) {
				body.capPercent = v.capPercent ?? null;
				body.floorPercent = v.floorPercent ?? null;
			}
			if (props.indicator) body.isActive = isActive.value;
		}
		try {
			const saved = props.indicator
				? await service.updateIndicator(props.indicator.id, body)
				: await service.createIndicator({ ...body, name: v.name.trim(), unit: v.unit.trim(), direction: v.direction });
			toast.success(props.indicator ? `Đã lưu ${saved.name}` : `Đã thêm chỉ tiêu ${saved.name}`);
			emit('saved', saved);
		} catch (err) {
			const info = taskErrorInfo(err, 'Chưa lưu được chỉ tiêu.');
			serverError.value = info.message;
			toast.error(info.message);
		}
	});
	useEscapeKey(() => emit('close'), () => !isSubmitting.value);
	const INPUT = 'mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-100 disabled:text-gray-500 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-800/60';
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" @click.self="emit('close')">
			<form
				class="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl dark:bg-gray-900"
				role="dialog"
				aria-modal="true"
				:aria-label="indicator ? 'Sửa chỉ tiêu' : 'Thêm chỉ tiêu'"
				data-testid="kpi-indicator-form"
				@submit.prevent="onSubmit"
			>
				<div class="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ indicator ? `Sửa ${indicator.name}` : 'Thêm chỉ tiêu nhập tay' }}</h2>
					<button type="button" class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Đóng" @click="emit('close')">
						<Icon name="heroicons:x-mark" class="h-5 w-5" />
					</button>
				</div>
				<div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
					<p v-if="isAuto" class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200" data-testid="kpi-indicator-auto-note">
						Đây là chỉ tiêu tự động, hệ thống đếm từ công việc và chấm công. Tên, đơn vị và kiểu không đổi được. Bạn chỉ đổi mức trần, mức sàn, bảng mốc hoặc tắt chỉ tiêu.
					</p>
					<div>
						<label for="kpi-ind-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Tên chỉ tiêu <span class="text-red-500">*</span></label>
						<input id="kpi-ind-name" v-model="name" type="text" maxlength="150" :disabled="isAuto" placeholder="Ví dụ Chuyên môn" :class="[INPUT, errors.name ? 'border-rose-500' : 'border-gray-300 dark:border-gray-600']" />
						<p v-if="errors.name" class="mt-1 text-xs text-rose-600">{{ errors.name }}</p>
					</div>
					<div class="grid gap-4 sm:grid-cols-2">
						<UiSelect v-model="direction" label="Kiểu tính" :options="directionOptions" :disabled="isAuto" data-testid="kpi-ind-direction" />
						<div>
							<label for="kpi-ind-unit" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Đơn vị <span class="text-red-500">*</span></label>
							<input id="kpi-ind-unit" v-model="unit" type="text" maxlength="30" :disabled="isAuto || manualScale" placeholder="%, điểm, việc" :class="[INPUT, errors.unit ? 'border-rose-500' : 'border-gray-300 dark:border-gray-600']" />
							<p v-if="errors.unit" class="mt-1 text-xs text-rose-600">{{ errors.unit }}</p>
						</div>
					</div>
					<label v-if="direction === 'HIGHER'" class="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
						<input v-model="manualScale" type="checkbox" :disabled="isAuto" class="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" data-testid="kpi-ind-scale" />
						<span>Chấm 1–5 bằng năm nút<span class="block text-xs text-gray-500">{{ KPI_HINTS.manualScale }}</span></span>
					</label>
					<div v-if="usesRatio" class="grid gap-4 sm:grid-cols-2">
						<UiNumberInput v-model="capPercent" :decimals="2" label="Mức trần (%)" :hint="KPI_HINTS.cap" :error="errors.capPercent" placeholder="120" />
						<UiNumberInput v-model="floorPercent" :decimals="2" label="Mức sàn (%)" :hint="KPI_HINTS.floor" :error="errors.floorPercent" placeholder="Không có" />
					</div>
					<div v-if="direction === 'BANDS'" class="space-y-2">
						<p class="text-sm font-medium text-gray-700 dark:text-gray-300">Bảng mốc</p>
						<p class="text-xs text-gray-500">Kết quả tới mức nào thì tỷ lệ hoàn thành bao nhiêu. Mốc cuối dành cho mọi kết quả lớn hơn.</p>
						<div v-for="(b, i) in bands" :key="i" class="flex items-end gap-2">
							<div class="flex-1">
								<UiNumberInput v-if="i < bands.length - 1" v-model="b.upTo" :decimals="2" :label="i === 0 ? `Kết quả tới (${unit || 'số'})` : undefined" />
								<p v-else class="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500 dark:bg-gray-800">Trên mọi mốc</p>
							</div>
							<div class="flex-1">
								<UiNumberInput v-model="b.percent" :decimals="2" :label="i === 0 ? 'Tỷ lệ hoàn thành (%)' : undefined" />
							</div>
							<button
								v-if="bands.length > 2 && i < bands.length - 1"
								type="button"
								class="mb-1 rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-rose-600 dark:hover:bg-gray-800"
								aria-label="Bỏ mốc"
								@click="bands.splice(i, 1)"
							>
								<Icon name="heroicons:trash" class="h-4 w-4" />
							</button>
						</div>
						<button type="button" class="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300" @click="addBand">+ Thêm mốc</button>
						<p v-if="bandError" class="text-xs text-rose-600">{{ bandError }}</p>
					</div>
					<label v-if="indicator" class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
						<input v-model="isActive" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
						Đang dùng (tắt thì không chọn được khi làm mẫu mới)
					</label>
					<p v-if="serverError" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300" role="alert" data-testid="kpi-indicator-error">{{ serverError }}</p>
				</div>
				<div class="flex justify-end gap-3 border-t border-gray-200 px-5 py-3 dark:border-gray-700">
					<CommonAppButton variant="secondary" :disabled="isSubmitting" @click="emit('close')">Huỷ</CommonAppButton>
					<CommonAppButton type="submit" :loading="isSubmitting" data-testid="kpi-indicator-save">{{ indicator ? 'Lưu' : 'Thêm chỉ tiêu' }}</CommonAppButton>
				</div>
			</form>
		</div>
	</Teleport>
</template>
