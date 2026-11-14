<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import MaintenanceCloseModal from '~/components/modules/asset/MaintenanceCloseModal.vue';
	import {
		MAINTENANCE_STATUS_CLASS,
		MAINTENANCE_TYPE_CLASS,
		formatAssetMoney,
		maintenanceCreatorName,
	} from '~/utils/asset.utils';
	import { formatDate } from '~/utils/date';
	import {
		ASSET_MAINTENANCE_STATUS_LABELS,
		ASSET_MAINTENANCE_TYPE_LABELS,
		type AssetMaintenance,
		type AssetMaintenanceStatus,
		type AssetMaintenanceType,
		type AssetVendor,
	} from '~/types/asset.types';

	definePageMeta({ title: 'Sửa chữa, bảo dưỡng tài sản' });

	const service = useAssetService();
	const { canWrite } = useModuleAccess();
	const { hasPermission } = usePermissions();

	const canManage = computed(() => canWrite('ASSET') && hasPermission('asset:manage'));

	const items = ref<AssetMaintenance[]>([]);
	const meta = ref<{ total: number; totalPages: number } | null>(null);
	const loading = ref(true);
	const loadError = ref<string | null>(null);
	const page = ref(1);
	const limit = 20;
	const filterStatus = ref<AssetMaintenanceStatus | ''>('');
	const filterType = ref<AssetMaintenanceType | ''>('');
	const filterVendor = ref<number | undefined>(undefined);
	const vendors = ref<AssetVendor[]>([]);
	const closing = ref<AssetMaintenance | null>(null);

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			const res = await service.findMaintenances({
				status: filterStatus.value || undefined,
				type: filterType.value || undefined,
				vendorId: filterVendor.value,
				page: page.value,
				limit,
			});
			items.value = res.data;
			meta.value = res.meta;
		} catch (e) {
			items.value = [];
			meta.value = null;
			loadError.value =
				e instanceof Error ? e.message : 'Chưa tải được danh sách phiếu sửa, phiếu bảo dưỡng. Bạn bấm Thử lại.';
		} finally {
			loading.value = false;
		}
	}

	onMounted(async () => {
		service
			.findVendors({ isActive: true })
			.then(list => {
				vendors.value = list;
			})
			.catch(() => {
				/* ô lọc rỗng, bảng vẫn chạy */
			});
		await load();
	});

	watch([filterStatus, filterType, filterVendor], () => {
		page.value = 1;
		load();
	});
	watch(page, load);

	const statusOptions = [
		{ value: '', label: 'Tất cả trạng thái' },
		...Object.entries(ASSET_MAINTENANCE_STATUS_LABELS).map(([value, label]) => ({ value, label })),
	];
	const typeOptions = [
		{ value: '', label: 'Sửa chữa và bảo dưỡng' },
		...Object.entries(ASSET_MAINTENANCE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
	];
	const vendorOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Tất cả đơn vị sửa chữa' },
		...vendors.value.map(v => ({ value: v.id as number | undefined, label: v.name })),
	]);

	/** Câu trạng thái rỗng phân biệt "chưa có phiếu nào" với "lọc không ra". */
	const emptyText = computed(() =>
		filterStatus.value || filterType.value || filterVendor.value
			? 'Không có phiếu sửa hay phiếu bảo dưỡng nào khớp bộ lọc. Bạn bỏ bớt điều kiện lọc để xem thêm.'
			: 'Chưa có phiếu sửa hay phiếu bảo dưỡng nào. Bạn mở phiếu ở trang chi tiết của từng tài sản.',
	);

	const showValueColumn = computed(() => items.value.some(m => m.cost != null));

	async function onClosed() {
		closing.value = null;
		await load();
	}
</script>

