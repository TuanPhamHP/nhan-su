<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import * as z from 'zod';
import { useAttendanceService } from '~/services/attendance.service';
import type { AttendanceRecordDetail } from '~/types/attendance.types';
import { formatVNDateTime } from '~/utils/attendance.utils';

const props = defineProps<{
	record: AttendanceRecordDetail;
}>();

const emit = defineEmits<{
	updated: [record: AttendanceRecordDetail];
	close: [];
}>();

const toast = useToast();
const service = useAttendanceService();

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

function toDatetimeLocal(iso: string | null): string {
	if (!iso) return '';
	// Shift UTC → VN (+7h), read with getUTC* to avoid browser-timezone double-shift.
	const d = new Date(new Date(iso).getTime() + VN_OFFSET_MS);
	const year = d.getUTCFullYear();
	const month = String(d.getUTCMonth() + 1).padStart(2, '0');
	const day = String(d.getUTCDate()).padStart(2, '0');
	const h = String(d.getUTCHours()).padStart(2, '0');
	const m = String(d.getUTCMinutes()).padStart(2, '0');
	return `${year}-${month}-${day}T${h}:${m}`;
}

function fromDatetimeLocal(val: string): string {
	if (!val) return '';
	// Treat the datetime-local string as UTC (append Z), then subtract 7h to get true UTC.
	const utcMs = Date.parse(`${val}:00.000Z`) - VN_OFFSET_MS;
	return new Date(utcMs).toISOString();
}

const schema = toTypedSchema(
	z.object({
		checkInAt: z.string().optional(),
		checkOutAt: z.string().optional(),
		note: z.string().optional(),
	}),
);

const { handleSubmit, defineField, isSubmitting } = useForm({
	validationSchema: schema,
	initialValues: {
		checkInAt: toDatetimeLocal(props.record.checkInAt),
		checkOutAt: toDatetimeLocal(props.record.checkOutAt),
		note: props.record.note ?? '',
	},
});

const [checkInAt, checkInAtAttrs] = defineField('checkInAt');
const [checkOutAt, checkOutAtAttrs] = defineField('checkOutAt');
const [note, noteAttrs] = defineField('note');

const onSubmit = handleSubmit(async values => {
	try {
		const dto = {
			...(values.checkInAt ? { checkInAt: fromDatetimeLocal(values.checkInAt) } : {}),
			...(values.checkOutAt ? { checkOutAt: fromDatetimeLocal(values.checkOutAt) } : {}),
			...(values.note ? { note: values.note } : {}),
		};
		const updated = await service.manualEdit(props.record.id, dto);
		toast.success('Đã cập nhật bản ghi chấm công');
		emit('updated', updated);
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Lỗi cập nhật bản ghi');
	}
});

function onKeydown(e: KeyboardEvent) {
	if (e.key === 'Escape') emit('close');
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
		@click.self="emit('close')"
	>
		<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700">
			<!-- Header -->
			<div class="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<div class="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
					<svg class="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
						<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 7.125L18 8.625l-8.25 8.25" />
					</svg>
				</div>
				<div class="flex-1 min-w-0">
					<h3 class="text-base font-semibold text-gray-900 dark:text-white">Chỉnh sửa thủ công</h3>
					<p class="text-xs text-gray-500 dark:text-gray-400 truncate">
						{{ props.record.employee?.fullName }} · {{ props.record.date }}
					</p>
				</div>
				<button
					class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
					@click="emit('close')"
				>
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Current values info -->
			<div class="px-6 pt-4 pb-2">
				<div class="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400">
					<span>Hiện tại:</span>
					<span>Check-in: <strong class="text-gray-700 dark:text-gray-300">{{ formatVNDateTime(props.record.checkInAt) }}</strong></span>
					<span>Check-out: <strong class="text-gray-700 dark:text-gray-300">{{ formatVNDateTime(props.record.checkOutAt) }}</strong></span>
				</div>
			</div>

			<!-- Form -->
			<form class="px-6 pb-6 pt-2 space-y-4" @submit.prevent="onSubmit">
				<div class="flex flex-col gap-1.5">
					<label class="text-sm font-medium text-gray-700 dark:text-gray-300">Giờ check-in (giờ VN)</label>
					<UiDateTimePickerV2
						v-model="checkInAt"
						v-bind="checkInAtAttrs"
						placeholder="Chọn giờ check-in"
					/>
				</div>

				<div class="flex flex-col gap-1.5">
					<label class="text-sm font-medium text-gray-700 dark:text-gray-300">Giờ check-out (giờ VN)</label>
					<UiDateTimePickerV2
						v-model="checkOutAt"
						v-bind="checkOutAtAttrs"
						placeholder="Chọn giờ check-out"
					/>
				</div>

				<div class="flex flex-col gap-1.5">
					<label class="text-sm font-medium text-gray-700 dark:text-gray-300">Ghi chú</label>
					<textarea
						v-model="note"
						v-bind="noteAttrs"
						rows="3"
						placeholder="VD: Nhân viên quên check-in, đã xác nhận qua email"
						class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors placeholder:text-gray-400"
					/>
				</div>

				<div class="flex gap-3 pt-2">
					<CommonAppButton variant="outline" class="flex-1" @click="emit('close')">Hủy</CommonAppButton>
					<CommonAppButton class="flex-1" :loading="isSubmitting" type="submit">Lưu thay đổi</CommonAppButton>
				</div>
			</form>
		</div>
	</div>
</template>
