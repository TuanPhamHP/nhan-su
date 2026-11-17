<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import RecruitStatTile from '~/components/modules/recruitment/RecruitStatTile.vue';
	import RecruitChip from '~/components/modules/recruitment/RecruitChip.vue';
	import {
		downloadRecruitmentBlob,
		formatPercent,
		formatRecruitMoney,
		headcountYearOptions,
		recruitErrorMessage,
		JOB_STATUS_CLASS,
	} from '~/utils/recruitment.utils';
	import type {
		HeadcountRow,
		RecruitmentCostRow,
		RecruitmentFunnel,
		RecruitmentJob,
		RecruitmentSourceRow,
		RecruitmentTimeToHire,
	} from '~/types/recruitment.types';

	definePageMeta({ title: 'Báo cáo tuyển dụng' });

	const toast = useToast();
	const service = useRecruitmentService();
	const { hasPermission } = usePermissions();
	const directoryStore = useDirectoryStore();
	const { departments, positions } = storeToRefs(directoryStore);

	/**
	 * Hai mức quyền, không gộp được:
	 * - Phễu tuyển dụng và Định biên chỉ cần `recruitment:read` và chạy theo phạm vi, nên
	 *   trưởng phòng xem được phần của phòng mình.
	 * - Nguồn ứng viên, Thời gian tuyển và Chi phí là báo cáo toàn công ty, cần
	 *   `recruitment:report:read`; thiếu quyền thì API trả 403 nên tab phải ẩn hẳn.
	 */
	const canSeeCompanyReports = computed(() => hasPermission('recruitment:report:read'));

	type TabId = 'funnel' | 'headcount' | 'sources' | 'timeToHire' | 'costs';

	const tabs = computed(() => {
		const list: { id: TabId; label: string }[] = [
			{ id: 'funnel', label: 'Phễu tuyển dụng' },
			{ id: 'headcount', label: 'Định biên' },
		];
		if (canSeeCompanyReports.value) {
			list.push(
				{ id: 'sources', label: 'Hiệu quả nguồn' },
				{ id: 'timeToHire', label: 'Thời gian tuyển' },
				{ id: 'costs', label: 'Chi phí' },
			);
		}
		return list;
	});

	const tab = ref<TabId>('funnel');

	// Bộ lọc dùng chung
	const from = ref('');
	const to = ref('');
	const filterJob = ref<number | undefined>(undefined);
	const filterDept = ref<number | undefined>(undefined);
	const filterPosition = ref<number | undefined>(undefined);
	const year = ref(new Date().getFullYear());

	const jobs = ref<RecruitmentJob[]>([]);
	const loading = ref(false);
	const loadError = ref<string | null>(null);
	const exporting = ref(false);

	const funnel = ref<RecruitmentFunnel | null>(null);
	const headcount = ref<HeadcountRow[]>([]);
	const sources = ref<RecruitmentSourceRow[]>([]);
	const timeToHire = ref<RecruitmentTimeToHire | null>(null);
	const costs = ref<RecruitmentCostRow[]>([]);

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			const range = { from: from.value || undefined, to: to.value || undefined };
			switch (tab.value) {
				case 'funnel':
					funnel.value = await service.funnelReport({ ...range, jobId: filterJob.value });
					break;
				case 'headcount':
					headcount.value = await service.headcountReport({
						year: year.value,
						departmentId: filterDept.value,
					});
					break;
				case 'sources':
					sources.value = await service.sourceReport({
						...range,
						departmentId: filterDept.value,
					});
					break;
				case 'timeToHire':
					timeToHire.value = await service.timeToHireReport({
						...range,
						departmentId: filterDept.value,
						positionId: filterPosition.value,
					});
					break;
				case 'costs':
					costs.value = await service.costReport(range);
					break;
			}
		} catch (e) {
			loadError.value = recruitErrorMessage(e, 'Không tải được báo cáo');
		} finally {
			loading.value = false;
		}
	}

	onMounted(async () => {
		directoryStore.load().catch(() => {
			/* ô lọc rỗng, báo cáo vẫn chạy */
		});
		try {
			const res = await service.findJobs({ limit: 100 });
			jobs.value = res.data;
		} catch {
			// Ô lọc tin rỗng thì vẫn xem được phễu toàn bộ.
		}
		await load();
	});

	watch([tab, from, to, filterJob, filterDept, filterPosition, year], load);

	const jobOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Tất cả tin' },
		...jobs.value.map(j => ({ value: j.id as number | undefined, label: `${j.code} · ${j.title}` })),
	]);

	const deptOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Tất cả phòng ban' },
		...departments.value.map(d => ({ value: d.id as number | undefined, label: d.name })),
	]);

	const positionOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Tất cả vị trí' },
		...positions.value.map(p => ({ value: p.id as number | undefined, label: p.name })),
	]);

	const yearOptions = headcountYearOptions();

	const showRangeFilter = computed(() => tab.value !== 'headcount');
	const showJobFilter = computed(() => tab.value === 'funnel');
	const showDeptFilter = computed(() =>
		['headcount', 'sources', 'timeToHire'].includes(tab.value),
	);
	const showPositionFilter = computed(() => tab.value === 'timeToHire');
	const showYearFilter = computed(() => tab.value === 'headcount');

	/** Thời gian tuyển không có bản Excel; các báo cáo còn lại đều có. */
	const canExport = computed(() => tab.value !== 'timeToHire');

	async function handleExport() {
		exporting.value = true;
		try {
			const range = { from: from.value || undefined, to: to.value || undefined };
			let blob: Blob;
			let name: string;
			switch (tab.value) {
				case 'funnel':
					blob = await service.exportFunnel({ ...range, jobId: filterJob.value });
					name = 'pheu-tuyen-dung.xlsx';
					break;
				case 'headcount':
					blob = await service.exportHeadcountReport({
						year: year.value,
						departmentId: filterDept.value,
					});
					name = `dinh-bien-${year.value}.xlsx`;
					break;
				case 'sources':
					blob = await service.exportSourceReport({ ...range, departmentId: filterDept.value });
					name = 'nguon-ung-vien.xlsx';
					break;
				default:
					blob = await service.exportCostReport(range);
					name = 'chi-phi-tuyen-dung.xlsx';
			}
			downloadRecruitmentBlob(blob, name);
		} catch (e) {
			toast.error(recruitErrorMessage(e, 'Xuất Excel thất bại'));
		} finally {
			exporting.value = false;
		}
	}

	/** Chiều dài thanh phễu so với dòng đầu, để bảng đọc được bằng mắt. */
	function funnelWidth(reached: number): string {
		const top = funnel.value?.stages[0]?.reached ?? 0;
		if (!top) return '0%';
		return `${Math.max(2, Math.round((reached / top) * 100))}%`;
	}

	const costTotals = computed(() =>
		costs.value.reduce(
			(acc, r) => ({
				budget: acc.budget + (r.budget ?? 0),
				actual: acc.actual + (r.actualCost ?? 0),
				hires: acc.hires + r.hires,
			}),
			{ budget: 0, actual: 0, hires: 0 },
		),
	);
