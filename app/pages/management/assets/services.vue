<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import {
		ASSET_STATUS_CLASS,
		formatAssetMoney,
		renewalDaysClass,
		renewalDaysLabel,
	} from '~/utils/asset.utils';
	import { formatDate } from '~/utils/date';
	import { ASSET_STATUS_LABELS, SERVICE_STATUSES, type Asset, type AssetStatus } from '~/types/asset.types';

	definePageMeta({ title: 'Dịch vụ thuê bao' });

	const toast = useToast();
	const service = useAssetService();

	const items = ref<Asset[]>([]);
	const meta = ref<{ total: number; totalPages: number } | null>(null);
	const loading = ref(true);
	const page = ref(1);
	const limit = 20;
	const search = ref('');
	const filterStatus = ref<AssetStatus | ''>('');

	async function load() {
		loading.value = true;
		try {
			const res = await service.findAll({
				kind: 'SERVICE',
				status: filterStatus.value || undefined,
				search: search.value || undefined,
				page: page.value,
				limit,
			});
			items.value = res.data;
			meta.value = res.meta;
		} catch (e) {
			items.value = [];
			meta.value = null;
			toast.error(e instanceof Error ? e.message : 'Không tải được danh sách dịch vụ');
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);
	watch([search, filterStatus], () => {
		page.value = 1;
		load();
	});
	watch(page, load);

	let searchTimer: ReturnType<typeof setTimeout> | null = null;
	function onSearchInput(e: Event) {
		const val = (e.target as HTMLInputElement).value;
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			search.value = val;
		}, 300);
	}

	const statusOptions = [
		{ value: '', label: 'Tất cả trạng thái' },
		...SERVICE_STATUSES.map(code => ({ value: code, label: ASSET_STATUS_LABELS[code] })),
	];

	const showValueColumn = computed(() => items.value.some(a => a.canViewValue));

	/** Sắp hết hạn lên đầu để người trực nhìn thấy trước, trong cùng một trang server trả về. */
	const sorted = computed(() =>
		[...items.value].sort((a, b) => {
			const da = a.service?.daysUntilRenewal;
			const db = b.service?.daysUntilRenewal;
			if (da == null && db == null) return 0;
			if (da == null) return 1;
			if (db == null) return -1;
			return da - db;
		}),
	);
</script>

<template>
	<div class="space-y-5">
		<div>
			<h1 class="text-xl font-bold text-gray-900 dark:text-white">Dịch vụ thuê bao</h1>
			<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
				VPS, tên miền, license phần mềm — xếp theo thứ sắp đến hạn trước
			</p>
		</div>

		<CommonAppModuleNotice module="ASSET" />

		<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
				<div class="relative sm:col-span-2">
					<svg
						class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
					</svg>
					<input
						type="text"
						placeholder="Tìm mã hoặc tên dịch vụ..."
						class="block w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						@input="onSearchInput"
					/>
				</div>
				<UiSelect v-model="filterStatus" :options="statusOptions" />
			</div>
		</div>

		<div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
			<div v-if="loading" class="space-y-3 p-6">
				<div v-for="i in 5" :key="i" class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
			</div>

			<p v-else-if="!sorted.length" class="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
				Chưa có dịch vụ nào.
			</p>

			<div v-else class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Dịch vụ</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Người phụ trách</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Chu kỳ</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Hạn gia hạn</th>
							<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Ghế</th>
							<th v-if="showValueColumn" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Đơn giá</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Trạng thái</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
						<tr v-for="a in sorted" :key="a.id" class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40">
							<td class="px-4 py-3">
								<NuxtLink
									:to="`/management/assets/${a.id}`"
									class="font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
								>
									{{ a.name }}
								</NuxtLink>
								<p class="font-mono text-xs text-gray-400">{{ a.code }}</p>
								<p v-if="a.service?.plan" class="text-xs text-gray-400">{{ a.service.plan }}</p>
							</td>
							<td class="px-4 py-3 text-gray-700 dark:text-gray-300">
								{{ a.service?.owner.fullName ?? '—' }}
								<p v-if="a.service" class="font-mono text-xs text-gray-400">{{ a.service.owner.employeeCode }}</p>
							</td>
							<td class="px-4 py-3 text-gray-600 dark:text-gray-300">
								{{ a.service?.billingCycleLabel ?? '—' }}
								<p v-if="a.service?.autoRenew" class="text-xs text-emerald-600 dark:text-emerald-400">Tự gia hạn</p>
							</td>
							<td class="px-4 py-3">
								<p class="text-gray-700 dark:text-gray-300">
									{{ a.service?.nextRenewalDate ? formatDate(a.service.nextRenewalDate) : '—' }}
								</p>
								<p class="text-xs" :class="renewalDaysClass(a.service?.daysUntilRenewal ?? null)">
									{{ renewalDaysLabel(a.service?.daysUntilRenewal ?? null) }}
								</p>
							</td>
							<td class="px-4 py-3 text-right tabular-nums">
								<span
									:class="
										a.service?.seatCount != null && a.service.seatsUsed > a.service.seatCount
											? 'text-amber-600 dark:text-amber-400 font-semibold'
											: 'text-gray-700 dark:text-gray-300'
									"
								>
									{{ a.service?.seatsUsed ?? 0 }}<template v-if="a.service?.seatCount != null">/{{ a.service.seatCount }}</template>
								</span>
							</td>
							<td v-if="showValueColumn" class="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
								{{ formatAssetMoney(a.service?.unitPrice ?? null, a.currency) }}
							</td>
							<td class="px-4 py-3">
								<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="ASSET_STATUS_CLASS[a.status]">
									{{ a.statusLabel }}
								</span>
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<div
				v-if="meta && meta.totalPages > 1"
				class="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-800"
			>
				<p class="text-xs text-gray-500 dark:text-gray-400">{{ meta.total }} dịch vụ</p>
				<CommonAppPagination :current-page="page" :total-pages="meta.totalPages" @update:current-page="page = $event" />
			</div>
		</div>
	</div>
</template>
