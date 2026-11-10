<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import AssetFormModal from '~/components/modules/asset/AssetFormModal.vue';
	import AssetImportModal from '~/components/modules/asset/AssetImportModal.vue';
	import { downloadAssetBlob, formatAssetMoney, ASSET_STATUS_CLASS } from '~/utils/asset.utils';
	import { formatDate } from '~/utils/date';
	import {
		ASSET_KIND_LABELS,
		ASSET_STATUS_LABELS,
		PHYSICAL_STATUSES,
		SERVICE_STATUSES,
		type Asset,
		type AssetCategory,
		type AssetKind,
		type AssetStatus,
	} from '~/types/asset.types';

	definePageMeta({ title: 'Quản lý tài sản' });

	const toast = useToast();
	const service = useAssetService();
	const { canWrite } = useModuleAccess();
	const { hasPermission } = usePermissions();
	const directoryStore = useDirectoryStore();
	const { departments } = storeToRefs(directoryStore);

	const canManage = computed(() => canWrite('ASSET') && hasPermission('asset:manage'));

	// ─── Bộ lọc ───────────────────────────────────────────────────────────────────
	const search = ref('');
	const filterKind = ref<AssetKind | ''>('');
	const filterStatus = ref<AssetStatus | ''>('');
	const filterCategory = ref<number | undefined>(undefined);
	const filterDept = ref<number | undefined>(undefined);
	const page = ref(1);
	const limit = 20;

	const assets = ref<Asset[]>([]);
	const meta = ref<{ page: number; limit: number; total: number; totalPages: number } | null>(null);
	const loading = ref(true);
	const categories = ref<AssetCategory[]>([]);
	const exporting = ref(false);

	const showFormModal = ref(false);
	const showImportModal = ref(false);

	function currentQuery() {
		return {
			search: search.value || undefined,
			kind: filterKind.value || undefined,
			status: filterStatus.value || undefined,
			categoryId: filterCategory.value,
			departmentId: filterDept.value,
		};
	}

	async function loadTable() {
		loading.value = true;
		try {
			const res = await service.findAll({ ...currentQuery(), page: page.value, limit });
			assets.value = res.data;
			meta.value = res.meta;
		} catch (e) {
			// MANAGER mở phòng khác hay công ty chưa mở module đều rơi vào đây: hiện toast,
			// giữ bảng rỗng, KHÔNG để trang trắng.
			assets.value = [];
			meta.value = null;
			toast.error(e instanceof Error ? e.message : 'Không tải được danh sách tài sản');
		} finally {
			loading.value = false;
		}
	}

	onMounted(async () => {
		try {
			categories.value = await service.findCategories();
		} catch {
			// không chặn bảng chính: thiếu danh mục thì ô lọc loại rỗng thôi
		}
		directoryStore.load().catch(() => {
			/* ô lọc phòng ban rỗng, bảng vẫn chạy */
		});
		await loadTable();
	});

	watch([search, filterKind, filterStatus, filterCategory, filterDept], () => {
		page.value = 1;
		loadTable();
	});
	watch(page, () => loadTable());

	// Đổi họ tài sản thì trạng thái và loại đang chọn có thể không còn thuộc họ đó.
	watch(filterKind, kind => {
		if (kind && filterStatus.value) {
			const allowed = kind === 'SERVICE' ? SERVICE_STATUSES : PHYSICAL_STATUSES;
			if (!allowed.includes(filterStatus.value)) filterStatus.value = '';
		}
		if (kind && filterCategory.value) {
			const cat = categories.value.find(c => c.id === filterCategory.value);
			if (cat && cat.kind !== kind) filterCategory.value = undefined;
		}
	});

	let searchTimer: ReturnType<typeof setTimeout> | null = null;
	function onSearchInput(e: Event) {
		const val = (e.target as HTMLInputElement).value;
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			search.value = val;
		}, 300);
	}

	const kindOptions = [
		{ value: '', label: 'Tất cả loại hình' },
		...Object.entries(ASSET_KIND_LABELS).map(([value, label]) => ({ value, label })),
	];

	const statusOptions = computed(() => {
		const codes = filterKind.value
			? filterKind.value === 'SERVICE'
				? SERVICE_STATUSES
				: PHYSICAL_STATUSES
			: [...PHYSICAL_STATUSES, ...SERVICE_STATUSES];
		return [
			{ value: '', label: 'Tất cả trạng thái' },
			...codes.map(code => ({ value: code, label: ASSET_STATUS_LABELS[code] })),
		];
	});

	const categoryOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Tất cả loại tài sản' },
		...categories.value
			.filter(c => !filterKind.value || c.kind === filterKind.value)
			.map(c => ({ value: c.id as number | undefined, label: `${c.groupName} → ${c.name}` })),
	]);

	const deptOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Tất cả phòng ban' },
		...departments.value.map(d => ({ value: d.id as number | undefined, label: d.name })),
	]);

	/** Cột tiền ẩn hẳn khi không ai trong trang này được xem giá trị. */
	const showValueColumn = computed(() => assets.value.some(a => a.canViewValue));

	function holderLabel(asset: Asset): string {
		if (!asset.holders.length) return '—';
		const first = asset.holders[0]!;
		const name = first.employee?.fullName ?? first.department?.name ?? '—';
		return asset.holders.length > 1 ? `${name} +${asset.holders.length - 1}` : name;
	}

	async function handleExport() {
		exporting.value = true;
		try {
			const blob = await service.exportExcel(currentQuery());
			downloadAssetBlob(blob, 'tai-san.xlsx');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Xuất Excel thất bại');
		} finally {
			exporting.value = false;
		}
	}

	async function onSaved() {
		showFormModal.value = false;
		page.value = 1;
		await loadTable();
	}

	async function onImported() {
		showImportModal.value = false;
		page.value = 1;
		await loadTable();
	}
