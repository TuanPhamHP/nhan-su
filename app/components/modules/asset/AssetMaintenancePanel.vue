<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import MaintenanceFormModal from '~/components/modules/asset/MaintenanceFormModal.vue';
	import MaintenanceCloseModal from '~/components/modules/asset/MaintenanceCloseModal.vue';
	import {
		MAINTENANCE_STATUS_CLASS,
		MAINTENANCE_TYPE_CLASS,
		formatAssetMoney,
		maintenanceCreatorName,
	} from '~/utils/asset.utils';
	import { formatDate } from '~/utils/date';
	import type { Asset, AssetMaintenance } from '~/types/asset.types';

	const props = withDefaults(
		defineProps<{
			asset: Asset;
			canManage: boolean;
			/** Phiếu cần tô nổi và cuộn tới, khi mở từ trang Sửa chữa, bảo dưỡng hay từ báo hỏng. */
			highlightId?: number | null;
		}>(),
		{ highlightId: null },
	);

	const emit = defineEmits<{ 'asset-changed': [] }>();

	const service = useAssetService();

	const items = ref<AssetMaintenance[]>([]);
	const loading = ref(true);
	const loadError = ref<string | null>(null);
	const editing = ref<AssetMaintenance | null>(null);
	const closing = ref<AssetMaintenance | null>(null);

	/** Mỗi lúc chỉ một phiếu mở: có phiếu mở thì nút "Mở phiếu" phải tắt. */
	const openTicket = computed(() =>
		items.value.find(m => m.status === 'OPEN' || m.status === 'IN_PROGRESS'),
	);

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			const res = await service.findMaintenances({ assetId: props.asset.id, limit: 100 });
			items.value = res.data;
		} catch (e) {
			items.value = [];
			loadError.value =
				e instanceof Error ? e.message : 'Chưa tải được phiếu sửa, phiếu bảo dưỡng của tài sản này. Bạn bấm Thử lại.';
		} finally {
			loading.value = false;
		}
	}

	onMounted(async () => {
		await load();
		if (!props.highlightId) return;
		await nextTick();
		document.getElementById(`maintenance-${props.highlightId}`)?.scrollIntoView({ block: 'center' });
	});

	async function afterChange() {
		editing.value = null;
		closing.value = null;
		await load();
		emit('asset-changed');
	}
</script>

<template>
	<section class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
		<!-- Mở phiếu nằm ở menu "Tác vụ" đầu trang, không lặp lại nút ở đây. -->
		<div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
			<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">Phiếu sửa chữa, bảo dưỡng</h3>
			<p v-if="openTicket" class="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
				Tài sản đang có một phiếu chưa đóng. Mỗi tài sản chỉ có một phiếu mở tại một thời điểm, nên bạn bấm
				Đóng ở phiếu đó trước khi mở phiếu mới.
			</p>
		</div>

		<div v-if="loading" class="space-y-3 p-4">
			<div v-for="i in 3" :key="i" class="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
		</div>

		<div v-else-if="loadError" class="flex flex-col items-center gap-3 px-4 py-10 text-center">
			<p class="text-sm text-rose-700 dark:text-rose-300">{{ loadError }}</p>
			<CommonAppButton size="sm" variant="outline" @click="load">Thử lại</CommonAppButton>
		</div>

		<p v-else-if="!items.length" class="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
			Tài sản này chưa có phiếu sửa hay phiếu bảo dưỡng nào.
		</p>

		<div v-else class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead class="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
					<tr>
						<th class="px-4 py-2 text-left font-medium">Loại</th>
						<th class="px-4 py-2 text-left font-medium">Mô tả</th>
						<th class="px-4 py-2 text-left font-medium">Đơn vị thực hiện</th>
						<th class="px-4 py-2 text-left font-medium">Gửi đi / Xong</th>
						<th v-if="asset.canViewValue" class="px-4 py-2 text-right font-medium">Chi phí</th>
						<th class="px-4 py-2 text-left font-medium">Trạng thái</th>
						<th v-if="canManage" class="px-4 py-2" />
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
					<tr
						v-for="m in items"
						:id="`maintenance-${m.id}`"
						:key="m.id"
						:class="m.id === highlightId ? 'bg-amber-50 dark:bg-amber-900/20' : ''"
					>
						<td class="px-4 py-3">
							<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="MAINTENANCE_TYPE_CLASS[m.type]">
								{{ m.typeLabel }}
							</span>
							<p class="mt-1 text-xs text-gray-400">{{ maintenanceCreatorName(m.createdBy) }}</p>
						</td>
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
