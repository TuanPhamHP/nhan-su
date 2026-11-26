<script setup lang="ts">
	import { splitInternalPaths } from '~/utils/agent-markdown';

	/**
	 * Chữ thuần do server dựng (câu báo kết quả, cảnh báo, dòng dữ liệu của thẻ xác nhận, tin hệ
	 * thống) với đường dẫn nội bộ an toàn thành link. Không render markdown, không nhận HTML.
	 *
	 * Component không tự chuyển trang: AgentMessageBubble bắt cú bấm mọi `a[data-agent-link]` bên
	 * trong, kiểm lại `href` rồi đi bằng router, nên cửa sổ chat nhanh còn kịp thu nhỏ trên điện thoại.
	 */
	const props = defineProps<{ text: string }>();

	const segments = computed(() => splitInternalPaths(props.text));
</script>

<template>
	<template v-for="(seg, i) in segments" :key="i">
		<a
			v-if="seg.type === 'link'"
			:href="seg.value"
			data-agent-link=""
			class="font-medium underline underline-offset-2 [overflow-wrap:anywhere] hover:decoration-2"
			>{{ seg.value }}</a
		>
		<template v-else>{{ seg.value }}</template>
	</template>
</template>
