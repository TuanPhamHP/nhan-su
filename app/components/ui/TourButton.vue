<script setup lang="ts">
	/**
	 * Nút "Hướng dẫn" cạnh tiêu đề trang: bấm là chạy lại tour của trang từ đầu.
	 *
	 * `UiPageHeader` tự gắn nút này khi có prop `tour`; trang có đầu trang riêng (chi tiết tài sản)
	 * đặt thẳng nút này cạnh tiêu đề.
	 */
	const props = defineProps<{ tour: string }>();

	const { start } = useTour();
</script>

<template>
	<button
		type="button"
		data-tour-button
		class="inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-lg px-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 sm:px-2 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-brand-400"
		aria-label="Xem hướng dẫn trang này"
		title="Xem hướng dẫn trang này"
		@click="start(props.tour)"
	>
		<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"
			/>
		</svg>
		<span class="hidden sm:inline">Hướng dẫn</span>
	</button>
</template>
