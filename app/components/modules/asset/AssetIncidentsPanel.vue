<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import AssetIncidentDetailModal from '~/components/modules/asset/AssetIncidentDetailModal.vue';
	import { INCIDENT_STATUS_CLASS, INCIDENT_TYPE_CLASS } from '~/utils/asset.utils';
	import { formatDate, formatDateTime } from '~/utils/date';
	import type { Asset, AssetIncident } from '~/types/asset.types';

	/**
	 * Tab "Báo hỏng" của một tài sản: mọi báo cáo nhân viên từng gửi cho nó.
	 *
	 * Lấy hết trong một lần (`limit: 100`) vì một thiết bị hiếm khi có nhiều hơn chừng đó
	 * báo cáo; danh sách toàn công ty mới cần phân trang, ở trang Báo hỏng, báo mất.
	 */
	const props = defineProps<{
		asset: Asset;
		canManage: boolean;
	}>();

	const emit = defineEmits<{ 'asset-changed': [] }>();

	const service = useAssetService();

	const items = ref<AssetIncident[]>([]);
	const loading = ref(true);
	const loadError = ref<string | null>(null);
	const selected = ref<AssetIncident | null>(null);

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			const res = await service.findIncidents({ assetId: props.asset.id, limit: 100 });
			items.value = res.data;
		} catch (e) {
			items.value = [];
			loadError.value =
				e instanceof Error ? e.message : 'Chưa tải được báo hỏng, báo mất của tài sản này. Bạn bấm Thử lại.';
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);

	async function onHandled() {
		selected.value = null;
		await load();
		// Xử lý báo cáo đổi trạng thái tài sản (Đang sửa, Mất...) nên trang chính phải tải lại.
		emit('asset-changed');
	}
</script>

<template>
	<section class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
		<div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
			<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">Báo hỏng, báo mất</h3>
			<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
				Do người đang giữ tài sản gửi lên từ trang "Tài sản của tôi".
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
			Tài sản này chưa có báo hỏng hay báo mất nào.
		</p>

		<div v-else class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead class="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
					<tr>
						<th class="px-4 py-2 text-left font-medium">Loại</th>
						<th class="px-4 py-2 text-left font-medium">Nội dung</th>
						<th class="px-4 py-2 text-left font-medium">Người báo</th>
						<th class="px-4 py-2 text-left font-medium">Phát hiện / Gửi</th>
						<th class="px-4 py-2 text-left font-medium">Trạng thái</th>
						<th class="px-4 py-2" />
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
					<tr v-for="item in items" :key="item.id">
						<td class="px-4 py-3">
							<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="INCIDENT_TYPE_CLASS[item.type]">
								{{ item.typeLabel }}
							</span>
							<p v-if="item.photoDocumentIds.length" class="mt-1 text-xs text-gray-400">
								{{ item.photoDocumentIds.length }} ảnh
							</p>
						</td>
						<td class="max-w-xs px-4 py-3">
							<p class="break-words text-gray-800 dark:text-gray-200">{{ item.description }}</p>
						</td>
						<td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ item.reportedBy.name }}</td>
						<td class="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
							<p>{{ item.occurredOn ? formatDate(item.occurredOn) : '—' }}</p>
							<p class="text-gray-400">{{ formatDateTime(item.createdAt) }}</p>
						</td>
						<td class="px-4 py-3">
							<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="INCIDENT_STATUS_CLASS[item.status]">
								{{ item.statusLabel }}
							</span>
							<p v-if="item.status === 'RESOLVED' && item.maintenance" class="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
								Phiếu sửa: {{ item.maintenance.statusLabel }}
							</p>
						</td>
						<td class="px-4 py-3 text-right">
							<CommonAppButton size="sm" variant="outline" @click="selected = item">
								{{ canManage && item.status === 'OPEN' ? 'Xử lý' : 'Xem' }}
							</CommonAppButton>
						</td>
					</tr>
				</tbody>
			</table>
		</div>

		<AssetIncidentDetailModal
			v-if="selected"
			:incident="selected"
			:can-manage="canManage"
			@handled="onHandled"
			@stale="onHandled"
			@close="selected = null"
		/>
	</section>
</template>
