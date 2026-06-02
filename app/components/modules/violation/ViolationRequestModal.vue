<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { format, parseISO } from 'date-fns';
	import { useViolationRequestService } from '~/services/violation-request.service';
	import type { ViolationCounter, ViolationRequest, ViolationRequestType } from '~/types/violation.types';

	const props = defineProps<{
		counter: ViolationCounter;
		initialType?: ViolationRequestType;
		initialDate?: string;
	}>();

	const emit = defineEmits<{
		submitted: [ViolationRequest];
		close: [];
	}>();

	const service = useViolationRequestService();
	const toast = useToast();

	// ─── Evidence file ────────────────────────────────────────────────────────────
	const evidenceFile = ref<File | null>(null);
	const evidenceError = ref<string | null>(null);
	const fileInputRef = ref<HTMLInputElement | null>(null);

	// ─── Validation schema ────────────────────────────────────────────────────────
	const schema = toTypedSchema(
		z.object({
			type: z.enum(['FORGOT_CHECKIN', 'FORGOT_CHECKOUT', 'LATE', 'EARLY'] as const, {
				required_error: 'Vui lòng chọn loại vi phạm',
				invalid_type_error: 'Vui lòng chọn loại vi phạm',
			}),
			violationDate: z.string().min(1, 'Vui lòng chọn ngày vi phạm'),
			reason: z.string().min(10, 'Lý do phải có ít nhất 10 ký tự'),
		}),
	);

	const { handleSubmit, defineField, errors, isSubmitting } = useForm({
		validationSchema: schema,
		initialValues: {
			type: props.initialType,
			violationDate: props.initialDate ?? '',
		},
	});

	const [type, typeAttrs] = defineField('type');
	const [violationDate, violationDateAttrs] = defineField('violationDate');
	const [reason, reasonAttrs] = defineField('reason');

	// ─── Deadline computed ────────────────────────────────────────────────────────
	const deadline = computed(() => {
		if (!violationDate.value) return null;
		const d = parseISO(violationDate.value);
		return new Date(d.getFullYear(), d.getMonth() + 1, 5, 23, 59, 59);
	});

	const deadlinePassed = computed(() => {
		if (!deadline.value) return false;
		return new Date() > deadline.value;
	});

	const deadlineDisplay = computed(() => {
		if (!deadline.value) return '';
		return format(deadline.value, "'23:59 ngày' dd/MM/yyyy");
	});

	const todayStr = format(new Date(), 'yyyy-MM-dd');

	// ─── File upload ──────────────────────────────────────────────────────────────
	function handleFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		evidenceError.value = null;
		if (!file) {
			evidenceFile.value = null;
			return;
		}
		const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
		if (!allowed.includes(file.type)) {
			evidenceError.value = 'Chỉ chấp nhận JPG, PNG, PDF';
			input.value = '';
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			evidenceError.value = 'Tệp không được vượt quá 5MB';
			input.value = '';
			return;
		}
		evidenceFile.value = file;
	}

	function removeEvidence() {
		evidenceFile.value = null;
		evidenceError.value = null;
		if (fileInputRef.value) fileInputRef.value.value = '';
	}

	// ─── Submit ───────────────────────────────────────────────────────────────────
	const onSubmit = handleSubmit(async vals => {
		if (deadlinePassed.value) return;

		const isForgotCheckin = vals.type === 'FORGOT_CHECKIN';
		const needsConfirm =
			props.counter.remaining === 1 ||
			(isForgotCheckin && props.counter.remaining === 2);

		if (needsConfirm) {
			const msg =
				isForgotCheckin && props.counter.remaining === 2
					? 'Nếu đây là phiếu quên chấm công cả ngày (tốn 2 lượt), bạn sẽ không còn lượt nào trong tháng. Tiếp tục?'
					: 'Đây là lần giải trình cuối cùng trong tháng này. Bạn có chắc muốn tiếp tục?';
			if (!confirm(msg)) return;
		}

		try {
			const result = await service.create({
				type: vals.type,
				violationDate: vals.violationDate,
				reason: vals.reason,
				evidencePhoto: evidenceFile.value ?? undefined,
			});
			const remaining = Math.max(0, props.counter.remaining - result.slotCost);
			toast.success(`Đã gửi phiếu, chờ duyệt. Còn ${remaining} lần trong tháng.`);
			emit('submitted', result);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
		}
	});
</script>

