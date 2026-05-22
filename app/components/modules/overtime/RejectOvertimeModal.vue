<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { useOvertimeRequestService } from '~/services/overtime-request.service';
import type { OvertimeRequestResponse } from '~/types/overtime.types';

const props = defineProps<{ request: OvertimeRequestResponse }>();
const emit = defineEmits<{ rejected: []; close: [] }>();

const service = useOvertimeRequestService();
const toast = useToast();

const schema = toTypedSchema(
	z.object({
		reviewNote: z.string().min(10, 'Lý do từ chối phải có ít nhất 10 ký tự'),
	}),
);

const { handleSubmit, defineField, errors, isSubmitting } = useForm({ validationSchema: schema });
const [reviewNote, reviewNoteAttrs] = defineField('reviewNote');

const onSubmit = handleSubmit(async values => {
	try {
		await service.reject(props.request.id, { reviewNote: values.reviewNote });
		toast.success('Đã từ chối đơn OT');
		emit('rejected');
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	}
});

function formatDate(d: string) {
	return format(new Date(d), 'dd/MM/yyyy');
}

function formatTime(d: string) {
	return format(new Date(d), 'HH:mm');
}
</script>

<template>
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
		<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg">
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 class="text-base font-semibold text-gray-900 dark:text-white">Từ chối đơn OT</h2>
				<button
					class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
					@click="emit('close')"
				>
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Request info (readonly) -->
			<div class="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 space-y-2 text-sm">
				<div class="flex justify-between">
					<span class="text-gray-500 dark:text-gray-400">Nhân viên</span>
					<span class="font-medium text-gray-900 dark:text-white">
						{{ request.employee.fullName }}
						<span class="text-gray-400 text-xs ml-1">({{ request.employee.employeeCode }})</span>
					</span>
				</div>
				<div class="flex justify-between">
					<span class="text-gray-500 dark:text-gray-400">Ngày OT</span>
					<span class="font-medium text-gray-900 dark:text-white">{{ formatDate(request.overtimeDate) }}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-gray-500 dark:text-gray-400">Thời gian</span>
					<span class="font-medium text-gray-900 dark:text-white">
						{{ formatTime(request.startTime) }} → {{ formatTime(request.endTime) }}
						<span class="text-gray-400 ml-1">({{ request.hoursDisplay }})</span>
					</span>
				</div>
				<div class="flex justify-between gap-4">
					<span class="text-gray-500 dark:text-gray-400 flex-shrink-0">Lý do OT</span>
					<span class="font-medium text-gray-900 dark:text-white text-right">{{ request.reason }}</span>
				</div>
			</div>

			<!-- Form -->
			<form class="px-6 py-4 space-y-4" @submit.prevent="onSubmit">
				<div class="space-y-1.5">
					<label class="text-sm font-medium text-gray-700 dark:text-gray-300">
						Lý do từ chối <span class="text-red-500">*</span>
					</label>
					<textarea
						v-model="reviewNote"
						v-bind="reviewNoteAttrs"
						rows="4"
						placeholder="Nhập lý do từ chối để thông báo cho nhân viên"
						:class="[
							'block w-full rounded-lg border px-3 py-2.5 text-sm transition-colors resize-none',
							'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400',
							'focus:outline-none focus:ring-2 focus:ring-offset-0',
							errors.reviewNote
								? 'border-red-400 focus:ring-red-300'
								: 'border-gray-300 focus:border-brand-500 focus:ring-brand-200 dark:border-gray-600',
						]"
					/>
					<p v-if="errors.reviewNote" class="text-xs text-red-500">{{ errors.reviewNote }}</p>
				</div>

				<div class="flex items-center justify-end gap-3 pt-2">
					<CommonAppButton variant="outline" @click="emit('close')">Huỷ</CommonAppButton>
					<CommonAppButton variant="danger" type="submit" :loading="isSubmitting">Từ chối đơn</CommonAppButton>
				</div>
			</form>
		</div>
	</div>
</template>
