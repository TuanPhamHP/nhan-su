<script setup lang="ts">
	/**
	 * Hộp thoại "xác nhận kèm một dòng ghi chú".
	 *
	 * Module này có gần mười thao tác cùng một hình dạng: duyệt (ghi chú tuỳ chọn), từ chối,
	 * huỷ yêu cầu, trả lại định biên, đánh dấu không tái tuyển, ẩn danh, ghi không nhận việc
	 * (đều bắt buộc lý do). Gom vào một component để chỗ nào cũng giữ đúng một hành vi quan
	 * trọng: **gặp lỗi thì GIỮ hộp thoại mở** — BE của module trả lỗi trước khi ghi, nên dữ
	 * liệu không đổi và người dùng sửa được ngay trên form đang mở.
	 *
	 * `submit` do nơi gọi truyền vào và được chờ ở đây; ném lỗi thì hộp thoại tự hiện câu lỗi
	 * và không đóng.
	 */
	const props = withDefaults(
		defineProps<{
			title: string;
			/** Câu mô tả việc sắp làm, hiện trên ô nhập. */
			description?: string;
			label?: string;
			placeholder?: string;
			/** Bắt buộc nhập thì để `true`; BE của các route "từ chối", "huỷ" đều đòi. */
			required?: boolean;
			minLength?: number;
			confirmLabel?: string;
			variant?: 'primary' | 'danger';
			submit: (note: string) => Promise<void>;
		}>(),
		{
			label: 'Lý do',
			placeholder: 'Nhập nội dung...',
			required: true,
			minLength: 3,
			confirmLabel: 'Xác nhận',
			variant: 'primary',
		},
	);

	const emit = defineEmits<{ done: []; close: [] }>();

	const note = ref('');
	const submitting = ref(false);
	const error = ref<string | null>(null);

	const tooShort = computed(
		() => props.required && note.value.trim().length < props.minLength,
	);

	async function confirm() {
		if (submitting.value) return;
		if (tooShort.value) {
			error.value = `${props.label} phải có ít nhất ${props.minLength} ký tự`;
			return;
		}
		submitting.value = true;
		error.value = null;
		try {
			await props.submit(note.value.trim());
			emit('done');
		} catch (e) {
			// Giữ hộp thoại mở: BE trả lỗi TRƯỚC khi ghi nên sửa rồi gửi lại là được.
			error.value = e instanceof Error ? e.message : 'Thao tác thất bại';
		} finally {
			submitting.value = false;
		}
	}
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

				<form class="space-y-4 p-6" @submit.prevent="confirm">
					<p v-if="description" class="text-sm text-gray-600 dark:text-gray-300">{{ description }}</p>

					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
							{{ label }}
							<span v-if="required" class="text-red-500">*</span>
						</label>
						<textarea
							v-model="note"
							rows="3"
							:placeholder="placeholder"
							class="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						/>
					</div>

					<p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
						{{ error }}
					</p>

					<div class="flex justify-end gap-3 pt-1">
						<CommonAppButton variant="secondary" type="button" @click="emit('close')">Huỷ</CommonAppButton>
						<CommonAppButton :variant="variant" type="submit" :loading="submitting">
							{{ confirmLabel }}
						</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
