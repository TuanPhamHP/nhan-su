<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { useKpiService } from '~/services/kpi.service';
	import { useDirectoryStore } from '~/stores/directory';
	import type { KpiIndicator, KpiTemplate } from '~/types/kpi.types';
	import { KPI_HINTS, kpiWeightText } from '~/utils/kpi.utils';
	import { taskErrorInfo } from '~/utils/tasks.utils';

	/**
	 * Thêm, sửa mẫu đánh giá (F-21, S-23). Tổng trọng số hiện ngay dưới bảng ("còn thiếu 5%"); máy chủ vẫn chặn
	 * khi khác 100 (`KPI_WEIGHT_NOT_100`) và câu đó hiện nguyên. Mẫu đã có phiếu thì lưu là tạo phiên bản mới,
	 * phiếu cũ giữ phiên bản cũ (BR-28).
	 */
	const props = defineProps<{ template?: KpiTemplate | null; indicators: KpiIndicator[] }>();
	const emit = defineEmits<{ close: []; saved: [template: KpiTemplate, newVersion: boolean] }>();

	const service = useKpiService();
	const toast = useToast();
	const directoryStore = useDirectoryStore();
	onMounted(() => directoryStore.load().catch(() => toast.error('Chưa tải được danh sách phòng, vị trí')));

	const schema = toTypedSchema(
		z.object({
			name: z.string({ required_error: 'Nhập tên mẫu' }).trim().min(1, 'Nhập tên mẫu').max(150, 'Tên tối đa 150 ký tự'),
			departmentId: z.string(),
			positionId: z.string(),
			regulationNo: z.string().max(100, 'Số quy chế tối đa 100 ký tự'),
			regulationDate: z.string().optional(),
		}),
	);
	const { defineField, errors, handleSubmit, isSubmitting } = useForm({
		validationSchema: schema,
		initialValues: {
			name: props.template?.name ?? '',
			departmentId: props.template?.department ? String(props.template.department.id) : '',
			positionId: props.template?.position ? String(props.template.position.id) : '',
			regulationNo: props.template?.regulationNo ?? '',
			regulationDate: props.template?.regulationDate ?? undefined,
		},
	});
	const [name] = defineField('name');
	const [departmentId] = defineField('departmentId');
	const [positionId] = defineField('positionId');
	const [regulationNo] = defineField('regulationNo');
	const [regulationDate] = defineField('regulationDate');

	type Row = { indicatorId: string; target: number | undefined; weight: number | undefined };
	const rows = ref<Row[]>(
		props.template?.items.map(i => ({ indicatorId: String(i.indicator.id), target: i.target, weight: i.weight })) ?? [{ indicatorId: '', target: undefined, weight: undefined }],
	);
	const rowError = ref('');
	const serverError = ref('');

	const activeIndicators = computed(() => props.indicators.filter(i => i.isActive || rows.value.some(r => r.indicatorId === String(i.id))));
	function optionsFor(row: Row) {
		const used = new Set(rows.value.filter(r => r !== row).map(r => r.indicatorId));
		return activeIndicators.value.filter(i => !used.has(String(i.id))).map(i => ({ value: String(i.id), label: `${i.name} (${i.unit})` }));
	}
	function indicatorOf(row: Row) {
		return props.indicators.find(i => String(i.id) === row.indicatorId) ?? null;
	}
	const weightSum = computed(() => rows.value.reduce((n, r) => n + (r.weight ?? 0), 0));
	const weightState = computed(() => kpiWeightText(weightSum.value));

	const deptOptions = computed(() => [{ value: '', label: 'Không gắn phòng' }, ...directoryStore.departments.map(d => ({ value: String(d.id), label: d.name }))]);
	const posOptions = computed(() => [{ value: '', label: 'Không gắn vị trí' }, ...directoryStore.positions.map(p => ({ value: String(p.id), label: p.name }))]);
	const willVersion = computed(() => !!props.template && props.template.reviewCount > 0);

	const onSubmit = handleSubmit(async v => {
		rowError.value = '';
		serverError.value = '';
		const items = [];
		for (const r of rows.value) {
			if (!r.indicatorId) {
				rowError.value = 'Chọn chỉ tiêu cho mọi dòng, hoặc bỏ dòng trống';
				return;
			}
			if (r.target == null || r.weight == null) {
				rowError.value = 'Mỗi dòng cần mức giao và trọng số';
				return;
			}
			items.push({ indicatorId: Number(r.indicatorId), target: r.target, weight: r.weight });
		}
		if (!items.length) {
			rowError.value = 'Mẫu cần ít nhất một chỉ tiêu';
			return;
		}
		const body = {
			name: v.name.trim(),
			departmentId: v.departmentId ? Number(v.departmentId) : null,
			positionId: v.positionId ? Number(v.positionId) : null,
			regulationNo: v.regulationNo.trim() || undefined,
			regulationDate: v.regulationDate || undefined,
			items,
		};
		try {
			const saved = props.template ? await service.updateTemplate(props.template.id, body) : await service.createTemplate(body);
			const newVersion = !!props.template && saved.id !== props.template.id;
			toast.success(newVersion ? `Đã tạo phiên bản ${saved.version} của mẫu ${saved.name}` : props.template ? `Đã lưu mẫu ${saved.name}` : `Đã thêm mẫu ${saved.name}`);
			emit('saved', saved, newVersion);
		} catch (err) {
			const info = taskErrorInfo(err, 'Chưa lưu được mẫu.');
			serverError.value = info.message;
			toast.error(info.message);
		}
	});
	useEscapeKey(() => emit('close'), () => !isSubmitting.value);
	const INPUT = 'mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:text-gray-100';
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" @click.self="emit('close')">
			<form
				class="flex max-h-[94vh] w-full max-w-3xl flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl dark:bg-gray-900"
				role="dialog"
				aria-modal="true"
				:aria-label="template ? 'Sửa mẫu đánh giá' : 'Thêm mẫu đánh giá'"
				data-testid="kpi-template-form"
				@submit.prevent="onSubmit"
			>
				<div class="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ template ? `Sửa mẫu ${template.name}` : 'Thêm mẫu đánh giá' }}</h2>
					<button type="button" class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Đóng" @click="emit('close')">
						<Icon name="heroicons:x-mark" class="h-5 w-5" />
					</button>
				</div>
				<div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
					<p v-if="willVersion" class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200" data-testid="kpi-template-version-note">
						Mẫu này đã dùng cho {{ template!.reviewCount }} phiếu. Lưu sẽ tạo phiên bản {{ template!.version + 1 }}, phiếu đã có giữ nguyên phiên bản {{ template!.version }}.
					</p>
					<p class="text-xs text-gray-500">{{ KPI_HINTS.template }} Mẫu của một người chọn theo vị trí trước, rồi theo phòng, cuối cùng là mẫu chung.</p>
					<div>
						<label for="kpi-tpl-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Tên mẫu <span class="text-red-500">*</span></label>
						<input id="kpi-tpl-name" v-model="name" type="text" maxlength="150" placeholder="Ví dụ Kế toán" :class="[INPUT, errors.name ? 'border-rose-500' : 'border-gray-300 dark:border-gray-600']" />
						<p v-if="errors.name" class="mt-1 text-xs text-rose-600">{{ errors.name }}</p>
					</div>
					<div class="grid gap-4 sm:grid-cols-2">
						<UiSelect v-model="departmentId" label="Phòng" :options="deptOptions" searchable data-testid="kpi-tpl-dept" />
						<UiSelect v-model="positionId" label="Vị trí" :options="posOptions" searchable data-testid="kpi-tpl-position" />
					</div>
					<div class="grid gap-4 sm:grid-cols-2">
						<div>
							<label for="kpi-tpl-reg" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Số quy chế</label>
							<input id="kpi-tpl-reg" v-model="regulationNo" type="text" maxlength="100" placeholder="Ví dụ 12/QĐ-NS" :class="[INPUT, 'border-gray-300 dark:border-gray-600']" />
						</div>
						<UiDatePicker v-model="regulationDate" label="Ngày quy chế" />
					</div>

					<div class="space-y-2">
						<p class="text-sm font-medium text-gray-700 dark:text-gray-300">Chỉ tiêu, mức giao, trọng số</p>
						<div v-for="(r, i) in rows" :key="i" class="grid grid-cols-[minmax(0,1fr)_6rem_5.5rem_auto] items-end gap-2" :data-testid="`kpi-tpl-row-${i}`">
							<UiSelect v-model="r.indicatorId" :label="i === 0 ? 'Chỉ tiêu' : undefined" :options="optionsFor(r)" searchable placeholder="Chọn chỉ tiêu" />
							<UiNumberInput
								v-model="r.target"
								:decimals="2"
								:label="i === 0 ? 'Mức giao' : undefined"
								:placeholder="indicatorOf(r)?.manualScale ? '1–5' : indicatorOf(r)?.unit ?? ''"
							/>
							<UiNumberInput v-model="r.weight" :decimals="2" :label="i === 0 ? 'Trọng số %' : undefined" />
							<button
								type="button"
								class="mb-1 rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-rose-600 disabled:opacity-30 dark:hover:bg-gray-800"
								aria-label="Bỏ dòng"
								:disabled="rows.length < 2"
								@click="rows.splice(i, 1)"
							>
								<Icon name="heroicons:trash" class="h-4 w-4" />
							</button>
						</div>
						<div class="flex flex-wrap items-center justify-between gap-2">
							<button type="button" class="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300" data-testid="kpi-tpl-add-row" @click="rows.push({ indicatorId: '', target: undefined, weight: undefined })">
								+ Thêm chỉ tiêu
							</button>
							<p
								class="rounded-full px-2.5 py-1 text-xs font-semibold"
								:class="weightState.ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'"
								aria-live="polite"
								data-testid="kpi-tpl-weight"
							>
								{{ weightState.text }}
							</p>
						</div>
						<p v-if="rowError" class="text-xs text-rose-600">{{ rowError }}</p>
					</div>
					<p v-if="serverError" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300" role="alert" data-testid="kpi-template-error">{{ serverError }}</p>
				</div>
				<div class="flex justify-end gap-3 border-t border-gray-200 px-5 py-3 dark:border-gray-700">
					<CommonAppButton variant="secondary" :disabled="isSubmitting" @click="emit('close')">Huỷ</CommonAppButton>
					<CommonAppButton type="submit" :loading="isSubmitting" data-testid="kpi-template-save">{{ willVersion ? 'Lưu thành phiên bản mới' : template ? 'Lưu' : 'Thêm mẫu' }}</CommonAppButton>
				</div>
			</form>
		</div>
	</Teleport>
</template>
