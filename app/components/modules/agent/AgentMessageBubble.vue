<script setup lang="ts">
	import DOMPurify from 'dompurify';
	import AgentActionForm from '~/components/modules/agent/AgentActionForm.vue';
	import AgentChartBlock from '~/components/modules/agent/AgentChartBlock.vue';
	import type { AgentChatMessage as ChatMsg } from '~/types/agent.types';
	import { renderAgentMarkdown } from '~/utils/agent-markdown';

	const props = defineProps<{ message: ChatMsg }>();

	const emit = defineEmits<{
		confirm: [pendingActionId: number, payload: Record<string, unknown>];
		cancel: [pendingActionId: number];
	}>();

	const toast = useToast();

	const copied = ref(false);

	const isUser = computed(() => props.message.role === 'user');
	const isSystem = computed(() => props.message.role === 'system');

	/** Form không kèm chữ (VD dựng lại sau F5) thì không vẽ bong bóng rỗng. */
	const hasBubble = computed(() => !!props.message.text || !!props.message.status);

	/**
	 * Chỉ render markdown KHI ĐÃ STREAM XONG. Lúc đang chảy từng mảnh, một bảng mới
	 * được nửa dòng sẽ hiện ra méo mó rồi nhảy — hiện text thô mượt hơn nhiều.
	 */
	const html = computed(() => {
		if (isUser.value || props.message.streaming || props.message.error) return null;
		if (!props.message.text) return null;
		return DOMPurify.sanitize(renderAgentMarkdown(props.message.text));
	});

	/** Hiện nút copy khi câu trả lời đã xong và có nội dung. */
	const canCopy = computed(
		() => !isUser.value && !props.message.streaming && !props.message.status && !!props.message.text,
	);

	async function copy(): Promise<void> {
		try {
			await navigator.clipboard.writeText(props.message.text);
			copied.value = true;
			setTimeout(() => (copied.value = false), 1500);
		} catch {
			toast.error('Trình duyệt không cho phép sao chép');
		}
	}
</script>

<template>
	<!-- Dấu vết một thao tác đã thực thi — dải mảnh giữa khung, không phải lời thoại -->
	<div v-if="isSystem" class="flex w-full justify-center animate-fade-in">
		<p
			class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
		>
			<Icon name="heroicons:check-circle" class="h-3.5 w-3.5" />
			{{ message.text }}
		</p>
	</div>

	<div v-else :class="['group flex w-full gap-3 animate-fade-in', isUser ? 'justify-end' : 'justify-start']">
		<div
			v-if="!isUser"
			:class="[
				'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm',
				message.error
					? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300'
					: 'bg-[var(--color-accent)] text-white',
			]"
		>
			<Icon :name="message.error ? 'heroicons:exclamation-triangle' : 'heroicons:sparkles'" class="h-4 w-4" />
		</div>

		<div
			:class="[
				'flex min-w-0 flex-col gap-1.5',
				// Form cần chỗ để điền — bong bóng chữ thì hẹp cho dễ đọc
				message.pending ? 'w-full max-w-xl' : 'max-w-[85%]',
				isUser ? 'items-end' : 'items-start',
			]"
		>
			<!--
				`max-w-full min-w-0` KHÔNG thừa dù cột ngoài đã có max-w-[85%].
				Cột dùng `items-start`, nên bong bóng co giãn theo NỘI DUNG chứ không theo
				cột. Bảng markdown đặt `width: max-content` nên nó đẩy bong bóng rộng vượt
				cả cột, và lúc đó `overflow-x: auto` của .agent-table-wrap không có gì để
				cuộn — bảng tràn thẳng ra ngoài mép màn hình. Đã thấy thật trên iPhone 13.
			-->
			<div
				v-if="hasBubble"
				:class="[
					'min-w-0 max-w-full px-4 py-3 text-sm leading-relaxed break-words shadow-sm',
					isUser
						? 'rounded-2xl rounded-br-md bg-[var(--color-accent)] text-white'
						: message.error
							? 'rounded-2xl rounded-tl-md border border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
							: 'rounded-2xl rounded-tl-md border border-gray-200 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100',
				]"
			>
				<!-- Trạng thái trước khi có chữ đầu tiên -->
				<p v-if="message.status" class="flex items-center gap-2 text-gray-500 dark:text-gray-400">
					<span class="flex gap-1">
						<span
							v-for="i in 3"
							:key="i"
							class="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-accent)]"
							:style="{ animationDelay: `${(i - 1) * 0.15}s` }"
						/>
					</span>
					{{ message.status }}
				</p>

				<!-- Đã xong → markdown đã render và sanitize -->
				<div v-else-if="html" class="agent-md" v-html="html" />

				<!-- Đang stream hoặc lỗi → text thô -->
				<template v-else>
					<span class="whitespace-pre-wrap">{{ message.text }}</span
					><span
						v-if="message.streaming"
						class="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current align-middle"
					/>
				</template>
			</div>

			<!-- Biểu đồ đứng TRƯỚC form: nó là dữ liệu để đọc, form là việc phải làm. -->
			<AgentChartBlock
				v-for="(c, i) in message.charts ?? []"
				:key="`chart-${i}`"
				:chart="c"
			/>

			<AgentActionForm
				v-if="message.pending"
				:pending="message.pending"
				@confirm="emit('confirm', message.pending!.pendingActionId, $event)"
				@cancel="emit('cancel', message.pending!.pendingActionId)"
			/>

			<div v-if="canCopy || message.toolsCalled?.length" class="flex flex-wrap items-center gap-1.5 px-1">
				<span
					v-for="tool in message.toolsCalled"
					:key="tool"
					class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-700/60 dark:text-gray-300"
				>
					<Icon name="heroicons:magnifying-glass" class="h-3 w-3" />
					{{ tool }}
				</span>

				<button
					v-if="canCopy"
					type="button"
					:title="copied ? 'Đã sao chép' : 'Sao chép câu trả lời'"
					class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 md:opacity-0 md:group-hover:opacity-100 dark:hover:bg-gray-700/60 dark:hover:text-gray-200"
					@click="copy"
				>
					<Icon :name="copied ? 'heroicons:check' : 'heroicons:clipboard-document'" class="h-3 w-3" />
					{{ copied ? 'Đã chép' : 'Sao chép' }}
				</button>
			</div>
		</div>
	</div>
