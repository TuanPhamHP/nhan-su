<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import * as z from 'zod';
import { useMakeupAttendanceService } from '~/services/makeup-attendance.service';
import type { AttendanceRecordDetail } from '~/types/attendance.types';

const props = defineProps<{
	record: AttendanceRecordDetail;
}>();

const emit = defineEmits<{
	submitted: [];
	close: [];
}>();

const toast = useToast();
const service = useMakeupAttendanceService();
const evidencePhotoFile = ref<File | null>(null);

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

function toDatetimeLocal(iso: string | null): string {
	if (!iso) return '';
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
	const utcMs = Date.parse(`${val}:00.000Z`) - VN_OFFSET_MS;
	return new Date(utcMs).toISOString();
}

const missingLabel = computed(() => {
	if (props.record.missingType === 'MISSING_CHECKOUT') return 'Quên check-out';
	return 'Vắng cả ngày (không check-in)';
});

const schema = toTypedSchema(
	z.object({
		requestedCheckIn: z.string().optional(),
		requestedCheckOut: z.string().optional(),
		reason: z.string().min(10, 'Lý do phải có ít nhất 10 ký tự'),
	}),
);

const { handleSubmit, defineField, errors, isSubmitting } = useForm({
	validationSchema: schema,
	initialValues: {
		requestedCheckIn: props.record.checkInAt ? toDatetimeLocal(props.record.checkInAt) : '',
		requestedCheckOut: '',
		reason: '',
	},
});

const [requestedCheckIn, requestedCheckInAttrs] = defineField('requestedCheckIn');
const [requestedCheckOut, requestedCheckOutAttrs] = defineField('requestedCheckOut');
const [reason, reasonAttrs] = defineField('reason');

function onFileChange(e: Event) {
	const target = e.target as HTMLInputElement;
	evidencePhotoFile.value = target.files?.[0] ?? null;
}

const onSubmit = handleSubmit(async values => {
	try {
		await service.create({
			dto: {
				attendanceDate: props.record.date,
				...(values.requestedCheckIn ? { requestedCheckIn: fromDatetimeLocal(values.requestedCheckIn) } : {}),
				...(values.requestedCheckOut ? { requestedCheckOut: fromDatetimeLocal(values.requestedCheckOut) } : {}),
				reason: values.reason,
			},
			...(evidencePhotoFile.value ? { evidencePhoto: evidencePhotoFile.value } : {}),
		});
		toast.success('Đã gửi đơn bù công thành công');
		emit('submitted');
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Lỗi gửi đơn bù công');
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
				<div class="w-9 h-9 rounded-lg bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center">
					<svg class="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
					</svg>
				</div>
				<div class="flex-1 min-w-0">
					<h3 class="text-base font-semibold text-gray-900 dark:text-white">Tạo đơn bù công</h3>
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

			<!-- Lock reason info -->
			<div class="px-6 pt-4 pb-2">
				<div class="flex items-center gap-2 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
					<svg class="w-4 h-4 text-orange-600 dark:text-orange-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
					</svg>
					<span class="text-xs text-orange-700 dark:text-orange-300">
						Bản ghi đã bị khóa — <strong>{{ missingLabel }}</strong>
					</span>
				</div>
			</div>

			<!-- Form -->
			<form class="px-6 pb-6 pt-2 space-y-4" @submit.prevent="onSubmit">
				<div class="flex flex-col gap-1.5">
					<label class="text-sm font-medium text-gray-700 dark:text-gray-300">Giờ check-in đề nghị (giờ VN)</label>
					<UiDateTimePickerV2
						v-model="requestedCheckIn"
						v-bind="requestedCheckInAttrs"
						placeholder="Chọn giờ check-in"
					/>
				</div>

				<div class="flex flex-col gap-1.5">
					<label class="text-sm font-medium text-gray-700 dark:text-gray-300">Giờ check-out đề nghị (giờ VN)</label>
					<UiDateTimePickerV2
						v-model="requestedCheckOut"
						v-bind="requestedCheckOutAttrs"
						placeholder="Chọn giờ check-out"
					/>
				</div>

				<div class="flex flex-col gap-1.5">
					<label class="text-sm font-medium text-gray-700 dark:text-gray-300">
						Lý do <span class="text-red-500">*</span>
					</label>
					<textarea
						v-model="reason"
						v-bind="reasonAttrs"
						rows="3"
						placeholder="Mô tả lý do bù công..."
						class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors placeholder:text-gray-400"
						:class="{ 'border-red-400 focus:ring-red-400': errors.reason }"
					/>
					<span v-if="errors.reason" class="text-xs text-red-500">{{ errors.reason }}</span>
				</div>

				<div class="flex flex-col gap-1.5">
					<label class="text-sm font-medium text-gray-700 dark:text-gray-300">Ảnh bằng chứng (tùy chọn)</label>
					<label
						class="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 hover:border-brand-400 dark:hover:border-brand-500 cursor-pointer transition-colors bg-gray-50 dark:bg-gray-800"
					>
						<svg class="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
						</svg>
						<span class="text-sm text-gray-500 dark:text-gray-400 flex-1 truncate">
							{{ evidencePhotoFile ? evidencePhotoFile.name : 'Chọn ảnh...' }}
						</span>
						<input type="file" class="hidden" accept="image/*" @change="onFileChange" />
					</label>
				</div>

				<div class="flex gap-3 pt-2">
					<CommonAppButton variant="outline" class="flex-1" @click="emit('close')">Hủy</CommonAppButton>
					<CommonAppButton class="flex-1" :loading="isSubmitting" type="submit">Gửi đơn</CommonAppButton>
				</div>
			</form>
		</div>
	</div>
</template>
