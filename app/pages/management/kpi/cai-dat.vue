<script setup lang="ts">
	import TaskEmptyState from '~/components/modules/tasks/TaskEmptyState.vue';
	import KpiGradeScaleFormModal from '~/components/modules/kpi/KpiGradeScaleFormModal.vue';
	import KpiIndicatorFormModal from '~/components/modules/kpi/KpiIndicatorFormModal.vue';
	import KpiTemplateFormModal from '~/components/modules/kpi/KpiTemplateFormModal.vue';
	import { useKpiService } from '~/services/kpi.service';
	import { kpiSettingsTour } from '~/tours/kpi';
	import type { KpiGradeScale, KpiIndicator, KpiTemplate } from '~/types/kpi.types';
	import { KPI_HINTS, kpiGradeLegend, kpiNum, kpiTargetText, kpiWeightText } from '~/utils/kpi.utils';
	import { formatDate } from '~/utils/date';
	import { taskErrorInfo, vnToday } from '~/utils/tasks.utils';

	/**
	 * UI-12 Cài đặt KPI (nhân sự, `kpi:manage`): ba thẻ Chỉ tiêu, Mẫu đánh giá, Thang xếp loại. Đường dẫn giữ thẻ
	 * đang mở (`?tab=`). Người không có quyền bị chặn ở `permission-guard`; máy chủ vẫn trả 403 `KPI_FORBIDDEN`.
	 */
	useHead({ title: 'Cài đặt KPI' });

	const route = useRoute();
	const router = useRouter();
	const service = useKpiService();
	const toast = useToast();
	const { canUse, canWrite } = useModuleAccess();
	const readOnly = computed(() => !canWrite('TASKS'));

	type Tab = 'indicators' | 'templates' | 'grades';
	const TABS: Array<{ key: Tab; label: string; hint: string }> = [
		{ key: 'indicators', label: 'Chỉ tiêu', hint: KPI_HINTS.indicator },
		{ key: 'templates', label: 'Mẫu đánh giá', hint: KPI_HINTS.template },
		{ key: 'grades', label: 'Thang xếp loại', hint: KPI_HINTS.gradeScale },
	];
	const tab = computed<Tab>(() => (['templates', 'grades'].includes(String(route.query.tab)) ? (route.query.tab as Tab) : 'indicators'));
	function setTab(t: Tab) {
		router.replace({ query: { ...route.query, tab: t === 'indicators' ? undefined : t } });
	}

	const indicators = ref<KpiIndicator[]>([]);
	const templates = ref<KpiTemplate[]>([]);
	const scales = ref<KpiGradeScale[]>([]);
	/** Hiện chỉ tiêu, mẫu ngừng dùng nằm trên đường dẫn (`?inactive=1`). */
	const showInactive = computed({
		get: () => route.query.inactive === '1',
		set: (v: boolean) => router.replace({ query: { ...route.query, inactive: v ? '1' : undefined } }),
	});
	const loading = ref(true);
	const loadError = ref('');

	async function load() {
		loading.value = true;
		loadError.value = '';
		try {
			const [i, t, g] = await Promise.all([service.listIndicators(true), service.listTemplates(true), service.listGradeScales()]);
			indicators.value = i;
			templates.value = t;
			scales.value = [...g].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
		} catch (err) {
			loadError.value = taskErrorInfo(err, 'Chưa tải được cài đặt KPI.').message;
		} finally {
			loading.value = false;
		}
	}
	onMounted(() => {
		if (canUse('TASKS')) load();
		else loading.value = false;
	});

	const shownIndicators = computed(() => indicators.value.filter(i => showInactive.value || i.isActive));
	const shownTemplates = computed(() =>
		templates.value
			.filter(t => showInactive.value || t.isActive)
			.sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name, 'vi') || b.version - a.version),
	);

	// ─── Chỉ tiêu ────────────────────────────────────────────────────────────
	const editingIndicator = ref<KpiIndicator | null | 'new'>(null);
	function onIndicatorSaved(saved: KpiIndicator) {
		const i = indicators.value.findIndex(x => x.id === saved.id);
		if (i >= 0) indicators.value[i] = saved;
		else indicators.value.push(saved);
		editingIndicator.value = null;
	}
	function ratioText(i: KpiIndicator): string {
		if (i.direction === 'BANDS') return (i.bands ?? []).map(b => (b.upTo == null ? `trên: ${kpiNum(b.percent)}%` : `≤ ${kpiNum(b.upTo)}: ${kpiNum(b.percent)}%`)).join(' · ');
		if (i.direction === 'PASS_FAIL') return 'Đạt 100%, không đạt 0%';
		return [i.capPercent != null ? `trần ${kpiNum(i.capPercent)}%` : null, i.floorPercent != null ? `sàn ${kpiNum(i.floorPercent)}%` : null].filter(Boolean).join(' · ') || '—';
	}

	// ─── Mẫu ────────────────────────────────────────────────────────────────
	const editingTemplate = ref<KpiTemplate | null | 'new'>(null);
	async function onTemplateSaved() {
		editingTemplate.value = null;
		// Lưu thành phiên bản mới thì bản cũ ngừng dùng: tải lại cả danh sách cho đúng.
		templates.value = await service.listTemplates(true).catch(() => templates.value);
	}
	const togglingId = ref<number | null>(null);
	async function toggleTemplate(t: KpiTemplate) {
		togglingId.value = t.id;
		try {
			const saved = await service.updateTemplate(t.id, { isActive: !t.isActive });
			const i = templates.value.findIndex(x => x.id === t.id);
			if (i >= 0) templates.value[i] = saved;
			toast.success(saved.isActive ? `Đã dùng lại mẫu ${saved.name}` : `Đã ngừng dùng mẫu ${saved.name}`);
		} catch (err) {
			toast.error(taskErrorInfo(err, 'Chưa đổi được trạng thái mẫu.').message);
		} finally {
			togglingId.value = null;
		}
	}
	function scopeText(t: KpiTemplate): string {
		if (t.scope === 'POSITION') return `Vị trí ${t.position?.name ?? ''}${t.department ? `, phòng ${t.department.name}` : ''}`;
		if (t.scope === 'DEPARTMENT') return `Phòng ${t.department?.name ?? ''}`;
		return 'Mẫu chung cho người chưa có mẫu riêng';
	}

	// ─── Thang ──────────────────────────────────────────────────────────────
	const addingScale = ref(false);
	function onScaleSaved(s: KpiGradeScale) {
		scales.value = [s, ...scales.value].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
		addingScale.value = false;
	}
	const today = vnToday();
	const currentScaleId = computed(() => scales.value.find(s => s.effectiveFrom <= today)?.id ?? null);
	function gradeLine(s: KpiGradeScale): string {
		return kpiGradeLegend(s.grades);
	}

	usePageTour('kpi-settings', kpiSettingsTour, () => canUse('TASKS') && !loading.value && !loadError.value);
