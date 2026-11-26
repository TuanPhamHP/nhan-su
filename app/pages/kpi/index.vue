<script setup lang="ts">
	import TaskEmptyState from '~/components/modules/tasks/TaskEmptyState.vue';
	import KpiGradeBadge from '~/components/modules/kpi/KpiGradeBadge.vue';
	import KpiReviewDetail from '~/components/modules/kpi/KpiReviewDetail.vue';
	import KpiStatusBadge from '~/components/modules/kpi/KpiStatusBadge.vue';
	import { useKpiService } from '~/services/kpi.service';
	import { kpiMyTour } from '~/tours/kpi';
	import type { KpiReviewDetail as KpiReviewDetailType, KpiReviewListItem } from '~/types/kpi.types';
	import { kpiDayText, kpiNum } from '~/utils/kpi.utils';
	import { taskErrorInfo } from '~/utils/tasks.utils';

	/**
	 * UI-10 KPI của tôi (F-28, S-22): phiếu kỳ đang mở với điểm tạm tính và "Tính lúc …", lịch sử các kỳ đã
	 * công bố, phản hồi Đồng ý / Không đồng ý. Thông báo N-23, N-24 mở `/kpi?reviewId=`.
	 */
	useHead({ title: 'KPI của tôi' });

	const route = useRoute();
	const router = useRouter();
	const service = useKpiService();
	const { canUse } = useModuleAccess();

	const reviews = ref<KpiReviewListItem[]>([]);
	const loading = ref(true);
	const loadError = ref('');

	function sortDesc(list: KpiReviewListItem[]) {
		return [...list].sort((a, b) => b.period.startDate.localeCompare(a.period.startDate) || b.id - a.id);
	}

	async function load() {
		loading.value = true;
		loadError.value = '';
		try {
			const res = await service.listReviews({ mine: true, limit: 100 });
			reviews.value = sortDesc(res.data);
		} catch (err) {
			loadError.value = taskErrorInfo(err, 'Chưa tải được KPI của bạn.').message;
		} finally {
			loading.value = false;
		}
	}
	onMounted(() => {
		if (canUse('TASKS')) load();
		else loading.value = false;
	});

	/** Phiếu đang xem: `?reviewId=` (từ thông báo), không có thì phiếu chưa công bố mới nhất, rồi phiếu mới nhất. */
	const selectedId = computed<number | null>(() => {
		const q = Number(route.query.reviewId);
		if (Number.isInteger(q) && q > 0) return q;
		return reviews.value.find(r => r.status !== 'PUBLISHED')?.id ?? reviews.value[0]?.id ?? null;
	});
	function select(id: number) {
		router.replace({ query: { ...route.query, reviewId: String(id) } });
	}
	const published = computed(() => reviews.value.filter(r => r.status === 'PUBLISHED'));

	function onChanged(r: KpiReviewDetailType) {
		const i = reviews.value.findIndex(x => x.id === r.id);
		if (i >= 0) reviews.value[i] = { ...reviews.value[i]!, status: r.status, statusLabel: r.statusLabel, totalScore: r.totalScore, grade: r.grade };
	}
	const current = ref<KpiReviewDetailType | null>(null);

	usePageTour(
		'kpi-my',
		() => kpiMyTour({ hasReview: () => loading.value || reviews.value.length > 0, canFeedback: () => !!current.value?.permissions.canFeedback }),
		() => canUse('TASKS') && !loading.value && !loadError.value && reviews.value.length > 0 && !!current.value,
	);
</script>

<template>
	<div class="space-y-4 pb-24">
		<UiPageHeader
			title="KPI của tôi"
			description="Điểm KPI theo từng kỳ: số tự động lấy từ công việc và chấm công, chỉ tiêu nhập tay do cấp trên chấm. Giữa kỳ là điểm tạm tính, hệ thống tính lại mỗi đêm."
		/>
		<CommonAppModuleNotice module="TASKS" />

		<div v-if="loading" class="space-y-3" aria-busy="true">
			<div class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
			<div class="h-72 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>
		<TaskEmptyState v-else-if="loadError" kind="error" title="Chưa xem được KPI" :description="loadError" action-label="Thử lại" @action="load" />
		<TaskEmptyState
			v-else-if="!reviews.length && !selectedId"
			kind="none"
			title="Bạn chưa có phiếu KPI nào"
			description="Khi nhân sự mở kỳ đánh giá, phiếu của bạn sẽ hiện ở đây cùng điểm tạm tính."
			data-testid="kpi-my-empty"
		/>
		<template v-else>
			<!-- Chọn kỳ: thẻ cuộn ngang, dùng được cả màn hẹp -->
			<div v-if="reviews.length" class="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" data-tour="kpi-periods">
				<div class="flex gap-2" role="tablist" aria-label="Các kỳ đánh giá">
					<button
						v-for="r in reviews"
						:key="r.id"
						type="button"
						role="tab"
						:aria-selected="r.id === selectedId"
						class="shrink-0 rounded-xl border px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-brand-500"
						:class="r.id === selectedId ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900'"
						:data-testid="`kpi-my-period-${r.id}`"
						@click="select(r.id)"
					>
						<p class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ r.period.name }}</p>
						<p class="mt-0.5 flex items-center gap-1.5">
							<KpiStatusBadge :status="r.status" :label="r.statusLabel" />
							<span v-if="r.totalScore != null" class="text-xs text-gray-600 dark:text-gray-300">{{ kpiNum(r.totalScore, 1) }} điểm</span>
						</p>
					</button>
				</div>
			</div>

			<KpiReviewDetail v-if="selectedId" :key="selectedId" :review-id="selectedId" self @loaded="r => (current = r)" @changed="r => { current = r; onChanged(r); }">
				<template #not-found>
					<CommonAppButton v-if="reviews.length" size="sm" variant="secondary" @click="select(reviews[0]!.id)">Về phiếu của tôi</CommonAppButton>
				</template>
			</KpiReviewDetail>

			<!-- Lịch sử các kỳ đã công bố -->
			<section v-if="published.length" class="space-y-2" data-testid="kpi-my-history">
				<h2 class="text-sm font-semibold text-gray-900 dark:text-white">Các kỳ đã công bố</h2>
				<ul class="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-700 dark:bg-gray-900">
					<li v-for="r in published" :key="r.id">
						<button type="button" class="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/40" @click="select(r.id)">
							<span class="min-w-0 flex-1">
								<span class="block text-sm font-medium text-gray-900 dark:text-gray-100">{{ r.period.name }}</span>
								<span class="text-xs text-gray-500">Công bố {{ kpiDayText(r.publishedAt) }}</span>
							</span>
							<span class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ kpiNum(r.totalScore, 1) }}</span>
							<KpiGradeBadge :grade="r.grade" :grades="current?.period.id === r.period.id ? current.grades : []" />
						</button>
					</li>
				</ul>
			</section>
		</template>
	</div>
</template>
