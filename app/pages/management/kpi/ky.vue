<script setup lang="ts">
	import TaskEmptyState from '~/components/modules/tasks/TaskEmptyState.vue';
	import KpiConfirmModal from '~/components/modules/kpi/KpiConfirmModal.vue';
	import KpiGradeBadge from '~/components/modules/kpi/KpiGradeBadge.vue';
	import KpiOpenPeriodModal from '~/components/modules/kpi/KpiOpenPeriodModal.vue';
	import KpiResultsView from '~/components/modules/kpi/KpiResultsView.vue';
	import KpiReviewPanel from '~/components/modules/kpi/KpiReviewPanel.vue';
	import KpiStatusBadge from '~/components/modules/kpi/KpiStatusBadge.vue';
	import KpiYearResultsView from '~/components/modules/kpi/KpiYearResultsView.vue';
	import { useKpiService } from '~/services/kpi.service';
	import { useDirectoryStore } from '~/stores/directory';
	import { kpiPeriodTour } from '~/tours/kpi';
	import type { KpiGradeScale, KpiPeriod, KpiPeriodDetail, KpiReviewDetail, KpiReviewListItem, KpiReviewStatus } from '~/types/kpi.types';
	import { KPI_STATUS_LABELS, KPI_STEPS, kpiAtText, kpiGradeLegend, kpiNum, kpiRangeText } from '~/utils/kpi.utils';
	import { formatDate } from '~/utils/date';
	import { taskErrorInfo } from '~/utils/tasks.utils';

	/**
	 * UI-13 Kỳ đánh giá (nhân sự, `kpi:manage`): mở kỳ, đếm phiếu theo bước (bấm số để lọc), người chưa có phiếu
	 * kèm lý do và nút Tạo phần còn thiếu, cảnh báo phiếu của người đã nghỉ, Tính lại ngay, Công bố cả kỳ; danh
	 * sách phiếu mở khung phiếu bên phải để chốt, công bố, mở lại, đổi người chấm; thẻ Kết quả và Kết quả năm.
	 * Thông báo `KPI_REVIEW_OVERDUE` mở `?periodId=`.
	 */
	useHead({ title: 'Kỳ đánh giá KPI' });

	const route = useRoute();
	const router = useRouter();
	const service = useKpiService();
	const toast = useToast();
	const directoryStore = useDirectoryStore();
	const { canUse, canWrite } = useModuleAccess();
	const readOnly = computed(() => !canWrite('TASKS'));

	function setQuery(patch: Record<string, string | undefined>) {
		const next: Record<string, unknown> = { ...route.query, ...patch };
		for (const [k, v] of Object.entries(next)) if (v === undefined || v === '') delete next[k];
		router.replace({ query: next as Record<string, string> });
	}

	// ─── Kỳ ─────────────────────────────────────────────────────────────────
	const periods = ref<KpiPeriod[]>([]);
	const scales = ref<KpiGradeScale[]>([]);
	const loading = ref(true);
	const loadError = ref('');
	async function loadPeriods() {
		loading.value = true;
		loadError.value = '';
		try {
			const [p, s] = await Promise.all([service.listPeriods(), service.listGradeScales().catch(() => [] as KpiGradeScale[])]);
			periods.value = [...p].sort((a, b) => b.startDate.localeCompare(a.startDate) || b.id - a.id);
			scales.value = [...s].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
		} catch (err) {
			loadError.value = taskErrorInfo(err, 'Chưa tải được kỳ đánh giá.').message;
		} finally {
			loading.value = false;
		}
	}
	onMounted(async () => {
		if (!canUse('TASKS')) {
			loading.value = false;
			return;
		}
		directoryStore.load().catch(() => {});
		await loadPeriods();
	});

	const periodId = computed<number | null>(() => {
		const v = Number(route.query.periodId);
		if (Number.isInteger(v) && v > 0) return v;
		return periods.value[0]?.id ?? null;
	});
	const detail = ref<KpiPeriodDetail | null>(null);
	const detailLoading = ref(false);
	const detailError = ref('');
	async function loadDetail(quiet = false) {
		if (!periodId.value) {
			detail.value = null;
			return;
		}
		if (!quiet) detailLoading.value = true;
		detailError.value = '';
		try {
			detail.value = await service.getPeriod(periodId.value);
			const i = periods.value.findIndex(p => p.id === detail.value!.id);
			if (i >= 0) periods.value[i] = detail.value;
		} catch (err) {
			detailError.value = taskErrorInfo(err, 'Chưa tải được kỳ.').message;
		} finally {
			detailLoading.value = false;
		}
	}
	// Tải chi tiết khi danh sách kỳ đã có và mỗi lần đổi kỳ.
	watch(
		() => (loading.value ? null : periodId.value),
		id => {
			if (!id) return;
			loadDetail();
			loadReviews();
		},
	);

	const view = computed<'reviews' | 'results' | 'year'>(() => (route.query.view === 'results' ? 'results' : route.query.view === 'year' ? 'year' : 'reviews'));
	const statusFilter = computed<KpiReviewStatus | ''>(() => (KPI_STEPS.includes(route.query.status as KpiReviewStatus) ? (route.query.status as KpiReviewStatus) : ''));
	const deptFilter = computed(() => String(route.query.dept ?? ''));
	const q = ref(String(route.query.q ?? ''));

	// ─── Phiếu của kỳ ───────────────────────────────────────────────────────
	const reviews = ref<KpiReviewListItem[]>([]);
	const reviewTotal = ref(0);
	const reviewPage = ref(1);
	const reviewsLoading = ref(false);
	const reviewsError = ref('');
	async function loadReviews(more = false) {
		if (!periodId.value) return;
		reviewsLoading.value = true;
		reviewsError.value = '';
		try {
			const next = more ? reviewPage.value + 1 : 1;
			const res = await service.listReviews({
				periodId: periodId.value,
				status: statusFilter.value || undefined,
				departmentId: deptFilter.value ? Number(deptFilter.value) : undefined,
				q: q.value.trim() || undefined,
				page: next,
				limit: 100,
			});
			reviews.value = more ? [...reviews.value, ...res.data] : res.data;
			reviewTotal.value = res.meta.total;
			reviewPage.value = next;
		} catch (err) {
			reviewsError.value = taskErrorInfo(err, 'Chưa tải được phiếu.').message;
		} finally {
			reviewsLoading.value = false;
		}
	}
	watch(() => [statusFilter.value, deptFilter.value], () => loadReviews());
	let searchTimer: ReturnType<typeof setTimeout> | null = null;
	watch(q, () => {
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => loadReviews(), 350);
	});

	const deptOptions = computed(() => [{ value: '', label: 'Mọi phòng' }, ...directoryStore.departments.map(d => ({ value: String(d.id), label: d.name }))]);

	// ─── Khung phiếu ────────────────────────────────────────────────────────
	const openReviewId = computed<number | null>(() => {
		const v = Number(route.query.reviewId);
		return Number.isInteger(v) && v > 0 ? v : null;
	});
	function openReview(id: number) {
		setQuery({ reviewId: String(id) });
	}
	function onReviewChanged(r: KpiReviewDetail) {
		const i = reviews.value.findIndex(x => x.id === r.id);
		if (i >= 0) reviews.value[i] = { ...reviews.value[i]!, ...r };
		loadDetail(true);
	}

	// ─── Thao tác kỳ ────────────────────────────────────────────────────────
	const opening = ref(false);
	async function onOpened(p: KpiPeriodDetail) {
		opening.value = false;
		detail.value = p;
		setQuery({ periodId: String(p.id), status: undefined, reviewId: undefined, view: undefined });
		await loadPeriods();
	}

	const busy = ref<'recompute' | 'missing' | null>(null);
	async function recompute() {
		if (!detail.value) return;
		busy.value = 'recompute';
		try {
			const res = await service.recompute(detail.value.id);
			toast.success(res.failed ? `Đã tính lại ${res.computed} phiếu, ${res.failed} phiếu lỗi` : `Đã tính lại ${res.computed} phiếu`);
			await Promise.all([loadDetail(true), loadReviews()]);
		} catch (err) {
			toast.error(taskErrorInfo(err, 'Chưa tính lại được.').message);
		} finally {
			busy.value = null;
		}
	}
	async function addMissing() {
		if (!detail.value) return;
		busy.value = 'missing';
		const before = detail.value.total;
		try {
			const p = await service.addMissing(detail.value.id);
			detail.value = p;
			const added = p.total - before;
			toast.success(added > 0 ? `Đã tạo thêm ${added} phiếu` : 'Không tạo thêm được phiếu nào, xem lý do trong danh sách');
			await loadReviews();
		} catch (err) {
			toast.error(taskErrorInfo(err, 'Chưa tạo được phần còn thiếu.').message);
		} finally {
			busy.value = null;
		}
	}
	const confirmPublishAll = ref(false);
	async function publishAll(): Promise<string | null> {
		if (!detail.value) return null;
		try {
			const res = await service.publishPeriod(detail.value.id);
			toast.success(
				res.skippedOwn
					? `Đã công bố ${res.published} phiếu. Bỏ qua ${res.skippedOwn} phiếu của chính bạn, người khác có quyền công bố giúp.`
					: `Đã công bố ${res.published} phiếu`,
			);
			await Promise.all([loadDetail(true), loadReviews()]);
			return null;
		} catch (err) {
			const info = taskErrorInfo(err, 'Chưa công bố được.');
			toast.error(info.message);
			return info.message;
		}
	}

	const canRecompute = computed(() => !!detail.value && detail.value.counts.OPEN + detail.value.counts.MANAGER_REVIEW > 0);
	const grades = computed(() => detail.value?.gradeScale.grades ?? []);
	const lastComputed = computed(() => reviews.value.map(r => r.computedAt).filter((x): x is string => !!x).sort().at(-1) ?? null);

	usePageTour('kpi-periods', () => kpiPeriodTour({ hasPeriod: () => !!detail.value }), () => canUse('TASKS') && !loading.value && !loadError.value && !detailLoading.value);
