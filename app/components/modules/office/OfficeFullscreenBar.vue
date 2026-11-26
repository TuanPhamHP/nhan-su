<script setup lang="ts">
	/**
	 * Thanh trên cùng của khung toàn màn hình: tên khung và nút đóng.
	 *
	 * Thanh chỉ gắn vào trang khi khung đang mở, nên giữ Tab trong khung và nghe Esc đúng lúc đó; nội
	 * dung khung thì sống suốt, không bị dựng lại khi mở hay đóng.
	 */
	const props = defineProps<{
		container: HTMLElement | null;
		title: string;
	}>();

	const emit = defineEmits<{
		close: [];
	}>();

	const closeRef = ref<HTMLButtonElement | null>(null);

	useFocusTrap(toRef(props, 'container'), () => closeRef.value);
	useEscapeKey(() => emit('close'));
</script>

<template>
	<div class="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-2.5 dark:border-gray-700 dark:bg-gray-900">
		<p class="truncate text-base font-semibold text-gray-900 dark:text-white">{{ title }}</p>
		<div class="flex shrink-0 items-center gap-3">
			<span class="hidden text-xs text-gray-500 sm:inline dark:text-gray-400">Nhấn Esc để đóng</span>
			<button
				ref="closeRef"
				type="button"
				aria-label="Đóng chế độ toàn màn hình"
				class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-gray-800 dark:hover:text-gray-100"
				@click="emit('close')"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	</div>
</template>
