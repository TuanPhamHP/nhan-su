<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import RecruitChip from '~/components/modules/recruitment/RecruitChip.vue';
	import RecruitCandidateFormModal from '~/components/modules/recruitment/RecruitCandidateFormModal.vue';
	import RecruitCandidateMergeModal from '~/components/modules/recruitment/RecruitCandidateMergeModal.vue';
	import RecruitCandidateTimeline from '~/components/modules/recruitment/RecruitCandidateTimeline.vue';
	import RecruitCandidateComments from '~/components/modules/recruitment/RecruitCandidateComments.vue';
	import RecruitCandidateEmails from '~/components/modules/recruitment/RecruitCandidateEmails.vue';
	import RecruitAddToJobModal from '~/components/modules/recruitment/RecruitAddToJobModal.vue';
	import RecruitNotePromptModal from '~/components/modules/recruitment/RecruitNotePromptModal.vue';
	import {
		formatFileSizeVn,
		formatRecruitMoney,
		openPresignedUrl,
		recruitErrorMessage,
		APPLICATION_STATUS_CLASS,
	} from '~/utils/recruitment.utils';
	import { formatDate, formatDateTime } from '~/utils/date';
	import type { RecruitmentCandidateDetail } from '~/types/recruitment.types';

	definePageMeta({ title: 'Hồ sơ ứng viên' });

	const route = useRoute();
	const router = useRouter();
	const toast = useToast();
	const service = useRecruitmentService();
	const { canWrite } = useModuleAccess();
	const { hasPermission } = usePermissions();

	const candidateId = computed(() => Number(route.params.id));
	const item = ref<RecruitmentCandidateDetail | null>(null);
	const loading = ref(true);
	const loadError = ref<string | null>(null);
	const acting = ref(false);

	const writable = computed(() => canWrite('RECRUIT'));
	const canManage = computed(() => writable.value && hasPermission('recruitment:manage'));

	const activeTab = ref<'info' | 'timeline' | 'comments' | 'emails'>('info');

	const showEdit = ref(false);
	const showMerge = ref(false);
	const showAddToJob = ref(false);
	const blacklisting = ref(false);
	const unblacklisting = ref(false);
	const anonymizing = ref(false);
	const uploadingFile = ref(false);
	/** File vừa chọn ở ô kéo thả; tải lên ngay rồi xoá khỏi ô. */
	const pickedFile = ref<File | null>(null);

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			item.value = await service.findCandidate(candidateId.value);
		} catch (e) {
			item.value = null;
			loadError.value = recruitErrorMessage(e, 'Không mở được hồ sơ ứng viên này');
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);
	watch(candidateId, load);

	/**
	 * Ứng viên đã ẩn danh thì mọi thao tác ghi đều bị từ chối, nên khoá hết nút thay vì để
	 * người dùng bấm rồi nhận lỗi.
	 */
	const anonymized = computed(() => !!item.value?.anonymizedAt);
	const editable = computed(() => canManage.value && !anonymized.value);

	const tabs = [
		{ id: 'info', label: 'Thông tin' },
		{ id: 'timeline', label: 'Lịch sử' },
		{ id: 'comments', label: 'Bình luận' },
		{ id: 'emails', label: 'Email' },
	] as const;

	async function run(action: () => Promise<RecruitmentCandidateDetail>, okMessage: string) {
		if (acting.value) return;
		acting.value = true;
		try {
			item.value = await action();
			toast.success(okMessage);
		} catch (e) {
			toast.error(recruitErrorMessage(e, 'Thao tác thất bại'));
		} finally {
			acting.value = false;
		}
	}

	const addToPool = () =>
		run(() => service.addToTalentPool(candidateId.value), 'Đã đưa vào kho tiềm năng');
	const removeFromPool = () =>
		run(() => service.removeFromTalentPool(candidateId.value), 'Đã gỡ khỏi kho tiềm năng');

	/** Thiếu đồng ý lưu kho thì BE từ chối; ghi nhận đồng ý xong mới đưa vào kho được. */
	async function recordPoolConsent() {
		await run(
			() =>
				service.recordConsent(candidateId.value, {
					kind: 'TALENT_POOL',
					basis: 'WRITTEN_CONSENT',
					note: 'Ghi nhận tại màn hồ sơ ứng viên',
				}),
			'Đã ghi nhận đồng ý lưu kho, giờ đưa vào kho được rồi',
		);
	}

	async function doBlacklist(reason: string) {
		item.value = await service.blacklistCandidate(candidateId.value, reason);
	}

	async function doUnblacklist(note: string) {
		item.value = await service.unblacklistCandidate(candidateId.value, note);
	}

	async function doAnonymize(reason: string) {
		await service.anonymizeCandidate(candidateId.value, reason);
	}

	function onAnonymized() {
		anonymizing.value = false;
		toast.success('Đã xoá dữ liệu ứng viên');
		router.push('/management/recruitment/candidates');
	}

	async function openFile(fileId: number) {
		try {
			await openPresignedUrl(() => service.candidateFileUrl(fileId));
		} catch (e) {
			toast.error(recruitErrorMessage(e, 'Không mở được file'));
		}
	}

	// Chọn xong là tải luôn: màn hình này không có nút Lưu nào để gom lại.
	watch(pickedFile, async file => {
		if (!file || uploadingFile.value) return;
		uploadingFile.value = true;
		try {
			await service.uploadCandidateFile(candidateId.value, file, 'OTHER');
			toast.success('Đã tải tài liệu');
			await load();
		} catch (err) {
			toast.error(recruitErrorMessage(err, 'Tải tài liệu thất bại'));
		} finally {
			uploadingFile.value = false;
			pickedFile.value = null;
		}
	});

	function onMerged(keptId: number) {
		showMerge.value = false;
		toast.success('Đã gộp hai hồ sơ');
		// Bản giữ lại là bản tạo sau, nên id có thể khác hồ sơ đang mở.
		if (keptId === candidateId.value) load();
		else router.push(`/management/recruitment/candidates/${keptId}`);
	}
