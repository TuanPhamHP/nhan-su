<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import { recruitErrorMessage, toRecruitNumber, toRecruitText } from '~/utils/recruitment.utils';
	import {
		JOB_VISIBILITY_LABELS,
		type PipelineTemplate,
		type RecruitmentJob,
		type RecruitmentJobVisibility,
		type Requisition,
	} from '~/types/recruitment.types';

	/**
	 * Tạo tin từ một yêu cầu đã duyệt, hoặc sửa tin đang có.
	 *
	 * Khi tạo, BE sao chép các vòng của quy trình mẫu vào tin, nên sửa quy trình của tin sau
	 * đó KHÔNG ảnh hưởng quy trình mẫu — và ngược lại. Mô tả để trống thì BE lấy JD của yêu
	 * cầu; cả hai trống thì báo lỗi, nên form nói trước điều đó.
	 */
	const props = defineProps<{
		/** Có khi tạo tin từ trang chi tiết yêu cầu. */
		requisition?: Requisition;
		/** Có khi sửa tin. */
		job?: RecruitmentJob;
	}>();

	const emit = defineEmits<{
		created: [jobId: number];
		saved: [job: RecruitmentJob];
		close: [];
	}>();

	const service = useRecruitmentService();
	const directoryStore = useDirectoryStore();
	const { employees } = storeToRefs(directoryStore);

	const isEdit = computed(() => !!props.job);

	const requisitionId = ref<number | undefined>(props.requisition?.id);
	const pipelineTemplateId = ref<number | undefined>(undefined);
	const title = ref(props.job?.title ?? props.requisition?.position.name ?? '');
	const locationsText = ref((props.job?.locations ?? []).join(', '));
	const salaryText = ref(props.job?.salaryText ?? '');
	const description = ref(props.job?.description ?? '');
	const requirements = ref(props.job?.requirements ?? '');
	const benefits = ref(props.job?.benefits ?? '');
	const deadline = ref(props.job?.deadline ?? '');
	const visibility = ref<RecruitmentJobVisibility>(props.job?.visibility ?? 'PUBLIC');
	const ownerId = ref<number | undefined>(props.job?.owner.id);
	const budget = ref<string | number>(props.job?.budget ?? '');
	const actualCost = ref<string | number>(props.job?.actualCost ?? '');
	const slug = ref(props.job?.slug ?? '');

	const pipelines = ref<PipelineTemplate[]>([]);
	const openRequisitions = ref<Requisition[]>([]);
	const submitting = ref(false);
	const error = ref<string | null>(null);
	const loadingLists = ref(true);

	onMounted(async () => {
		directoryStore.load().catch(() => {
			/* ô chọn người phụ trách rỗng, form vẫn dùng được */
		});
		try {
			if (!isEdit.value) {
				pipelines.value = await service.findPipelineTemplates(true);
				pipelineTemplateId.value = pipelines.value.find(p => p.isDefault)?.id ?? pipelines.value[0]?.id;

				// Mở từ trang Tin thì phải tự chọn yêu cầu: chỉ yêu cầu Đã duyệt hoặc Đang tuyển tạo được tin.
				if (!props.requisition) {
					const [approved, recruiting] = await Promise.all([
						service.findRequisitions({ status: 'APPROVED', limit: 100 }),
						service.findRequisitions({ status: 'RECRUITING', limit: 100 }),
					]);
					openRequisitions.value = [...approved.data, ...recruiting.data];
				}
			}
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Không tải được quy trình mẫu hoặc danh sách yêu cầu');
		} finally {
			loadingLists.value = false;
		}
	});

	const requisitionOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Chọn yêu cầu tuyển dụng...' },
		...openRequisitions.value.map(r => ({
			value: r.id as number | undefined,
			label: `${r.code} · ${r.position.name} · ${r.quantity} người`,
		})),
	]);

	const pipelineOptions = computed(() => [
		...pipelines.value.map(p => ({
			value: p.id as number | undefined,
			label: p.isDefault ? `${p.name} (mặc định)` : p.name,
		})),
	]);

	const ownerOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Người tạo tin' },
		...employees.value.map(e => ({
			value: e.id as number | undefined,
			label: `${e.fullName} (${e.employeeCode})`,
		})),
	]);

	const visibilityOptions = Object.entries(JOB_VISIBILITY_LABELS).map(([value, label]) => ({
		value,
		label,
	}));

	/** Nguồn JD khi để trống mô tả: dùng JD của yêu cầu đang chọn. */
	const pickedRequisition = computed(
		() =>
			props.requisition ??
			openRequisitions.value.find(r => r.id === requisitionId.value) ??
			null,
	);

	const descriptionWillFallBack = computed(
		() => !isEdit.value && !description.value.trim() && !!pickedRequisition.value?.jobDescription,
	);

	const missingDescription = computed(
		() =>
			!isEdit.value && !description.value.trim() && !pickedRequisition.value?.jobDescription,
	);

	function locationList(): string[] | undefined {
		const list = locationsText.value
			.split(',')
			.map(s => s.trim())
			.filter(Boolean);
		return list.length ? list : undefined;
	}

	async function save() {
		if (!isEdit.value && requisitionId.value == null) {
			error.value = 'Chọn yêu cầu tuyển dụng để tạo tin';
			return;
		}
		if (missingDescription.value) {
			error.value =
				'Tin phải có mô tả công việc. Yêu cầu tuyển dụng này cũng chưa có mô tả, nên hãy nhập ở đây.';
			return;
		}

		submitting.value = true;
		error.value = null;
		try {
			const shared = {
				title: toRecruitText(title.value),
				locations: locationList(),
				salaryText: toRecruitText(salaryText.value),
				description: toRecruitText(description.value),
				requirements: toRecruitText(requirements.value),
				benefits: toRecruitText(benefits.value),
				deadline: toRecruitText(deadline.value),
				visibility: visibility.value,
				ownerId: ownerId.value,
				budget: toRecruitNumber(budget.value),
				actualCost: toRecruitNumber(actualCost.value),
				slug: toRecruitText(slug.value),
			};

			if (props.job) {
				const saved = await service.updateJob(props.job.id, shared);
				emit('saved', saved);
			} else {
				const created = await service.createJob({
					requisitionId: requisitionId.value as number,
					pipelineTemplateId: pipelineTemplateId.value,
					...shared,
				});
				emit('created', created.id);
			}
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Lưu tin tuyển dụng thất bại');
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
							{{ isEdit ? 'Sửa tin tuyển dụng' : 'Tạo tin tuyển dụng' }}
						</h2>
						<p v-if="job" class="mt-0.5 font-mono text-xs text-gray-500 dark:text-gray-400">
							{{ job.code }}
						</p>
						<p v-else-if="requisition" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
							Từ yêu cầu <span class="font-mono">{{ requisition.code }}</span>
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
					<div v-if="loadingLists && !isEdit" class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />

					<div v-if="!isEdit && !requisition" class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
							Yêu cầu tuyển dụng <span class="text-red-500">*</span>
						</label>
						<UiSelect v-model="requisitionId" :options="requisitionOptions" />
						<p class="text-xs text-gray-500 dark:text-gray-400">
							Chỉ yêu cầu Đã duyệt hoặc Đang tuyển mới mở được tin.
						</p>
					</div>

					<div v-if="!isEdit" class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Quy trình</label>
						<UiSelect v-model="pipelineTemplateId" :options="pipelineOptions" placeholder="Quy trình mặc định" />
						<p class="text-xs text-gray-500 dark:text-gray-400">
							Tin giữ một bản sao riêng của quy trình, nên sửa vòng của tin sau này không đụng tới quy
							trình mẫu.
						</p>
					</div>

					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div class="space-y-1 sm:col-span-2">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Tiêu đề tin
							</label>
							<input
								v-model="title"
								type="text"
								maxlength="200"
								placeholder="Backend Developer (NestJS)"
								class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
							<p class="text-xs text-gray-500 dark:text-gray-400">
								Để trống thì lấy tên vị trí của yêu cầu.
							</p>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Nơi làm việc</label>
							<input
								v-model="locationsText"
								type="text"
								placeholder="Hà Nội, Đà Nẵng"
								class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
							<p class="text-xs text-gray-500 dark:text-gray-400">Nhiều nơi thì cách nhau dấu phẩy.</p>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Lương hiển thị cho ứng viên
							</label>
							<input
								v-model="salaryText"
								type="text"
								maxlength="100"
								placeholder="18–25 triệu"
								class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
							<p class="text-xs text-gray-500 dark:text-gray-400">
								Đây là dòng chữ cho ứng viên đọc, khác khung lương nội bộ của yêu cầu.
							</p>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Hạn nộp hồ sơ</label>
							<UiDatePicker v-model="deadline" />
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Hiển thị</label>
							<UiSelect v-model="visibility" :options="visibilityOptions" />
							<p v-if="visibility === 'INTERNAL'" class="text-xs text-gray-500 dark:text-gray-400">
								Tin nội bộ không nằm trong danh sách công khai, chỉ ai có link mới mở được.
							</p>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Người phụ trách tin
							</label>
							<UiSelect v-model="ownerId" :options="ownerOptions" />
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Đường dẫn công khai
							</label>
							<input
								v-model="slug"
								type="text"
								maxlength="80"
								placeholder="backend-developer-nestjs"
								class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
							<p class="text-xs text-gray-500 dark:text-gray-400">
								Chữ thường không dấu, số và gạch ngang. Để trống thì hệ thống tự sinh từ tiêu đề.
							</p>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Ngân sách</label>
							<input
								v-model="budget"
								type="number"
								min="0"
								step="1000"
								class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Chi phí thực tế
							</label>
							<input
								v-model="actualCost"
								type="number"
								min="0"
								step="1000"
								class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
							<p class="text-xs text-gray-500 dark:text-gray-400">
								Hai số này vào báo cáo chi phí tuyển dụng.
							</p>
						</div>

						<div class="space-y-1 sm:col-span-2">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Mô tả công việc
								<span v-if="missingDescription" class="text-red-500">*</span>
							</label>
							<textarea
								v-model="description"
								rows="5"
								placeholder="Nội dung ứng viên đọc trên trang tuyển dụng..."
								class="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
							<p v-if="descriptionWillFallBack" class="text-xs text-gray-500 dark:text-gray-400">
								Để trống thì tin lấy mô tả của yêu cầu tuyển dụng.
							</p>
							<p v-else-if="missingDescription" class="text-xs text-amber-600 dark:text-amber-400">
								Yêu cầu tuyển dụng này chưa có mô tả, nên phải nhập ở đây.
							</p>
						</div>

						<div class="space-y-1 sm:col-span-2">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Yêu cầu</label>
							<textarea
								v-model="requirements"
								rows="3"
								class="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
						</div>

						<div class="space-y-1 sm:col-span-2">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Quyền lợi</label>
							<textarea
								v-model="benefits"
								rows="3"
								class="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
						</div>
					</div>

					<p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
						{{ error }}
					</p>

					<div class="flex justify-end gap-3 pt-1">
						<CommonAppButton variant="secondary" type="button" @click="emit('close')">Huỷ</CommonAppButton>
						<CommonAppButton variant="primary" type="submit" :loading="submitting">
							{{ isEdit ? 'Lưu' : 'Tạo tin nháp' }}
						</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
