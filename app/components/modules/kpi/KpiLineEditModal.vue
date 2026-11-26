<script setup lang="ts">
	import { useKpiService } from '~/services/kpi.service';
	import type { KpiReviewDetail, KpiReviewLine, UpdateKpiLineBody } from '~/types/kpi.types';
	import { kpiValueText } from '~/utils/kpi.utils';
	import { taskErrorInfo } from '~/utils/tasks.utils';

	/**
	 * Sửa một dòng phiếu (F-25, S-21, bridge mục 6).
	 * - `adjust`: chỉnh số tự động. Số gốc chỉ đọc, ô số mới, ô lý do. Số mới khác số gốc thì máy chủ đòi lý
	 *   do (`KPI_ADJUST_REASON_REQUIRED`); câu lỗi hiện ngay dưới ô lý do. Có nút "Về số hệ thống".
	 * - `value`: nhập kết quả cho chỉ tiêu nhập tay không chấm 1–5.
	 * - `note`: chỉ ghi chú của dòng.
	 * Mọi kiểu đều có ô ghi chú. Lưu xong máy chủ trả phiếu mới, nơi gọi thay thẳng.
	 */
	const props = defineProps<{ reviewId: number; line: KpiReviewLine; mode: 'adjust' | 'value' | 'note' }>();
	const emit = defineEmits<{ close: []; saved: [review: KpiReviewDetail] }>();

	const service = useKpiService();
	const toast = useToast();

	const value = ref<number | undefined>(props.line.value ?? props.line.autoValue ?? undefined);
	const reason = ref(props.line.adjustReason ?? '');
	const note = ref(props.line.reviewerNote ?? '');
	const saving = ref(false);
	const reasonError = ref('');
	const valueError = ref('');

	const title = computed(() => (props.mode === 'adjust' ? 'Chỉnh số tự động' : props.mode === 'value' ? 'Nhập kết quả' : 'Ghi chú cho chỉ tiêu'));
	const changed = computed(() => props.mode === 'adjust' && value.value != null && value.value !== props.line.autoValue);

	async function send(body: UpdateKpiLineBody, okText: string) {
		saving.value = true;
		reasonError.value = '';
		valueError.value = '';
		try {
			const review = await service.updateLine(props.reviewId, props.line.id, body);
			toast.success(okText);
			emit('saved', review);
		} catch (err) {
			const info = taskErrorInfo(err, 'Chưa lưu được dòng này.');
			if (info.code === 'KPI_ADJUST_REASON_REQUIRED') reasonError.value = info.message;
			else if (info.code === 'KPI_LINE_VALUE_INVALID') valueError.value = info.message;
			toast.error(info.message);
		} finally {
			saving.value = false;
		}
	}

	function save() {
		const n = note.value.trim();
		const noteChanged = n !== (props.line.reviewerNote ?? '');
		const body: UpdateKpiLineBody = {};
		if (props.mode !== 'note') {
			body.value = value.value ?? null;
			if (props.mode === 'adjust' && reason.value.trim()) body.reason = reason.value.trim();
		}
		if (noteChanged || props.mode === 'note') body.note = n || null;
		send(body, props.mode === 'note' ? 'Đã lưu ghi chú' : 'Đã lưu kết quả');
	}

	function resetToAuto() {
		send({ resetToAuto: true }, 'Đã dùng lại số hệ thống tính');
	}

	useEscapeKey(() => emit('close'), () => !saving.value);
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[65] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" @click.self="emit('close')">
			<form
				class="w-full max-w-md rounded-t-2xl bg-white shadow-xl sm:rounded-2xl dark:bg-gray-900"
				role="dialog"
				aria-modal="true"
				:aria-label="title"
				data-testid="kpi-line-edit"
				@submit.prevent="save"
			>
				<div class="flex items-start justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
					<div>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ title }}</h2>
						<p class="text-sm text-gray-500">{{ line.name }}</p>
					</div>
					<button type="button" class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Đóng" @click="emit('close')">
						<Icon name="heroicons:x-mark" class="h-5 w-5" />
					</button>
				</div>
				<div class="space-y-4 px-5 py-4">
					<template v-if="mode === 'adjust'">
						<div class="rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800">
							<span class="text-gray-500">Số hệ thống tính:</span>
							<b class="ml-1 text-gray-900 dark:text-gray-100" data-testid="kpi-line-auto">{{ kpiValueText(line, line.autoValue) }}</b>
						</div>
						<UiNumberInput v-model="value" :decimals="2" :label="`Số mới (${line.unit || 'số'})`" :error="valueError" data-testid="kpi-line-value" />
						<div>
							<label for="kpi-adjust-reason" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Lý do chỉnh<span v-if="changed" class="text-red-500"> *</span>
							</label>
							<textarea
								id="kpi-adjust-reason"
								v-model="reason"
								rows="2"
								maxlength="500"
								placeholder="Ví dụ: hai việc trễ do khách hàng đổi yêu cầu"
								class="mt-1 w-full resize-none rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:text-gray-100"
								:class="reasonError ? 'border-rose-500' : 'border-gray-300 dark:border-gray-600'"
								data-testid="kpi-line-reason"
							/>
							<p v-if="reasonError" class="mt-1 text-xs text-rose-600" data-testid="kpi-line-reason-error">{{ reasonError }}</p>
							<p v-else class="mt-1 text-xs text-gray-500">Nhân viên và nhân sự đều thấy số gốc, số mới và lý do.</p>
						</div>
					</template>
					<UiNumberInput
						v-else-if="mode === 'value'"
						v-model="value"
						:decimals="2"
						:label="`Kết quả (${line.unit || 'số'})`"
						:error="valueError"
						data-testid="kpi-line-value"
					/>
					<div>
						<label for="kpi-line-note" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Ghi chú của người chấm</label>
						<textarea
							id="kpi-line-note"
							v-model="note"
							rows="2"
							maxlength="1000"
							placeholder="Nhân viên đọc được ghi chú này"
							class="mt-1 w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							data-testid="kpi-line-note"
						/>
					</div>
				</div>
				<div class="flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 px-5 py-3 dark:border-gray-700">
					<CommonAppButton
						v-if="mode === 'adjust' && line.adjusted"
						variant="ghost"
						class="mr-auto"
						:disabled="saving"
						data-testid="kpi-line-reset"
						@click="resetToAuto"
					>
						Về số hệ thống
					</CommonAppButton>
					<CommonAppButton variant="secondary" :disabled="saving" @click="emit('close')">Huỷ</CommonAppButton>
					<CommonAppButton type="submit" :loading="saving" data-testid="kpi-line-save">Lưu</CommonAppButton>
				</div>
			</form>
		</div>
	</Teleport>
</template>