</script>

<template>
	<div class="space-y-4 pb-24">
		<UiPageHeader
			title="Cài đặt KPI"
			description="Danh mục chỉ tiêu, mẫu đánh giá cho từng phòng hay vị trí, và thang xếp loại. KPI chỉ để xem và xuất kết quả."
			tour="kpi-settings"
		/>
		<CommonAppModuleNotice module="TASKS" />

		<div class="flex flex-wrap items-center gap-2">
			<div class="flex rounded-lg bg-gray-100 p-0.5 text-sm dark:bg-gray-800" role="tablist" aria-label="Phần cài đặt">
				<button
					v-for="t in TABS"
					:key="t.key"
					type="button"
					role="tab"
					:aria-selected="tab === t.key"
					:title="t.hint"
					class="whitespace-nowrap rounded-md px-3 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
					:class="tab === t.key ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'"
					:data-tour="`kpi-tab-${t.key}`"
					:data-testid="`kpi-settings-tab-${t.key}`"
					@click="setTab(t.key)"
				>
					{{ t.label }}
				</button>
			</div>
			<label v-if="tab !== 'grades'" class="ml-auto flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
				<input v-model="showInactive" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
				Hiện cả mục đã tắt
			</label>
		</div>

		<div v-if="loading" class="h-64 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" aria-busy="true" />
		<TaskEmptyState v-else-if="loadError" kind="error" title="Chưa xem được cài đặt" :description="loadError" action-label="Thử lại" @action="load" />

		<!-- Chỉ tiêu -->
		<section v-else-if="tab === 'indicators'" class="space-y-3">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<p class="text-sm text-gray-600 dark:text-gray-300">{{ KPI_HINTS.indicator }}</p>
				<CommonAppButton v-if="!readOnly" data-testid="kpi-indicator-add" @click="editingIndicator = 'new'">
					<Icon name="heroicons:plus" class="mr-1 h-4 w-4" />Thêm chỉ tiêu
				</CommonAppButton>
			</div>
			<div class="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
				<table class="w-full min-w-[48rem] text-sm" data-testid="kpi-indicator-table">
					<thead class="bg-gray-50 text-left text-xs font-medium text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
						<tr>
							<th class="px-3 py-2">Chỉ tiêu</th>
							<th class="px-3 py-2">Nguồn</th>
							<th class="px-3 py-2">Kiểu tính</th>
							<th class="px-3 py-2">Đơn vị</th>
							<th class="px-3 py-2">Trần, sàn, mốc</th>
							<th class="px-3 py-2" />
						</tr>
					</thead>
					<tbody>
						<tr v-for="i in shownIndicators" :key="i.id" class="border-t border-gray-100 dark:border-gray-800" :class="i.isActive ? '' : 'opacity-60'" :data-testid="`kpi-indicator-${i.id}`">
							<td class="px-3 py-2">
								<p class="font-medium text-gray-900 dark:text-gray-100">{{ i.name }}</p>
								<p v-if="i.manualScale" class="text-xs text-gray-500">Chấm 1–5 bằng năm nút</p>
								<p v-if="!i.isActive" class="text-xs text-gray-500">Đã tắt</p>
							</td>
							<td class="px-3 py-2">
								<span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="i.source === 'AUTO' ? 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'">
									{{ i.sourceLabel }}
								</span>
							</td>
							<td class="px-3 py-2 text-gray-700 dark:text-gray-200">{{ i.directionLabel }}</td>
							<td class="px-3 py-2 text-gray-700 dark:text-gray-200">{{ i.unit }}</td>
							<td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-300">{{ ratioText(i) }}</td>
							<td class="px-3 py-2 text-right">
								<button v-if="!readOnly" type="button" class="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300" :data-testid="`kpi-indicator-edit-${i.id}`" @click="editingIndicator = i">Sửa</button>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</section>

		<!-- Mẫu -->
		<section v-else-if="tab === 'templates'" class="space-y-3">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<p class="text-sm text-gray-600 dark:text-gray-300">Mẫu của một người chọn theo vị trí trước, rồi theo phòng, cuối cùng là mẫu chung.</p>
				<CommonAppButton v-if="!readOnly" data-testid="kpi-template-add" @click="editingTemplate = 'new'">
					<Icon name="heroicons:plus" class="mr-1 h-4 w-4" />Thêm mẫu
				</CommonAppButton>
			</div>
			<TaskEmptyState v-if="!shownTemplates.length" kind="none" title="Chưa có mẫu đánh giá nào" description="Thêm mẫu để kỳ đánh giá tạo được phiếu cho mọi người." />
			<div class="grid gap-3 lg:grid-cols-2">
				<article
					v-for="t in shownTemplates"
					:key="t.id"
					class="space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
					:class="t.isActive ? '' : 'opacity-60'"
					:data-testid="`kpi-template-${t.id}`"
				>
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0">
							<h3 class="font-semibold text-gray-900 dark:text-white">
								{{ t.name }} <span class="text-xs font-normal text-gray-500">phiên bản {{ t.version }}</span>
							</h3>
							<p class="text-xs text-gray-500">{{ scopeText(t) }}</p>
							<p v-if="t.regulationNo || t.regulationDate" class="text-xs text-gray-500">
								Quy chế {{ t.regulationNo ?? '' }}<template v-if="t.regulationDate"> ngày {{ formatDate(t.regulationDate) }}</template>
							</p>
						</div>
						<span v-if="!t.isActive" class="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">Ngừng dùng</span>
					</div>
					<ul class="divide-y divide-gray-100 text-sm dark:divide-gray-800">
						<li v-for="it in t.items" :key="it.indicator.id" class="flex items-center justify-between gap-2 py-1.5">
							<span class="min-w-0 truncate text-gray-800 dark:text-gray-200">{{ it.indicator.name }}</span>
							<span class="shrink-0 text-xs text-gray-500">giao {{ kpiTargetText({ direction: it.indicator.direction, manualScale: it.indicator.manualScale, unit: it.indicator.unit }, it.target) }} · {{ kpiNum(it.weight) }}%</span>
						</li>
					</ul>
					<div class="flex flex-wrap items-center justify-between gap-2 text-xs">
						<span :class="kpiWeightText(t.totalWeight).ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700'">{{ kpiWeightText(t.totalWeight).text }}</span>
						<span class="text-gray-500">{{ t.reviewCount }} phiếu đang dùng</span>
					</div>
					<div v-if="!readOnly" class="flex justify-end gap-3 border-t border-gray-100 pt-2 dark:border-gray-800">
						<button type="button" class="text-sm font-medium text-gray-600 hover:underline disabled:opacity-50 dark:text-gray-300" :disabled="togglingId === t.id" @click="toggleTemplate(t)">
							{{ t.isActive ? 'Ngừng dùng' : 'Dùng lại' }}
						</button>
						<button v-if="t.isActive" type="button" class="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300" :data-testid="`kpi-template-edit-${t.id}`" @click="editingTemplate = t">Sửa</button>
					</div>
				</article>
			</div>
		</section>

		<!-- Thang -->
		<section v-else class="space-y-3">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<p class="text-sm text-gray-600 dark:text-gray-300">{{ KPI_HINTS.gradeScale }}</p>
				<CommonAppButton v-if="!readOnly" data-testid="kpi-grade-add" @click="addingScale = true">
					<Icon name="heroicons:plus" class="mr-1 h-4 w-4" />Thêm thang
				</CommonAppButton>
			</div>
			<ul class="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-700 dark:bg-gray-900" data-testid="kpi-grade-list">
				<li v-for="s in scales" :key="s.id" class="flex flex-wrap items-center gap-3 px-4 py-3">
					<div class="min-w-0 flex-1">
						<p class="text-sm font-medium text-gray-900 dark:text-gray-100">
							Áp dụng từ {{ s.effectiveFrom <= '2000-12-31' ? 'đầu' : formatDate(s.effectiveFrom) }}
							<span v-if="s.id === currentScaleId" class="ml-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Đang áp dụng</span>
							<span v-else-if="s.effectiveFrom > today" class="ml-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">Sắp áp dụng</span>
						</p>
						<p class="text-sm text-gray-600 dark:text-gray-300">{{ gradeLine(s) }}</p>
					</div>
				</li>
			</ul>
		</section>

		<KpiIndicatorFormModal v-if="editingIndicator" :indicator="editingIndicator === 'new' ? null : editingIndicator" @close="editingIndicator = null" @saved="onIndicatorSaved" />
		<KpiTemplateFormModal
			v-if="editingTemplate"
			:template="editingTemplate === 'new' ? null : editingTemplate"
			:indicators="indicators"
			@close="editingTemplate = null"
			@saved="onTemplateSaved"
		/>
		<KpiGradeScaleFormModal v-if="addingScale" :base="scales.find(s => s.id === currentScaleId) ?? null" @close="addingScale = false" @saved="onScaleSaved" />
	</div>
</template>
