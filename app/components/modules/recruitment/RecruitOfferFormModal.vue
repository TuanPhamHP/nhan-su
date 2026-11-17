<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import {
		formatRecruitMoney,
		minProbationSalary,
		offerTermErrors,
		recruitErrorMessage,
		toRecruitNumber,
		toRecruitText,
	} from '~/utils/recruitment.utils';
	import {
		PROBATION_GROUP_LABELS,
		PROBATION_GROUP_MAX_DAYS,
		REQUISITION_EMPLOYMENT_TYPE_LABELS,
		type RecruitmentOffer,
		type RecruitmentProbationGroup,
		type RequisitionEmploymentType,
	} from '~/types/recruitment.types';

	/**
	 * Tạo offer nháp cho một hồ sơ đang ở vòng Offer, hoặc sửa offer còn Nháp.
	 *
	 * Đây là chỗ DUY NHẤT của module trả nhiều lỗi validate cùng lúc: `error.errors[]` có
	 * một phần tử cho mỗi điều khoản sai, kèm `min` của lương thử việc và `max` của số ngày.
	 * Form gắn từng lỗi vào đúng ô thay vì đổ một dòng toast, vì người dùng cần biết sửa ô
	 * nào. Lỗi sai kiểu dữ liệu (ngày sai định dạng, số âm) bị chặn ở tầng DTO và KHÔNG có
	 * `errors[]`, nên khi đó rơi về câu lỗi chung.
	 */
	const props = defineProps<{
		/** Khi tạo offer mới. */
		applicationId?: number;
		candidateName?: string;
		/** Khung lương của yêu cầu, để cảnh báo vượt khung trước khi gửi duyệt. */
		salaryMax?: number | null;
		/** Khi sửa offer nháp. */
		offer?: RecruitmentOffer;
	}>();

	const emit = defineEmits<{ saved: [offer: RecruitmentOffer]; close: [] }>();

	const service = useRecruitmentService();

	const isEdit = computed(() => !!props.offer);

	const baseSalary = ref<string | number>(props.offer?.baseSalary ?? '');
	const startDate = ref(props.offer?.startDate ?? '');
	const responseDeadline = ref(props.offer?.responseDeadline ?? '');
	const probationGroup = ref<RecruitmentProbationGroup>(props.offer?.probationGroup ?? 'NONE');
	const probationDays = ref<string | number>(props.offer?.probationDays ?? '');
	const probationSalary = ref<string | number>(props.offer?.probationSalary ?? '');
	const employmentType = ref<RequisitionEmploymentType | undefined>(props.offer?.employmentType);
	const level = ref(props.offer?.level ?? '');
	const allowances = ref(props.offer?.allowances ?? '');

	const submitting = ref(false);
	const error = ref<string | null>(null);
	const fieldErrors = ref<Record<string, string>>({});

	const probationGroupOptions = Object.entries(PROBATION_GROUP_LABELS).map(([value, label]) => ({
		value,
		label,
	}));

	const employmentTypeOptions = [
		{ value: undefined as string | undefined, label: 'Theo yêu cầu tuyển dụng' },
		...Object.entries(REQUISITION_EMPLOYMENT_TYPE_LABELS).map(([value, label]) => ({
			value: value as string | undefined,
			label,
		})),
	];

	const hasProbation = computed(() => probationGroup.value !== 'NONE');

	const maxProbationDays = computed(() => PROBATION_GROUP_MAX_DAYS[probationGroup.value]);

	/** Lương thử việc tối thiểu theo BR-02, tính ngay để người dùng không phải đoán. */
	const minProbation = computed(() => minProbationSalary(toRecruitNumber(baseSalary.value)));

	const overBand = computed(() => {
		const base = toRecruitNumber(baseSalary.value);
		if (base == null) return false;
		// Khung tối đa trống nghĩa là chưa nhập khung, và khi đó MỌI offer đều tính là vượt.
		if (props.salaryMax == null) return true;
		return base > props.salaryMax;
	});

	/** Gắn từng lỗi của BE vào đúng ô nhập. */
	function applyTermErrors(e: unknown): boolean {
		const list = offerTermErrors(e);
		if (!list.length) return false;
		const next: Record<string, string> = {};
		for (const item of list) {
			switch (item.code) {
				case 'RECRUIT_PROBATION_SALARY_TOO_LOW':
					next.probationSalary =
						item.min != null ? `Tối thiểu ${formatRecruitMoney(item.min)}` : item.message;
					break;
				case 'RECRUIT_PROBATION_TOO_LONG':
					next.probationDays = item.max != null ? `Tối đa ${item.max} ngày` : item.message;
					break;
				case 'RECRUIT_PROBATION_SALARY_REQUIRED':
					next.probationSalary = item.message;
					break;
				case 'RECRUIT_PROBATION_DAYS_REQUIRED':
					next.probationDays = item.message;
					break;
				case 'RECRUIT_START_DATE_PAST':
					next.startDate = item.message;
					break;
				case 'RECRUIT_RESPONSE_DEADLINE_INVALID':
					next.responseDeadline = item.message;
					break;
				default:
					next.baseSalary = item.message;
			}
		}
		fieldErrors.value = next;
		return true;
	}

	async function save() {
		const base = toRecruitNumber(baseSalary.value);
		fieldErrors.value = {};
		error.value = null;

		if (base == null || base < 1) {
			fieldErrors.value = { baseSalary: 'Nhập lương chính thức' };
			return;
		}
		if (!startDate.value) {
			fieldErrors.value = { startDate: 'Chọn ngày bắt đầu làm việc' };
			return;
		}

		submitting.value = true;
		try {
			const body = {
				baseSalary: base,
				startDate: startDate.value,
				probationGroup: probationGroup.value,
				probationDays: hasProbation.value ? toRecruitNumber(probationDays.value) : undefined,
				probationSalary: hasProbation.value ? toRecruitNumber(probationSalary.value) : undefined,
				responseDeadline: toRecruitText(responseDeadline.value),
				employmentType: employmentType.value,
				level: toRecruitText(level.value),
				allowances: toRecruitText(allowances.value),
			};
			const saved = props.offer
				? await service.updateOffer(props.offer.id, body)
				: await service.createOffer(props.applicationId as number, body);
			emit('saved', saved);
		} catch (e) {
			if (!applyTermErrors(e)) {
				error.value = recruitErrorMessage(e, 'Lưu offer thất bại');
			}
		} finally {
			submitting.value = false;
		}
	}
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-4">
			<div class="my-8 w-full max-w-2xl rounded-2xl bg-white shadow-xl dark:bg-gray-900">
				<div class="flex items-start justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
					<div>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">
							{{ isEdit ? 'Sửa offer nháp' : 'Tạo offer' }}
						</h2>
						<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
							{{ candidateName ?? offer?.candidate.fullName ?? '' }}
							<template v-if="offer"> · <span class="font-mono">{{ offer.code }}</span></template>
						</p>
					</div>
					<button
						type="button"
						class="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
						aria-label="Đóng"
						@click="emit('close')"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<form class="max-h-[70vh] space-y-4 overflow-y-auto p-6" @submit.prevent="save">
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Lương chính thức <span class="text-red-500">*</span>
							</label>
							<input
								v-model="baseSalary"
								type="number"
								min="1"
								step="1000"
								placeholder="22000000"
								class="w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:text-gray-100"
								:class="
									fieldErrors.baseSalary
										? 'border-red-400'
										: 'border-gray-300 dark:border-gray-600'
								"
							/>
							<p v-if="fieldErrors.baseSalary" class="text-xs text-red-500">{{ fieldErrors.baseSalary }}</p>
							<p v-else class="text-xs text-gray-500 dark:text-gray-400">
								{{ formatRecruitMoney(toRecruitNumber(baseSalary) ?? null) }} gross mỗi tháng
							</p>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Cấp bậc</label>
							<input
								v-model="level"
								type="text"
								maxlength="100"
								placeholder="Senior"
								class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
						</div>

						<div
							v-if="overBand"
							class="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 sm:col-span-2 dark:border-amber-700 dark:bg-amber-900/20"
						>
							<p class="text-sm text-amber-800 dark:text-amber-200">
								<template v-if="salaryMax == null">
									Yêu cầu tuyển dụng chưa nhập khung lương, nên mọi offer đều tính là vượt khung và
									cần thêm một bước duyệt của Giám đốc.
								</template>
								<template v-else>
									Lương này vượt khung tối đa {{ formatRecruitMoney(salaryMax) }} của yêu cầu tuyển
									dụng, nên luồng duyệt sẽ có thêm bước của Giám đốc.
								</template>
							</p>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Ngày bắt đầu làm việc <span class="text-red-500">*</span>
							</label>
							<UiDatePicker v-model="startDate" :error="fieldErrors.startDate" />
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Hạn phản hồi
							</label>
							<UiDatePicker v-model="responseDeadline" :error="fieldErrors.responseDeadline" />
							<p v-if="!fieldErrors.responseDeadline" class="text-xs text-gray-500 dark:text-gray-400">
								Để trống thì hệ thống lấy năm ngày kể từ hôm nay, không quá ngày bắt đầu. Offer hết
								hiệu lực lúc 23:59:59 của ngày hạn.
							</p>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Loại hình</label>
							<UiSelect v-model="employmentType" :options="employmentTypeOptions" />
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Nhóm thử việc
							</label>
							<UiSelect v-model="probationGroup" :options="probationGroupOptions" />
						</div>

						<template v-if="hasProbation">
							<div class="space-y-1">
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
									Số ngày thử việc <span class="text-red-500">*</span>
								</label>
								<input
									v-model="probationDays"
									type="number"
									min="1"
									:max="maxProbationDays ?? 180"
									step="1"
									class="w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:text-gray-100"
									:class="
										fieldErrors.probationDays
											? 'border-red-400'
											: 'border-gray-300 dark:border-gray-600'
									"
								/>
								<p v-if="fieldErrors.probationDays" class="text-xs text-red-500">
									{{ fieldErrors.probationDays }}
								</p>
								<p v-else-if="maxProbationDays" class="text-xs text-gray-500 dark:text-gray-400">
									Nhóm này tối đa {{ maxProbationDays }} ngày.
								</p>
							</div>

							<div class="space-y-1">
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
									Lương thử việc <span class="text-red-500">*</span>
								</label>
								<input
									v-model="probationSalary"
									type="number"
									min="0"
									step="1000"
									class="w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:text-gray-100"
									:class="
										fieldErrors.probationSalary
											? 'border-red-400'
											: 'border-gray-300 dark:border-gray-600'
									"
								/>
								<p v-if="fieldErrors.probationSalary" class="text-xs text-red-500">
									{{ fieldErrors.probationSalary }}
								</p>
								<p v-else-if="minProbation" class="text-xs text-gray-500 dark:text-gray-400">
									Tối thiểu {{ formatRecruitMoney(minProbation) }}, bằng 85% lương chính thức.
								</p>
							</div>
						</template>

						<div class="space-y-1 sm:col-span-2">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Phụ cấp</label>
							<textarea
								v-model="allowances"
								rows="2"
								placeholder="Phụ cấp ăn trưa 730.000 đ/tháng..."
								class="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
						</div>
					</div>

					<p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
						{{ error }}
					</p>

					<div class="flex justify-end gap-3 pt-1">
						<CommonAppButton variant="secondary" type="button" @click="emit('close')">Huỷ</CommonAppButton>
						<CommonAppButton variant="primary" type="submit" :loading="submitting">
							{{ isEdit ? 'Lưu' : 'Tạo offer nháp' }}
						</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
