<script setup lang="ts">
	import { useGeneralRequestService } from '~/services/general-request.service';
	import { fileSizeText } from '~/utils/general-request.utils';
	import { formatDateTime } from '~/utils/date';
	import type { RequestAttachment } from '~/types/general-request.types';

	/**
	 * File đính kèm của phiếu.
	 *
	 * Tải lên ngay lúc chọn file, không chờ bấm gửi: máy chủ nhận file theo id phiếu nên phiếu
	 * phải tồn tại trước, và người dùng thấy ngay file nào đã lên. Người gửi chỉ thêm, gỡ được
	 * khi phiếu còn là nháp hoặc đang cần bổ sung (`canAttach`); ai xem được phiếu cũng mở được
	 * file bằng link ký sống một giờ.
	 *
	 * Danh sách loại file và trần dung lượng do máy chủ quy định: PDF, ảnh JPG, PNG, Word, Excel,
	 * mỗi tệp tối đa 10 MB và một phiếu tối đa 10 tệp. `UiFileDropzone` lọc trước ở hộp chọn file,
	 * nhưng câu lỗi cuối cùng vẫn là câu của máy chủ.
	 */
	const props = defineProps<{
		requestId: number;
		attachments: RequestAttachment[];
		canAttach: boolean;
	}>();

	const emit = defineEmits<{
		/** Danh sách file đổi: trang cha tải lại phiếu để `attachments` khớp máy chủ. */
		changed: [];
	}>();

	const toast = useToast();
	const service = useGeneralRequestService();

	const picked = ref<File | File[] | null>(null);
	const uploading = ref(false);
	const removingId = ref<number | null>(null);
	const openingId = ref<number | null>(null);

	const ACCEPT = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx';
	const MAX_FILES = 10;

	const full = computed(() => props.attachments.length >= MAX_FILES);

	async function onPicked(value: File | File[] | null) {
		const files = value ? (Array.isArray(value) ? value : [value]) : [];
		if (!files.length) return;
		uploading.value = true;
		try {
			for (const file of files) {
				await service.uploadAttachment(props.requestId, file);
			}
			toast.success(files.length > 1 ? `Đã tải lên ${files.length} tệp.` : 'Đã tải lên một tệp.');
			emit('changed');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa tải được tệp lên.');
			// Tải một nửa rồi lỗi thì danh sách trên màn vẫn phải khớp máy chủ.
			emit('changed');
		} finally {
			uploading.value = false;
			picked.value = null;
		}
	}

	async function remove(attachment: RequestAttachment) {
		removingId.value = attachment.id;
		try {
			await service.removeAttachment(props.requestId, attachment.id);
			toast.success('Đã gỡ tệp.');
			emit('changed');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa gỡ được tệp.');
		} finally {
			removingId.value = null;
		}
	}

	async function open(attachment: RequestAttachment) {
		openingId.value = attachment.id;
		try {
			const { url } = await service.attachmentUrl(props.requestId, attachment.id);
			window.open(url, '_blank', 'noopener');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa mở được tệp.');
		} finally {
			openingId.value = null;
		}
	}
</script>

<template>
	<section class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<h2 class="text-sm font-semibold text-gray-900 dark:text-white">Tệp đính kèm</h2>
			<span class="text-xs text-gray-500 dark:text-gray-400">{{ attachments.length }} / {{ MAX_FILES }} tệp</span>
		</div>

		<ul v-if="attachments.length" class="mt-3 space-y-2">
			<li
				v-for="attachment in attachments"
				:key="attachment.id"
				class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
			>
				<div class="min-w-0">
					<p class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ attachment.fileName }}</p>
					<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
						{{ fileSizeText(attachment.size) }} · {{ attachment.uploadedBy.fullName }} ·
						{{ formatDateTime(attachment.createdAt) }}
					</p>
				</div>
				<div class="flex flex-shrink-0 items-center gap-1.5">
					<button
						type="button"
						class="rounded-md px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
						:disabled="openingId === attachment.id"
						@click="open(attachment)"
					>
						{{ openingId === attachment.id ? 'Đang mở…' : 'Mở tệp' }}
					</button>
					<button
						v-if="canAttach"
						type="button"
						class="rounded-md px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
						:disabled="removingId === attachment.id"
						@click="remove(attachment)"
					>
						{{ removingId === attachment.id ? 'Đang gỡ…' : 'Gỡ tệp' }}
					</button>
				</div>
			</li>
		</ul>

		<p v-else class="mt-3 text-sm text-gray-500 dark:text-gray-400">Phiếu này chưa có tệp nào đính kèm.</p>

		<div v-if="canAttach" class="mt-3">
			<UiFileDropzone
				v-model="picked"
				:accept="ACCEPT"
				:max-size-mb="10"
				multiple
				:disabled="uploading || full"
				:hint="
					full
						? 'Phiếu đã có đủ mười tệp. Bạn gỡ một tệp rồi tải tệp khác lên.'
						: 'Hệ thống nhận tệp PDF, ảnh JPG hoặc PNG, Word và Excel, mỗi tệp không quá 10 MB.'
				"
				@update:model-value="onPicked"
			/>
			<p v-if="uploading" class="mt-2 text-xs text-gray-500 dark:text-gray-400">Đang tải tệp lên…</p>
		</div>
	</section>
</template>
