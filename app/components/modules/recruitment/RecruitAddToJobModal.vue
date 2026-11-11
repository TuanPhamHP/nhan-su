<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import { recruitErrorMessage } from '~/utils/recruitment.utils';
	import type {
		RecruitmentCandidateDetail,
		RecruitmentJob,
		RecruitmentSource,
	} from '~/types/recruitment.types';

	/**
	 * Đưa một ứng viên có sẵn vào một tin, thường là người trong kho tiềm năng.
	 *
	 * Ứng viên đang có hồ sơ **đang xét** ở tin đó thì hệ thống từ chối; còn nếu họ từng bị
	 * loại hoặc đã rút ở tin đó thì hệ thống MỞ LẠI chính hồ sơ cũ về vòng Ứng tuyển chứ
	 * không tạo hồ sơ mới, nên lịch sử không bị tách làm hai.
	 */
	const props = defineProps<{ candidate: RecruitmentCandidateDetail }>();

	const emit = defineEmits<{ added: []; close: [] }>();

	const service = useRecruitmentService();

	const jobs = ref<RecruitmentJob[]>([]);
	const sources = ref<RecruitmentSource[]>([]);
	const jobId = ref<number | undefined>(undefined);
	const sourceId = ref<number | undefined>(props.candidate.sourceId ?? undefined);
	const cvFileId = ref<number | undefined>(undefined);
	const loading = ref(true);
	const submitting = ref(false);
	const error = ref<string | null>(null);

	onMounted(async () => {
		try {
			const [jobRes, sourceList] = await Promise.all([
				service.findJobs({ status: 'OPEN', limit: 100 }),
				service.findSources(true),
			]);
			jobs.value = jobRes.data;
			sources.value = sourceList;
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Không tải được danh sách tin tuyển dụng');
		} finally {
			loading.value = false;
		}
	});

	const jobOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Chọn tin tuyển dụng...' },
		...jobs.value.map(j => ({ value: j.id as number | undefined, label: `${j.code} · ${j.title}` })),
	]);

	const sourceOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Theo nguồn ghi trên ứng viên' },
		...sources.value.map(s => ({ value: s.id as number | undefined, label: s.name })),
	]);

	const cvOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'CV mới nhất của ứng viên' },
		...props.candidate.files
			.filter(f => f.kind === 'CV')
			.map(f => ({ value: f.id as number | undefined, label: f.fileName })),
	]);

	/** Tin ứng viên đang có hồ sơ còn xét — chọn vào đó sẽ bị từ chối. */
	const activeJobIds = computed(
		() => props.candidate.applications.filter(a => a.status === 'ACTIVE').map(a => a.jobId),
	);

	const alreadyActive = computed(() => jobId.value != null && activeJobIds.value.includes(jobId.value));

	const willReopen = computed(
		() =>
			jobId.value != null &&
			props.candidate.applications.some(
				a => a.jobId === jobId.value && (a.status === 'REJECTED' || a.status === 'WITHDRAWN'),
			),
	);

	async function save() {
		if (jobId.value == null) {
			error.value = 'Chọn tin tuyển dụng';
			return;
		}
		submitting.value = true;
		error.value = null;
		try {
			await service.addCandidateToJob(props.candidate.id, {
				jobId: jobId.value,
				sourceId: sourceId.value,
				cvFileId: cvFileId.value,
			});
			emit('added');
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Thêm ứng viên vào tin thất bại');
		} finally {
			submitting.value = false;
		}
	}
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-4">
			<div class="my-8 w-full max-w-md rounded-2xl bg-white shadow-xl dark:bg-gray-900">
				<div class="flex items-start justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
					<div>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Thêm vào tin tuyển dụng</h2>
						<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ candidate.fullName }}</p>
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

				<form class="space-y-4 p-6" @submit.prevent="save">
					<div v-if="loading" class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />

					<template v-else>
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Tin tuyển dụng <span class="text-red-500">*</span>
							</label>
							<UiSelect v-model="jobId" :options="jobOptions" />
							<p v-if="alreadyActive" class="text-xs text-amber-600 dark:text-amber-400">
								Ứng viên đang có hồ sơ còn xét ở tin này, nên hệ thống sẽ từ chối. Hãy đóng hồ sơ cũ
								trước, hoặc chọn tin khác.
							</p>
							<p v-else-if="willReopen" class="text-xs text-gray-500 dark:text-gray-400">
								Ứng viên từng ứng tuyển tin này, nên hệ thống mở lại chính hồ sơ cũ về vòng Ứng tuyển.
							</p>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Nguồn</label>
							<UiSelect v-model="sourceId" :options="sourceOptions" />
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								CV dùng cho lần ứng tuyển này
							</label>
							<UiSelect v-model="cvFileId" :options="cvOptions" />
						</div>
					</template>

					<p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
						{{ error }}
					</p>

					<div class="flex justify-end gap-3 pt-1">
						<CommonAppButton variant="secondary" type="button" @click="emit('close')">Huỷ</CommonAppButton>
						<CommonAppButton variant="primary" type="submit" :loading="submitting">Thêm</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
