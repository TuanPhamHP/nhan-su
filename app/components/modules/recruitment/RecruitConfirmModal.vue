<script setup lang="ts">
	/**
	 * Hộp xác nhận cho những thao tác mất dữ liệu như xoá dòng định biên hay rút đề xuất. Có
	 * `reasonLabel` thì kèm ô lý do bắt buộc, và `tone="danger"` cho việc có hậu quả lan ra
	 * ngoài chính dòng đang xoá.
	 *
	 * Khác `RecruitNotePromptModal` ở chỗ xử lý lỗi: hộp kia giữ nguyên hộp thoại vì người dùng
	 * sửa câu lý do rồi gửi lại là xong. Ở đây lỗi nghĩa là dữ liệu trên màn đã cũ — chẳng hạn
	 * vừa có người tạo yêu cầu tuyển mới cho vị trí đó — nên việc đúng phải làm là đóng hộp,
	 * nói cho người dùng biết và TẢI LẠI bảng. Đó là việc của trang, không phải của hộp thoại,
	 * nên hộp này chỉ phát `confirm` kèm lý do rồi để trang tự quyết.
	 */
	const props = withDefaults(
		defineProps<{
			title: string;
			description?: string;
			/** Những dòng phụ cần đọc kỹ, ví dụ số đã chốt sẽ mất theo dòng. */
			details?: string[];
			/** `danger` tô đỏ khối chi tiết, cho thao tác có hậu quả ngoài chính dòng đang xoá. */
			tone?: 'neutral' | 'danger';
			/** Có nhãn này thì hộp hiện ô lý do BẮT BUỘC; nút xác nhận khoá khi ô còn trống. */
			reasonLabel?: string;
			reasonPlaceholder?: string;
			/** Trần ký tự của backend. */
			reasonMaxLength?: number;
			confirmLabel?: string;
			variant?: 'primary' | 'danger';
			loading?: boolean;
		}>(),
		{
			tone: 'neutral',
			reasonPlaceholder: 'Vì sao cần làm việc này...',
			reasonMaxLength: 2000,
			confirmLabel: 'Xác nhận',
			variant: 'danger',
			loading: false,
		},
	);

	const emit = defineEmits<{ confirm: [reason: string]; close: [] }>();

	const reason = ref('');

	/** Chỉ khoảng trắng cũng bị backend trả 400, nên khoá nút ngay ở đây. */
	const reasonMissing = computed(() => !!props.reasonLabel && !reason.value.trim());
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-4">
			<div class="my-8 w-full max-w-md rounded-2xl bg-white shadow-xl dark:bg-gray-900">
				<div class="flex items-start justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ title }}</h2>
					<button
						type="button"
						class="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
						aria-label="Đóng"
						@click="emit('close')"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<div class="max-h-[60vh] space-y-3 overflow-y-auto p-6">
					<p
						v-if="description"
						class="text-sm"
						:class="
							tone === 'danger'
								? 'font-medium text-rose-800 dark:text-rose-200'
								: 'text-gray-600 dark:text-gray-300'
						"
					>
						{{ description }}
					</p>
					<ul
						v-if="details?.length"
						class="space-y-1.5 rounded-lg px-3 py-2"
						:class="tone === 'danger' ? 'bg-rose-50 dark:bg-rose-900/20' : 'bg-gray-50 dark:bg-gray-800/60'"
					>
						<li
							v-for="line in details"
							:key="line"
							class="text-sm"
							:class="tone === 'danger' ? 'text-rose-700 dark:text-rose-300' : 'text-gray-600 dark:text-gray-300'"
						>
							{{ line }}
						</li>
					</ul>

					<div v-if="reasonLabel" class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
							{{ reasonLabel }} <span class="text-red-500">*</span>
						</label>
						<textarea
							v-model="reason"
							rows="3"
							:maxlength="reasonMaxLength"
							:placeholder="reasonPlaceholder"
							class="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						/>
						<p class="text-xs text-gray-500 dark:text-gray-400">
							Lý do được lưu vào nhật ký hệ thống, nên hãy viết đủ để sau này đọc lại còn hiểu.
						</p>
					</div>
				</div>

				<div class="flex justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
					<CommonAppButton variant="secondary" :disabled="loading" @click="emit('close')">
						Huỷ
					</CommonAppButton>
					<CommonAppButton
						:variant="variant"
						:loading="loading"
						:disabled="reasonMissing"
						@click="emit('confirm', reason.trim())"
					>
						{{ confirmLabel }}
					</CommonAppButton>
				</div>
			</div>
		</div>
	</Teleport>
</template>
