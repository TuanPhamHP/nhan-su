<script setup lang="ts">
	import TeamScorecardForm from '~/components/modules/recruitment/TeamScorecardForm.vue';
	import { useRecruitmentMeService } from '~/services/recruitment-me.service';
	import { recruitErrorMessage, INTERVIEW_STATUS_CLASS, SCORECARD_STATUS_CLASS } from '~/utils/recruitment.utils';
	import { formatDateTime } from '~/utils/date';
	import type { RecruitmentInterview, RecruitmentMyScorecard, RecruitmentScorecard } from '~/types/recruitment-me.types';

	/**
	 * "Phỏng vấn của tôi" (UI-09) — trang tự phục vụ của người phỏng vấn và thành viên hội đồng.
	 *
	 * KHÔNG khai `layout` ở đây, cố ý: `role-layout.global.ts` gán layout cho mọi route gốc theo
	 * vai trò, nên nhân viên thấy layout `employee` còn HR thấy layout quản trị. Khai cứng
	 * `layout: 'employee'` thì `setPageLayout` của middleware cũng ghi đè, mà nếu ghi đè được thì
	 * HR tự chấm phiếu sẽ mất sidebar quản trị đang dùng — HR cũng phải vào trang này vì route
	 * lưu và nộp phiếu nằm ở nhóm `/v1/me/recruitment` cho MỌI vai trò.
	 */
	const service = useRecruitmentMeService();
	const toast = useToast();
	const route = useRoute();
	const router = useRouter();
	const { canWrite } = useModuleAccess();

	const tab = ref<'interviews' | 'scorecards'>('interviews');

	const interviews = ref<RecruitmentInterview[]>([]);
	const scorecards = ref<RecruitmentMyScorecard[]>([]);
	const loadingInterviews = ref(true);
	const loadingScorecards = ref(true);

	/** Phiếu đang mở form chấm. */
	const editing = ref<RecruitmentScorecard | null>(null);

	const canScore = computed(() => canWrite('RECRUIT'));

	async function loadInterviews() {
		loadingInterviews.value = true;
		try {
			interviews.value = await service.interviews();
		} catch (e) {
			interviews.value = [];
			toast.error(recruitErrorMessage(e, 'Không tải được lịch phỏng vấn'));
		} finally {
			loadingInterviews.value = false;
		}
	}

	async function loadScorecards() {
		loadingScorecards.value = true;
		try {
			scorecards.value = await service.pendingScorecards();
		} catch (e) {
			scorecards.value = [];
			toast.error(recruitErrorMessage(e, 'Không tải được danh sách phiếu'));
		} finally {
			loadingScorecards.value = false;
		}
	}

	/**
	 * Mở thẳng một phiếu từ link ngoài (`?scorecard=<id>`), ví dụ từ trang hồ sơ ở khu quản lý.
	 * Xoá query TRƯỚC khi tìm phiếu, để F5 không mở lại — đúng mẫu URL-driven modal của repo.
	 */
	function openByQueryId() {
		const raw = route.query.scorecard;
		if (!raw) return;
		const id = Number(raw);
		router.replace({ path: '/recruitment/my-interviews' });
		if (!id || Number.isNaN(id)) return;

		const found = scorecards.value.find(s => s.id === id);
		if (found) {
			tab.value = 'scorecards';
			editing.value = found;
		} else {
			// Phiếu đã nộp xong không còn trong danh sách chờ; mở từ trang hồ sơ thì đúng chỗ hơn.
			toast.info('Phiếu này không còn chờ bạn chấm. Bạn mở lại từ trang hồ sơ ứng viên nhé.');
		}
	}

	onMounted(async () => {
		await Promise.all([loadInterviews(), loadScorecards()]);
		openByQueryId();
	});

	/** Nộp xong thì phiếu rời danh sách chờ, nên tải lại cả hai tab cho số liệu khớp. */
	async function afterSubmit() {
		editing.value = null;
		await loadScorecards();
	}

	function onSaved(updated: RecruitmentScorecard) {
		const i = scorecards.value.findIndex(s => s.id === updated.id);
		if (i >= 0 && scorecards.value[i]) {
			scorecards.value[i] = { ...scorecards.value[i], ...updated } as RecruitmentMyScorecard;
			editing.value = scorecards.value[i] as RecruitmentScorecard;
		}
	}

	useHead({ title: 'Phỏng vấn của tôi' });
</script>

