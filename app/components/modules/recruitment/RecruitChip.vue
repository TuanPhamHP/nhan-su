<script setup lang="ts">
	/**
	 * Chip trạng thái dùng chung cho cả module.
	 *
	 * Nhãn luôn lấy từ `*Label` của response, chỉ màu là do FE quyết — nên component nhận
	 * sẵn cả chữ lẫn lớp màu, không tự tra bảng.
	 */
	withDefaults(
		defineProps<{
			label: string;
			tone?: string;
		}>(),
		{ tone: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
	);
</script>

<template>
	<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" :class="tone">
		{{ label }}
	</span>
</template>