<template>
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
		<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
			<!-- Header -->
			<div
				class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0"
			>
				<h2 class="text-base font-semibold text-gray-900 dark:text-white">Tạo phiếu giải trình vi phạm</h2>
				<button
					class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
					@click="emit('close')"
				>
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Scrollable body -->
			<div class="overflow-y-auto flex-1 px-6 py-4">
				<!-- Quota warning -->
				<div
					v-if="counter.remaining <= 2"
					class="mb-4 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-700 space-y-1"
				>
					<p class="text-sm text-amber-700 dark:text-amber-300 font-medium">
						⚠️ Bạn còn {{ counter.remaining }} lần giải trình trong tháng này
					</p>
					<p v-if="type === 'FORGOT_CHECKIN' && counter.remaining <= 2" class="text-xs text-amber-600 dark:text-amber-400">
						Lưu ý: phiếu quên chấm công cả ngày tốn 2 lượt.
					</p>
				</div>

				<form id="violation-create-form" class="space-y-4" @submit.prevent="onSubmit">
					<!-- Loại vi phạm -->
					<div class="space-y-1.5">
						<label class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Loại vi phạm <span class="text-red-500">*</span>
						</label>
						<select
							v-model="type"
							v-bind="typeAttrs"
							:class="[
								'block w-full rounded-lg border px-3 py-2.5 text-sm transition-colors appearance-none',
								'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
								'focus:outline-none focus:ring-2 focus:ring-offset-0',
								errors.type
									? 'border-red-400 focus:ring-red-300'
									: 'border-gray-300 focus:border-brand-500 focus:ring-brand-200 dark:border-gray-600',
							]"
						>
							<option value="">-- Chọn loại vi phạm --</option>
							<option value="FORGOT_CHECKIN">Quên chấm công vào</option>
							<option value="FORGOT_CHECKOUT">Quên chấm công ra</option>
							<option value="LATE">Đi muộn</option>
							<option value="EARLY">Về sớm</option>
						</select>
						<p v-if="errors.type" class="text-xs text-red-500">{{ errors.type }}</p>
					</div>

					<!-- Ngày vi phạm -->
					<div class="space-y-1.5">
						<label class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Ngày vi phạm <span class="text-red-500">*</span>
						</label>
						<UiDatePicker
							v-model="violationDate"
							:max="todayStr"
							:error="errors.violationDate"
							@blur="violationDateAttrs.onBlur?.()"
						/>
						<template v-if="violationDate && !errors.violationDate">
							<p v-if="deadlinePassed" class="text-xs text-red-600 dark:text-red-400 font-medium">
								❌ Đã quá hạn nộp phiếu cho ngày này (hạn: {{ deadlineDisplay }})
							</p>
							<p v-else class="text-xs text-blue-600 dark:text-blue-400">⏰ Hạn nộp: {{ deadlineDisplay }}</p>
						</template>
					</div>

					<!-- FORGOT_CHECKIN: thông tin tự động -->
					<div
						v-if="type === 'FORGOT_CHECKIN'"
						class="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-700"
					>
						<svg class="w-4 h-4 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<div class="text-xs text-blue-700 dark:text-blue-300 space-y-0.5">
							<p>Hệ thống tự động xác định giờ check-in/check-out theo ca làm việc khi phiếu được duyệt.</p>
							<p class="font-medium">Quên chấm công cả ngày (không có bản ghi) tốn <span class="underline">2 lượt</span> giải trình.</p>
						</div>
					</div>

					<!-- Lý do -->
					<div class="space-y-1.5">
						<label class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Lý do <span class="text-red-500">*</span>
						</label>
						<textarea
							v-model="reason"
							v-bind="reasonAttrs"
							rows="3"
							placeholder="Mô tả lý do vi phạm (ít nhất 10 ký tự)"
							:class="[
								'block w-full rounded-lg border px-3 py-2.5 text-sm transition-colors resize-none',
								'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400',
								'focus:outline-none focus:ring-2 focus:ring-offset-0',
								errors.reason
									? 'border-red-400 focus:ring-red-300'
									: 'border-gray-300 focus:border-brand-500 focus:ring-brand-200 dark:border-gray-600',
							]"
						/>
						<p v-if="errors.reason" class="text-xs text-red-500">{{ errors.reason }}</p>
					</div>

					<!-- Ảnh minh chứng -->
					<div class="space-y-1.5">
						<label class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Ảnh minh chứng
							<span class="text-xs font-normal text-gray-400">(JPG, PNG, PDF · tối đa 5MB)</span>
						</label>

						<div
							v-if="evidenceFile"
							class="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-700"
						>
							<svg
								class="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							<span class="text-xs text-green-700 dark:text-green-300 flex-1 truncate">{{ evidenceFile.name }}</span>
							<button
								type="button"
								class="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
								@click="removeEvidence"
							>
								<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
									<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>

						<label
							v-else
							class="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-pointer hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-colors"
						>
							<svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 5.75 5.75 0 011.072 11.095H6.75z"
								/>
							</svg>
							<span class="text-sm text-gray-500 dark:text-gray-400">Chọn tệp đính kèm</span>
							<input ref="fileInputRef" type="file" accept=".jpg,.jpeg,.png,.pdf" class="hidden" @change="handleFileChange" />
						</label>

						<p v-if="evidenceError" class="text-xs text-red-500">{{ evidenceError }}</p>
					</div>
				</form>
			</div>

			<!-- Footer -->
			<div
				class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0"
			>
				<CommonAppButton variant="outline" @click="emit('close')">Huỷ</CommonAppButton>
				<CommonAppButton type="submit" form="violation-create-form" :loading="isSubmitting" :disabled="deadlinePassed">
					Gửi phiếu
				</CommonAppButton>
			</div>
		</div>
	</div>
</template>
