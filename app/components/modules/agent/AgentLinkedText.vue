<script setup lang="ts">
	import AgentSourceLabel from '~/components/modules/agent/AgentSourceLabel.vue';
	import { splitAgentLinks } from '~/utils/agent-markdown';
	import { splitAgentMark } from '~/utils/agent-source';

	/**
	 * Chữ thuần do server dựng (câu báo kết quả, cảnh báo, dòng dữ liệu của thẻ xác nhận, tin hệ
	 * thống) với đường dẫn nội bộ an toàn và link markdown `[Mở việc HQ-2](/cong-viec?task=HQ-2)`
	 * thành link. Không render markdown khác, không nhận HTML.
	 *
	 * Chữ có đuôi `⟦Trợ lý AI⟧ …` (lý do, mô tả do trợ lý soạn trước đó) thì cắt đuôi, hiện nhãn
	 * "Soạn qua Trợ lý AI".
	 *
	 * Component không tự chuyển trang: AgentMessageBubble bắt cú bấm mọi `a[data-agent-link]` bên
	 * trong, kiểm lại `href` rồi đi bằng router, nên cửa sổ chat nhanh còn kịp thu nhỏ trên điện thoại.
	 */
	const props = defineProps<{ text: string }>();

	const mark = computed(() => splitAgentMark(props.text));
	const segments = computed(() => splitAgentLinks(mark.value.text));
</script>

<template>
	<template v-for="(seg, i) in segments" :key="i">
		<a
			v-if="seg.type === 'link'"
			:href="seg.value"
			data-agent-link=""
			class="font-medium underline underline-offset-2 [overflow-wrap:anywhere] hover:decoration-2"
			>{{ seg.label ?? seg.value }}</a
		>
		<template v-else>{{ seg.value }}</template>
	</template>
	<template v-if="mark.viaAgent">
		{{ ' ' }}<AgentSourceLabel :trace="mark.trace" />
	</template>
</template>
