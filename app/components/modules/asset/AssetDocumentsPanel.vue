<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import DocumentUploadModal from '~/components/modules/asset/DocumentUploadModal.vue';
	import { formatAssetMoney, formatFileSize } from '~/utils/asset.utils';
	import { formatDate, formatDateTime } from '~/utils/date';
	import type { Asset, AssetDocument } from '~/types/asset.types';

	const props = defineProps<{
		asset: Asset;
		canManage: boolean;
	}>();

	const toast = useToast();
	const service = useAssetService();

	const docs = ref<AssetDocument[]>([]);
	const loading = ref(true);
	const loadError = ref<string | null>(null);
	const showUpload = ref(false);
	const opening = ref<number | null>(null);
	const removing = ref<number | null>(null);
	/** Giấy tờ đang chờ người dùng xác nhận xoá. */
	const confirmingRemove = ref<AssetDocument | null>(null);

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			docs.value = await service.findDocuments(props.asset.id);
		} catch (e) {
			docs.value = [];
			loadError.value = e instanceof Error ? e.message : 'Chưa tải được giấy tờ của tài sản này. Bạn bấm Thử lại.';
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);

	/**
	 * Lấy presigned URL ngay lúc bấm rồi mở tab mới.
	 *
	 * URL sống ngắn nên không lưu lại: lần sau bấm thì xin URL mới. Mở tab trước khi
	 * `await` sẽ bị trình duyệt chặn popup, nên chấp nhận mở sau — người dùng vừa bấm
	 * nên phần lớn trình duyệt vẫn coi là có tương tác.
	 */
	async function openDoc(doc: AssetDocument) {
		if (opening.value) return;
		opening.value = doc.id;
		try {
			const url = await service.documentUrl(doc.id);
			window.open(url, '_blank', 'noopener');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa mở được file. Bạn thử lại sau ít phút.');
		} finally {
			opening.value = null;
		}
	}

	/**
	 * Xoá giấy tờ, sau khi người dùng đã xác nhận.
	 *
	 * BE xoá cả giấy tờ chứ không chỉ gỡ khỏi tài sản đang xem, nên hoá đơn dùng chung cho cả lô
	 * cũng mất ở các tài sản khác. Hộp xác nhận nói rõ điều này trước khi xoá.
	 */
	async function removeDoc(doc: AssetDocument) {
		if (removing.value) return;
		removing.value = doc.id;
		try {
			await service.removeDocument(doc.id);
			toast.success(`Đã xoá ${doc.fileName}.`);
			confirmingRemove.value = null;
			await load();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa xoá được giấy tờ. Bạn thử lại sau ít phút.');
		} finally {
			removing.value = null;
		}
	}

	useEscapeKey(
		() => (confirmingRemove.value = null),
		() => !!confirmingRemove.value && !removing.value,
	);

	async function onUploaded() {
		showUpload.value = false;
		await load();
	}

	/** Giấy tờ dùng chung nhiều tài sản (hoá đơn mua cả lô) thì nói rõ cho người xem. */
	function sharedWith(doc: AssetDocument): number {
		return doc.links.filter(l => l.assetId != null && l.assetId !== props.asset.id).length;
	}
</script>

<template>
	<section class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
		<div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
			<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">Giấy tờ</h3>
			<CommonAppButton v-if="canManage" size="sm" variant="primary" @click="showUpload = true">
				Tải lên
			</CommonAppButton>
		</div>

		<div v-if="loading" class="space-y-3 p-4">
			<div v-for="i in 3" :key="i" class="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
		</div>

		<div v-else-if="loadError" class="flex flex-col items-center gap-3 px-4 py-10 text-center">
			<p class="text-sm text-rose-700 dark:text-rose-300">{{ loadError }}</p>
			<CommonAppButton size="sm" variant="outline" @click="load">Thử lại</CommonAppButton>
		</div>

		<p v-else-if="!docs.length" class="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
			Chưa có giấy tờ nào.<template v-if="canManage"> Bạn bấm Tải lên để thêm hoá đơn, hợp đồng hay phiếu bảo hành.</template>
		</p>

		<div v-else class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead class="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
					<tr>
						<th class="px-4 py-2 text-left font-medium">Tên file</th>
						<th class="px-4 py-2 text-left font-medium">Loại</th>
						<th class="px-4 py-2 text-left font-medium">Số hiệu / Ngày</th>
						<th v-if="asset.canViewValue" class="px-4 py-2 text-right font-medium">Số tiền</th>
						<th class="px-4 py-2 text-left font-medium">Tải lên</th>
						<th class="px-4 py-2" />
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
					<tr v-for="doc in docs" :key="doc.id">
						<td class="px-4 py-3">
							<p class="break-all font-medium text-gray-900 dark:text-white">{{ doc.fileName }}</p>
							<p class="text-xs text-gray-400">
								{{ formatFileSize(doc.sizeBytes) }}
								<span v-if="sharedWith(doc) > 0"> · dùng chung với {{ sharedWith(doc) }} tài sản khác</span>
							</p>
						</td>
						<td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ doc.typeLabel }}</td>
						<td class="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
							<p>{{ doc.number ?? '—' }}</p>
							<p class="text-gray-400">{{ doc.issuedDate ? formatDate(doc.issuedDate) : '—' }}</p>
						</td>
						<td v-if="asset.canViewValue" class="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
							{{ formatAssetMoney(doc.amount) }}
						</td>
						<td class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
							<p>{{ doc.uploadedBy.name }}</p>
							<p class="text-gray-400">{{ formatDateTime(doc.uploadedAt) }}</p>
						</td>
						<td class="px-4 py-3 text-right">
							<div class="flex justify-end gap-2">
								<CommonAppButton size="sm" variant="outline" :loading="opening === doc.id" @click="openDoc(doc)">
									Mở
								</CommonAppButton>
								<CommonAppButton
									v-if="canManage"
									size="sm"
									variant="danger"
									:aria-label="`Xoá ${doc.fileName}`"
									@click="confirmingRemove = doc"
								>
									Xoá
								</CommonAppButton>
							</div>
						</td>
					</tr>
				</tbody>
			</table>
		</div>

		<DocumentUploadModal
			v-if="showUpload"
			:asset-ids="[asset.id]"
			@uploaded="onUploaded"
			@close="showUpload = false"
		/>

		<Teleport to="body">
			<div
				v-if="confirmingRemove"
				class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
				role="alertdialog"
				aria-modal="true"
				aria-label="Xoá giấy tờ"
			>
				<div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Xoá giấy tờ</h2>
					<p class="mt-2 break-words text-sm text-gray-600 dark:text-gray-300">
						Xoá <strong>{{ confirmingRemove.fileName }}</strong>?
						<template v-if="sharedWith(confirmingRemove) > 0">
							Giấy tờ này đang gắn với {{ sharedWith(confirmingRemove) + 1 }} tài sản và sẽ bị gỡ khỏi tất cả.
						</template>
						<template v-else>Giấy tờ sẽ bị xoá hẳn và không khôi phục được.</template>
					</p>
					<div class="mt-5 flex justify-end gap-3">
						<CommonAppButton variant="secondary" :disabled="!!removing" @click="confirmingRemove = null">
							Giữ lại
						</CommonAppButton>
						<CommonAppButton
							variant="danger"
							:loading="removing === confirmingRemove.id"
							@click="removeDoc(confirmingRemove)"
						>
							Xoá giấy tờ
						</CommonAppButton>
					</div>
				</div>
			</div>
		</Teleport>
	</section>
</template>
