<script setup lang="ts">
	import TaskEmptyState from '~/components/modules/tasks/TaskEmptyState.vue';
	import KpiReviewDetail from '~/components/modules/kpi/KpiReviewDetail.vue';
	import KpiStatusBadge from '~/components/modules/kpi/KpiStatusBadge.vue';
	import { useKpiService } from '~/services/kpi.service';
	import { useApprovalStore } from '~/stores/approval';
	import { kpiReviewTour } from '~/tours/kpi';
	import type { KpiReviewDetail as KpiReviewDetailType, KpiReviewListItem } from '~/types/kpi.types';
	import { kpiNum } from '~/utils/kpi.utils';
	import { taskErrorInfo } from '~/utils/tasks.utils';

	/**
	 * UI-11 Đánh giá nhân viên: phiếu chờ tôi chấm (`toReview=true&status=MANAGER_REVIEW`), thẻ thứ hai là mọi
	 * phiếu tôi chấm. Màn rộng chia hai cột danh sách và phiếu; màn hẹp mở phiếu thay danh sách, có nút Về danh
	 * sách. Nút Phiếu kế tiếp lấy phiếu sau trong danh sách đang xem. N-22 mở `/kpi/danh-gia?reviewId=`.
	 */
	useHead({ title: 'Đánh giá nhân viên' });

	const route = useRoute();
	const router = useRouter();
	const service = useKpiService();
	const approvalStore = useApprovalStore();
	const { canUse } = useModuleAccess();

	const tab = computed<'pending' | 'all'>(() => (route.query.tab === 'all' ? 'all' : 'pending'));
	const q = ref(String(route.query.q ?? ''));
	const rows = ref<KpiReviewListItem[]>([]);
	const total = ref(0);
	const loading = ref(true);
	const loadError = ref('');

	async function load() {
		loading.value = true;
		loadError.value = '';
		try {
			const res = await service.listReviews({
				toReview: true,
				status: tab.value === 'pending' ? 'MANAGER_REVIEW' : undefined,
				q: q.value.trim() || undefined,
				limit: 100,
			});
			rows.value = res.data;
			total.value = res.meta.total;
		} catch (err) {
			loadError.value = taskErrorInfo(err, 'Chưa tải được danh sách phiếu.').message;
		} finally {
			loading.value = false;
		}
	}
	onMounted(() => {
		if (canUse('TASKS')) load();
		else loading.value = false;
	});
	watch(tab, load);
	let searchTimer: ReturnType<typeof setTimeout> | null = null;
	watch(q, v => {
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			// Ghi từ khoá lên đường dẫn để tải lại trang vẫn còn.
			setQuery({ q: v.trim() || undefined });
			load();
		}, 350);
	});

	const selectedId = computed<number | null>(() => {
		const v = Number(route.query.reviewId);
		return Number.isInteger(v) && v > 0 ? v : null;
	});
	/** Màn rộng tự mở phiếu đầu tiên; màn hẹp giữ danh sách cho người dùng chọn. */
	const wide = ref(true);
	onMounted(() => {
		wide.value = window.matchMedia('(min-width: 1024px)').matches;
	});
	const shownId = computed(() => selectedId.value ?? (wide.value ? rows.value[0]?.id ?? null : null));

	function setQuery(patch: Record<string, string | undefined>) {
		const next: Record<string, unknown> = { ...route.query, ...patch };
		for (const [k, v] of Object.entries(next)) if (v === undefined || v === '') delete next[k];
		router.replace({ query: next as Record<string, string> });
	}
	function open(id: number) {
		setQuery({ reviewId: String(id) });
	}

	/** Phiếu sau phiếu đang xem; ở thẻ Chờ tôi chấm thì bỏ qua phiếu vừa gửi. */
	const nextRow = computed(() => {
		if (!shownId.value) return null;
		const n = rows.value.length;
		const i = rows.value.findIndex(r => r.id === shownId.value);
		for (let k = 1; k <= n; k++) {
			const row = rows.value[(Math.max(i, -1) + k + n) % n];
			if (!row || row.id === shownId.value) continue;
			if (tab.value === 'pending' && row.status !== 'MANAGER_REVIEW') continue;
			return row;
		}
		return null;
	});
	function goNext() {
		if (nextRow.value) open(nextRow.value.id);
		nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
	}

	function onChanged(r: KpiReviewDetailType) {
		// Gửi xong vẫn giữ dòng trong danh sách đang xem (đổi nhãn bước) để người chấm bấm Phiếu kế tiếp; tải lại
		// trang thì phiếu đã gửi mới rời thẻ Chờ tôi chấm.
		rows.value = rows.value.map(x => (x.id === r.id ? { ...x, status: r.status, statusLabel: r.statusLabel, totalScore: r.totalScore, grade: r.grade } : x));
		if (r.status !== 'MANAGER_REVIEW') approvalStore.fetchCounts();
	}
	const pendingLeft = computed(() => rows.value.filter(r => r.status === 'MANAGER_REVIEW').length);

	usePageTour('kpi-review', () => kpiReviewTour({ hasRows: () => rows.value.length > 0 }), () => canUse('TASKS') && !loading.value && !loadError.value && rows.value.length > 0 && wide.value);
