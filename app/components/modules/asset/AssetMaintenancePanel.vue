<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import MaintenanceFormModal from '~/components/modules/asset/MaintenanceFormModal.vue';
	import MaintenanceCloseModal from '~/components/modules/asset/MaintenanceCloseModal.vue';
	import { MAINTENANCE_STATUS_CLASS, formatAssetMoney } from '~/utils/asset.utils';
	import { formatDate } from '~/utils/date';
	import type { Asset, AssetMaintenance } from '~/types/asset.types';

	const props = defineProps<{
		asset: Asset;
		canManage: boolean;
	}>();

	const emit = defineEmits<{ 'asset-changed': [] }>();

	const toast = useToast();
	const service = useAssetService();

	const items = ref<AssetMaintenance[]>([]);
	const loading = ref(true);
	const editing = ref<AssetMaintenance | null>(null);
	const closing = ref<AssetMaintenance | null>(null);

	/** Mỗi lúc chỉ một phiếu mở: có phiếu mở thì nút "Mở phiếu" phải tắt. */
	const openTicket = computed(() =>
		items.value.find(m => m.status === 'OPEN' || m.status === 'IN_PROGRESS'),
	);

	async function load() {
		loading.value = true;
		try {
			const res = await service.findMaintenances({ assetId: props.asset.id, limit: 100 });
			items.value = res.data;
		} catch (e) {
			items.value = [];
			toast.error(e instanceof Error ? e.message : 'Không tải được phiếu sửa chữa');
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);

	async function afterChange() {
		editing.value = null;
		closing.value = null;
		await load();
		emit('asset-changed');
	}
</script>

<template>
	<section class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
		<!-- Mở phiếu sửa nằm ở menu "Tác vụ" đầu trang, không lặp lại nút ở đây. -->
		<div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
			<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">Phiếu sửa chữa</h3>
			<p v-if="openTicket" class="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
				Đang có phiếu mở — đóng phiếu này rồi mới mở phiếu mới được.
			</p>
		</div>

		<div v-if="loading" class="space-y-3 p-4">
			<div v-for="i in 3" :key="i" class="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
		</div>

		<p v-else-if="!items.length" class="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
			Tài sản này chưa có phiếu sửa nào.
		</p>

		<div v-else class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead class="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
					<tr>
						<th class="px-4 py-2 text-left font-medium">Mô tả</th>
						<th class="px-4 py-2 text-left font-medium">Đơn vị sửa</th>
						<th class="px-4 py-2 text-left font-medium">Gửi / Xong</th>
						<th v-if="asset.canViewValue" class="px-4 py-2 text-right font-medium">Chi phí</th>
						<th class="px-4 py-2 text-left font-medium">Trạng thái</th>
						<th v-if="canManage" class="px-4 py-2" />
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
					<tr v-for="m in items" :key="m.id">
						<td class="px-4 py-3">
							<p class="text-gray-900 dark:text-white">{{ m.description }}</p>
							<p v-if="m.workDone" class="text-xs text-gray-500 dark:text-gray-400">Đã làm: {{ m.workDone }}</p>
							<p v-if="m.underWarranty" class="text-xs text-emerald-600 dark:text-emerald-400">Còn bảo hành</p>
						</td>
						<td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ m.vendor?.name ?? '—' }}</td>
						<td class="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
							<p>{{ m.sentAt ? formatDate(m.sentAt) : '—' }}</p>
							<p class="text-gray-400">{{ m.doneAt ? formatDate(m.doneAt) : 'chưa xong' }}</p>
						</td>
						<td v-if="asset.canViewValue" class="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
							{{ formatAssetMoney(m.cost) }}
						</td>
						<td class="px-4 py-3">
							<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="MAINTENANCE_STATUS_CLASS[m.status]">
								{{ m.statusLabel }}
							</span>
						</td>
						<td v-if="canManage" class="px-4 py-3 text-right">
							<div v-if="m.status === 'OPEN' || m.status === 'IN_PROGRESS'" class="flex justify-end gap-2">
								<CommonAppButton size="sm" variant="outline" @click="editing = m">Sửa</CommonAppButton>
								<CommonAppButton size="sm" variant="primary" @click="closing = m">Đóng</CommonAppButton>
							</div>
						</td>
					</tr>
				</tbody>
			</table>
		</div>

		<MaintenanceFormModal
			v-if="editing"
			:asset-id="asset.id"
			:asset-label="`${asset.code} · ${asset.name}`"
			:maintenance="editing"
			@saved="afterChange"
			@close="editing = null"
		/>
		<MaintenanceCloseModal
			v-if="closing"
			:maintenance="closing"
			@closed="afterChange"
			@close="closing = null"
		/>
	</section>
</template>