</script>

<template>
	<div class="space-y-5">
		<NuxtLink
			to="/management/recruitment/candidates"
			class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
			Kho ứng viên
		</NuxtLink>

		<CommonAppModuleNotice module="RECRUIT" />

		<div v-if="loading" class="space-y-4">
			<div class="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
			<div class="h-64 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>

		<div
			v-else-if="loadError"
			class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-center dark:border-rose-800 dark:bg-rose-900/20"
		>
			<p class="text-sm text-rose-700 dark:text-rose-300">{{ loadError }}</p>
			<NuxtLink
				to="/management/recruitment/candidates"
				class="mt-2 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400"
			>
				Quay lại kho ứng viên
			</NuxtLink>
		</div>

		<template v-else-if="item">
			<!-- Banner cảnh báo -->
			<div
				v-if="item.isBlacklisted === true"
				class="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 dark:border-rose-700 dark:bg-rose-900/20"
			>
				<p class="text-sm font-medium text-rose-800 dark:text-rose-200">
					Ứng viên này đã được đánh dấu không tái tuyển
				</p>
				<p v-if="item.blacklistReason" class="mt-1 text-sm text-rose-700 dark:text-rose-300">
					{{ item.blacklistReason }}
				</p>
				<p v-if="item.blacklistedAt" class="mt-0.5 text-xs text-rose-600 dark:text-rose-400">
					Đánh dấu ngày {{ formatDate(item.blacklistedAt) }}
				</p>
			</div>

			<div
				v-else-if="item.duplicateBlacklisted === true"
				class="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 dark:border-rose-700 dark:bg-rose-900/20"
			>
				<p class="text-sm text-rose-800 dark:text-rose-200">
					Hồ sơ này trùng email hoặc số điện thoại với một ứng viên đã bị đánh dấu không tái tuyển.
				</p>
			</div>

			<div
				v-if="anonymized"
				class="rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 dark:border-gray-600 dark:bg-gray-800/60"
			>
				<p class="text-sm text-gray-700 dark:text-gray-300">
					Dữ liệu của ứng viên này đã được xoá theo yêu cầu, nên mọi thao tác sửa đều bị khoá.
				</p>
			</div>

			<div
				v-else-if="item.minimizedAt"
				class="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/60"
			>
				<p class="text-sm text-gray-700 dark:text-gray-300">
					Hồ sơ đã được thu gọn theo thời hạn lưu dữ liệu, nên chỉ còn họ tên, liên hệ và thông tin
					đánh dấu.
				</p>
			</div>

			<div
				v-if="item.duplicates.length && item.duplicateBlacklisted !== true"
				class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-900/20"
			>
				<p class="text-sm text-amber-800 dark:text-amber-200">
					Có {{ item.duplicates.length }} hồ sơ trùng email hoặc số điện thoại với người này.
				</p>
				<CommonAppButton v-if="editable" variant="outline" size="sm" @click="showMerge = true">
					Gộp hồ sơ
				</CommonAppButton>
			</div>

			<!-- Đầu trang -->
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div class="min-w-0">
					<div class="flex flex-wrap items-center gap-2">
						<h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ item.fullName }}</h1>
						<RecruitChip
							v-if="item.isDraft"
							label="Hồ sơ nháp"
							tone="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
						/>
						<RecruitChip
							v-if="item.inTalentPool"
							label="Kho tiềm năng"
							tone="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
						/>
					</div>
					<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
						{{ [item.currentTitle, item.currentCompany].filter(Boolean).join(' · ') || 'Chưa ghi nơi làm việc' }}
					</p>
				</div>

				<div v-if="editable" class="flex flex-wrap items-center gap-2">
					<CommonAppButton variant="outline" size="sm" @click="showEdit = true">Sửa</CommonAppButton>
					<CommonAppButton variant="outline" size="sm" @click="showAddToJob = true">
						Thêm vào tin
					</CommonAppButton>
					<CommonAppButton
						v-if="!item.inTalentPool"
						variant="outline"
						size="sm"
						:loading="acting"
						@click="addToPool"
					>
						Lưu vào kho tiềm năng
					</CommonAppButton>
					<CommonAppButton v-else variant="outline" size="sm" :loading="acting" @click="removeFromPool">
						Gỡ khỏi kho
					</CommonAppButton>
					<CommonAppButton
						v-if="item.canSeeBlacklist && item.isBlacklisted !== true"
						variant="danger_outline"
						size="sm"
						@click="blacklisting = true"
					>
						Đánh dấu không tái tuyển
					</CommonAppButton>
					<CommonAppButton
						v-if="item.canSeeBlacklist && item.isBlacklisted === true"
						variant="outline"
						size="sm"
						@click="unblacklisting = true"
					>
						Gỡ đánh dấu
					</CommonAppButton>
				</div>
			</div>

			<!-- Tab -->
			<div class="border-b border-gray-200 dark:border-gray-700">
				<nav class="-mb-px flex flex-wrap gap-1">
					<button
						v-for="t in tabs"
						:key="t.id"
						type="button"
						class="border-b-2 px-4 py-2.5 text-sm font-medium transition-colors"
						:class="
							activeTab === t.id
								? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
								: 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
						"
						@click="activeTab = t.id"
					>
						{{ t.label }}
					</button>
				</nav>
			</div>

			<template v-if="activeTab === 'info'">
				<div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
					<div class="space-y-5 lg:col-span-2">
						<!-- Thông tin -->
						<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
							<h2 class="text-base font-semibold text-gray-900 dark:text-white">Thông tin cá nhân</h2>
							<dl class="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
								<div>
									<dt class="text-xs text-gray-500 dark:text-gray-400">Email</dt>
									<dd class="truncate text-sm text-gray-900 dark:text-white">{{ item.email ?? '—' }}</dd>
								</div>
								<div>
									<dt class="text-xs text-gray-500 dark:text-gray-400">Điện thoại</dt>
									<dd class="text-sm text-gray-900 dark:text-white">{{ item.phone ?? '—' }}</dd>
								</div>
								<div>
									<dt class="text-xs text-gray-500 dark:text-gray-400">Lương mong muốn</dt>
									<dd class="text-sm text-gray-900 dark:text-white">
										<template v-if="item.canViewSalary">
											{{ formatRecruitMoney(item.expectedSalary) }}
										</template>
										<template v-else>
											<span class="text-gray-400">Bạn không được xem</span>
										</template>
									</dd>
								</div>
								<div>
									<dt class="text-xs text-gray-500 dark:text-gray-400">Kinh nghiệm</dt>
									<dd class="text-sm text-gray-900 dark:text-white">
										{{ item.yearsOfExperience != null ? `${item.yearsOfExperience} năm` : '—' }}
									</dd>
								</div>
								<div>
									<dt class="text-xs text-gray-500 dark:text-gray-400">Ngày sinh</dt>
									<dd class="text-sm text-gray-900 dark:text-white">
										{{ item.dateOfBirth ? formatDate(item.dateOfBirth) : '—' }}
									</dd>
								</div>
								<div>
									<dt class="text-xs text-gray-500 dark:text-gray-400">Giới tính</dt>
									<dd class="text-sm text-gray-900 dark:text-white">{{ item.gender ?? '—' }}</dd>
								</div>
								<div>
									<dt class="text-xs text-gray-500 dark:text-gray-400">Học vấn</dt>
									<dd class="text-sm text-gray-900 dark:text-white">
										{{ [item.educationLevel, item.school].filter(Boolean).join(' · ') || '—' }}
									</dd>
								</div>
								<div>
									<dt class="text-xs text-gray-500 dark:text-gray-400">Nguồn</dt>
									<dd class="text-sm text-gray-900 dark:text-white">{{ item.source?.name ?? '—' }}</dd>
								</div>
								<div class="sm:col-span-2">
									<dt class="text-xs text-gray-500 dark:text-gray-400">Địa chỉ</dt>
									<dd class="text-sm text-gray-900 dark:text-white">{{ item.address ?? '—' }}</dd>
								</div>
								<div v-if="item.linkedinUrl || item.portfolioUrl" class="sm:col-span-2">
									<dt class="text-xs text-gray-500 dark:text-gray-400">Liên kết</dt>
									<dd class="flex flex-wrap gap-3 text-sm">
										<a
											v-if="item.linkedinUrl"
											:href="item.linkedinUrl"
											target="_blank"
											rel="noopener"
											class="text-brand-600 hover:underline dark:text-brand-400"
										>
											LinkedIn
										</a>
										<a
											v-if="item.portfolioUrl"
											:href="item.portfolioUrl"
											target="_blank"
											rel="noopener"
											class="text-brand-600 hover:underline dark:text-brand-400"
										>
											Portfolio
										</a>
									</dd>
								</div>
							</dl>

							<div v-if="item.tags.length" class="mt-4">
								<p class="text-xs text-gray-500 dark:text-gray-400">Tag</p>
								<div class="mt-1 flex flex-wrap gap-1.5">
									<span
										v-for="t in item.tags"
										:key="t.id"
										class="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
									>
										{{ t.name }}
									</span>
								</div>
							</div>

							<p v-if="item.employeeId" class="mt-4 text-sm text-gray-700 dark:text-gray-300">
								Ứng viên này đã thành nhân viên.
								<NuxtLink
									:to="`/management/employees/${item.employeeId}`"
									class="text-brand-600 hover:underline dark:text-brand-400"
								>
									Mở hồ sơ nhân viên
								</NuxtLink>
							</p>
						</div>

						<!-- Lần ứng tuyển -->
						<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
							<h2 class="text-base font-semibold text-gray-900 dark:text-white">Các lần ứng tuyển</h2>
							<p v-if="!item.applications.length" class="mt-2 text-sm text-gray-500 dark:text-gray-400">
								Ứng viên chưa ứng tuyển tin nào.
							</p>
							<ul v-else class="mt-3 space-y-2">
								<li
									v-for="app in item.applications"
									:key="app.id"
									class="rounded-lg border border-gray-100 px-3 py-2.5 dark:border-gray-800"
								>
									<div class="flex flex-wrap items-start justify-between gap-2">
										<div class="min-w-0">
											<NuxtLink
												:to="`/management/recruitment/jobs/${app.jobId}`"
												class="text-sm font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
											>
												{{ app.job.title }}
											</NuxtLink>
											<p class="text-xs text-gray-400">
												<span class="font-mono">{{ app.job.code }}</span>
												· vòng {{ app.stage.name }} · ứng tuyển {{ formatDate(app.appliedAt) }}
											</p>
											<p v-if="app.rejectReason" class="mt-0.5 text-xs text-rose-500">
												{{ app.rejectReason.name }}
											</p>
										</div>
										<RecruitChip :label="app.statusLabel" :tone="APPLICATION_STATUS_CLASS[app.status]" />
									</div>
								</li>
							</ul>
						</div>
					</div>

					<div class="space-y-5">
						<!-- File -->
						<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
							<h2 class="text-base font-semibold text-gray-900 dark:text-white">CV và tài liệu</h2>

							<div v-if="editable" class="mt-3">
								<UiFileDropzone
									v-model="pickedFile"
									accept=".pdf,.jpg,.jpeg,.png,.zip,.docx"
									:max-size-mb="20"
									:disabled="uploadingFile"
									:hint="uploadingFile ? 'Đang tải lên...' : 'PDF, JPG, PNG, ZIP, DOCX · tối đa 20 MB'"
								/>
							</div>

							<p v-if="!item.files.length" class="mt-2 text-sm text-gray-500 dark:text-gray-400">
								Chưa có file nào.
							</p>
							<ul v-else class="mt-3 space-y-1.5">
								<li v-for="file in item.files" :key="file.id">
									<button
										type="button"
										class="block w-full truncate text-left text-sm text-brand-600 hover:underline dark:text-brand-400"
										@click="openFile(file.id)"
									>
										{{ file.fileName }}
									</button>
									<p class="text-xs text-gray-400">
										{{ file.kindLabel }} · {{ formatFileSizeVn(file.sizeBytes) }} ·
										{{ formatDate(file.createdAt) }}
									</p>
								</li>
							</ul>
							<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
								File chỉ bị xoá khi ứng viên được ẩn danh, nên không có nút xoá từng file.
							</p>
						</div>

						<!-- Đồng ý dữ liệu -->
						<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
							<h2 class="text-base font-semibold text-gray-900 dark:text-white">Đồng ý xử lý dữ liệu</h2>
							<p v-if="!item.consents.length" class="mt-2 text-sm text-gray-500 dark:text-gray-400">
								Chưa ghi nhận đồng ý nào.
							</p>
							<ul v-else class="mt-3 space-y-2">
								<li v-for="consent in item.consents" :key="consent.id" class="text-sm">
									<p class="text-gray-900 dark:text-white">{{ consent.kindLabel }}</p>
									<p class="text-xs text-gray-400">
										{{ consent.methodLabel }}
										<template v-if="consent.basisLabel"> · {{ consent.basisLabel }}</template>
										· {{ formatDateTime(consent.givenAt) }}
									</p>
									<p v-if="consent.basisNote" class="text-xs text-gray-500 dark:text-gray-400">
										{{ consent.basisNote }}
									</p>
								</li>
							</ul>
							<CommonAppButton
								v-if="editable && !item.inTalentPool"
								class="mt-3"
								variant="ghost"
								size="sm"
								:loading="acting"
								@click="recordPoolConsent"
							>
								Ghi nhận đồng ý lưu kho
							</CommonAppButton>
						</div>

						<!-- Xoá dữ liệu -->
						<div
							v-if="canManage && !anonymized"
							class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
						>
							<h2 class="text-base font-semibold text-gray-900 dark:text-white">Yêu cầu xoá dữ liệu</h2>
							<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
								Khi ứng viên yêu cầu xoá dữ liệu cá nhân, dùng nút này. Hệ thống xoá liên hệ, file và
								nội dung email, chỉ giữ lại điểm số để thống kê.
							</p>
							<CommonAppButton class="mt-3" variant="danger_outline" size="sm" @click="anonymizing = true">
								Xoá dữ liệu ứng viên
							</CommonAppButton>
						</div>
					</div>
				</div>
			</template>

			<div v-else class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
				<RecruitCandidateTimeline v-if="activeTab === 'timeline'" :candidate-id="candidateId" />
				<RecruitCandidateComments
					v-else-if="activeTab === 'comments'"
					:candidate-id="candidateId"
					:applications="item.applications"
					:can-write="writable && !anonymized"
				/>
				<RecruitCandidateEmails
					v-else
					:candidate-id="candidateId"
					:applications="item.applications"
					:can-manage="editable"
					:has-email="!!item.email"
				/>
			</div>

			<!-- Modal -->
			<RecruitCandidateFormModal
				v-if="showEdit"
				:candidate="item"
				@saved="
					c => {
						item = c;
						showEdit = false;
						toast.success('Đã lưu thông tin ứng viên');
					}
				"
				@close="showEdit = false"
			/>

			<RecruitCandidateMergeModal
				v-if="showMerge"
				:candidate="item"
				@merged="onMerged"
				@close="showMerge = false"
			/>

			<RecruitAddToJobModal
				v-if="showAddToJob"
				:candidate="item"
				@added="
					showAddToJob = false;
					toast.success('Đã thêm ứng viên vào tin');
					load();
				"
				@close="showAddToJob = false"
			/>

			<RecruitNotePromptModal
				v-if="blacklisting"
				title="Đánh dấu không tái tuyển"
				description="Dấu này chỉ người phụ trách tuyển dụng thấy. Hệ thống sẽ báo khi người này nộp hồ sơ lần nữa."
				label="Lý do"
				confirm-label="Đánh dấu"
				variant="danger"
				:submit="doBlacklist"
				@done="
					blacklisting = false;
					toast.success('Đã đánh dấu không tái tuyển');
				"
				@close="blacklisting = false"
			/>

			<RecruitNotePromptModal
				v-if="unblacklisting"
				title="Gỡ đánh dấu không tái tuyển"
				description="Lý do đánh dấu cũ sẽ bị xoá khỏi hồ sơ và chỉ còn trong lịch sử."
				label="Ghi chú"
				confirm-label="Gỡ đánh dấu"
				:submit="doUnblacklist"
				@done="
					unblacklisting = false;
					toast.success('Đã gỡ đánh dấu');
				"
				@close="unblacklisting = false"
			/>

			<RecruitNotePromptModal
				v-if="anonymizing"
				title="Xoá dữ liệu ứng viên"
				description="Hồ sơ đang xét sẽ chuyển sang Rút hồ sơ, toàn bộ file bị xoá khỏi kho lưu trữ, liên hệ và nội dung email bị thay bằng dấu ẩn danh. Việc này không hoàn tác được."
				label="Lý do"
				confirm-label="Xoá dữ liệu"
				variant="danger"
				:submit="doAnonymize"
				@done="onAnonymized"
				@close="anonymizing = false"
			/>
		</template>
	</div>
</template>
