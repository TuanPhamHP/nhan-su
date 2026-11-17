<script setup lang="ts">
	import { useRecruitmentMeService } from '~/services/recruitment-me.service';
	import {
		recruitErrorCode,
		recruitErrorMessage,
		formatScore,
		APPLICATION_STATUS_CLASS,
		JOB_STATUS_CLASS,
		STAGE_KIND_CLASS,
	} from '~/utils/recruitment.utils';
	import { formatDate, formatDateTime } from '~/utils/date';
	import type {
		RecruitmentApplicationCard,
		RecruitmentMyJob,
		RecruitmentStageKind,
	} from '~/types/recruitment-me.types';

	/**
	 * Hồ sơ của một tin tôi ngồi hội đồng (UI-09). Layout do `role-layout.global.ts` gán theo vai
	 * trò, xem ghi chú ở `my-interviews.vue`.
	 */
	const route = useRoute();
	const router = useRouter();
	const service = useRecruitmentMeService();
	const toast = useToast();

	const jobId = computed(() => Number(route.params.id));

	const job = ref<RecruitmentMyJob | null>(null);
	const applications = ref<RecruitmentApplicationCard[]>([]);
	const loading = ref(true);
	/** Mở tin của hội đồng khác bằng URL: hiện màn chặn chứ KHÔNG để trắng trang. */
	const forbidden = ref(false);
	const notFound = ref(false);

	/**
	 * Mỗi vòng một cột. Dùng `stages` của tin làm xương sống thay vì nhóm từ danh sách hồ sơ, để
	 * vòng rỗng vẫn hiện ra — nhìn vào là biết ứng viên đang dồn ở đâu.
	 */
	const columns = computed(() => {
		const stages = [...(job.value?.stages ?? [])].sort((a, b) => a.order - b.order);
		return stages.map(stage => ({
			stage,
			// `stages[].kind` của `RecruitmentMyJob` là `string`, nên tra bảng màu ở đây thay vì
			// ép kiểu trong template; mã lạ thì về màu mặc định.
			topClass: STAGE_KIND_CLASS[stage.kind as RecruitmentStageKind] ?? 'border-t-gray-400',
			items: applications.value.filter(a => a.stage.id === stage.id),
		}));
	});

	async function load() {
		loading.value = true;
		forbidden.value = false;
		notFound.value = false;
		try {
			// Tin lấy từ danh sách tin tôi ngồi hội đồng: nhóm `/me` không có route chi tiết tin.
			const jobs = await service.jobs();
			job.value = jobs.find(j => j.id === jobId.value) ?? null;
			applications.value = await service.jobApplications(jobId.value, { status: 'ACTIVE' });
			if (!job.value) notFound.value = true;
		} catch (e) {
			const code = recruitErrorCode(e);
			if (code === 'RECRUIT_SCOPE_FORBIDDEN') {
				forbidden.value = true;
				toast.error(recruitErrorMessage(e, 'Bạn không ngồi hội đồng của tin này'));
			} else if (code === 'RECRUIT_JOB_NOT_FOUND') {
				notFound.value = true;
			} else {
				toast.error(recruitErrorMessage(e, 'Không tải được hồ sơ của tin'));
			}
			applications.value = [];
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);

	useHead(() => ({ title: job.value?.title ?? 'Tin tuyển dụng' }));
</script>

<template>
	<div class="mx-auto w-full max-w-6xl space-y-4 p-4 sm:p-6">
		<NuxtLink
			to="/recruitment/my-interviews"
			class="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
			</svg>
			Phỏng vấn của tôi
		</NuxtLink>

		<CommonAppModuleNotice module="RECRUIT" />

		<div v-if="loading" class="space-y-4">
			<div class="h-8 w-1/2 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
			<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				<div v-for="i in 3" :key="i" class="h-48 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
			</div>
		</div>

		<div
			v-else-if="forbidden"
			class="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900"
		>
			<h1 class="text-lg font-semibold text-gray-900 dark:text-white">Bạn không xem được tin này</h1>
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
			<h1 class="text-lg font-semibold text-gray-900 dark:text-white">Không tìm thấy tin tuyển dụng</h1>
			<CommonAppButton class="mt-4" variant="outline" @click="router.push('/recruitment/my-interviews')">
				Về Phỏng vấn của tôi
			</CommonAppButton>
		</div>

		<template v-else-if="job">
			<header class="flex flex-wrap items-start justify-between gap-3">
				<div class="min-w-0">
					<h1 class="text-xl font-bold text-gray-900 sm:text-2xl dark:text-white">{{ job.title }}</h1>
					<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
						{{ job.code }}
						<span v-if="job.department"> · {{ job.department.name }}</span>
						<span v-if="job.deadline"> · nhận hồ sơ đến {{ formatDate(job.deadline) }}</span>
					</p>
				</div>
				<span class="rounded-full px-2.5 py-0.5 text-xs font-medium" :class="JOB_STATUS_CLASS[job.status]">
					{{ job.statusLabel }}
				</span>
			</header>

			<p class="text-sm text-gray-600 dark:text-gray-400">
				Đang có <span class="font-semibold text-gray-900 dark:text-white">{{ job.activeCount }}</span> hồ sơ được xét.
			</p>

			<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				<section
					v-for="col in columns"
					:key="col.stage.id"
					class="rounded-xl border border-t-4 border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
					:class="col.topClass"
				>
					<header class="flex items-center justify-between gap-2 px-3 py-2.5">
						<h2 class="truncate text-sm font-semibold text-gray-900 dark:text-white">{{ col.stage.name }}</h2>
						<span class="flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
							{{ col.items.length }}
						</span>
					</header>

					<p v-if="!col.items.length" class="px-3 pb-4 text-xs text-gray-400 dark:text-gray-500">
						Chưa có hồ sơ ở vòng này.
					</p>

					<ul v-else class="space-y-2 px-3 pb-3">
						<li v-for="app in col.items" :key="app.id">
							<button
								type="button"
								class="w-full rounded-lg border border-gray-200 p-2.5 text-left transition-colors hover:border-brand-400 hover:bg-brand-50/40 dark:border-gray-700 dark:hover:border-brand-500 dark:hover:bg-gray-800"
								@click="router.push(`/recruitment/applications/${app.id}`)"
							>
								<div class="flex items-start justify-between gap-2">
									<p class="min-w-0 truncate text-sm font-medium text-gray-900 dark:text-white">
										{{ app.candidate.fullName }}
									</p>
									<span
										v-if="app.score != null"
										class="flex-shrink-0 text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-300"
									>
										{{ formatScore(app.score) }}
									</span>
								</div>
								<p class="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
									Vào vòng {{ formatDateTime(app.stageEnteredAt) }}
								</p>
								<div class="mt-1.5 flex flex-wrap items-center gap-1.5">
									<span
										class="rounded-full px-1.5 py-0.5 text-xs font-medium"
										:class="APPLICATION_STATUS_CLASS[app.status]"
									>
										{{ app.statusLabel }}
									</span>
									<span v-if="app.source" class="text-xs text-gray-500 dark:text-gray-400">
										{{ app.source.name }}
									</span>
								</div>
							</button>
						</li>
					</ul>
				</section>
			</div>
		</template>
	</div>
</template>
