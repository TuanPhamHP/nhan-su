<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import { downloadRecruitmentBlob, recruitErrorMessage } from '~/utils/recruitment.utils';
	import type {
		RecruitmentBulkCvResult,
		RecruitmentImportResult,
		RecruitmentJob,
	} from '~/types/recruitment.types';

	/**
	 * Hai cách đưa nhiều ứng viên vào hệ thống một lúc.
	 *
	 * - **Nhập Excel**: mỗi dòng là một ứng viên đầy đủ. Dòng hợp lệ được tạo, dòng hỏng trả
	 *   về kèm số dòng để sửa file rồi nhập lại — nên luôn hiện danh sách lỗi theo dòng thay
	 *   vì một câu "nhập thất bại".
	 * - **Tải nhiều CV**: mỗi file thành một ứng viên NHÁP, họ tên tạm lấy theo tên file; HR
	 *   mở từng người để điền email và số điện thoại, lần lưu đầu bỏ cờ nháp.
	 */
	const emit = defineEmits<{ done: []; close: [] }>();

	const service = useRecruitmentService();
	const toast = useToast();

	const mode = ref<'excel' | 'cv'>('excel');

	const excelFile = ref<File | null>(null);
	const cvFiles = ref<File[]>([]);
	const cvJobId = ref<number | undefined>(undefined);
	const jobs = ref<RecruitmentJob[]>([]);

	const submitting = ref(false);
	const downloading = ref(false);
	const error = ref<string | null>(null);
	const excelResult = ref<RecruitmentImportResult | null>(null);
	const cvResults = ref<RecruitmentBulkCvResult[]>([]);

	onMounted(async () => {
		try {
			const res = await service.findJobs({ status: 'OPEN', limit: 100 });
			jobs.value = res.data;
		} catch {
			// Không có danh sách tin thì vẫn nhập được, chỉ là không gắn vào tin nào.
		}
	});

	const jobOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Không gắn vào tin nào' },
		...jobs.value.map(j => ({ value: j.id as number | undefined, label: `${j.code} · ${j.title}` })),
	]);

	async function downloadTemplate() {
		downloading.value = true;
		try {
			const blob = await service.downloadCandidateImportTemplate();
			downloadRecruitmentBlob(blob, 'mau-nhap-ung-vien.xlsx');
		} catch (e) {
			toast.error(recruitErrorMessage(e, 'Không tải được file mẫu'));
		} finally {
			downloading.value = false;
		}
	}

	// Ô chọn file tự kiểm định dạng và dung lượng từng file; ở đây chỉ còn trần số lượng,
	// vì BE nhận tối đa 50 file mỗi lần.
	watch(excelFile, () => {
		excelResult.value = null;
		error.value = null;
	});

	watch(cvFiles, list => {
		cvResults.value = [];
		error.value = list.length > 50 ? 'Mỗi lần tải tối đa 50 file CV' : null;
	});

	async function importExcel() {
		if (!excelFile.value) {
			error.value = 'Chọn file Excel theo mẫu';
			return;
		}
		submitting.value = true;
		error.value = null;
		try {
			excelResult.value = await service.importCandidates(excelFile.value);
			if (!excelResult.value.errors.length) {
				toast.success(`Đã nhập ${excelResult.value.created} ứng viên`);
				emit('done');
			}
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Nhập file thất bại');
		} finally {
			submitting.value = false;
		}
	}

	async function uploadCvs() {
		if (!cvFiles.value.length) {
			error.value = 'Chọn ít nhất một file CV';
			return;
		}
		submitting.value = true;
		error.value = null;
		try {
			cvResults.value = await service.uploadBulkCv(cvFiles.value, cvJobId.value);
			const ok = cvResults.value.filter(r => r.ok).length;
			if (ok === cvResults.value.length) {
				toast.success(`Đã tạo ${ok} ứng viên nháp`);
				emit('done');
			}
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Tải CV thất bại');
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
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Nhập nhiều ứng viên</h2>
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

				<div class="border-b border-gray-200 px-6 dark:border-gray-700">
					<nav class="-mb-px flex gap-1">
						<button
							v-for="t in [
								{ id: 'excel', label: 'Nhập từ Excel' },
								{ id: 'cv', label: 'Tải nhiều CV' },
							]"
							:key="t.id"
							type="button"
							class="border-b-2 px-4 py-2.5 text-sm font-medium transition-colors"
							:class="
								mode === t.id
									? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
									: 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
							"
							@click="mode = t.id as 'excel' | 'cv'"
						>
							{{ t.label }}
						</button>
					</nav>
				</div>

				<div class="max-h-[60vh] space-y-4 overflow-y-auto p-6">
					<template v-if="mode === 'excel'">
						<p class="text-sm text-gray-600 dark:text-gray-300">
							Mỗi dòng là một ứng viên, tối đa 2.000 dòng một lần. Dòng trùng email hoặc số điện thoại
							với ứng viên đã có sẽ báo lỗi chứ hệ thống không tự gộp, nên hãy gộp tay ở màn Ứng viên
							sau khi nhập.
						</p>

						<CommonAppButton variant="outline" size="sm" :loading="downloading" @click="downloadTemplate">
							Tải file mẫu
						</CommonAppButton>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">File Excel</label>
							<UiFileDropzone v-model="excelFile" accept=".xlsx" :max-size-mb="10" />
						</div>

						<div
							v-if="excelResult"
							class="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700"
						>
							<p class="text-sm text-gray-700 dark:text-gray-300">
								Đã tạo {{ excelResult.created }} ứng viên.
								<template v-if="excelResult.errors.length">
									Còn {{ excelResult.errors.length }} dòng chưa nhập được.
								</template>
							</p>
							<ul v-if="excelResult.errors.length" class="mt-2 space-y-1">
								<li
									v-for="row in excelResult.errors"
									:key="row.row"
									class="rounded bg-rose-50 px-2 py-1 text-xs text-rose-700 dark:bg-rose-900/20 dark:text-rose-300"
								>
									Dòng {{ row.row }}: {{ row.message }}
								</li>
							</ul>
						</div>
					</template>

					<template v-else>
						<p class="text-sm text-gray-600 dark:text-gray-300">
							Mỗi file thành một ứng viên nháp, họ tên tạm lấy theo tên file. Mở từng người để điền
							email và số điện thoại; lần lưu đầu tiên sẽ bỏ cờ nháp.
						</p>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Gắn vào tin tuyển dụng
							</label>
							<UiSelect v-model="cvJobId" :options="jobOptions" />
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								File CV (tối đa 50 file)
							</label>
							<UiFileDropzone
								v-model="cvFiles"
								multiple
								accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
								:max-size-mb="5"
								hint="PDF, DOC, DOCX, JPG hoặc PNG · mỗi file tối đa 5 MB · tối đa 50 file"
							/>
						</div>

						<ul v-if="cvResults.length" class="space-y-1">
							<li
								v-for="row in cvResults"
								:key="row.fileName"
								class="rounded px-2 py-1 text-xs"
								:class="
									row.ok
										? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
										: 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300'
								"
							>
								{{ row.fileName }}:
								<template v-if="row.ok">đã tạo ứng viên nháp</template>
								<template v-else>{{ row.message }}</template>
							</li>
						</ul>
					</template>

					<p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
						{{ error }}
					</p>
				</div>

				<div class="flex justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
					<CommonAppButton variant="secondary" @click="emit('close')">Đóng</CommonAppButton>
					<CommonAppButton
						v-if="mode === 'excel'"
						variant="primary"
						:loading="submitting"
						@click="importExcel"
					>
						Nhập file
					</CommonAppButton>
					<CommonAppButton v-else variant="primary" :loading="submitting" @click="uploadCvs">
						Tải {{ cvFiles.length || '' }} CV
					</CommonAppButton>
				</div>
			</div>
		</div>
	</Teleport>
</template>