<template>
	<div class="mx-auto w-full max-w-4xl space-y-4 p-4 sm:p-6">
		<header>
			<h1 class="text-xl font-bold text-gray-900 sm:text-2xl dark:text-white">Phỏng vấn của tôi</h1>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
				Buổi phỏng vấn bạn được giao và phiếu đánh giá đang chờ bạn chấm.
			</p>
		</header>

		<CommonAppModuleNotice module="RECRUIT" />

		<div class="flex gap-1 rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900">
			<button
				type="button"
				class="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
				:class="tab === 'interviews'
					? 'bg-brand-600 text-white'
					: 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'"
				@click="tab = 'interviews'"
			>
				Buổi phỏng vấn
				<span v-if="interviews.length" class="ml-1">({{ interviews.length }})</span>
			</button>
			<button
				type="button"
				class="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
				:class="tab === 'scorecards'
					? 'bg-brand-600 text-white'
					: 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'"
				@click="tab = 'scorecards'"
			>
				Phiếu chờ chấm
				<span v-if="scorecards.length" class="ml-1">({{ scorecards.length }})</span>
			</button>
		</div>

		<!-- Form chấm phiếu nằm ngay trên danh sách, không mở modal: trên điện thoại modal cao
		     hơn màn hình thì người chấm vừa cuộn vừa mất ngữ cảnh ứng viên. -->
		<TeamScorecardForm
			v-if="editing"
			:scorecard="editing"
			:can-write="canScore"
			@saved="onSaved"
			@submitted="afterSubmit"
			@close="editing = null"
		/>

		<template v-if="tab === 'interviews'">
			<div v-if="loadingInterviews" class="space-y-3">
				<div v-for="i in 3" :key="i" class="h-28 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
			</div>

			<p
				v-else-if="!interviews.length"
				class="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
			>
				Bạn không có buổi phỏng vấn nào trong 90 ngày tới.
			</p>

			<ul v-else class="space-y-3">
				<li
					v-for="it in interviews"
					:key="it.id"
					class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
				>
					<div class="flex flex-wrap items-start justify-between gap-2">
						<div class="min-w-0">
							<p class="text-base font-semibold text-gray-900 dark:text-white">{{ it.candidate.fullName }}</p>
							<p class="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
								{{ it.job.title }} · {{ it.stage.name }}
							</p>
						</div>
						<span
							class="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
							:class="INTERVIEW_STATUS_CLASS[it.status]"
						>
							{{ it.statusLabel }}
						</span>
					</div>

					<dl class="mt-3 space-y-1.5 text-sm">
						<div class="flex gap-2">
							<dt class="w-24 flex-shrink-0 text-gray-500 dark:text-gray-400">Thời gian</dt>
							<dd class="font-medium text-gray-900 dark:text-white">
								{{ formatDateTime(it.startAt) }} – {{ formatDateTime(it.endAt) }}
							</dd>
						</div>
						<div class="flex gap-2">
							<dt class="w-24 flex-shrink-0 text-gray-500 dark:text-gray-400">Hình thức</dt>
							<dd class="text-gray-900 dark:text-white">{{ it.modeLabel }}</dd>
						</div>
						<div v-if="it.location" class="flex gap-2">
							<dt class="w-24 flex-shrink-0 text-gray-500 dark:text-gray-400">Địa điểm</dt>
							<dd class="min-w-0 break-words text-gray-900 dark:text-white">{{ it.location }}</dd>
						</div>
						<div v-if="it.meetingUrl" class="flex gap-2">
							<dt class="w-24 flex-shrink-0 text-gray-500 dark:text-gray-400">Link họp</dt>
							<dd class="min-w-0">
								<a
									:href="it.meetingUrl"
									target="_blank"
									rel="noopener noreferrer"
									class="break-all font-medium text-brand-600 underline dark:text-brand-400"
								>
									{{ it.meetingUrl }}
								</a>
							</dd>
						</div>
						<div v-if="it.interviewers.length" class="flex gap-2">
							<dt class="w-24 flex-shrink-0 text-gray-500 dark:text-gray-400">Hội đồng</dt>
							<dd class="min-w-0 text-gray-900 dark:text-white">
								{{ it.interviewers.map(p => p.fullName).join(', ') }}
							</dd>
						</div>
						<div v-if="it.note" class="flex gap-2">
							<dt class="w-24 flex-shrink-0 text-gray-500 dark:text-gray-400">Ghi chú</dt>
							<dd class="min-w-0 whitespace-pre-line text-gray-900 dark:text-white">{{ it.note }}</dd>
						</div>
					</dl>

					<CommonAppButton
						class="mt-3"
						size="sm"
						variant="outline"
						@click="router.push(`/recruitment/applications/${it.application.id}`)"
					>
						Xem hồ sơ ứng viên
					</CommonAppButton>
				</li>
			</ul>
		</template>

		<template v-else>
			<div v-if="loadingScorecards" class="space-y-3">
				<div v-for="i in 2" :key="i" class="h-24 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
			</div>

			<p
				v-else-if="!scorecards.length"
				class="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
			>
				Không có phiếu nào đang chờ bạn chấm.
			</p>

			<ul v-else class="space-y-3">
				<li
					v-for="card in scorecards"
					:key="card.id"
					class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
				>
					<div class="flex flex-wrap items-start justify-between gap-2">
						<div class="min-w-0">
							<p class="text-base font-semibold text-gray-900 dark:text-white">{{ card.candidate.fullName }}</p>
							<p class="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
								{{ card.job.title }} · {{ card.stage.name }}
							</p>
							<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
								{{ card.template.name }} · {{ card.kindLabel }}
								<span v-if="card.interview"> · buổi {{ formatDateTime(card.interview.startAt) }}</span>
							</p>
						</div>
						<span
							class="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
							:class="SCORECARD_STATUS_CLASS[card.status]"
						>
							{{ card.statusLabel }}
						</span>
					</div>

					<div class="mt-3 flex flex-wrap gap-2">
						<CommonAppButton size="sm" @click="editing = card">Chấm phiếu</CommonAppButton>
						<CommonAppButton
							size="sm"
							variant="outline"
							@click="router.push(`/recruitment/applications/${card.applicationId}`)"
						>
							Xem hồ sơ
						</CommonAppButton>
					</div>
				</li>
			</ul>
		</template>
	</div>
</template>
