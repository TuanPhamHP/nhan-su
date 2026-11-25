<script setup lang="ts">
	import TaskEmptyState from '~/components/modules/tasks/TaskEmptyState.vue';
	import KpiResultsView from '~/components/modules/kpi/KpiResultsView.vue';
	import KpiReviewPanel from '~/components/modules/kpi/KpiReviewPanel.vue';
	import KpiYearResultsView from '~/components/modules/kpi/KpiYearResultsView.vue';
	import { useKpiService } from '~/services/kpi.service';
	import { useDirectoryStore } from '~/stores/directory';
	import type { KpiPeriodRef } from '~/types/kpi.types';
	import { taskErrorInfo } from '~/utils/tasks.utils';

	/**
	 * Kết quả KPI cho giám đốc và trưởng phòng (F-29): phần Kết quả, Kết quả năm của UI-13 mở cho người xem được
	 * kết quả mà không quản lý kỳ. Giám đốc, ADMIN, nhân sự xem mọi phòng và mở được phiếu từng người; trưởng
	 * phòng chỉ phòng mình, chỉ xem điểm (bridge mục 1). Máy chủ là bên chặn thật (403 `KPI_FORBIDDEN`).
	 *
	 * Danh sách kỳ (`GET /kpi/periods`) chỉ dành cho `kpi:manage`, nên người khác lấy kỳ từ các phiếu mình xem
	 * được (ai cũng có phiếu của chính mình trong mỗi kỳ).
	 */
	useHead({ title: 'Kết quả KPI' });

	const route = useRoute();
	const router = useRouter();
	const service = useKpiService();
	const directoryStore = useDirectoryStore();
	const { user } = useAuth();
	const { hasPermission } = usePermissions();
	const { canUse } = useModuleAccess();
	const taskScope = useTaskScope();

	const manage = computed(() => hasPermission('kpi:manage'));
	const broad = computed(() => manage.value || user.value?.role === 'DIRECTOR' || user.value?.role === 'ADMIN');
	const managedDepts = computed(() => taskScope.scope.value?.managedDepartments ?? []);
	const allowed = computed(() => broad.value || managedDepts.value.length > 0);

	const periods = ref<KpiPeriodRef[]>([]);
	const checking = ref(true);
	const loadError = ref('');

	async function load() {
		loadError.value = '';
		try {
			if (manage.value) {
				periods.value = await service.listPeriods();
			} else {
				const res = await service.listReviews({ limit: 100 });
				const map = new Map<number, KpiPeriodRef>();
				for (const r of res.data) map.set(r.period.id, r.period);
				periods.value = [...map.values()];
			}
			periods.value.sort((a, b) => b.startDate.localeCompare(a.startDate));
		} catch (err) {
			loadError.value = taskErrorInfo(err, 'Chưa tải được danh sách kỳ.').message;
		}
	}
	onMounted(async () => {
		if (!canUse('TASKS')) {
			checking.value = false;
			return;
		}
		await taskScope.load(true);
		if (broad.value) await directoryStore.load().catch(() => {});
		if (allowed.value) await load();
		checking.value = false;
	});

	const deptOptions = computed(() => {
		if (broad.value) return [{ value: '', label: 'Mọi phòng' }, ...directoryStore.departments.map(d => ({ value: String(d.id), label: d.name }))];
		const list = managedDepts.value;
		return [...(list.length > 1 ? [{ value: '', label: 'Mọi phòng tôi quản lý' }] : []), ...list.map(d => ({ value: String(d.id), label: d.name }))];
	});

	function setQuery(patch: Record<string, string | undefined>) {
		const next: Record<string, unknown> = { ...route.query, ...patch };
		for (const [k, v] of Object.entries(next)) if (v === undefined || v === '') delete next[k];
		router.replace({ query: next as Record<string, string> });
	}
	const view = computed<'period' | 'year'>(() => (route.query.view === 'year' ? 'year' : 'period'));
	const periodId = computed(() => {
		const v = Number(route.query.periodId);
		return Number.isInteger(v) && v > 0 ? v : periods.value[0]?.id ?? null;
	});
	const periodOptions = computed(() => periods.value.map(p => ({ value: String(p.id), label: p.name })));
	const openReviewId = computed<number | null>(() => {
		const v = Number(route.query.reviewId);
		return Number.isInteger(v) && v > 0 ? v : null;
	});
</script>

<template>
	<div class="space-y-4 pb-24">
		<UiPageHeader
			title="Kết quả KPI"
			description="Điểm và xếp loại theo kỳ, phân bố theo phòng, kết quả cả năm. Trưởng phòng xem phòng mình, giám đốc xem mọi phòng."
		/>
		<CommonAppModuleNotice module="TASKS" />

		<div v-if="checking" class="h-40 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" aria-busy="true" />
		<TaskEmptyState
			v-else-if="!allowed"
			kind="filtered"
			title="Kết quả KPI dành cho giám đốc và trưởng phòng"
			description="Bạn chưa làm trưởng phòng nào. Điểm của bạn nằm ở KPI của tôi."
			action-label="Về KPI của tôi"
			data-testid="kpi-results-not-allowed"
			@action="router.push('/kpi')"
		/>
		<TaskEmptyState v-else-if="loadError" kind="error" title="Chưa xem được kết quả" :description="loadError" action-label="Thử lại" @action="load" />
		<TaskEmptyState v-else-if="!periods.length" kind="none" title="Chưa có kỳ đánh giá nào" />
		<template v-else>
			<div class="flex flex-wrap items-end gap-2">
				<div class="flex rounded-lg bg-gray-100 p-0.5 text-sm dark:bg-gray-800" role="tablist" aria-label="Xem theo">
					<button
						v-for="t in ([{ key: 'period', label: 'Theo kỳ' }, { key: 'year', label: 'Cả năm' }] as const)"
						:key="t.key"
						type="button"
						role="tab"
						:aria-selected="view === t.key"
						class="whitespace-nowrap rounded-md px-3 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
						:class="view === t.key ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'"
						@click="setQuery({ view: t.key === 'period' ? undefined : t.key })"
					>
						{{ t.label }}
					</button>
				</div>
				<UiSelect
					v-if="view === 'period'"
					class="w-full sm:w-56"
					label="Kỳ"
					:model-value="periodId ? String(periodId) : ''"
					:options="periodOptions"
					data-testid="kpi-results-period"
					@update:model-value="v => setQuery({ periodId: v == null ? undefined : String(v) })"
				/>
			</div>
			<KpiResultsView
				v-if="view === 'period' && periodId"
				:key="periodId"
				:period-id="periodId"
				:department-options="deptOptions"
				:can-open-review="broad"
				@open-review="id => setQuery({ reviewId: String(id) })"
			/>
			<KpiYearResultsView v-else-if="view === 'year'" :department-options="deptOptions" />
		</template>
		<KpiReviewPanel v-if="openReviewId" :review-id="openReviewId" @close="setQuery({ reviewId: undefined })" />
	</div>
</template>
