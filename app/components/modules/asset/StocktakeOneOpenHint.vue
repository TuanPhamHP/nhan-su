<script setup lang="ts">
	import { STOCKTAKE_ONE_OPEN_HINT } from '~/utils/asset.utils';

	/**
	 * Tooltip L13 cạnh nút "Mở đợt kiểm kê" và ở đầu trang chi tiết đợt.
	 *
	 * Tự vẽ thay vì dùng `UiTooltip`: câu dài nên phải xuống dòng, và trên điện thoại không có rê
	 * chuột nên bấm vào biểu tượng cũng mở được. Khi đang có đợt mở thì ghi thêm tên đợt đó.
	 */
	const props = defineProps<{ openName?: string | null }>();

	const open = ref(false);
	const text = computed(() =>
		props.openName ? `${STOCKTAKE_ONE_OPEN_HINT} Đợt đang mở: "${props.openName}".` : STOCKTAKE_ONE_OPEN_HINT,
	);
</script>

<template>
	<span class="relative inline-flex" @mouseenter="open = true" @mouseleave="open = false">
		<button
			type="button"
			class="flex h-11 w-11 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 sm:h-8 sm:w-8 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
			:aria-label="text"
			:aria-expanded="open"
			:title="text"
			@click="open = !open"
			@focus="open = true"
			@blur="open = false"
		>
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
			</svg>
		</button>
		<span
			v-if="open"
			role="tooltip"
			class="absolute right-0 top-full z-30 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-lg bg-gray-800 px-3 py-2 text-xs font-normal leading-relaxed text-white shadow-lg"
		>
			{{ text }}
		</span>
	</span>
</template>
