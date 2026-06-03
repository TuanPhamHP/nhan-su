<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import * as z from 'zod';
import { useBusinessTripService } from '~/services/business-trip.service';
import type { BusinessTripResponse } from '~/types/business-trip.types';

const props = defineProps<{ trip: BusinessTripResponse }>();
const emit = defineEmits<{
	rejected: [trip: BusinessTripResponse];
	close: [];
}>();

const toast = useToast();
const service = useBusinessTripService();

const schema = toTypedSchema(z.object({
	note: z.string().min(1, 'Vui lòng nhập lý do từ chối'),
}));

const { handleSubmit, defineField, errors, isSubmitting } = useForm({ validationSchema: schema });
const [note, noteAttrs] = defineField('note');

const onSubmit = handleSubmit(async values => {
	try {
		const updated = await service.reject(props.trip.id, { note: values.note });
		toast.success('Đã từ chối đơn công tác');
		emit('rejected', updated);
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	}
});
</script>

<template>
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
		<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md">
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 class="text-base font-semibold text-gray-900 dark:text-white">Từ chối đơn công tác</h2>
				<button class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" @click="emit('close')">
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<form class="p-6 space-y-4" @submit.prevent="onSubmit">
				<p class="text-sm text-gray-600 dark:text-gray-400">
					Từ chối đơn <strong class="text-gray-900 dark:text-white">{{ trip.title }}</strong> của
					<strong class="text-gray-900 dark:text-white">{{ trip.employee.fullName }}</strong>
				</p>

				<div class="space-y-1">
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Lý do từ chối <span class="text-red-500">*</span></label>
					<textarea
						v-model="note"
						v-bind="noteAttrs"
						rows="3"
						placeholder="Nhập lý do từ chối..."
						class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors resize-none"
					/>
					<p v-if="errors.note" class="text-xs text-red-500">{{ errors.note }}</p>
				</div>

				<div class="flex justify-end gap-3 pt-2">
					<CommonAppButton variant="secondary" type="button" @click="emit('close')">Hủy</CommonAppButton>
					<CommonAppButton variant="danger" type="submit" :loading="isSubmitting">Từ chối</CommonAppButton>
				</div>
			</form>
		</div>
	</div>
</template>
