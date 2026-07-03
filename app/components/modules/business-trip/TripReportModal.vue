<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import * as z from 'zod';
import { useBusinessTripService } from '~/services/business-trip.service';
import type { BusinessTripResponse, TripReportResponse } from '~/types/business-trip.types';

const props = defineProps<{
	tripId: number;
	existingReport?: TripReportResponse | null;
}>();
const emit = defineEmits<{
	saved: [trip: BusinessTripResponse];
	close: [];
}>();

const toast = useToast();
const service = useBusinessTripService();

const schema = toTypedSchema(z.object({
	summary: z.string().min(20, 'Tóm tắt phải ít nhất 20 ký tự'),
	results: z.string().min(20, 'Kết quả phải ít nhất 20 ký tự'),
	actualCost: z.number().min(0).optional(),
	issues: z.string().optional(),
}));

const { handleSubmit, defineField, errors, isSubmitting, setValues } = useForm({ validationSchema: schema });

const [summary, summaryAttrs] = defineField('summary');
const [results, resultsAttrs] = defineField('results');
const [actualCost, actualCostAttrs] = defineField('actualCost');
const [issues, issuesAttrs] = defineField('issues');

const attachmentUrls = ref<string[]>([]);

const isDraft = computed(() => !props.existingReport || props.existingReport.status === 'DRAFT');

onMounted(() => {
	if (props.existingReport) {
		setValues({
			summary: props.existingReport.summary,
			results: props.existingReport.results,
			actualCost: props.existingReport.actualCost ?? undefined,
			issues: props.existingReport.issues ?? undefined,
		});
		attachmentUrls.value = [...(props.existingReport.attachmentUrls ?? [])];
	}
});

function addAttachment() {
	attachmentUrls.value.push('');
}

function removeAttachment(index: number) {
	attachmentUrls.value.splice(index, 1);
}

function buildPayload(base: { summary: string; results: string; actualCost?: number; issues?: string }) {
	const cleaned = attachmentUrls.value.map(u => u.trim()).filter(Boolean);
	return { ...base, attachmentUrls: cleaned };
}

async function saveDraft() {
	const values = buildPayload({
		summary: summary.value ?? '',
		results: results.value ?? '',
		actualCost: actualCost.value,
		issues: issues.value,
	});
	try {
		let updated: BusinessTripResponse;
		if (props.existingReport) {
			updated = await service.updateReport(props.tripId, values);
		} else {
			updated = await service.createReport(props.tripId, values);
		}
		toast.success('Đã lưu nháp báo cáo');
		emit('saved', updated);
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	}
}

const onSubmit = handleSubmit(async values => {
	const payload = buildPayload(values);
	try {
		let updated: BusinessTripResponse;
		if (props.existingReport) {
			await service.updateReport(props.tripId, payload);
			updated = await service.submitReport(props.tripId);
		} else {
			await service.createReport(props.tripId, payload);
			updated = await service.submitReport(props.tripId);
		}
		toast.success('Đã nộp báo cáo công tác');
		emit('saved', updated);
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	}
});
</script>

<template>
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
		<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
				<div>
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">
						{{ existingReport ? 'Cập nhật báo cáo' : 'Thêm báo cáo công tác' }}
					</h2>
					<p v-if="existingReport?.status === 'SUBMITTED'" class="text-xs text-teal-600 dark:text-teal-400 mt-0.5">Đã nộp — chỉ đọc</p>
				</div>
				<button class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" @click="emit('close')">
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<form class="flex-1 overflow-y-auto p-6 space-y-4" @submit.prevent="onSubmit">
				<div class="space-y-1">
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Tóm tắt chuyến đi <span class="text-red-500">*</span></label>
					<textarea
						v-model="summary"
						v-bind="summaryAttrs"
						rows="3"
						:disabled="!isDraft"
						placeholder="Tóm tắt những gì đã thực hiện trong chuyến công tác (tối thiểu 20 ký tự)..."
						class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors resize-none disabled:opacity-60 disabled:cursor-not-allowed"
					/>
					<p v-if="errors.summary" class="text-xs text-red-500">{{ errors.summary }}</p>
				</div>

				<div class="space-y-1">
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Kết quả đạt được <span class="text-red-500">*</span></label>
					<textarea
						v-model="results"
						v-bind="resultsAttrs"
						rows="3"
						:disabled="!isDraft"
						placeholder="Mô tả kết quả đạt được sau chuyến công tác (tối thiểu 20 ký tự)..."
						class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors resize-none disabled:opacity-60 disabled:cursor-not-allowed"
					/>
					<p v-if="errors.results" class="text-xs text-red-500">{{ errors.results }}</p>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Chi phí thực tế (VNĐ)</label>
						<input
							v-model.number="actualCost"
							v-bind="actualCostAttrs"
							type="number"
							min="0"
							:disabled="!isDraft"
							placeholder="0"
							class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
						/>
					</div>
				</div>

				<div class="space-y-1">
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Vấn đề phát sinh</label>
					<textarea
						v-model="issues"
						v-bind="issuesAttrs"
						rows="2"
						:disabled="!isDraft"
						placeholder="Ghi chú các vấn đề phát sinh trong chuyến đi (nếu có)..."
						class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors resize-none disabled:opacity-60 disabled:cursor-not-allowed"
					/>
				</div>

				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Tệp đính kèm (URL)</label>
						<button
							v-if="isDraft"
							type="button"
							class="text-xs text-brand-600 dark:text-brand-400 hover:underline"
							@click="addAttachment"
						>
							+ Thêm URL
						</button>
					</div>
					<div v-if="attachmentUrls.length === 0" class="text-xs text-gray-400 italic">
						Chưa có tệp đính kèm
					</div>
					<div v-for="(_url, idx) in attachmentUrls" :key="idx" class="flex items-center gap-2">
						<input
							v-model="attachmentUrls[idx]"
							type="url"
							:disabled="!isDraft"
							placeholder="https://..."
							class="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
						/>
						<button
							v-if="isDraft"
							type="button"
							class="p-2 text-gray-400 hover:text-red-500 transition-colors"
							@click="removeAttachment(idx)"
						>
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				</div>
			</form>

			<div v-if="isDraft" class="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
				<CommonAppButton variant="secondary" type="button" @click="emit('close')">Hủy</CommonAppButton>
				<CommonAppButton variant="secondary" type="button" :loading="isSubmitting" @click="saveDraft">Lưu nháp</CommonAppButton>
				<CommonAppButton type="button" :loading="isSubmitting" @click="onSubmit">Nộp báo cáo</CommonAppButton>
			</div>
			<div v-else class="flex justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
				<CommonAppButton variant="secondary" @click="emit('close')">Đóng</CommonAppButton>
			</div>
		</div>
	</div>
</template>