</script>

<template>
	<div class="space-y-5">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h1 class="text-xl font-bold text-gray-900 dark:text-white">Quản lý tài sản</h1>
				<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
					Thiết bị và dịch vụ thuê bao của công ty
				</p>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<CommonAppButton variant="outline" :loading="exporting" @click="handleExport">
					Xuất Excel
				</CommonAppButton>
				<CommonAppButton v-if="canManage" variant="outline" @click="showImportModal = true">
					Nhập Excel
				</CommonAppButton>
				<CommonAppButton v-if="canManage" variant="primary" @click="showFormModal = true">
					Thêm tài sản
				</CommonAppButton>
			</div>
		</div>

		<CommonAppModuleNotice module="ASSET" />

		<!-- Bộ lọc -->
		<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
				<div class="relative">
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
						placeholder="Tìm mã, tên, serial, model..."
						class="block w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						@input="onSearchInput"
					/>
				</div>
				<UiSelect v-model="filterKind" :options="kindOptions" />
				<UiSelect v-model="filterStatus" :options="statusOptions" />
				<UiSelect v-model="filterCategory" :options="categoryOptions" />
				<UiSelect v-model="filterDept" :options="deptOptions" />
			</div>
		</div>

		<!-- Bảng -->
		<div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
			<div v-if="loading" class="space-y-3 p-6">
				<div v-for="i in 5" :key="i" class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
			</div>

			<div
				v-else-if="!assets.length"
				class="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500"
			>
				<svg class="mb-3 h-10 w-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25M12 12.75h.008v.008H12v-.008z"
					/>
				</svg>
				<p class="text-sm">Không tìm thấy tài sản nào</p>
			</div>

			<div v-else class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Mã</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tên</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Loại</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Đang giữ</th>
							<th v-if="showValueColumn" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Nguyên giá</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Trạng thái</th>
							<th class="px-4 py-3" />
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
						<tr
							v-for="asset in assets"
							:key="asset.id"
							class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40"
						>
							<td class="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{{ asset.code }}</td>
							<td class="px-4 py-3">
								<NuxtLink
									:to="`/management/assets/${asset.id}`"
									class="font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
								>
									{{ asset.name }}
								</NuxtLink>
								<p v-if="asset.physical?.serialNumber" class="font-mono text-xs text-gray-400">
									SN {{ asset.physical.serialNumber }}
								</p>
								<p v-else-if="asset.service?.plan" class="text-xs text-gray-400">{{ asset.service.plan }}</p>
							</td>
							<td class="px-4 py-3">
								<p class="text-gray-700 dark:text-gray-300">{{ asset.category.name }}</p>
								<p class="text-xs text-gray-400">{{ asset.category.groupName }} · {{ asset.kindLabel }}</p>
							</td>
							<td class="px-4 py-3 text-gray-700 dark:text-gray-300">
								{{ holderLabel(asset) }}
								<p
									v-if="asset.kind === 'SERVICE' && asset.service?.seatCount != null"
									class="text-xs"
									:class="
										asset.service.seatsUsed > asset.service.seatCount
											? 'text-amber-600 dark:text-amber-400'
											: 'text-gray-400'
									"
								>
									{{ asset.service.seatsUsed }}/{{ asset.service.seatCount }} ghế
								</p>
							</td>
							<td v-if="showValueColumn" class="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
								{{ formatAssetMoney(asset.costVnd ?? asset.cost, asset.costVnd != null ? 'VND' : asset.currency) }}
							</td>
							<td class="px-4 py-3">
								<span
									class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
									:class="ASSET_STATUS_CLASS[asset.status]"
								>
									{{ asset.statusLabel }}
								</span>
								<p v-if="asset.purchaseDate" class="mt-0.5 text-xs text-gray-400">
									Mua {{ formatDate(asset.purchaseDate) }}
								</p>
							</td>
							<td class="px-4 py-3 text-right">
								<NuxtLink
									:to="`/management/assets/${asset.id}`"
									class="text-xs text-brand-600 hover:underline dark:text-brand-400"
								>
									Xem chi tiết
								</NuxtLink>
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<div
				v-if="meta && meta.totalPages > 1"
				class="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-800"
			>
				<p class="text-xs text-gray-500 dark:text-gray-400">
					{{ (page - 1) * limit + 1 }}–{{ Math.min(page * limit, meta.total) }} / {{ meta.total }} tài sản
				</p>
				<CommonAppPagination
					:current-page="page"
					:total-pages="meta.totalPages"
					@update:current-page="page = $event"
				/>
			</div>
		</div>

		<AssetFormModal v-if="showFormModal" @saved="onSaved" @close="showFormModal = false" />
		<AssetImportModal v-if="showImportModal" @imported="onImported" @close="showImportModal = false" />
	</div>
</template>
