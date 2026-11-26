<script setup lang="ts">
	/**
	 * Hộp thoại nhỏ của module Hành chính văn phòng: tiêu đề, nội dung và hàng nút do nơi dùng truyền.
	 *
	 * Giữ Tab trong hộp, Esc hay bấm nền là đóng (trừ lúc đang chạy), con trỏ trở về nút đã mở hộp khi
	 * đóng. Dùng cho các hộp hỏi lại (khoá sớm, đóng kỳ, huỷ kỳ) và các hộp nhập nhỏ (đổi hạn chót).
	 */
	const props = defineProps<{
		title: string;
		/** Đang chạy việc: không đóng bằng Esc hay bấm nền. */
		busy?: boolean;
		/** Bề rộng tối đa, mặc định `max-w-md`. */
		width?: 'md' | 'lg';
	}>();

	const emit = defineEmits<{ close: [] }>();

	const panelRef = ref<HTMLElement | null>(null);
	const titleId = `office-dialog-${Math.random().toString(36).slice(2)}`;

	useFocusTrap(panelRef);
	useEscapeKey(
		() => emit('close'),
		() => !props.busy,
	);
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" @click.self="!busy && emit('close')">
			<div
				ref="panelRef"
				role="dialog"
				aria-modal="true"
				:aria-labelledby="titleId"
				:class="[
					'flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-2xl bg-white shadow-xl dark:bg-gray-900',
					width === 'lg' ? 'max-w-lg' : 'max-w-md',
				]"
			>
				<h2 :id="titleId" class="px-5 pt-5 text-base font-semibold text-gray-900 dark:text-white">{{ title }}</h2>
				<div class="flex-1 overflow-y-auto px-5 py-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
					<slot />
				</div>
				<div class="flex flex-col-reverse gap-2 border-t border-gray-100 px-5 py-3 sm:flex-row sm:justify-end dark:border-gray-800">
					<slot name="actions" />
				</div>
			</div>
		</div>
	</Teleport>
</template>
