<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import {
		formatRecruitMoney,
		recruitErrorMessage,
		toRecruitNumber,
		toRecruitText,
	} from '~/utils/recruitment.utils';
	import {
		REQUISITION_EMPLOYMENT_TYPE_LABELS,
		REQUISITION_REASON_LABELS,
		type Availability,
		type CreateRequisitionBody,
		type RecruitmentRequisitionReason,
		type Requisition,
		type RequisitionEmploymentType,
	} from '~/types/recruitment.types';

	/**
	 * Tạo hoặc sửa yêu cầu tuyển dụng.
	 *
	 * Hai điểm nghiệp vụ nằm hết trong form này:
	 *
	 * 1. **Còn trống bao nhiêu** đọc từ `GET /requisitions/availability` mỗi lần đổi vị trí
	 *    hay ngày cần có người, vì năm định biên tính theo `neededBy`. Lỗi vượt định biên của
	 *    BE không mang theo con số (bộ lọc lỗi cắt mất), nên con số phải có sẵn trên form.
	 * 2. **Lý do Thay thế bắt buộc chọn nhân viên được thay**, và nhân viên đó phải đang ở
	 *    đúng phòng và vị trí của yêu cầu.
	 */
	const props = defineProps<{ requisition?: Requisition }>();

	const emit = defineEmits<{ saved: [requisition: Requisition]; close: [] }>();

	const service = useRecruitmentService();
	const directoryStore = useDirectoryStore();
	const { employees, positions } = storeToRefs(directoryStore);

	const isEdit = computed(() => !!props.requisition);

	const positionId = ref<number | undefined>(props.requisition?.position.id);
	const quantity = ref<number>(props.requisition?.quantity ?? 1);
	const reason = ref<RecruitmentRequisitionReason>(props.requisition?.reason ?? 'ADDITIONAL');
	const replacedEmployeeId = ref<number | undefined>(props.requisition?.replacedEmployee?.id);
	const employmentType = ref<RequisitionEmploymentType>(
		props.requisition?.employmentType ?? 'FULL_TIME',
	);
	const salaryMin = ref<string | number>(props.requisition?.salaryMin ?? '');
	const salaryMax = ref<string | number>(props.requisition?.salaryMax ?? '');
	const neededBy = ref(props.requisition?.neededBy ?? '');
	const jobDescription = ref(props.requisition?.jobDescription ?? '');
	const requirements = ref(props.requisition?.requirements ?? '');
	const note = ref(props.requisition?.note ?? '');

	const submitting = ref(false);
	const error = ref<string | null>(null);

	onMounted(() => {
		directoryStore.load().catch(() => {
			error.value = 'Không tải được danh sách vị trí và nhân viên';
		});
		loadAvailability();
	});

	const positionOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Chọn vị trí...' },
		...positions.value
			.filter(p => p.isActive)
			.map(p => ({ value: p.id as number | undefined, label: `${p.name} — ${p.department}` })),
	]);

	const reasonOptions = Object.entries(REQUISITION_REASON_LABELS).map(([value, label]) => ({
		value,
		label,
	}));

	const employmentTypeOptions = Object.entries(REQUISITION_EMPLOYMENT_TYPE_LABELS).map(
		([value, label]) => ({ value, label }),
	);

	/** Nhân viên được thay phải cùng vị trí với yêu cầu, nên lọc theo vị trí đang chọn. */
	const replacedOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Chọn nhân viên được thay...' },
		...employees.value
			.filter(e => positionId.value == null || e.position?.id === positionId.value)
			.map(e => ({
				value: e.id as number | undefined,
				label: `${e.fullName} (${e.employeeCode})`,
			})),
	]);

	// ─── Còn trống ────────────────────────────────────────────────────────────────

	const availability = ref<Availability | null>(null);
	const availabilityError = ref<string | null>(null);
	const loadingAvailability = ref(false);

	/** Năm định biên: năm của ngày cần có người, chưa chọn thì năm nay. */
	const planYear = computed(() => {
		const y = Number(neededBy.value?.slice(0, 4));
		return Number.isInteger(y) && y > 2000 ? y : new Date().getFullYear();
	});

	async function loadAvailability() {
		availability.value = null;
		availabilityError.value = null;
		if (positionId.value == null) return;
		loadingAvailability.value = true;
		try {
			availability.value = await service.availability({
				positionId: positionId.value,
				year: planYear.value,
				// Khi sửa, không để yêu cầu này tự trừ chính nó khỏi phần còn trống.
				excludeId: props.requisition?.id,
			});
		} catch (e) {
			availabilityError.value = recruitErrorMessage(e, 'Không đọc được số còn trống của vị trí này');
		} finally {
			loadingAvailability.value = false;
		}
	}

	watch([positionId, planYear], loadAvailability);

	// Đổi vị trí thì nhân viên được thay có thể không còn đúng vị trí nữa.
	watch(positionId, () => {
		if (replacedEmployeeId.value != null) {
			const emp = employees.value.find(e => e.id === replacedEmployeeId.value);
			if (emp && emp.position?.id !== positionId.value) replacedEmployeeId.value = undefined;
		}
	});

	const noConfirmedPlan = computed(
		() => availability.value != null && availability.value.confirmed == null,
	);

	const exceedsAvailable = computed(() => {
		const a = availability.value;
		if (!a || a.confirmed == null) return false;
		return Number(quantity.value) > a.available;
	});

	// ─── Lưu ──────────────────────────────────────────────────────────────────────

	function buildBody(): CreateRequisitionBody {
		return {
			positionId: positionId.value as number,
			quantity: Number(quantity.value),
			reason: reason.value,
			replacedEmployeeId: reason.value === 'REPLACEMENT' ? replacedEmployeeId.value : undefined,
			employmentType: employmentType.value,
			salaryMin: toRecruitNumber(salaryMin.value),
			salaryMax: toRecruitNumber(salaryMax.value),
			neededBy: toRecruitText(neededBy.value),
			jobDescription: toRecruitText(jobDescription.value),
			requirements: toRecruitText(requirements.value),
			note: toRecruitText(note.value),
		};
	}

	async function save() {
		if (positionId.value == null) {
			error.value = 'Chọn vị trí cần tuyển';
			return;
		}
		const q = Number(quantity.value);
		if (!Number.isInteger(q) || q < 1 || q > 1000) {
			error.value = 'Số lượng phải là số nguyên từ 1 đến 1000';
			return;
		}
		if (reason.value === 'REPLACEMENT' && replacedEmployeeId.value == null) {
			error.value = 'Lý do Thay thế phải chọn nhân viên được thay';
			return;
		}
		const min = toRecruitNumber(salaryMin.value);
		const max = toRecruitNumber(salaryMax.value);
		if (min != null && max != null && min > max) {
			error.value = 'Khung lương "từ" không được lớn hơn "đến"';
			return;
		}

		submitting.value = true;
		error.value = null;
		try {
			const body = buildBody();
			const saved = props.requisition
				? await service.updateRequisition(props.requisition.id, body)
				: await service.createRequisition(body);
			emit('saved', saved);
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Lưu yêu cầu tuyển dụng thất bại');
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
							{{ isEdit ? 'Sửa yêu cầu tuyển dụng' : 'Tạo yêu cầu tuyển dụng' }}
						</h2>
						<p v-if="requisition" class="mt-0.5 font-mono text-xs text-gray-500 dark:text-gray-400">
							{{ requisition.code }}
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
						<div class="space-y-1 sm:col-span-2">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Vị trí cần tuyển <span class="text-red-500">*</span>
							</label>
							<UiSelect v-model="positionId" :options="positionOptions" />
						</div>

						<!-- Còn trống của (vị trí, năm) -->
						<div
							v-if="positionId != null"
							class="rounded-lg border px-3 py-2 sm:col-span-2"
							:class="
								noConfirmedPlan || exceedsAvailable
									? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20'
									: 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/60'
							"
						>
							<p v-if="loadingAvailability" class="text-sm text-gray-500 dark:text-gray-400">
								Đang đọc định biên...
							</p>
							<p v-else-if="availabilityError" class="text-sm text-rose-600 dark:text-rose-400">
								{{ availabilityError }}
							</p>
							<template v-else-if="availability">
								<p v-if="noConfirmedPlan" class="text-sm text-amber-800 dark:text-amber-200">
									Vị trí này chưa có định biên Đã chốt của năm {{ planYear }}, nên lưu được bản nháp
									nhưng chưa gửi duyệt được. Hãy chốt định biên trước.
								</p>
								<template v-else>
									<p class="text-sm text-gray-700 dark:text-gray-300">
										Định biên năm {{ planYear }} còn trống
										<strong class="text-base">{{ availability.available }}</strong> người, trên tổng
										{{ availability.confirmed }} đã chốt, {{ availability.current }} đang có và
										{{ availability.recruiting }} đang tuyển.
									</p>
									<p v-if="exceedsAvailable" class="mt-1 text-sm text-amber-800 dark:text-amber-200">
										Số lượng đang nhập vượt phần còn trống, nên lúc gửi duyệt hệ thống sẽ từ chối.
									</p>
									<p v-if="reason === 'REPLACEMENT'" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
										Với lý do Thay thế, lúc gửi duyệt người được thay không bị tính vào "đang có",
										nên số còn trống thật có thể nhiều hơn ở đây một người.
									</p>
								</template>
							</template>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Số lượng <span class="text-red-500">*</span>
							</label>
							<input
								v-model.number="quantity"
								type="number"
								min="1"
								max="1000"
								step="1"
								class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Loại hình <span class="text-red-500">*</span>
							</label>
							<UiSelect v-model="employmentType" :options="employmentTypeOptions" />
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Lý do tuyển <span class="text-red-500">*</span>
							</label>
							<UiSelect v-model="reason" :options="reasonOptions" />
						</div>

						<div v-if="reason === 'REPLACEMENT'" class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Nhân viên được thay <span class="text-red-500">*</span>
							</label>
							<UiSelect v-model="replacedEmployeeId" :options="replacedOptions" />
							<p class="text-xs text-gray-500 dark:text-gray-400">
								Danh sách lọc theo vị trí đang chọn, vì người được thay phải ở đúng phòng và vị trí
								của yêu cầu.
							</p>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Khung lương từ
							</label>
							<input
								v-model="salaryMin"
								type="number"
								min="0"
								step="1000"
								placeholder="18000000"
								class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
							<p class="text-xs text-gray-500 dark:text-gray-400">
								{{ formatRecruitMoney(toRecruitNumber(salaryMin) ?? null) }}
							</p>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Khung lương đến
							</label>
							<input
								v-model="salaryMax"
								type="number"
								min="0"
								step="1000"
								placeholder="25000000"
								class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
							<p class="text-xs text-gray-500 dark:text-gray-400">
								Để trống thì mọi offer của yêu cầu này đều tính là vượt khung và phải thêm bước duyệt
								của Giám đốc.
							</p>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Ngày cần có người
							</label>
							<UiDatePicker v-model="neededBy" />
							<p class="text-xs text-gray-500 dark:text-gray-400">
								Năm của ngày này quyết định dùng định biên năm nào.
							</p>
						</div>

						<div class="space-y-1 sm:col-span-2">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Mô tả công việc
							</label>
							<textarea
								v-model="jobDescription"
								rows="4"
								placeholder="Công việc chính của vị trí..."
								class="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
						</div>

						<div class="space-y-1 sm:col-span-2">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Yêu cầu</label>
							<textarea
								v-model="requirements"
								rows="3"
								placeholder="Kinh nghiệm, kỹ năng bắt buộc..."
								class="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
						</div>

						<div class="space-y-1 sm:col-span-2">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Ghi chú</label>
							<textarea
								v-model="note"
								rows="2"
								class="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
						</div>
					</div>

					<p
						v-if="isEdit"
						class="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-800/60 dark:text-gray-300"
					>
						Một trường đã có giá trị thì để trống không xoá được giá trị cũ, vì hệ thống coi ô trống là
						"không đổi". Muốn bỏ hẳn thì nhập giá trị khác.
					</p>

					<p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
						{{ error }}
					</p>

					<div class="flex justify-end gap-3 pt-1">
						<CommonAppButton variant="secondary" type="button" @click="emit('close')">Huỷ</CommonAppButton>
						<CommonAppButton variant="primary" type="submit" :loading="submitting">
							{{ isEdit ? 'Lưu' : 'Tạo bản nháp' }}
						</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