<template>
	<div class="space-y-5">
		<div>
			<h1 class="text-xl font-bold text-gray-900 dark:text-white">Sửa chữa, bảo dưỡng</h1>
			<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
				Phiếu sửa chữa và phiếu bảo dưỡng định kỳ của toàn bộ thiết bị. Mở phiếu mới từ trang chi tiết
				của từng tài sản; phiếu do hệ thống mở theo lịch ghi người tạo là "Hệ thống".
			</p>
		</div>

		<CommonAppModuleNotice module="ASSET" />

		<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
				<UiSelect v-model="filterType" :options="typeOptions" />
				<UiSelect v-model="filterStatus" :options="statusOptions" />
				<UiSelect v-model="filterVendor" :options="vendorOptions" />
			</div>
		</div>

		<div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
			<div v-if="loading" class="space-y-3 p-6">
				<div v-for="i in 5" :key="i" class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
			</div>

			<div v-else-if="loadError" class="flex flex-col items-center gap-3 px-4 py-12 text-center">
				<p class="text-sm text-rose-700 dark:text-rose-300">{{ loadError }}</p>
				<CommonAppButton size="sm" variant="outline" @click="load">Thử lại</CommonAppButton>
			</div>

			<p v-else-if="!items.length" class="px-4 py-16 text-center text-sm text-gray-600 dark:text-gray-400">
				{{ emptyText }}
			</p>

			<div v-else class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tài sản</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Loại</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Mô tả</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Đơn vị thực hiện</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Gửi đi / Xong</th>
							<th v-if="showValueColumn" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Chi phí</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Trạng thái</th>
							<th class="px-4 py-3" />
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
						<tr v-for="m in items" :key="m.id" class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40">
							<td class="px-4 py-3">
								<!-- Mở đúng phiếu ở tab Sửa chữa, bảo dưỡng chứ không phải tab Thông tin (G18). -->
								<NuxtLink
									:to="`/management/assets/${m.asset.id}?tab=maintenances&maintenance_id=${m.id}`"
									class="font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
								>
									{{ m.asset.name }}
								</NuxtLink>
								<p class="font-mono text-xs text-gray-400">{{ m.asset.code }}</p>
							</td>
							<td class="px-4 py-3">
								<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="MAINTENANCE_TYPE_CLASS[m.type]">
									{{ m.typeLabel }}
								</span>
								<p class="mt-1 text-xs text-gray-400">{{ maintenanceCreatorName(m.createdBy) }}</p>
							</td>
							<td class="max-w-xs px-4 py-3">
								<p class="break-words text-gray-700 dark:text-gray-300">{{ m.description }}</p>
								<p v-if="m.workDone" class="break-words text-xs text-gray-600 dark:text-gray-400">Đã làm: {{ m.workDone }}</p>
								<p v-if="m.underWarranty" class="text-xs text-emerald-600 dark:text-emerald-400">Còn bảo hành</p>
							</td>
							<td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ m.vendor?.name ?? '—' }}</td>
							<td class="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
								<p>{{ m.sentAt ? formatDate(m.sentAt) : '—' }}</p>
								<p class="text-gray-400">{{ m.doneAt ? formatDate(m.doneAt) : 'chưa xong' }}</p>
							</td>
							<td v-if="showValueColumn" class="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
								{{ formatAssetMoney(m.cost) }}
							</td>
							<td class="px-4 py-3">
								<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="MAINTENANCE_STATUS_CLASS[m.status]">
									{{ m.statusLabel }}
								</span>
							</td>
							<td class="px-4 py-3 text-right">
								<CommonAppButton
									v-if="canManage && (m.status === 'OPEN' || m.status === 'IN_PROGRESS')"
									size="sm"
									variant="primary"
									@click="closing = m"
								>
									Đóng phiếu
								</CommonAppButton>
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<div
				v-if="meta && meta.totalPages > 1"
				class="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-800"
			>
				<p class="text-xs text-gray-500 dark:text-gray-400">{{ meta.total }} phiếu</p>
				<CommonAppPagination :current-page="page" :total-pages="meta.totalPages" @update:current-page="page = $event" />
			</div>
		</div>

		<MaintenanceCloseModal v-if="closing" :maintenance="closing" @closed="onClosed" @close="closing = null" />
	</div>
</template>
