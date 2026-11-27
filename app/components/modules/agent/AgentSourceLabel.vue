<script setup lang="ts">
	import { agentTraceDetail } from '~/utils/agent-source';

	/**
	 * Nhãn nhỏ "Soạn qua Trợ lý AI" thay cho đuôi `⟦Trợ lý AI⟧ …` của nội dung do trợ lý soạn (xem `splitAgentMark`).
	 * Chạm vào thì hiện ai đã xác nhận, lúc nào (dùng được trên điện thoại, không dựa vào `title`).
	 */
	const props = defineProps<{ trace?: string | null }>();

	const open = ref(false);
	const detail = computed(() => agentTraceDetail(props.trace));
</script>

<template>
	<span class="inline-flex max-w-full flex-wrap items-center gap-1 text-[11px] leading-tight" data-testid="agent-source-label">
		<button
			type="button"
			class="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-400 dark:bg-violet-900/30 dark:text-violet-300"
			:aria-expanded="detail ? open : undefined"
			:disabled="!detail"
			@click="open = !open"
		>
			<Icon name="heroicons:sparkles" class="h-3 w-3" aria-hidden="true" />
			Soạn qua Trợ lý AI
		</button>
		<span v-if="open && detail" class="text-gray-500 dark:text-gray-400">{{ detail }}</span>
	</span>
</template>
