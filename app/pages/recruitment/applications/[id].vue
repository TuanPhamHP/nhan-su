<script setup lang="ts">
	import TeamScorecardForm from '~/components/modules/recruitment/TeamScorecardForm.vue';
	import TeamScorecardStages from '~/components/modules/recruitment/TeamScorecardStages.vue';
	import TeamCommentThread from '~/components/modules/recruitment/TeamCommentThread.vue';
	import { useRecruitmentMeService } from '~/services/recruitment-me.service';
	import {
		recruitErrorCode,
		recruitErrorMessage,
		formatRecruitMoney,
		openPresignedUrl,
		APPLICATION_STATUS_CLASS,
	} from '~/utils/recruitment.utils';
	import { formatDate, formatDateTime } from '~/utils/date';
	import type { RecruitmentMyJob, RecruitmentScorecard, RecruitmentTeamApplication } from '~/types/recruitment-me.types';

	/**
	 * Chi tiết một hồ sơ ứng tuyển, phía hội đồng (UI-09). Layout do `role-layout.global.ts` gán
	 * theo vai trò, xem ghi chú ở `my-interviews.vue`.
	 */
	const route = useRoute();
	const router = useRouter();
	const service = useRecruitmentMeService();
	const toast = useToast();
	const { user } = useAuth();
	const { canWrite } = useModuleAccess();

	const applicationId = computed(() => Number(route.params.id));

	const data = ref<RecruitmentTeamApplication | null>(null);
	/**
	 * Tin chứa hồ sơ này, lấy từ danh sách tin tôi ngồi hội đồng. Cần cho hai việc: danh sách
	 * thành viên để nhắc tên khi bình luận, và danh sách vòng để đề xuất chuyển vòng. Nhóm
	 * `/me` không có route chi tiết tin nên phải lọc từ danh sách.
	 */
	const job = ref<RecruitmentMyJob | null>(null);
	const loading = ref(true);
	/** Hồ sơ của tin mình không ngồi hội đồng: hiện màn chặn, không để trắng trang. */
	const forbidden = ref(false);
	const notFound = ref(false);
	const editing = ref<RecruitmentScorecard | null>(null);

	const canComment = computed(() => canWrite('RECRUIT'));
	const isManager = computed(() => user.value?.role === 'MANAGER');

	/**
	 * Vòng để đề xuất chuyển tới. Ưu tiên vòng của tin; chưa tải được tin thì tạm dùng các vòng
	 * đang có phiếu, vì danh sách đó luôn thiếu vòng chưa ai chấm.
	 */
	const stageOptions = computed(() => {
		if (job.value?.stages.length) {
			return [...job.value.stages].sort((a, b) => a.order - b.order).map(s => ({ id: s.id, name: s.name }));
		}
		return (data.value?.scorecards ?? []).map(s => ({ id: s.stageId, name: s.stageName }));
	});

	/** Người nhắc được khi bình luận: thành viên hội đồng của tin, rỗng khi chưa tải được tin. */
	const teamMembers = computed(() => job.value?.team ?? []);

	async function load() {
		loading.value = true;
		forbidden.value = false;
		notFound.value = false;
		job.value = null;
		try {
			data.value = await service.application(applicationId.value);
			// Tin lấy sau và KHÔNG chặn trang: hỏng chỗ này thì chỉ mất ô nhắc tên, hồ sơ vẫn đọc được.
			try {
				const jobs = await service.jobs();
				job.value = jobs.find(j => j.id === data.value?.jobId) ?? null;
			} catch {
				job.value = null;
			}
		} catch (e) {
			data.value = null;
			const code = recruitErrorCode(e);
			if (code === 'RECRUIT_SCOPE_FORBIDDEN') {
				forbidden.value = true;
				toast.error(recruitErrorMessage(e, 'Bạn không xem được hồ sơ này'));
			} else if (code === 'RECRUIT_APPLICATION_NOT_FOUND') {
				notFound.value = true;
			} else {
				toast.error(recruitErrorMessage(e, 'Không tải được hồ sơ'));
			}
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);

	/** Nộp hay lưu phiếu xong thì tải lại phần phiếu: nộp lần đầu mở ra phiếu của người khác (BR-08). */
	async function reloadScorecards() {
		if (!data.value) return;
		try {
			data.value = { ...data.value, scorecards: await service.applicationScorecards(applicationId.value) };
		} catch (e) {
			toast.error(recruitErrorMessage(e, 'Không tải lại được phiếu đánh giá'));
		}
	}

	async function onSubmitted() {
		editing.value = null;
		await reloadScorecards();
	}

	/** Link file sống 10 phút nên lấy đúng lúc bấm; `openPresignedUrl` mở tab trước khi chờ. */
	async function openFile(fileId: number) {
		try {
			await openPresignedUrl(() => service.candidateFileUrl(fileId));
		} catch (e) {
			toast.error(recruitErrorMessage(e, 'Không mở được file'));
		}
	}

	useHead(() => ({ title: data.value?.candidate.fullName ?? 'Hồ sơ ứng tuyển' }));
</script>

<template>
	<div class="mx-auto w-full max-w-4xl space-y-4 p-4 sm:p-6">
		<button
			type="button"
			class="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400"
			@click="router.back()"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
			</svg>
			Quay lại
		</button>

		<CommonAppModuleNotice module="RECRUIT" />

		<div v-if="loading" class="space-y-4">
			<div class="h-28 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
			<div class="h-40 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
			<div class="h-40 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
		</div>

		<div
			v-else-if="forbidden"
			class="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900"
		>
			<h1 class="text-lg font-semibold text-gray-900 dark:text-white">Bạn không xem được hồ sơ này</h1>
			<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
				Bạn chỉ xem được hồ sơ của những tin mình ngồi hội đồng.
			</p>
			<CommonAppButton class="mt-4" variant="outline" @click="router.push('/recruitment/my-interviews')">
				Về Phỏng vấn của tôi
			</CommonAppButton>
		</div>

		<div
			v-else-if="notFound"
			class="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900"
		>
			<h1 class="text-lg font-semibold text-gray-900 dark:text-white">Không tìm thấy hồ sơ ứng tuyển</h1>
			<CommonAppButton class="mt-4" variant="outline" @click="router.push('/recruitment/my-interviews')">
				Về Phỏng vấn của tôi
			</CommonAppButton>
		</div>

		<template v-else-if="data">
			<header class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div class="min-w-0">
						<h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ data.candidate.fullName }}</h1>
						<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
							<NuxtLink
								:to="`/recruitment/jobs/${data.jobId}`"
								class="font-medium text-brand-600 hover:underline dark:text-brand-400"
							>
								{{ data.job.title }}
							</NuxtLink>
							· {{ data.stage.name }}
						</p>
					</div>
					<span
						class="flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
						:class="APPLICATION_STATUS_CLASS[data.status]"
					>
						{{ data.statusLabel }}
					</span>
				</div>

				<dl class="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
					<div>
						<dt class="text-xs text-gray-500 dark:text-gray-400">Email</dt>
						<dd class="break-words text-sm text-gray-900 dark:text-white">{{ data.candidate.email ?? '—' }}</dd>
					</div>
					<div>
						<dt class="text-xs text-gray-500 dark:text-gray-400">Điện thoại</dt>
						<dd class="text-sm text-gray-900 dark:text-white">{{ data.candidate.phone ?? '—' }}</dd>
					</div>
					<div v-if="data.candidate.currentTitle || data.candidate.currentCompany">
						<dt class="text-xs text-gray-500 dark:text-gray-400">Đang làm</dt>
						<dd class="text-sm text-gray-900 dark:text-white">
							{{ [data.candidate.currentTitle, data.candidate.currentCompany].filter(Boolean).join(' · ') }}
						</dd>
					</div>
					<div v-if="data.candidate.yearsOfExperience != null">
						<dt class="text-xs text-gray-500 dark:text-gray-400">Kinh nghiệm</dt>
						<dd class="text-sm text-gray-900 dark:text-white">{{ data.candidate.yearsOfExperience }} năm</dd>
					</div>
					<div v-if="data.candidate.educationLevel || data.candidate.school">
						<dt class="text-xs text-gray-500 dark:text-gray-400">Học vấn</dt>
						<dd class="text-sm text-gray-900 dark:text-white">
							{{ [data.candidate.educationLevel, data.candidate.school].filter(Boolean).join(' · ') }}
						</dd>
					</div>
					<div v-if="data.candidate.dateOfBirth">
						<dt class="text-xs text-gray-500 dark:text-gray-400">Ngày sinh</dt>
						<dd class="text-sm text-gray-900 dark:text-white">{{ formatDate(data.candidate.dateOfBirth) }}</dd>
					</div>
					<!--
						Lương mong muốn chỉ hiện khi cờ `canViewSalary` của response là true. Người
						không được xem nhận `null`, mà `null` ở đây nghĩa là "bị che", không phải 0.
					-->
					<div v-if="data.canViewSalary">
						<dt class="text-xs text-gray-500 dark:text-gray-400">Lương mong muốn</dt>
						<dd class="text-sm font-medium text-gray-900 dark:text-white">
							{{ formatRecruitMoney(data.candidate.expectedSalary) }}
						</dd>
					</div>
					<div>
						<dt class="text-xs text-gray-500 dark:text-gray-400">Nộp hồ sơ</dt>
						<dd class="text-sm text-gray-900 dark:text-white">{{ formatDateTime(data.appliedAt) }}</dd>
					</div>
					<div v-if="data.source">
						<dt class="text-xs text-gray-500 dark:text-gray-400">Nguồn</dt>
						<dd class="text-sm text-gray-900 dark:text-white">{{ data.source.name }}</dd>
					</div>
				</dl>

				<div v-if="data.candidate.linkedinUrl || data.candidate.portfolioUrl" class="mt-3 flex flex-wrap gap-3 text-sm">
					<a
						v-if="data.candidate.linkedinUrl"
						:href="data.candidate.linkedinUrl"
						target="_blank"
						rel="noopener noreferrer"
						class="font-medium text-brand-600 underline dark:text-brand-400"
					>
						LinkedIn
					</a>
					<a
						v-if="data.candidate.portfolioUrl"
						:href="data.candidate.portfolioUrl"
						target="_blank"
						rel="noopener noreferrer"
						class="font-medium text-brand-600 underline dark:text-brand-400"
					>
						Portfolio
					</a>
				</div>
			</header>

			<section class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
				<h2 class="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-white">
					CV và tài liệu
				</h2>
				<p v-if="!data.files.length" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
					Ứng viên chưa có file nào.
				</p>
				<ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
					<li
						v-for="file in data.files"
						:key="file.id"
						class="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
					>
						<div class="min-w-0">
							<p class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ file.fileName }}</p>
							<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
								{{ file.kindLabel }}
								<span v-if="file.id === data.cvFileId"> · dùng cho lần ứng tuyển này</span>
								· {{ Math.max(1, Math.round(file.sizeBytes / 1024)) }} KB
							</p>
						</div>
						<CommonAppButton size="sm" variant="outline" @click="openFile(file.id)">Mở file</CommonAppButton>
					</li>
				</ul>
			</section>

			<TeamScorecardForm
				v-if="editing"
				:scorecard="editing"
				:can-write="canComment"
				@submitted="onSubmitted"
				@saved="reloadScorecards"
				@close="editing = null"
			/>

			<section>
				<h2 class="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Phiếu đánh giá</h2>
				<TeamScorecardStages
					:stages="data.scorecards"
					:my-employee-id="user?.id ?? null"
					scorable
					@open="editing = $event"
				/>
			</section>

			<TeamCommentThread
				:application-id="data.id"
				:stages="stageOptions"
				:team="teamMembers"
				:can-write="canComment"
				:is-manager="isManager"
			/>
		</template>
	</div>
</template>
