<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import MaintenanceCloseModal from '~/components/modules/asset/MaintenanceCloseModal.vue';
	import { MAINTENANCE_STATUS_CLASS, formatAssetMoney } from '~/utils/asset.utils';
	import { formatDate } from '~/utils/date';
	import {
		ASSET_MAINTENANCE_STATUS_LABELS,
		type AssetMaintenance,
		type AssetMaintenanceStatus,
		type AssetVendor,
	} from '~/types/asset.types';

	definePageMeta({ title: 'Sửa chữa tài sản' });

	const toast = useToast();
	const service = useAssetService();
	const { canWrite } = useModuleAccess();
	const { hasPermission } = usePermissions();

	const canManage = computed(() => canWrite('ASSET') && hasPermission('asset:manage'));

	const items = ref<AssetMaintenance[]>([]);
	const meta = ref<{ total: number; totalPages: number } | null>(null);
	const loading = ref(true);
	const page = ref(1);
	const limit = 20;
	const filterStatus = ref<AssetMaintenanceStatus | ''>('');
	const filterVendor = ref<number | undefined>(undefined);
	const vendors = ref<AssetVendor[]>([]);
	const closing = ref<AssetMaintenance | null>(null);

	async function load() {
		loading.value = true;
		try {
			const res = await service.findMaintenances({
				status: filterStatus.value || undefined,
				vendorId: filterVendor.value,
				page: page.value,
				limit,
			});
			items.value = res.data;
			meta.value = res.meta;
		} catch (e) {
			items.value = [];
			meta.value = null;
			toast.error(e instanceof Error ? e.message : 'Không tải được danh sách sửa chữa');
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

	watch([filterStatus, filterVendor], () => {
		page.value = 1;
		load();
	});
	watch(page, load);

	const statusOptions = [
		{ value: '', label: 'Tất cả trạng thái' },
		...Object.entries(ASSET_MAINTENANCE_STATUS_LABELS).map(([value, label]) => ({ value, label })),
	];
	const vendorOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Tất cả đơn vị sửa' },
		...vendors.value.map(v => ({ value: v.id as number | undefined, label: v.name })),
	]);

	const showValueColumn = computed(() => items.value.some(m => m.cost != null));

	async function onClosed() {
		closing.value = null;
		await load();
	}
</script>

<template>
	<div class="space-y-5">
		<div>
			<h1 class="text-xl font-bold text-gray-900 dark:text-white">Sửa chữa tài sản</h1>
			<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
				Phiếu sửa của toàn bộ thiết bị. Mở phiếu mới từ trang chi tiết của từng tài sản.
			</p>
		</div>

		<CommonAppModuleNotice module="ASSET" />

		<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<UiSelect v-model="filterStatus" :options="statusOptions" />
				<UiSelect v-model="filterVendor" :options="vendorOptions" />
			</div>
		</div>

		<div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
			<div v-if="loading" class="space-y-3 p-6">
				<div v-for="i in 5" :key="i" class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
			</div>

			<p v-else-if="!items.length" class="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
				Không có phiếu sửa nào.
			</p>

			<div v-else class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tài sản</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Mô tả</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Đơn vị sửa</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Gửi / Xong</th>
							<th v-if="showValueColumn" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Chi phí</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Trạng thái</th>
							<th class="px-4 py-3" />
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
						<tr v-for="m in items" :key="m.id" class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40">
							<td class="px-4 py-3">
								<NuxtLink
									:to="`/management/assets/${m.asset.id}`"
									class="font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
								>
									{{ m.asset.name }}
								</NuxtLink>
								<p class="font-mono text-xs text-gray-400">{{ m.asset.code }}</p>
							</td>
							<td class="max-w-xs px-4 py-3">
								<p class="break-words text-gray-700 dark:text-gray-300">{{ m.description }}</p>
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