</script>

<template>
	<div class="space-y-4 pb-24">
		<UiPageHeader
			title="Đánh giá nhân viên"
			description="Phiếu KPI của người bạn quản lý. Kỳ khép thì phiếu chuyển sang đây: chấm chỉ tiêu nhập tay, chỉnh số tự động nếu thấy sai, ghi nhận xét rồi gửi."
			:tour="rows.length ? 'kpi-review' : undefined"
		/>
		<CommonAppModuleNotice module="TASKS" />

		<div class="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
			<!-- Danh sách -->
			<section class="space-y-3" :class="shownId && !wide ? 'hidden' : ''" data-tour="kpi-review-list">
				<div class="flex rounded-lg bg-gray-100 p-0.5 text-sm dark:bg-gray-800" role="tablist" aria-label="Loại danh sách">
					<button
						v-for="t in ([{ key: 'pending', label: 'Chờ tôi chấm' }, { key: 'all', label: 'Tất cả phiếu tôi chấm' }] as const)"
						:key="t.key"
						type="button"
						role="tab"
						:aria-selected="tab === t.key"
						class="flex-1 whitespace-nowrap rounded-md px-2 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
						:class="tab === t.key ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'"
						:data-testid="`kpi-review-tab-${t.key}`"
						@click="setQuery({ tab: t.key === 'pending' ? undefined : t.key, reviewId: undefined })"
					>
						{{ t.label }}
					</button>
				</div>
				<input
					v-model="q"
					type="search"
					placeholder="Tìm tên, mã nhân viên"
					aria-label="Tìm phiếu"
					class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
				/>
				<div v-if="loading" class="space-y-2" aria-busy="true">
					<div v-for="i in 4" :key="i" class="h-14 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
				</div>
				<TaskEmptyState v-else-if="loadError" kind="error" title="Chưa tải được phiếu" :description="loadError" action-label="Thử lại" @action="load" />
				<TaskEmptyState
					v-else-if="!rows.length"
					:kind="q ? 'filtered' : 'done'"
					:title="q ? 'Không có phiếu nào khớp' : tab === 'pending' ? 'Không còn phiếu nào chờ bạn chấm' : 'Bạn chưa chấm phiếu nào'"
					:description="tab === 'pending' && !q ? 'Kỳ khép thì phiếu của người bạn quản lý sẽ chuyển sang đây.' : undefined"
					data-testid="kpi-review-empty"
				/>
				<ul v-else class="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-700 dark:bg-gray-900" data-testid="kpi-review-list">
					<li v-for="r in rows" :key="r.id">
						<button
							type="button"
							class="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500 dark:hover:bg-gray-800/40"
							:class="r.id === shownId ? 'bg-brand-50 dark:bg-brand-900/20' : ''"
							:aria-current="r.id === shownId ? 'true' : undefined"
							:data-testid="`kpi-review-row-${r.id}`"
							@click="open(r.id)"
						>
							<CommonAppAvatar :src="r.employee.avatarUrl" :name="r.employee.fullName" size="sm" />
							<span class="min-w-0 flex-1">
								<span class="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">{{ r.employee.fullName }}</span>
								<span class="block truncate text-xs text-gray-500">{{ r.period.name }}<template v-if="r.department"> · {{ r.department.name }}</template></span>
							</span>
							<span class="flex flex-col items-end gap-0.5">
								<KpiStatusBadge v-if="tab === 'all' || r.status !== 'MANAGER_REVIEW'" :status="r.status" :label="r.statusLabel" />
								<span class="text-xs text-gray-600 dark:text-gray-300">{{ r.totalScore == null ? '' : `${kpiNum(r.totalScore, 1)} điểm` }}</span>
							</span>
						</button>
					</li>
				</ul>
				<p v-if="tab === 'pending' && rows.length" class="text-xs text-gray-500">Còn {{ pendingLeft }} phiếu chờ chấm.</p>
			</section>

			<!-- Phiếu -->
			<section v-if="shownId" class="min-w-0">
				<button
					v-if="!wide"
					type="button"
					class="mb-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700 dark:text-brand-300"
					data-testid="kpi-back-to-list"
					@click="setQuery({ reviewId: undefined })"
				>
					<Icon name="heroicons:chevron-left" class="h-4 w-4" />Về danh sách
				</button>
				<KpiReviewDetail :key="shownId" :review-id="shownId" @changed="onChanged">
					<template #tools>
						<CommonAppButton v-if="nextRow" size="sm" variant="secondary" data-tour="kpi-next" data-testid="kpi-next" @click="goNext">
							Phiếu kế tiếp<Icon name="heroicons:chevron-right" class="ml-1 h-4 w-4" />
						</CommonAppButton>
					</template>
					<template #not-found>
						<CommonAppButton size="sm" variant="secondary" @click="setQuery({ reviewId: undefined })">Về danh sách</CommonAppButton>
					</template>
				</KpiReviewDetail>
			</section>
			<section v-else-if="wide && !loading && rows.length" class="hidden lg:block" />
		</div>
	</div>
</template>
