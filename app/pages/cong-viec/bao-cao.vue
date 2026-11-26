<script setup lang="ts">
	import { endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
	import TaskActionDialogHost from '~/components/modules/tasks/TaskActionDialogHost.vue';
	import TaskDetailPanel from '~/components/modules/tasks/TaskDetailPanel.vue';
	import TaskEmptyState from '~/components/modules/tasks/TaskEmptyState.vue';
	import TaskReportDrillModal from '~/components/modules/tasks/TaskReportDrillModal.vue';
	import TaskStatusBadge from '~/components/modules/tasks/TaskStatusBadge.vue';
	import { useDirectoryStore } from '~/stores/directory';
	import { useTasksService } from '~/services/tasks.service';
	import { tasksReportTour } from '~/tours/tasks';
	import type { TaskOverdueItem, TaskProgressCounts, TaskProgressReport, TaskReportPerson, TaskReportQuery } from '~/types/tasks.types';
	import { PROGRESS_COLUMNS, downloadTaskBlob, pctText, shortDate, taskErrorInfo, vnToday, type ProgressColumn } from '~/utils/tasks.utils';

	/**
	 * UI-06 Báo cáo công việc (F-10, F-18, RP-01, RP-02): tiến độ theo người trong khoảng ngày, việc quá
	 * hạn, xuất Excel hai loại. Mỗi ô số bấm được, mở đúng các việc làm nên con số đó (T-13).
	 *
	 * Ai xem gì do máy chủ quyết (bridge mục 16): ADMIN, Giám đốc, người có `task:report` xem mọi
	 * phòng; trưởng phòng xem phòng mình; quản lý dự án xem khi lọc đúng dự án mình. Trang chỉ dựng ô
	 * chọn theo phạm vi đó, xin ngoài phạm vi thì hiện câu 403 của máy chủ.
	 */
	useHead({ title: 'Báo cáo công việc' });

	const route = useRoute();
	const router = useRouter();
	const toast = useToast();
	const service = useTasksService();
	const directoryStore = useDirectoryStore();
	const { hasPermission } = usePermissions();
	const { canUse } = useModuleAccess();
	const taskScope = useTaskScope();
	const { scope, managedProjects } = taskScope;
	const panel = useTaskPanel();
	const today = vnToday();

	// ─── Phạm vi ─────────────────────────────────────────────────────────────
	const checking = ref(true);
	const allProjects = ref<Array<{ id: number; code: string; name: string }>>([]);
	const broad = computed(() => !!scope.value?.seesAllTasks || hasPermission('task:report'));
	const deptHead = computed(() => (scope.value?.managedDepartments.length ?? 0) > 0);
	const allowed = computed(() => broad.value || deptHead.value || managedProjects.value.length > 0);
	/** Chỉ là quản lý dự án: phải chọn đúng một dự án của mình. */
	const projectOnly = computed(() => !broad.value && !deptHead.value);

	onMounted(async () => {
		if (!canUse('TASKS')) {
			checking.value = false;
			return;
		}
		await taskScope.load(true);
		if (broad.value) {
			await directoryStore.load().catch(() => {});
			try {
				const res = await service.listProjects({ limit: 100 });
				allProjects.value = res.data.filter(p => !p.isSample).map(p => ({ id: p.id, code: p.code, name: p.name }));
			} catch {
				allProjects.value = [];
			}
		}
		checking.value = false;
		if (allowed.value) load();
	});

	const deptOptions = computed(() => {
		if (broad.value) return [{ value: '', label: 'Mọi phòng' }, ...directoryStore.departments.map(d => ({ value: String(d.id), label: d.name }))];
		const list = scope.value?.managedDepartments ?? [];
		if (!list.length) return [];
		return [...(list.length > 1 ? [{ value: '', label: 'Mọi phòng tôi quản lý' }] : []), ...list.map(d => ({ value: String(d.id), label: d.name }))];
	});
	const projectOptions = computed(() => {
		const list = broad.value ? allProjects.value : managedProjects.value;
		if (!list.length) return [];
		const head = projectOnly.value ? [] : [{ value: '', label: 'Mọi dự án' }];
		return [...head, ...list.map(p => ({ value: String(p.id), label: `${p.code} · ${p.name}` }))];
	});

	// ─── Bộ lọc trên đường dẫn ──────────────────────────────────────────────
	const monthStart = format(startOfMonth(parseISO(today)), 'yyyy-MM-dd');
	const monthEnd = format(endOfMonth(parseISO(today)), 'yyyy-MM-dd');
	const tab = computed<'progress' | 'overdue'>(() => (route.query.tab === 'overdue' ? 'overdue' : 'progress'));
	const from = computed(() => String(route.query.from ?? monthStart));
	const to = computed(() => String(route.query.to ?? monthEnd));
	const dept = computed(() => {
		const v = String(route.query.dept ?? '');
		if (v) return v;
		// Trưởng phòng một phòng: chọn sẵn phòng đó.
		return !broad.value && deptOptions.value.length === 1 ? deptOptions.value[0]!.value : '';
	});
	const project = computed(() => {
		const v = String(route.query.project ?? '');
		if (v) return v;
		return projectOnly.value ? (projectOptions.value[0]?.value ?? '') : '';
	});
	function setQuery(patch: Record<string, string | undefined>) {
		const q: Record<string, unknown> = { ...route.query, ...patch };
		for (const [k, v] of Object.entries(q)) if (v === undefined || v === '') delete q[k];
		router.replace({ query: q as Record<string, string> });
	}

	const reportQuery = computed<TaskReportQuery>(() => ({
		from: from.value,
		to: to.value,
		departmentId: dept.value ? Number(dept.value) : undefined,
		projectId: project.value ? Number(project.value) : undefined,
	}));
	const overdueQuery = computed<TaskReportQuery>(() => ({
		departmentId: dept.value ? Number(dept.value) : undefined,
		projectId: project.value ? Number(project.value) : undefined,
	}));

	// ─── Dữ liệu ─────────────────────────────────────────────────────────────
	const report = ref<TaskProgressReport | null>(null);
	const overdue = ref<TaskOverdueItem[]>([]);
	const overdueTotal = ref(0);
	const overduePage = ref(1);
	const loading = ref(true);
	const loadingMore = ref(false);
	const loadError = ref('');
	/** 403 `TASK_REPORT_FORBIDDEN`: xin phòng, dự án ngoài phạm vi. Nút là bỏ chọn, không phải thử lại. */
	const forbidden = ref(false);

	async function load(more = false) {
		if (!allowed.value) return;
		if (more) loadingMore.value = true;
		else loading.value = true;
		loadError.value = '';
		forbidden.value = false;
		try {
			if (tab.value === 'progress') {
				report.value = await service.progressReport(reportQuery.value);
			} else {
				const next = more ? overduePage.value + 1 : 1;
				const res = await service.overdueReport({ ...overdueQuery.value, page: next, limit: 50 });
				overdue.value = more ? [...overdue.value, ...res.data] : res.data;
				overdueTotal.value = res.meta.total;
				overduePage.value = next;
			}
		} catch (err) {
			const info = taskErrorInfo(err, 'Chưa tải được báo cáo.');
			loadError.value = info.message;
			forbidden.value = info.status === 403;
		} finally {
			loading.value = false;
			loadingMore.value = false;
		}
	}
	watch(() => [tab.value, JSON.stringify(reportQuery.value)], () => {
		if (!checking.value) load();
	});

	// ─── Bấm số ─────────────────────────────────────────────────────────────
	const drill = ref<{ col: ProgressColumn; person: TaskReportPerson | null; expected: number | string } | null>(null);
	function cellText(c: TaskProgressCounts, col: ProgressColumn): string {
		if (col.metric === 'quality') return c.quality == null ? '—' : String(Math.round(c.quality * 10) / 10).replace('.', ',');
		// `noDue` không có ở BE cũ: hiện 0 thay vì chữ "undefined".
		return String(c[col.metric] ?? 0);
	}
	function cellCount(c: TaskProgressCounts, col: ProgressColumn): number {
		return col.metric === 'quality' ? c.qualityCount : c[col.metric] ?? 0;
	}
	function openDrill(col: ProgressColumn, person: TaskReportPerson | null, c: TaskProgressCounts) {
		drill.value = { col, person, expected: cellText(c, col) };
	}
	function openFromDrill(code: string) {
		drill.value = null;
		panel.open(code);
	}

	/**
	 * Giải thích cột mở bằng nút ⓘ trên đầu cột (UI-18a): `title` không hiện trên điện thoại, còn hộp nổi trong
	 * khung cuộn ngang thì bị cắt, nên câu giải thích hiện trong một khung ngay trên bảng. Bấm lại thì đóng.
	 */
	const hintCol = ref<ProgressColumn | null>(null);
	function toggleHint(col: ProgressColumn) {
		hintCol.value = hintCol.value?.metric === col.metric ? null : col;
	}

	// ─── Xuất Excel ─────────────────────────────────────────────────────────
	const exporting = ref(false);
	async function exportExcel() {
		exporting.value = true;
		try {
			if (tab.value === 'progress') {
				const blob = await service.exportProgress(reportQuery.value);
				downloadTaskBlob(blob, `bao-cao-tien-do-cong-viec-${from.value}_${to.value}.xlsx`);
			} else {
				const blob = await service.exportOverdue(overdueQuery.value);
				downloadTaskBlob(blob, `viec-qua-han-${today}.xlsx`);
			}
			toast.success('Đã tải file Excel');
		} catch (err) {
			toast.error(taskErrorInfo(err, 'Chưa xuất được file Excel.').message);
		} finally {
			exporting.value = false;
		}
	}

	const scopeText = computed(() => {
		const s = report.value?.scope;
		if (!s) return '';
		if (s.projectName) return `Dự án ${s.projectName}`;
		return s.departmentNames.length ? `Phòng ${s.departmentNames.join(', ')}` : 'Mọi phòng';
	});

	usePageTour('tasks-report', () => tasksReportTour({ showProgress: () => setQuery({ tab: undefined }) }), () => !checking.value && allowed.value && !loading.value && !loadError.value && tab.value === 'progress');
</script>

<template>
	<div class="space-y-4 pb-24">
		<UiPageHeader
			title="Báo cáo công việc"
			description="Tiến độ theo từng người trong khoảng ngày: được giao, hoàn thành, đúng hạn, quá hạn, khối lượng và chất lượng. Việc tự giao, việc con và dự án mẫu không tính."
		>
			<CommonAppButton
				v-if="allowed && !checking"
				variant="secondary"
				:loading="exporting"
				data-tour="task-report-export"
				data-testid="report-export"
				@click="exportExcel"
			>
				<Icon name="heroicons:arrow-down-tray" class="mr-1 h-4 w-4" />Xuất Excel
			</CommonAppButton>
		</UiPageHeader>
		<CommonAppModuleNotice module="TASKS" />

		<div v-if="checking" class="space-y-2" aria-busy="true">
			<div v-for="i in 5" :key="i" class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
		</div>
		<TaskEmptyState
			v-else-if="!allowed"
			kind="filtered"
			title="Báo cáo dành cho trưởng phòng và quản lý dự án"
			description="Bạn chưa làm trưởng phòng hay quản lý dự án nào, và chưa được cấp quyền xem báo cáo. Việc của bạn nằm ở Việc của tôi."
			action-label="Về Việc của tôi"
			data-testid="report-not-allowed"
			@action="router.push('/cong-viec')"
		/>
		<template v-else>
			<div class="flex rounded-lg bg-gray-100 p-0.5 text-sm dark:bg-gray-800 sm:inline-flex" role="tablist" aria-label="Loại báo cáo">
				<button
					v-for="t in ([{ key: 'progress', label: 'Tiến độ' }, { key: 'overdue', label: 'Việc quá hạn' }] as const)"
					:key="t.key"
					type="button"
					role="tab"
					:aria-selected="tab === t.key"
					class="flex-1 whitespace-nowrap rounded-md px-3 py-1.5 font-medium focus:outline-none sm:flex-none focus:ring-2 focus:ring-brand-500"
					:class="tab === t.key ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'"
					:data-testid="`report-tab-${t.key}`"
					@click="setQuery({ tab: t.key === 'progress' ? undefined : t.key })"
				>
					{{ t.label }}
				</button>
			</div>

			<div class="grid gap-2 sm:flex sm:flex-wrap sm:items-end" data-tour="task-report-filters">
				<div v-if="tab === 'progress'" class="sm:w-72">
					<span class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Hạn ban đầu trong khoảng</span>
					<UiDateRangePicker
						:from-date="from"
						:to-date="to"
						@update:from-date="v => setQuery({ from: v || undefined })"
						@update:to-date="v => setQuery({ to: v || undefined })"
					/>
				</div>
				<UiSelect
					v-if="deptOptions.length"
					class="sm:w-56"
					label="Phòng"
					:model-value="dept"
					:options="deptOptions"
					searchable
					data-testid="report-dept"
					@update:model-value="v => setQuery({ dept: v == null ? undefined : String(v) })"
				/>
				<UiSelect
					v-if="projectOptions.length"
					class="sm:w-64"
					label="Dự án"
					:model-value="project"
					:options="projectOptions"
					searchable
					data-testid="report-project"
					@update:model-value="v => setQuery({ project: v == null ? undefined : String(v) })"
				/>
			</div>

			<div v-if="loading" class="h-64 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" aria-busy="true" />
			<TaskEmptyState
				v-else-if="loadError"
				kind="error"
				title="Chưa xem được báo cáo"
				:description="loadError"
				:action-label="forbidden ? 'Xem phạm vi của tôi' : 'Thử lại'"
				data-testid="report-error"
				@action="forbidden ? setQuery({ dept: undefined, project: undefined }) : load()"
			/>

			<!-- Tiến độ -->
			<template v-else-if="tab === 'progress' && report">
				<p class="text-sm text-gray-600 dark:text-gray-300">
					{{ scopeText }} · hạn ban đầu từ {{ shortDate(report.from, today) }} tới {{ shortDate(report.to, today) }} · bấm vào số để xem việc
				</p>
				<TaskEmptyState
					v-if="!report.rows.length"
					kind="filtered"
					title="Không có việc nào được giao trong khoảng này"
					description="Bạn chọn khoảng ngày khác hoặc phòng, dự án khác."
				/>
				<div
					v-if="report.rows.length && hintCol"
					class="flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900 dark:border-brand-800 dark:bg-brand-900/20 dark:text-brand-100"
					role="note"
					data-testid="report-col-hint"
				>
					<Icon name="heroicons:information-circle" class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
					<p class="min-w-0 flex-1"><b>{{ hintCol.label }}:</b> {{ hintCol.hint }}</p>
					<button
						type="button"
						class="-m-1 rounded p-1 text-brand-700 hover:bg-brand-100 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-brand-300 dark:hover:bg-brand-900/40"
						aria-label="Đóng giải thích"
						@click="hintCol = null"
					>
						<Icon name="heroicons:x-mark" class="h-4 w-4" />
					</button>
				</div>
				<div v-if="report.rows.length" class="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900" data-tour="task-report-table">
					<table class="w-full min-w-[72rem] text-sm" data-testid="report-table">
						<thead class="bg-gray-50 text-left text-xs font-medium text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
							<tr>
								<th class="sticky left-0 z-10 bg-gray-50 px-3 py-2 dark:bg-gray-800">Người thực hiện</th>
								<th v-for="col in PROGRESS_COLUMNS" :key="col.metric" class="whitespace-nowrap px-3 py-2 text-right" :title="col.hint">
									{{ col.label }}
									<button
										type="button"
										class="-my-1 ml-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full align-middle text-gray-400 hover:bg-gray-200 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:hover:bg-gray-700 dark:hover:text-gray-200"
										:class="hintCol?.metric === col.metric ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : ''"
										:aria-label="`Giải thích cột ${col.label}`"
										:aria-expanded="hintCol?.metric === col.metric"
										:data-testid="`report-col-info-${col.metric}`"
										@click="toggleHint(col)"
									>
										<Icon name="heroicons:information-circle" class="h-4 w-4" />
									</button>
								</th>
							</tr>
						</thead>
						<tbody>
							<tr v-for="r in report.rows" :key="r.person.id" class="border-t border-gray-100 dark:border-gray-800">
								<td class="sticky left-0 z-10 bg-white px-3 py-2 dark:bg-gray-900">
									<p class="font-medium text-gray-900 dark:text-gray-100">
										{{ r.person.fullName }}<span v-if="r.person.inactive" class="ml-1 text-xs font-normal text-gray-400">(đã nghỉ)</span>
									</p>
									<p class="text-xs text-gray-500">{{ [r.person.employeeCode, r.person.departmentName].filter(Boolean).join(' · ') }}</p>
								</td>
								<td v-for="col in PROGRESS_COLUMNS" :key="col.metric" class="px-3 py-2 text-right">
									<button
										v-if="cellCount(r.counts, col) > 0"
										type="button"
										class="rounded px-1 font-medium text-brand-700 underline decoration-dotted underline-offset-2 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-brand-300 dark:hover:bg-brand-900/30"
										:class="col.metric === 'overdueOpen' ? 'text-rose-600 dark:text-rose-400' : ''"
										:data-testid="`report-cell-${r.person.id}-${col.metric}`"
										@click="openDrill(col, r.person, r.counts)"
									>
										{{ cellText(r.counts, col) }}
									</button>
									<span v-else class="text-gray-400">{{ cellText(r.counts, col) }}</span>
									<span v-if="col.pct" class="block text-[11px] text-gray-500">{{ pctText(r.counts[col.pct]) }}</span>
								</td>
							</tr>
						</tbody>
						<tfoot>
							<tr class="border-t-2 border-gray-200 bg-gray-50 font-semibold dark:border-gray-700 dark:bg-gray-800/60">
								<td class="sticky left-0 z-10 bg-gray-50 px-3 py-2 dark:bg-gray-800">Tổng</td>
								<td v-for="col in PROGRESS_COLUMNS" :key="col.metric" class="px-3 py-2 text-right">
									<button
										v-if="cellCount(report.total, col) > 0"
										type="button"
										class="rounded px-1 text-brand-700 underline decoration-dotted underline-offset-2 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-brand-300"
										:data-testid="`report-cell-total-${col.metric}`"
										@click="openDrill(col, null, report.total)"
									>
										{{ cellText(report.total, col) }}
									</button>
									<span v-else class="text-gray-400">{{ cellText(report.total, col) }}</span>
									<span v-if="col.pct" class="block text-[11px] font-normal text-gray-500">{{ pctText(report.total[col.pct]) }}</span>
								</td>
							</tr>
						</tfoot>
					</table>
				</div>
				<p class="text-xs text-gray-500 dark:text-gray-400" data-testid="report-rate-note">
					Tỷ lệ hoàn thành tính trên số việc được giao trừ việc đã huỷ. Tỷ lệ báo xong đúng hạn chỉ tính việc có hạn,
					việc chưa có hạn đếm riêng ở cột Chưa có hạn. Đúng hạn tính theo lần báo xong đầu tiên.
				</p>
			</template>

			<!-- Việc quá hạn -->
			<template v-else-if="tab === 'overdue'">
				<p class="text-sm text-gray-600 dark:text-gray-300">{{ overdueTotal }} việc chưa báo xong mà hạn đã qua</p>
				<TaskEmptyState v-if="!overdue.length" kind="done" title="Không có việc nào quá hạn" description="Mọi việc trong phạm vi này đều đang kịp hạn." />
				<div v-else class="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
					<table class="w-full min-w-[56rem] text-sm" data-testid="report-overdue-table">
						<thead class="bg-gray-50 text-left text-xs font-medium text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
							<tr>
								<th class="px-3 py-2">Số hiệu</th>
								<th class="px-3 py-2">Tiêu đề</th>
								<th class="px-3 py-2">Người thực hiện</th>
								<th class="px-3 py-2">Người giao</th>
								<th class="px-3 py-2">Hạn</th>
								<th class="px-3 py-2">Hạn ban đầu</th>
								<th class="px-3 py-2 text-right">Quá hạn</th>
								<th class="px-3 py-2">Trạng thái</th>
							</tr>
						</thead>
						<tbody>
							<tr v-for="t in overdue" :key="t.id" class="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/40">
								<td class="px-3 py-2 text-xs font-semibold text-gray-500">{{ t.code }}</td>
								<td class="px-3 py-2">
									<button type="button" class="text-left font-medium text-gray-900 hover:underline dark:text-gray-100" @click="panel.open(t.code)">{{ t.title }}</button>
									<span v-if="t.project" class="block text-xs text-gray-500">{{ t.project.name }}</span>
								</td>
								<td class="px-3 py-2 text-gray-700 dark:text-gray-200">{{ t.assignee.fullName }}</td>
								<td class="px-3 py-2 text-gray-700 dark:text-gray-200">{{ t.assigner.fullName }}</td>
								<td class="px-3 py-2">{{ shortDate(t.dueDate, today) }}</td>
								<td class="px-3 py-2 text-gray-500">{{ shortDate(t.originalDueDate, today) }}</td>
								<td class="px-3 py-2 text-right font-semibold text-rose-600">{{ t.daysOverdue }} ngày</td>
								<td class="px-3 py-2"><TaskStatusBadge :status="t.status" :label="t.statusLabel" /></td>
							</tr>
						</tbody>
					</table>
				</div>
				<div v-if="overdue.length < overdueTotal" class="text-center">
					<CommonAppButton size="sm" variant="secondary" :loading="loadingMore" @click="load(true)">Tải thêm</CommonAppButton>
				</div>
			</template>
		</template>

		<TaskReportDrillModal
			v-if="drill"
			:query="reportQuery"
			:metric="drill.col.metric"
			:metric-label="drill.col.label"
			:assignee-id="drill.person?.id ?? null"
			:person-name="drill.person?.fullName ?? null"
			:expected="drill.expected"
			@close="drill = null"
			@open="t => openFromDrill(t.code)"
		/>
		<TaskDetailPanel />
		<TaskActionDialogHost />
	</div>
</template>