</script>

<template>
	<div class="space-y-4 pb-24">
		<UiPageHeader
			title="Kỳ đánh giá"
			description="Mở kỳ tháng hay quý, theo dõi phiếu đang ở bước nào, chốt và công bố kết quả. Kết quả năm tự tính từ các kỳ đã công bố."
			tour="kpi-periods"
		>
			<CommonAppButton v-if="!readOnly && !loading" data-tour="kpi-open-period" data-testid="kpi-open-period" @click="opening = true">
				<Icon name="heroicons:plus" class="mr-1 h-4 w-4" />Mở kỳ
			</CommonAppButton>
		</UiPageHeader>
		<CommonAppModuleNotice module="TASKS" />

		<div v-if="loading" class="space-y-3" aria-busy="true">
			<div class="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
			<div class="h-64 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>
		<TaskEmptyState v-else-if="loadError" kind="error" title="Chưa xem được kỳ đánh giá" :description="loadError" action-label="Thử lại" @action="loadPeriods" />
		<TaskEmptyState
			v-else-if="!periods.length"
			kind="none"
			title="Chưa mở kỳ đánh giá nào"
			description="Mở kỳ đầu tiên để hệ thống tạo phiếu cho mọi người và bắt đầu tính số tự động."
			:action-label="readOnly ? undefined : 'Mở kỳ'"
			@action="opening = true"
		/>
		<template v-else>
			<!-- Chọn kỳ -->
			<div class="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
				<div class="flex gap-2" role="tablist" aria-label="Các kỳ">
					<button
						v-for="p in periods"
						:key="p.id"
						type="button"
						role="tab"
						:aria-selected="p.id === periodId"
						class="shrink-0 rounded-xl border px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-brand-500"
						:class="p.id === periodId ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900'"
						:data-testid="`kpi-period-${p.id}`"
						@click="setQuery({ periodId: String(p.id), status: undefined, reviewId: undefined })"
					>
						<p class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ p.name }}</p>
						<p class="text-xs text-gray-500">{{ p.statusLabel }} · {{ p.total }} phiếu</p>
					</button>
				</div>
			</div>

			<div v-if="detailLoading && !detail" class="h-48 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
			<TaskEmptyState v-else-if="detailError" kind="error" title="Chưa xem được kỳ" :description="detailError" action-label="Thử lại" @action="loadDetail()" />
			<template v-else-if="detail">
				<!-- Đầu kỳ -->
				<section class="space-y-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900" data-testid="kpi-period-detail">
					<div class="flex flex-wrap items-start gap-3">
						<div class="min-w-0 flex-1">
							<h2 class="text-lg font-semibold text-gray-900 dark:text-white">
								{{ detail.name }}
								<span class="ml-1 rounded-full bg-gray-100 px-2 py-0.5 align-middle text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">{{ detail.statusLabel }}</span>
							</h2>
							<p class="text-sm text-gray-600 dark:text-gray-300">
								{{ kpiRangeText(detail.startDate, detail.endDate) }} · phản hồi trong {{ detail.feedbackDays }} ngày
							</p>
							<p class="text-xs text-gray-500" data-testid="kpi-period-scale">
								Thang của kỳ (từ {{ detail.gradeScale.effectiveFrom <= '2000-12-31' ? 'đầu' : formatDate(detail.gradeScale.effectiveFrom) }}):
								{{ kpiGradeLegend(detail.gradeScale.grades) }}
							</p>
							<p v-if="lastComputed" class="text-xs text-gray-500">Lần tính gần nhất: {{ kpiAtText(lastComputed) }}</p>
						</div>
						<div v-if="!readOnly" class="flex flex-wrap gap-2">
							<!--
								Luôn hiện khi kỳ chưa công bố hết: `missing` của máy chủ chỉ liệt kê người VẪN chưa tạo được phiếu
								(chưa có mẫu, chưa có người chấm). Người vừa có mẫu, người mới vào thì không nằm trong danh sách
								nhưng vẫn cần bấm nút này mới có phiếu.
							-->
							<CommonAppButton
								v-if="detail.status !== 'CLOSED'"
								variant="secondary"
								:loading="busy === 'missing'"
								title="Tạo phiếu cho người đang làm chưa có phiếu trong kỳ, ví dụ người mới vào hay người vừa có mẫu"
								data-testid="kpi-add-missing"
								@click="addMissing"
							>
								<Icon name="heroicons:user-plus" class="mr-1 h-4 w-4" />Tạo phần còn thiếu
							</CommonAppButton>
							<CommonAppButton v-if="canRecompute" variant="secondary" :loading="busy === 'recompute'" data-testid="kpi-recompute" @click="recompute">
								<Icon name="heroicons:arrow-path" class="mr-1 h-4 w-4" />Tính lại ngay
							</CommonAppButton>
							<CommonAppButton v-if="detail.counts.PENDING_FINAL > 0" data-tour="kpi-publish-all" data-testid="kpi-publish-all" @click="confirmPublishAll = true">
								Công bố cả kỳ ({{ detail.counts.PENDING_FINAL }})
							</CommonAppButton>
						</div>
					</div>

					<!-- Đếm theo bước -->
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-5" data-tour="kpi-counts" data-testid="kpi-counts">
						<button
							v-for="s in KPI_STEPS"
							:key="s"
							type="button"
							class="rounded-lg border px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-brand-500"
							:class="statusFilter === s ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/40'"
							:aria-pressed="statusFilter === s"
							:data-testid="`kpi-count-${s}`"
							@click="setQuery({ status: statusFilter === s ? undefined : s, view: undefined })"
						>
							<p class="text-xl font-bold text-gray-900 dark:text-white">{{ detail.counts[s] }}</p>
							<p class="text-xs text-gray-600 dark:text-gray-300">{{ KPI_STATUS_LABELS[s] }}</p>
						</button>
					</div>
				</section>

				<!-- Chưa có phiếu -->
				<section v-if="detail.missing.length" class="space-y-2 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-900/10" data-testid="kpi-missing">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<h3 class="text-sm font-semibold text-amber-900 dark:text-amber-200">{{ detail.missing.length }} người đang làm chưa có phiếu</h3>
					</div>
					<p class="text-xs text-amber-900/80 dark:text-amber-200/80">Thêm mẫu cho phòng, vị trí của họ hoặc gán quản lý trực tiếp, rồi bấm Tạo phần còn thiếu ở trên.</p>
					<ul class="divide-y divide-amber-100 text-sm dark:divide-amber-900/40">
						<li v-for="m in detail.missing" :key="m.employee.id" class="flex flex-wrap items-center justify-between gap-2 py-1.5">
							<span class="text-gray-900 dark:text-gray-100">{{ m.employee.fullName }} <span class="text-xs text-gray-500">{{ [m.employee.employeeCode, m.department?.name].filter(Boolean).join(' · ') }}</span></span>
							<span class="text-xs font-medium text-amber-800 dark:text-amber-300">{{ m.reasonLabel }}</span>
						</li>
					</ul>
				</section>

				<!-- Người đã nghỉ -->
				<section v-if="detail.terminatedWarnings.length" class="space-y-2 rounded-xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-800 dark:bg-rose-900/10" data-testid="kpi-terminated">
					<h3 class="text-sm font-semibold text-rose-900 dark:text-rose-200">{{ detail.terminatedWarnings.length }} phiếu chưa công bố của người đã nghỉ việc</h3>
					<p class="text-xs text-rose-900/80 dark:text-rose-200/80">Hệ thống không tự xử lý. Bạn mở phiếu để đổi người chấm, chốt hay công bố tay.</p>
					<ul class="divide-y divide-rose-100 text-sm dark:divide-rose-900/40">
						<li v-for="w in detail.terminatedWarnings" :key="w.reviewId" class="flex flex-wrap items-center justify-between gap-2 py-1.5">
							<span class="text-gray-900 dark:text-gray-100">
								{{ w.employee.fullName }}
								<span class="text-xs text-gray-500">nghỉ {{ w.terminationDate ? formatDate(w.terminationDate) : '' }}</span>
							</span>
							<span class="flex items-center gap-2">
								<KpiStatusBadge :status="w.status" :label="w.statusLabel" />
								<button type="button" class="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300" @click="openReview(w.reviewId)">Mở phiếu</button>
							</span>
						</li>
					</ul>
				</section>

				<!-- Thẻ -->
				<div class="flex rounded-lg bg-gray-100 p-0.5 text-sm dark:bg-gray-800 sm:inline-flex" role="tablist" aria-label="Xem theo">
					<button
						v-for="t in ([{ key: 'reviews', label: 'Phiếu' }, { key: 'results', label: 'Kết quả' }, { key: 'year', label: 'Kết quả năm' }] as const)"
						:key="t.key"
						type="button"
						role="tab"
						:aria-selected="view === t.key"
						class="flex-1 whitespace-nowrap rounded-md px-3 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 sm:flex-none"
						:class="view === t.key ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'"
						:data-tour="t.key === 'results' ? 'kpi-tab-results' : undefined"
						:data-testid="`kpi-view-${t.key}`"
						@click="setQuery({ view: t.key === 'reviews' ? undefined : t.key })"
					>
						{{ t.label }}
					</button>
				</div>

				<section v-if="view === 'reviews'" class="space-y-3">
					<div class="grid gap-2 sm:flex sm:items-end">
						<UiSelect
							class="sm:w-56"
							label="Phòng"
							:model-value="deptFilter"
							:options="deptOptions"
							searchable
							@update:model-value="v => setQuery({ dept: v == null ? undefined : String(v) })"
						/>
						<input
							v-model="q"
							type="search"
							placeholder="Tìm tên, mã nhân viên"
							aria-label="Tìm phiếu"
							class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 sm:w-64 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						/>
						<p v-if="statusFilter" class="text-sm text-gray-600 dark:text-gray-300 sm:ml-2">
							Đang lọc: {{ KPI_STATUS_LABELS[statusFilter] }}
							<button type="button" class="ml-1 text-brand-700 hover:underline dark:text-brand-300" @click="setQuery({ status: undefined })">Bỏ lọc</button>
						</p>
					</div>
					<div v-if="reviewsLoading && !reviews.length" class="h-40 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
					<TaskEmptyState v-else-if="reviewsError" kind="error" title="Chưa tải được phiếu" :description="reviewsError" action-label="Thử lại" @action="loadReviews()" />
					<TaskEmptyState v-else-if="!reviews.length" kind="filtered" title="Không có phiếu nào khớp" />
					<div v-else class="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
						<table class="w-full min-w-[48rem] text-sm" data-testid="kpi-period-reviews">
							<thead class="bg-gray-50 text-left text-xs font-medium text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
								<tr>
									<th class="px-3 py-2">Nhân viên</th>
									<th class="px-3 py-2">Phòng</th>
									<th class="px-3 py-2">Người chấm</th>
									<th class="px-3 py-2">Bước</th>
									<th class="px-3 py-2 text-right">Điểm</th>
									<th class="px-3 py-2 text-center">Xếp loại</th>
								</tr>
							</thead>
							<tbody>
								<tr
									v-for="r in reviews"
									:key="r.id"
									class="cursor-pointer border-t border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/40"
									:class="r.id === openReviewId ? 'bg-brand-50 dark:bg-brand-900/20' : ''"
									:data-testid="`kpi-period-review-${r.id}`"
									@click="openReview(r.id)"
								>
									<td class="px-3 py-2">
										<p class="font-medium text-gray-900 dark:text-gray-100">
											{{ r.employee.fullName }}<span v-if="r.employeeInactive" class="ml-1 text-xs font-normal text-rose-600">(đã nghỉ)</span>
										</p>
										<p class="text-xs text-gray-500">{{ r.employee.employeeCode }}</p>
									</td>
									<td class="px-3 py-2 text-gray-700 dark:text-gray-200">{{ r.department?.name ?? '—' }}</td>
									<td class="px-3 py-2 text-gray-700 dark:text-gray-200">{{ r.reviewer.fullName }}</td>
									<td class="px-3 py-2"><KpiStatusBadge :status="r.status" :label="r.statusLabel" /></td>
									<td class="px-3 py-2 text-right font-semibold">{{ kpiNum(r.totalScore, 1) }}</td>
									<td class="px-3 py-2 text-center"><KpiGradeBadge :grade="r.grade" :grades="grades" /></td>
								</tr>
							</tbody>
						</table>
					</div>
					<div v-if="reviews.length < reviewTotal" class="text-center">
						<CommonAppButton size="sm" variant="secondary" :loading="reviewsLoading" @click="loadReviews(true)">Tải thêm</CommonAppButton>
					</div>
				</section>
				<KpiResultsView v-else-if="view === 'results'" :key="`r${detail.id}`" :period-id="detail.id" :department-options="deptOptions" can-open-review @open-review="openReview" />
				<KpiYearResultsView v-else :department-options="deptOptions" />
			</template>
		</template>

		<KpiOpenPeriodModal v-if="opening" :scales="scales" @close="opening = false" @opened="onOpened" />
		<KpiConfirmModal
			v-if="confirmPublishAll && detail"
			title="Công bố cả kỳ"
			:message="`Công bố ${detail.counts.PENDING_FINAL} phiếu đang chờ chốt của ${detail.name}. Phiếu chưa chốt được chốt luôn, nhân viên nhận thông báo. Phiếu của chính bạn để người khác có quyền công bố giúp.`"
			confirm-label="Công bố"
			:confirm="() => publishAll()"
			@close="confirmPublishAll = false"
		/>
		<KpiReviewPanel v-if="openReviewId" :review-id="openReviewId" @close="setQuery({ reviewId: undefined })" @changed="onReviewChanged" />
	</div>
</template>
