<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import { downloadAssetBlob, formatAssetMoney, renewalDaysClass, renewalDaysLabel } from '~/utils/asset.utils';
	import { formatDate, todayYmd } from '~/utils/date';
	import {
		ASSET_ACCOUNTING_CLASS_LABELS,
		type AssetAccountingClass,
		type AssetCategory,
		type AssetDepreciationReport,
		type AssetExpiringRow,
	} from '~/types/asset.types';

	definePageMeta({ title: 'Báo cáo tài sản' });

	const toast = useToast();
	const service = useAssetService();

	const activeTab = ref<'depreciation' | 'expiring'>('depreciation');

	// ─── Báo cáo khấu hao ─────────────────────────────────────────────────────────
	const asOf = ref(todayYmd());
	const filterCategory = ref<number | undefined>(undefined);
	const filterClass = ref<AssetAccountingClass | ''>('');
	const categories = ref<AssetCategory[]>([]);
	const report = ref<AssetDepreciationReport | null>(null);
	const loadingReport = ref(false);
	const reportError = ref<string | null>(null);
	const exporting = ref(false);

	function depreciationQuery() {
		return {
			asOf: asOf.value || undefined,
			categoryId: filterCategory.value,
			accountingClass: filterClass.value || undefined,
		};
	}

	async function loadReport() {
		loadingReport.value = true;
		reportError.value = null;
		try {
			report.value = await service.depreciationReport(depreciationQuery());
		} catch (e) {
			// Thiếu `asset:value:read` thì cả báo cáo này không mở được — nói thẳng lý do.
			report.value = null;
			reportError.value = e instanceof Error ? e.message : 'Không tải được báo cáo khấu hao';
		} finally {
			loadingReport.value = false;
		}
	}

	async function exportReport() {
		exporting.value = true;
		try {
			const blob = await service.exportDepreciationReport(depreciationQuery());
			downloadAssetBlob(blob, 'khau-hao-tai-san.xlsx');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Xuất Excel thất bại');
		} finally {
			exporting.value = false;
		}
	}

	// ─── Báo cáo sắp hết hạn ──────────────────────────────────────────────────────
	const withinDays = ref(30);
	const expiringType = ref<'renewal' | 'warranty' | ''>('');
	const expiring = ref<AssetExpiringRow[]>([]);
	const loadingExpiring = ref(false);

	async function loadExpiring() {
		loadingExpiring.value = true;
		try {
			expiring.value = await service.expiringReport({
				withinDays: withinDays.value,
				type: expiringType.value || undefined,
			});
		} catch (e) {
			expiring.value = [];
			toast.error(e instanceof Error ? e.message : 'Không tải được danh sách sắp hết hạn');
		} finally {
			loadingExpiring.value = false;
		}
	}

	onMounted(async () => {
		service
			.findCategories()
			.then(list => {
				categories.value = list;
			})
			.catch(() => {
				/* ô lọc rỗng thôi */
			});
		await loadReport();
	});

	watch([asOf, filterCategory, filterClass], loadReport);
	watch([withinDays, expiringType], () => {
		if (activeTab.value === 'expiring') loadExpiring();
	});
	watch(activeTab, tab => {
		if (tab === 'expiring' && !expiring.value.length && !loadingExpiring.value) loadExpiring();
	});

	const categoryOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Tất cả loại tài sản' },
		...categories.value
			.filter(c => c.kind === 'PHYSICAL')
			.map(c => ({ value: c.id as number | undefined, label: `${c.groupName} → ${c.name}` })),
	]);
	const classOptions = [
		{ value: '', label: 'Tất cả phân loại' },
		...Object.entries(ASSET_ACCOUNTING_CLASS_LABELS).map(([value, label]) => ({ value, label })),
	];
	const withinOptions = [
		{ value: 7, label: 'Trong 7 ngày' },
		{ value: 30, label: 'Trong 30 ngày' },
		{ value: 90, label: 'Trong 90 ngày' },
		{ value: 180, label: 'Trong 180 ngày' },
	];
	const typeOptions = [
		{ value: '', label: 'Cả gia hạn và bảo hành' },
		{ value: 'renewal', label: 'Gia hạn dịch vụ' },
		{ value: 'warranty', label: 'Hết hạn bảo hành' },
	];
</script>