</script>

<template>
	<div class="space-y-5">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h1 class="text-xl font-bold text-gray-900 dark:text-white">Báo cáo tuyển dụng</h1>
				<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
					Phễu ứng viên, định biên, hiệu quả nguồn, thời gian và chi phí tuyển
				</p>
			</div>
			<CommonAppButton v-if="canExport" variant="outline" :loading="exporting" @click="handleExport">
				Xuất Excel
			</CommonAppButton>
		</div>

		<CommonAppModuleNotice module="RECRUIT" />

		<p
			v-if="!canSeeCompanyReports"
			class="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300"
		>
			Bạn xem được phễu tuyển dụng và định biên trong phạm vi của mình. Báo cáo nguồn ứng viên, thời
			gian tuyển và chi phí là báo cáo toàn công ty nên cần quyền riêng.
		</p>

		<div class="border-b border-gray-200 dark:border-gray-700">
			<nav class="-mb-px flex flex-wrap gap-1">
				<button
					v-for="t in tabs"
					:key="t.id"
					type="button"
					class="border-b-2 px-4 py-2.5 text-sm font-medium transition-colors"
					:class="
						tab === t.id
							? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
							: 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
					"
					@click="tab = t.id"
				>
					{{ t.label }}
				</button>
			</nav>
		</div>

		<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<template v-if="showRangeFilter">
					<div class="space-y-1">
						<label class="block text-xs font-medium text-gray-600 dark:text-gray-400">Từ ngày</label>
						<UiDatePicker v-model="from" />
					</div>
					<div class="space-y-1">
						<label class="block text-xs font-medium text-gray-600 dark:text-gray-400">Đến ngày</label>
						<UiDatePicker v-model="to" />
					</div>
				</template>
				<div v-if="showYearFilter" class="space-y-1">
					<label class="block text-xs font-medium text-gray-600 dark:text-gray-400">Năm</label>
					<UiSelect v-model="year" :options="yearOptions" />
				</div>
				<div v-if="showJobFilter" class="space-y-1">
					<label class="block text-xs font-medium text-gray-600 dark:text-gray-400">Tin tuyển dụng</label>
					<UiSelect v-model="filterJob" :options="jobOptions" />
				</div>
				<div v-if="showDeptFilter" class="space-y-1">
					<label class="block text-xs font-medium text-gray-600 dark:text-gray-400">Phòng ban</label>
					<UiSelect v-model="filterDept" :options="deptOptions" />
				</div>
				<div v-if="showPositionFilter" class="space-y-1">
					<label class="block text-xs font-medium text-gray-600 dark:text-gray-400">Vị trí</label>
					<UiSelect v-model="filterPosition" :options="positionOptions" />
				</div>
			</div>
		</div>

		<div v-if="loading" class="space-y-3">
			<div v-for="i in 3" :key="i" class="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>

		<div
			v-else-if="loadError"
			class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-center dark:border-rose-800 dark:bg-rose-900/20"
		>
			<p class="text-sm text-rose-700 dark:text-rose-300">{{ loadError }}</p>
		</div>

		<!-- RP-01 Phễu -->
		<template v-else-if="tab === 'funnel' && funnel">
			<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Phễu tuyển dụng</h2>
					<p class="text-sm text-gray-500 dark:text-gray-400">{{ funnel.total }} hồ sơ trong bộ lọc</p>
				</div>

				<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
					Một hồ sơ được tính ở mọi vòng nó từng đi qua, kể cả khi sau đó bị loại, nên số ở vòng đầu
					luôn lớn hơn hoặc bằng vòng sau.
				</p>

				<ul class="mt-4 space-y-3">
					<li v-for="stage in funnel.stages" :key="stage.key">
						<div class="flex items-center justify-between gap-3 text-sm">
							<span class="text-gray-700 dark:text-gray-300">{{ stage.label }}</span>
							<span class="tabular-nums text-gray-900 dark:text-white">
								{{ stage.reached }}
								<span v-if="stage.conversionRate != null" class="ml-2 text-xs text-gray-400">
									{{ formatPercent(stage.conversionRate) }} so với vòng trước
								</span>
							</span>
						</div>
						<div class="mt-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800">
							<div class="h-2 rounded-full bg-brand-500" :style="{ width: funnelWidth(stage.reached) }" />
						</div>
					</li>
				</ul>
			</div>

			<div
				v-if="funnel.rejectionReasons.length"
				class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
			>
				<h2 class="text-base font-semibold text-gray-900 dark:text-white">Lý do loại nhiều nhất</h2>
				<ul class="mt-3 space-y-2">
					<li
						v-for="reason in funnel.rejectionReasons"
						:key="reason.reasonId"
						class="flex items-center justify-between gap-3 text-sm"
					>
						<span class="text-gray-700 dark:text-gray-300">{{ reason.name }}</span>
						<span class="tabular-nums text-gray-900 dark:text-white">{{ reason.count }}</span>
					</li>
				</ul>
			</div>
		</template>

		<!-- RP-03 Định biên -->
		<div
			v-else-if="tab === 'headcount'"
			class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
		>
			<div v-if="!headcount.length" class="py-16 text-center text-sm text-gray-400 dark:text-gray-500">
				Năm {{ year }} chưa có dòng định biên nào trong phạm vi của bạn.
			</div>
			<div v-else class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Phòng ban</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Vị trí</th>
							<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Đã chốt</th>
							<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Đang có</th>
							<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Đang tuyển</th>
							<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Còn trống</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
						<tr v-for="row in headcount" :key="row.id">
							<td class="px-4 py-3 text-gray-700 dark:text-gray-300">{{ row.department.name }}</td>
							<td class="px-4 py-3 text-gray-900 dark:text-white">{{ row.position.name }}</td>
							<td class="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-white">
								{{ row.confirmedQuantity ?? '—' }}
							</td>
							<td class="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{{ row.current }}</td>
							<td class="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{{ row.recruiting }}</td>
							<td
								class="px-4 py-3 text-right font-semibold tabular-nums"
								:class="row.available < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-white'"
							>
								{{ row.available }}
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>

		<!-- RP-02 Nguồn -->
		<div
			v-else-if="tab === 'sources'"
			class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
		>
			<div v-if="!sources.length" class="py-16 text-center text-sm text-gray-400 dark:text-gray-500">
				Chưa có hồ sơ nào trong khoảng đang chọn.
			</div>
			<div v-else class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Nguồn</th>
							<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Hồ sơ</th>
							<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Qua sơ loại</th>
							<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Đã tuyển</th>
							<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tỉ lệ tuyển</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
						<tr v-for="row in sources" :key="row.sourceId ?? 'unknown'">
							<td class="px-4 py-3 text-gray-900 dark:text-white">{{ row.sourceName }}</td>
							<td class="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{{ row.applications }}</td>
							<td class="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{{ row.passedScreening }}</td>
							<td class="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-white">{{ row.hired }}</td>
							<td class="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
								{{ formatPercent(row.hireRate) }}
							</td>
						</tr>
					</tbody>
				</table>
			</div>
			<p class="border-t border-gray-100 px-4 py-2 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
				Báo cáo này không có cột chi phí theo nguồn; chi phí xem ở tab Chi phí, tính theo từng tin.
			</p>
		</div>

		<!-- RP-04 Thời gian tuyển -->
		<template v-else-if="tab === 'timeToHire' && timeToHire">
			<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<RecruitStatTile label="Offer được đồng ý" :value="timeToHire.acceptedOffers" />
				<RecruitStatTile label="Offer bị từ chối" :value="timeToHire.declinedOffers" />
				<RecruitStatTile label="Offer hết hạn" :value="timeToHire.expiredOffers" />
				<RecruitStatTile
					label="Tỉ lệ đồng ý"
					:value="formatPercent(timeToHire.offerAcceptanceRate)"
				/>
			</div>

			<div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
				<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Từ duyệt yêu cầu đến đồng ý</h2>
					<p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
						Trung bình
						<strong>{{ timeToHire.timeToFill.average ?? '—' }}</strong> ngày, trung vị
						<strong>{{ timeToHire.timeToFill.median ?? '—' }}</strong> ngày.
					</p>
				</div>
				<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Từ ứng tuyển đến đồng ý</h2>
					<p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
						Trung bình
						<strong>{{ timeToHire.timeToHire.average ?? '—' }}</strong> ngày, trung vị
						<strong>{{ timeToHire.timeToHire.median ?? '—' }}</strong> ngày.
					</p>
				</div>
			</div>

			<p class="text-xs text-gray-500 dark:text-gray-400">
				Chỉ tính phiên bản cuối của mỗi offer, nên bản đã bị thay bằng phiên bản mới không lọt vào báo
				cáo. Báo cáo này không có bản Excel.
			</p>
		</template>

		<!-- RP-05 Chi phí -->
		<div
			v-else-if="tab === 'costs'"
			class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
		>
			<div v-if="!costs.length" class="py-16 text-center text-sm text-gray-400 dark:text-gray-500">
				Chưa có tin nào trong khoảng đang chọn.
			</div>
			<div v-else class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tin</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Phòng ban</th>
							<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Ngân sách</th>
							<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Chi phí thực tế</th>
							<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Đã tuyển</th>
							<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Chi phí mỗi người</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
						<tr v-for="row in costs" :key="row.jobId">
							<td class="px-4 py-3">
								<NuxtLink
									:to="`/management/recruitment/jobs/${row.jobId}`"
									class="text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
								>
									{{ row.title }}
								</NuxtLink>
								<div class="mt-0.5 flex items-center gap-2">
									<span class="font-mono text-xs text-gray-400">{{ row.code }}</span>
									<RecruitChip :label="row.statusLabel" :tone="JOB_STATUS_CLASS[row.status]" />
								</div>
							</td>
							<td class="px-4 py-3 text-gray-700 dark:text-gray-300">{{ row.departmentName }}</td>
							<td class="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
								{{ formatRecruitMoney(row.budget) }}
							</td>
							<td class="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
								{{ formatRecruitMoney(row.actualCost) }}
							</td>
							<td class="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-white">{{ row.hires }}</td>
							<td class="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-white">
								{{ formatRecruitMoney(row.costPerHire) }}
							</td>
						</tr>
					</tbody>
					<tfoot>
						<tr class="border-t border-gray-200 bg-gray-50 font-semibold dark:border-gray-700 dark:bg-gray-800/50">
							<td class="px-4 py-3 text-gray-700 dark:text-gray-300" colspan="2">
								Tổng {{ costs.length }} tin
							</td>
							<td class="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-white">
								{{ formatRecruitMoney(costTotals.budget) }}
							</td>
							<td class="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-white">
								{{ formatRecruitMoney(costTotals.actual) }}
							</td>
							<td class="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-white">
								{{ costTotals.hires }}
							</td>
							<td class="px-4 py-3" />
						</tr>
					</tfoot>
				</table>
			</div>
			<p class="border-t border-gray-100 px-4 py-2 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
				Ngân sách và chi phí thực tế nhập ở từng tin tuyển dụng.
			</p>
		</div>
	</div>
</template>
