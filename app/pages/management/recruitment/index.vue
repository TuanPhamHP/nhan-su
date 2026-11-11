<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import RecruitStatTile from '~/components/modules/recruitment/RecruitStatTile.vue';
	import { recruitErrorMessage, headcountYearOptions } from '~/utils/recruitment.utils';
	import { formatDate } from '~/utils/date';
	import type { RecruitInboxCounts, RecruitmentDashboard } from '~/types/recruitment.types';

	definePageMeta({ title: 'Tổng quan tuyển dụng' });

	const service = useRecruitmentService();

	const year = ref(new Date().getFullYear());
	const yearOptions = headcountYearOptions();

	const data = ref<RecruitmentDashboard | null>(null);
	const counts = ref<RecruitInboxCounts | null>(null);
	const loading = ref(true);
	const loadError = ref<string | null>(null);

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			data.value = await service.dashboard(year.value);
		} catch (e) {
			// MANAGER không thuộc phòng nào, hay công ty chưa mở module, đều rơi vào đây:
			// hiện lý do trên trang, KHÔNG để màn hình trắng.
			data.value = null;
			loadError.value = recruitErrorMessage(e, 'Không tải được tổng quan tuyển dụng');
		} finally {
			loading.value = false;
		}
	}

	onMounted(async () => {
		await load();
		try {
			counts.value = await service.approvalCounts();
		} catch {
			// Badge "chờ tôi duyệt" chỉ là thông tin phụ, thiếu thì vẫn xem được tổng quan.
		}
	});

	watch(year, load);

	const pendingTotal = computed(() => {
		const c = counts.value;
		return c ? c.requisitions + c.offers + c.headcount : 0;
	});

	/** Tổng hồ sơ đang xét của một tin, để thanh tiến trình hiểu được tỉ lệ từng vòng. */
	function stageTotal(job: RecruitmentDashboard['openJobs'][number]): number {
		return job.byStageKind.reduce((sum, s) => sum + s.count, 0);
	}
</script>

<template>
	<div class="space-y-5">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h1 class="text-xl font-bold text-gray-900 dark:text-white">Tổng quan tuyển dụng</h1>
				<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
					Tin đang mở, lịch phỏng vấn, offer và định biên của năm đang chọn
				</p>
			</div>
			<div class="w-40">
				<UiSelect v-model="year" :options="yearOptions" />
			</div>
		</div>

		<CommonAppModuleNotice module="RECRUIT" />

		<div
			v-if="pendingTotal > 0"
			class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 dark:border-brand-800 dark:bg-brand-900/20"
		>
			<p class="text-sm text-brand-800 dark:text-brand-200">
				Đang có {{ pendingTotal }} việc chờ bạn duyệt: {{ counts?.requisitions ?? 0 }} yêu cầu tuyển,
				{{ counts?.offers ?? 0 }} offer và {{ counts?.headcount ?? 0 }} đề xuất định biên.
			</p>
			<NuxtLink
				to="/management/recruitment/approvals"
				class="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
			>
				Mở hộp duyệt
			</NuxtLink>
		</div>

		<div v-if="loading" class="grid grid-cols-2 gap-3 lg:grid-cols-4">
			<div v-for="i in 8" :key="i" class="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>

		<div
			v-else-if="loadError"
			class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-center dark:border-rose-800 dark:bg-rose-900/20"
		>
			<p class="text-sm text-rose-700 dark:text-rose-300">{{ loadError }}</p>
		</div>

		<template v-else-if="data">
			<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<RecruitStatTile
					label="Phỏng vấn hôm nay"
					:value="data.interviewsToday"
					:hint="`Cả tuần ${data.interviewsThisWeek} buổi`"
					to="/management/recruitment/interviews"
				/>
				<RecruitStatTile
					label="Phiếu đánh giá quá hạn"
					:value="data.overdueScorecards"
					hint="Chưa nộp sau buổi phỏng vấn quá một ngày"
					:warn="data.overdueScorecards > 0"
				/>
				<RecruitStatTile
					label="Offer chờ duyệt"
					:value="data.offersPendingApproval"
					to="/management/recruitment/offers"
				/>
				<RecruitStatTile
					label="Offer chờ ứng viên trả lời"
					:value="data.offersAwaitingResponse"
					to="/management/recruitment/offers"
				/>
			</div>

			<!-- Định biên so với thực tế -->
			<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">
						Định biên năm {{ year }}
					</h2>
					<NuxtLink
						:to="`/management/recruitment/headcount?year=${year}`"
						class="text-sm text-brand-600 hover:underline dark:text-brand-400"
					>
						Mở bảng định biên
					</NuxtLink>
				</div>

				<div class="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
					<RecruitStatTile label="Đã chốt" :value="data.headcount.confirmed" />
					<RecruitStatTile label="Đang có" :value="data.headcount.current" />
					<RecruitStatTile label="Đang tuyển" :value="data.headcount.recruiting" />
					<RecruitStatTile label="Còn trống" :value="data.headcount.available" />
				</div>

				<p
					v-if="data.headcount.overCommitted > 0"
					class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
				>
					Có {{ data.headcount.overCommitted }} dòng định biên đang thấp hơn số người đang dùng, nên
					phần còn trống của những dòng đó là số âm. Mở bảng định biên để xem và điều chỉnh.
				</p>
			</div>

			<!-- Tin đang mở -->
			<div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
				<div class="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Tin đang mở</h2>
					<NuxtLink
						to="/management/recruitment/jobs"
						class="text-sm text-brand-600 hover:underline dark:text-brand-400"
					>
						Tất cả tin
					</NuxtLink>
				</div>

				<div v-if="!data.openJobs.length" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
					Chưa có tin tuyển dụng nào đang mở.
				</div>

				<ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
					<li v-for="job in data.openJobs" :key="job.id" class="px-4 py-3">
						<div class="flex flex-wrap items-start justify-between gap-2">
							<div class="min-w-0">
								<NuxtLink
									:to="`/management/recruitment/jobs/${job.id}`"
									class="font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
								>
									{{ job.title }}
								</NuxtLink>
								<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
									<span class="font-mono">{{ job.code }}</span>
									· cần {{ job.quantity }} người
									<template v-if="job.deadline"> · hạn nộp {{ formatDate(job.deadline) }}</template>
								</p>
							</div>
							<p class="text-sm tabular-nums text-gray-600 dark:text-gray-300">
								{{ stageTotal(job) }} hồ sơ đang xét
							</p>
						</div>

						<div class="mt-2 flex flex-wrap gap-1.5">
							<span
								v-for="stage in job.byStageKind.filter(s => s.count > 0)"
								:key="stage.kind"
								class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
							>
								{{ stage.kindLabel }}
								<strong class="tabular-nums">{{ stage.count }}</strong>
							</span>
							<span v-if="stageTotal(job) === 0" class="text-xs text-gray-400 dark:text-gray-500">
								Chưa có hồ sơ nào
							</span>
						</div>
					</li>
				</ul>
			</div>
		</template>
	</div>
</template>