<template>
	<div class="space-y-5">
		<div>
			<h1 class="text-xl font-bold text-gray-900 dark:text-white">Báo cáo tài sản</h1>
			<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Khấu hao và những thứ sắp đến hạn</p>
		</div>

		<CommonAppModuleNotice module="ASSET" />

		<div class="border-b border-gray-200 dark:border-gray-700">
			<nav class="-mb-px flex gap-1">
				<button
					type="button"
					:class="[
						'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
						activeTab === 'depreciation'
							? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
							: 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400',
					]"
					@click="activeTab = 'depreciation'"
				>
					Khấu hao
				</button>
				<button
					type="button"
					:class="[
						'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
						activeTab === 'expiring'
							? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
							: 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400',
					]"
					@click="activeTab = 'expiring'"
				>
					Sắp hết hạn
				</button>
			</nav>
		</div>

		<!-- ── Khấu hao ─────────────────────────────────────────────────────── -->
		<template v-if="activeTab === 'depreciation'">
			<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-4">
					<label class="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
						Tính đến ngày
						<UiDatePicker v-model="asOf" />
					</label>
					<div class="sm:col-span-1">
						<p class="mb-1 text-xs text-gray-500 dark:text-gray-400">Loại tài sản</p>
						<UiSelect v-model="filterCategory" :options="categoryOptions" />
					</div>
					<div>
						<p class="mb-1 text-xs text-gray-500 dark:text-gray-400">Phân loại kế toán</p>
						<UiSelect v-model="filterClass" :options="classOptions" />
					</div>
					<div class="flex items-end">
						<CommonAppButton variant="outline" :loading="exporting" :disabled="!report" @click="exportReport">
							Xuất Excel
						</CommonAppButton>
					</div>
				</div>
			</div>

			<div v-if="loadingReport" class="space-y-3">
				<div v-for="i in 5" :key="i" class="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
			</div>

			<div
				v-else-if="reportError"
				class="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
			>
				{{ reportError }}
			</div>

			<template v-else-if="report">
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
					<div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
						<p class="text-xs text-gray-500 dark:text-gray-400">Tổng nguyên giá</p>
						<p class="mt-0.5 text-lg font-bold tabular-nums text-gray-900 dark:text-white">
							{{ formatAssetMoney(report.totals.costVnd) }}
						</p>
					</div>
					<div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
						<p class="text-xs text-gray-500 dark:text-gray-400">Đã trích khấu hao</p>
						<p class="mt-0.5 text-lg font-bold tabular-nums text-gray-900 dark:text-white">
							{{ formatAssetMoney(report.totals.accumulated) }}
						</p>
					</div>
					<div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
						<p class="text-xs text-gray-500 dark:text-gray-400">Giá trị còn lại</p>
						<p class="mt-0.5 text-lg font-bold tabular-nums text-brand-600 dark:text-brand-400">
							{{ formatAssetMoney(report.totals.bookValue) }}
						</p>
					</div>
				</div>

				<div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
					<p v-if="!report.rows.length" class="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
						Không có tài sản nào khớp bộ lọc.
					</p>
					<div v-else class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tài sản</th>
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Loại</th>
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Phân loại</th>
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Bắt đầu / Tháng</th>
									<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Nguyên giá</th>
									<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Luỹ kế</th>
									<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Còn lại</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
								<tr v-for="row in report.rows" :key="row.assetId" class="hover:bg-gray-50 dark:hover:bg-gray-800/40">
									<td class="px-4 py-3">
										<NuxtLink
											:to="`/management/assets/${row.assetId}`"
											class="font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
										>
											{{ row.name }}
										</NuxtLink>
										<p class="font-mono text-xs text-gray-400">{{ row.code }}</p>
									</td>
									<td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ row.categoryName }}</td>
									<td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ row.accountingClassLabel ?? '—' }}</td>
									<td class="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
										<p>{{ row.startDate ? formatDate(row.startDate) : '—' }}</p>
										<p class="text-gray-400">{{ row.months != null ? `${row.months} tháng` : '—' }}</p>
									</td>
									<td class="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
										{{ formatAssetMoney(row.costVnd) }}
									</td>
									<td class="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
										{{ formatAssetMoney(row.accumulated) }}
									</td>
									<td class="px-4 py-3 text-right font-medium tabular-nums text-gray-900 dark:text-white">
										{{ formatAssetMoney(row.bookValue) }}
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			</template>
		</template>

		<!-- ── Sắp hết hạn ──────────────────────────────────────────────────── -->
		<template v-else>
			<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<UiSelect v-model="withinDays" :options="withinOptions" />
					<UiSelect v-model="expiringType" :options="typeOptions" />
				</div>
			</div>

			<div v-if="loadingExpiring" class="space-y-3">
				<div v-for="i in 5" :key="i" class="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
			</div>

			<div v-else class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
				<p v-if="!expiring.length" class="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
					Không có gì đến hạn trong khoảng này.
				</p>
				<div v-else class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tài sản</th>
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Việc</th>
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Người phụ trách</th>
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Ngày</th>
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Còn lại</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr
								v-for="row in expiring"
								:key="`${row.type}-${row.assetId}`"
								class="hover:bg-gray-50 dark:hover:bg-gray-800/40"
							>
								<td class="px-4 py-3">
									<NuxtLink
										:to="`/management/assets/${row.assetId}`"
										class="font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
									>
										{{ row.name }}
									</NuxtLink>
									<p class="font-mono text-xs text-gray-400">{{ row.code }}</p>
								</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-300">
									{{ row.type === 'renewal' ? 'Gia hạn dịch vụ' : 'Hết hạn bảo hành' }}
								</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ row.ownerName ?? '—' }}</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ formatDate(row.date) }}</td>
								<td class="px-4 py-3" :class="renewalDaysClass(row.daysLeft)">
									{{ renewalDaysLabel(row.daysLeft) }}
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</template>
	</div>
</template>
