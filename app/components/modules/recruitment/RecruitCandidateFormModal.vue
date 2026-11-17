<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import { recruitErrorMessage, toRecruitNumber, toRecruitText } from '~/utils/recruitment.utils';
	import {
		CONSENT_BASIS_LABELS,
		GENDER_OPTIONS,
		type CreateCandidateBody,
		type RecruitmentCandidateDetail,
		type RecruitmentConsentBasis,
		type RecruitmentDuplicateMatch,
		type RecruitmentGender,
		type RecruitmentJob,
		type RecruitmentSource,
		type RecruitmentTag,
	} from '~/types/recruitment.types';

	/**
	 * Thêm hoặc sửa một ứng viên.
	 *
	 * **BE không tự chặn ứng viên trùng**, nên cảnh báo trùng là việc của màn hình này: rời ô
	 * email hay số điện thoại thì gọi `check-duplicates` và hiện danh sách người trùng kèm
	 * đường dẫn mở hồ sơ của họ. Cảnh báo không chặn lưu, vì có khi đúng là hai người khác
	 * nhau dùng chung số điện thoại nhà.
	 */
	const props = defineProps<{ candidate?: RecruitmentCandidateDetail }>();

	const emit = defineEmits<{ saved: [candidate: RecruitmentCandidateDetail]; close: [] }>();

	const service = useRecruitmentService();

	const isEdit = computed(() => !!props.candidate);

	const fullName = ref(props.candidate?.fullName ?? '');
	const email = ref(props.candidate?.email ?? '');
	const phone = ref(props.candidate?.phone ?? '');
	const consentBasis = ref<RecruitmentConsentBasis>('CANDIDATE_APPLIED');
	const consentNote = ref('');
	const talentPoolConsent = ref(false);
	const jobId = ref<number | undefined>(undefined);
	const sourceId = ref<number | undefined>(props.candidate?.sourceId ?? undefined);
	const tagIds = ref<number[]>(props.candidate?.tags.map(t => t.id) ?? []);
	const dateOfBirth = ref(props.candidate?.dateOfBirth ?? '');
	const gender = ref<RecruitmentGender | undefined>(props.candidate?.gender ?? undefined);
	const address = ref(props.candidate?.address ?? '');
	const educationLevel = ref(props.candidate?.educationLevel ?? '');
	const school = ref(props.candidate?.school ?? '');
	const yearsOfExperience = ref<string | number>(props.candidate?.yearsOfExperience ?? '');
	const currentTitle = ref(props.candidate?.currentTitle ?? '');
	const currentCompany = ref(props.candidate?.currentCompany ?? '');
	const linkedinUrl = ref(props.candidate?.linkedinUrl ?? '');
	const portfolioUrl = ref(props.candidate?.portfolioUrl ?? '');
	const expectedSalary = ref<string | number>(props.candidate?.expectedSalary ?? '');

	const cvFile = ref<File | null>(null);

	const sources = ref<RecruitmentSource[]>([]);
	const tags = ref<RecruitmentTag[]>([]);
	const jobs = ref<RecruitmentJob[]>([]);
	const duplicates = ref<RecruitmentDuplicateMatch[]>([]);
	const checkingDuplicates = ref(false);
	const submitting = ref(false);
	const error = ref<string | null>(null);

	onMounted(async () => {
		try {
			const [sourceList, tagList] = await Promise.all([
				service.findSources(true),
				service.findTags(true),
			]);
			sources.value = sourceList;
			tags.value = tagList;
			if (!isEdit.value) {
				// Chỉ tin còn nhận hồ sơ mới có nghĩa khi thêm ứng viên vào tin.
				const res = await service.findJobs({ status: 'OPEN', limit: 100 });
				jobs.value = res.data;
			}
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Không tải được danh mục nguồn và tag');
		}
	});

	const sourceOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Chưa rõ nguồn' },
		...sources.value.map(s => ({ value: s.id as number | undefined, label: s.name })),
	]);

	const jobOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Không gắn vào tin nào' },
		...jobs.value.map(j => ({ value: j.id as number | undefined, label: `${j.code} · ${j.title}` })),
	]);

	const genderOptions = [
		{ value: undefined as string | undefined, label: 'Không ghi' },
		...GENDER_OPTIONS.map(g => ({ value: g as string | undefined, label: g })),
	];

	const consentBasisOptions = Object.entries(CONSENT_BASIS_LABELS).map(([value, label]) => ({
		value,
		label,
	}));

	function toggleTag(id: number) {
		tagIds.value = tagIds.value.includes(id)
			? tagIds.value.filter(x => x !== id)
			: [...tagIds.value, id];
	}

	// ─── Kiểm trùng ───────────────────────────────────────────────────────────────

	async function checkDuplicates() {
		const e = email.value.trim();
		const p = phone.value.trim();
		if (!e && !p) {
			duplicates.value = [];
			return;
		}
		checkingDuplicates.value = true;
		try {
			const found = await service.checkDuplicates({ email: e || undefined, phone: p || undefined });
			// Khi sửa, chính ứng viên này không phải là bản trùng.
			duplicates.value = found.filter(d => d.id !== props.candidate?.id);
		} catch {
			// Kiểm trùng hỏng không được chặn việc lưu: để danh sách rỗng và đi tiếp.
			duplicates.value = [];
		} finally {
			checkingDuplicates.value = false;
		}
	}

	const hasBlacklistedDuplicate = computed(() => duplicates.value.some(d => d.isBlacklisted === true));

	// ─── Lưu ──────────────────────────────────────────────────────────────────────

	async function save() {
		if (!fullName.value.trim()) {
			error.value = 'Nhập họ tên ứng viên';
			return;
		}
		if (!email.value.trim() && !phone.value.trim()) {
			error.value = 'Ứng viên phải có email hoặc số điện thoại';
			return;
		}

		submitting.value = true;
		error.value = null;
		try {
			if (props.candidate) {
				const saved = await service.updateCandidate(props.candidate.id, {
					fullName: fullName.value.trim(),
					email: toRecruitText(email.value),
					phone: toRecruitText(phone.value),
					sourceId: sourceId.value,
					dateOfBirth: toRecruitText(dateOfBirth.value),
					gender: gender.value,
					address: toRecruitText(address.value),
					educationLevel: toRecruitText(educationLevel.value),
					school: toRecruitText(school.value),
					yearsOfExperience: toRecruitNumber(yearsOfExperience.value),
					currentTitle: toRecruitText(currentTitle.value),
					currentCompany: toRecruitText(currentCompany.value),
					linkedinUrl: toRecruitText(linkedinUrl.value),
					portfolioUrl: toRecruitText(portfolioUrl.value),
					expectedSalary: toRecruitNumber(expectedSalary.value),
				});
				// Tag đi qua route riêng vì đó là thao tác thay toàn bộ danh sách.
				const current = props.candidate.tags.map(t => t.id).sort().join(',');
				const next = [...tagIds.value].sort().join(',');
				const withTags = current === next ? saved : await service.saveCandidateTags(saved.id, tagIds.value);
				emit('saved', withTags);
			} else {
				const body: CreateCandidateBody = {
					fullName: fullName.value.trim(),
					email: toRecruitText(email.value),
					phone: toRecruitText(phone.value),
					consentBasis: consentBasis.value,
					consentNote: toRecruitText(consentNote.value),
					talentPoolConsent: talentPoolConsent.value,
					jobId: jobId.value,
					sourceId: sourceId.value,
					tagIds: tagIds.value.length ? tagIds.value : undefined,
					dateOfBirth: toRecruitText(dateOfBirth.value),
					gender: gender.value,
					address: toRecruitText(address.value),
					educationLevel: toRecruitText(educationLevel.value),
					school: toRecruitText(school.value),
					yearsOfExperience: toRecruitNumber(yearsOfExperience.value),
					currentTitle: toRecruitText(currentTitle.value),
					currentCompany: toRecruitText(currentCompany.value),
					linkedinUrl: toRecruitText(linkedinUrl.value),
					portfolioUrl: toRecruitText(portfolioUrl.value),
					expectedSalary: toRecruitNumber(expectedSalary.value),
					cv: cvFile.value ?? undefined,
				};
				const saved = await service.createCandidate(body);
				emit('saved', saved);
			}
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Lưu ứng viên thất bại');
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
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">
						{{ isEdit ? 'Sửa thông tin ứng viên' : 'Thêm ứng viên' }}
					</h2>
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
								Họ tên <span class="text-red-500">*</span>
							</label>
							<input
								v-model="fullName"
								type="text"
								maxlength="150"
								class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
							<input
								v-model="email"
								type="email"
								maxlength="200"
								class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
								@blur="checkDuplicates"
							/>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Số điện thoại</label>
							<input
								v-model="phone"
								type="tel"
								maxlength="30"
								class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
								@blur="checkDuplicates"
							/>
							<p class="text-xs text-gray-500 dark:text-gray-400">
								Phải có ít nhất email hoặc số điện thoại.
							</p>
						</div>

						<!-- Cảnh báo trùng -->
						<div v-if="checkingDuplicates" class="sm:col-span-2">
							<p class="text-xs text-gray-500 dark:text-gray-400">Đang kiểm trùng...</p>
						</div>

						<div
							v-else-if="duplicates.length"
							class="rounded-lg border px-3 py-2 sm:col-span-2"
							:class="
								hasBlacklistedDuplicate
									? 'border-rose-300 bg-rose-50 dark:border-rose-700 dark:bg-rose-900/20'
									: 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20'
							"
						>
							<p
								class="text-sm font-medium"
								:class="
									hasBlacklistedDuplicate
										? 'text-rose-800 dark:text-rose-200'
										: 'text-amber-800 dark:text-amber-200'
								"
							>
								<template v-if="hasBlacklistedDuplicate">
									Trùng với ứng viên đã đánh dấu không tái tuyển
								</template>
								<template v-else>Có {{ duplicates.length }} ứng viên trùng email hoặc số điện thoại</template>
							</p>
							<ul class="mt-1 space-y-0.5">
								<li v-for="d in duplicates" :key="d.id" class="text-sm">
									<NuxtLink
										:to="`/management/recruitment/candidates/${d.id}`"
										target="_blank"
										class="text-brand-700 hover:underline dark:text-brand-300"
									>
										{{ d.fullName }}
									</NuxtLink>
									<span class="text-gray-600 dark:text-gray-400">
										· trùng {{ d.matchedBy.map(m => (m === 'EMAIL' ? 'email' : 'số điện thoại')).join(' và ') }}
									</span>
								</li>
							</ul>
							<p class="mt-1 text-xs text-gray-600 dark:text-gray-400">
								Cảnh báo này không chặn lưu. Nếu đúng là một người thì lưu xong hãy gộp hai hồ sơ.
							</p>
						</div>

						<template v-if="!isEdit">
							<div class="space-y-1">
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
									Căn cứ xử lý dữ liệu <span class="text-red-500">*</span>
								</label>
								<UiSelect v-model="consentBasis" :options="consentBasisOptions" />
							</div>

							<div class="space-y-1">
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
									Ghi chú căn cứ
								</label>
								<input
									v-model="consentNote"
									type="text"
									maxlength="1000"
									placeholder="Ứng viên gửi CV qua email ngày 10/11"
									class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
								/>
							</div>

							<label class="flex items-start gap-2 sm:col-span-2">
								<input
									v-model="talentPoolConsent"
									type="checkbox"
									class="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
								/>
								<span class="text-sm text-gray-700 dark:text-gray-300">
									Ứng viên đã đồng ý lưu hồ sơ vào kho tiềm năng
									<span class="block text-xs text-gray-500 dark:text-gray-400">
										Tích ô này thì hệ thống ghi nhận đồng ý và đưa luôn vào kho. Không có đồng ý thì
										sau này không đưa vào kho được.
									</span>
								</span>
							</label>

							<div class="space-y-1">
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
									Gắn vào tin tuyển dụng
								</label>
								<UiSelect v-model="jobId" :options="jobOptions" />
							</div>

							<div class="space-y-1">
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">CV</label>
								<UiFileDropzone
									v-model="cvFile"
									accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
									:max-size-mb="5"
								/>
							</div>
						</template>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Nguồn</label>
							<UiSelect v-model="sourceId" :options="sourceOptions" />
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Lương mong muốn
							</label>
							<input
								v-model="expectedSalary"
								type="number"
								min="0"
								step="1000"
								class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Vị trí hiện tại</label>
							<input
								v-model="currentTitle"
								type="text"
								maxlength="150"
								class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Công ty hiện tại</label>
							<input
								v-model="currentCompany"
								type="text"
								maxlength="200"
								class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Số năm kinh nghiệm
							</label>
							<input
								v-model="yearsOfExperience"
								type="number"
								min="0"
								max="60"
								step="0.5"
								class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Ngày sinh</label>
							<UiDatePicker v-model="dateOfBirth" />
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Giới tính</label>
							<UiSelect v-model="gender" :options="genderOptions" />
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Trình độ</label>
							<input
								v-model="educationLevel"
								type="text"
								maxlength="100"
								class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Trường</label>
							<input
								v-model="school"
								type="text"
								maxlength="200"
								class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
						</div>

						<div class="space-y-1 sm:col-span-2">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Địa chỉ</label>
							<input
								v-model="address"
								type="text"
								maxlength="300"
								class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">LinkedIn</label>
							<input
								v-model="linkedinUrl"
								type="url"
								maxlength="300"
								placeholder="https://linkedin.com/in/..."
								class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Portfolio</label>
							<input
								v-model="portfolioUrl"
								type="url"
								maxlength="300"
								placeholder="https://..."
								class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
						</div>

						<div v-if="tags.length" class="space-y-1 sm:col-span-2">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Tag</label>
							<div class="flex flex-wrap gap-2">
								<button
									v-for="tag in tags"
									:key="tag.id"
									type="button"
									class="rounded-full border px-3 py-1 text-xs transition-colors"
									:class="
										tagIds.includes(tag.id)
											? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300'
											: 'border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300'
									"
									@click="toggleTag(tag.id)"
								>
									{{ tag.name }}
								</button>
							</div>
						</div>
					</div>

					<p
						v-if="isEdit"
						class="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-800/60 dark:text-gray-300"
					>
						Trường đã có giá trị thì để trống không xoá được giá trị cũ, vì hệ thống coi ô trống là
						"không đổi".
					</p>

					<p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
						{{ error }}
					</p>

					<div class="flex justify-end gap-3 pt-1">
						<CommonAppButton variant="secondary" type="button" @click="emit('close')">Huỷ</CommonAppButton>
						<CommonAppButton variant="primary" type="submit" :loading="submitting">
							{{ isEdit ? 'Lưu' : 'Thêm ứng viên' }}
						</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
