<script setup lang="ts">
	import { formatDateTime } from '~/utils/date';
	import { useMeProfileService } from '~/services/me-profile.service';
	import type { PendingDocument } from '~/types/hr-profile.types';

	/**
	 * Giấy tờ đã tải lên nhưng chưa gửi kèm yêu cầu nào.
	 *
	 * Mỗi người chỉ giữ được 10 giấy tờ dạng này, và máy chủ tự dọn sau 24 giờ. Khối này để
	 * người dùng tự thấy mình đang giữ những gì và xoá bớt, thay vì chạm trần rồi phải chờ.
	 * Giấy tờ đã đi kèm một yêu cầu chờ duyệt thì không hiện ở đây: muốn bỏ thì huỷ yêu cầu.
	 */
	const toast = useToast();
	const service = useMeProfileService();

	const documents = ref<PendingDocument[]>([]);
	const loading = ref(true);
	const removingId = ref<number | null>(null);

	async function load() {
		loading.value = true;
		try {
			const all = await service.findChangeRequestDocuments();
			documents.value = all.filter(d => d.requestId === null);
		} catch {
			// Khối này chỉ là tiện ích dọn dẹp: tải hỏng thì ẩn đi, đừng chen một toast đỏ vào
			// giữa trang hồ sơ. Việc người dùng đang làm vẫn chạy bình thường.
			documents.value = [];
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);
	defineExpose({ reload: load });

	async function remove(doc: PendingDocument) {
		removingId.value = doc.id;
		try {
			await service.removeChangeRequestDocument(doc.id);
			documents.value = documents.value.filter(d => d.id !== doc.id);
			toast.success('Đã xoá giấy tờ.');
		} catch (e) {
			// 409 nghĩa là giấy tờ vừa được gửi kèm một yêu cầu; câu của máy chủ đã nói rõ phải
			// huỷ yêu cầu nào, nên hiện nguyên văn rồi đọc lại danh sách cho khớp.
			toast.error(e instanceof Error ? e.message : 'Chưa xoá được giấy tờ này.');
			load();
		} finally {
			removingId.value = null;
		}
	}

	function open(doc: PendingDocument) {
		if (!doc.fileUrl) {
			toast.error('Giấy tờ này chưa có link xem. Bạn tải lại trang rồi thử lại.');
			return;
		}
		window.open(doc.fileUrl, '_blank');
	}
</script>

<template>
	<div
		v-if="loading || documents.length"
		class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900"
	>
		<h3 class="text-sm font-semibold text-gray-900 dark:text-white">Giấy tờ đã tải chưa gửi</h3>
		<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
			Đây là giấy tờ bạn đã tải lên nhưng chưa gửi kèm yêu cầu nào. Bạn giữ tối đa 10 giấy tờ như vậy, và hệ thống tự
			dọn sau 24 giờ.
		</p>

		<div v-if="loading" class="mt-5 space-y-2">
			<div v-for="i in 2" :key="i" class="h-12 w-full animate-pulse rounded-lg bg-gray-50 dark:bg-gray-800" />
		</div>

		<ul v-else class="mt-5 space-y-2">
			<li
				v-for="doc in documents"
				:key="doc.id"
				class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800"
			>
				<div class="min-w-0">
					<p class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ doc.fileName }}</p>
					<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
						{{ doc.typeLabel }} · tải lên {{ formatDateTime(doc.uploadedAt) }}
					</p>
				</div>
				<div class="flex flex-shrink-0 items-center gap-1.5">
					<button
						type="button"
						class="rounded-md px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
						@click="open(doc)"
					>
						Xem
					</button>
					<button
						type="button"
						class="rounded-md px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
						:disabled="removingId === doc.id"
						@click="remove(doc)"
					>
						{{ removingId === doc.id ? 'Đang xoá…' : 'Xoá' }}
					</button>
				</div>
			</li>
		</ul>
	</div>
</template>