</template>

<style scoped>
	/* Style cho HTML do renderAgentMarkdown sinh ra. `:deep` vì nội dung vào qua v-html. */
	.agent-md :deep(p) {
		margin: 0 0 0.5rem;
	}
	.agent-md :deep(p:last-child) {
		margin-bottom: 0;
	}
	.agent-md :deep(.agent-heading) {
		font-weight: 600;
		margin-top: 0.75rem;
	}
	.agent-md :deep(.agent-list) {
		margin: 0.25rem 0 0.5rem;
		padding-left: 1.1rem;
		list-style: disc;
	}
	.agent-md :deep(ol.agent-list) {
		list-style: decimal;
	}
	.agent-md :deep(.agent-list li) {
		margin: 0.15rem 0;
	}
	.agent-md :deep(.agent-code) {
		background: rgb(0 0 0 / 0.06);
		border-radius: 0.25rem;
		padding: 0.05rem 0.3rem;
		font-size: 0.85em;
	}
	.dark .agent-md :deep(.agent-code) {
		background: rgb(255 255 255 / 0.12);
	}
	/* Bảng dài hơn khung chat thì cuộn ngang, KHÔNG đẩy giãn cả bong bóng */
	.agent-md :deep(.agent-table-wrap) {
		overflow-x: auto;
		margin: 0.5rem 0;
		border: 1px solid rgb(0 0 0 / 0.08);
		border-radius: 0.6rem;
	}
	.dark .agent-md :deep(.agent-table-wrap) {
		border-color: rgb(255 255 255 / 0.12);
	}
	.agent-md :deep(.agent-table) {
		border-collapse: collapse;
		font-size: 0.8rem;
		width: max-content;
		min-width: 100%;
	}
	.agent-md :deep(.agent-table th),
	.agent-md :deep(.agent-table td) {
		border-bottom: 1px solid rgb(0 0 0 / 0.07);
		padding: 0.45rem 0.7rem;
		text-align: left;
		white-space: nowrap;
	}
	.dark .agent-md :deep(.agent-table th),
	.dark .agent-md :deep(.agent-table td) {
		border-color: rgb(255 255 255 / 0.1);
	}
	.agent-md :deep(.agent-table tr:last-child td) {
		border-bottom: 0;
	}
	.agent-md :deep(.agent-table th) {
		background: rgb(0 0 0 / 0.035);
		font-weight: 600;
		font-size: 0.72rem;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		color: rgb(0 0 0 / 0.55);
	}
	.dark .agent-md :deep(.agent-table th) {
		background: rgb(255 255 255 / 0.06);
		color: rgb(255 255 255 / 0.65);
	}
	.agent-md :deep(.agent-table tbody tr:hover) {
		background: rgb(0 0 0 / 0.02);
	}
	.dark .agent-md :deep(.agent-table tbody tr:hover) {
		background: rgb(255 255 255 / 0.04);
	}
</style>
