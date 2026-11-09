<script setup lang="ts">
	import DOMPurify from 'dompurify';
	import agentAvatar from '~/assets/icons/ONGO_AI_BOT.png';
	import AgentChartBlock from '~/components/modules/agent/AgentChartBlock.vue';
	import AgentTableBlock from '~/components/modules/agent/AgentTableBlock.vue';
	import {
		PLAYBOOK_LABELS,
		RATING_COLORS,
		type AgentConversationTranscript,
	} from '~/types/agent-analytics.types';
	import { renderAgentMarkdown } from '~/utils/agent-markdown';
	import { formatDateTime } from '~/utils/date';

	/**
	 * Khung đọc một hội thoại của nhân viên, CHỈ ĐỌC.
	 *
	 * Không dùng lại AgentMessageBubble vì nó mang nút chấm điểm và form xác nhận. Đây là
	 * nơi ADMIN đọc hội thoại của người khác, nên không được có gì bấm vào mà ghi dữ liệu.
	 */
	const props = defineProps<{
		conversationId: number;
		/** Mở từ một góp ý thì cuộn tới câu trả lời đó và làm nổi nó. */
		focusMessageId?: number | null;
		/** Hàm tải do page truyền xuống — component không tự gọi service. */
		fetch: (conversationId: number) => Promise<AgentConversationTranscript>;
	}>();

	const emit = defineEmits<{ close: [] }>();

	const data = ref<AgentConversationTranscript | null>(null);
	const loading = ref(true);
	const error = ref<string | null>(null);
	const scroller = ref<HTMLElement | null>(null);

	/** Sanitize ở đây vì đây là nội dung do model sinh ra, rồi mới vào `v-html`. */
	function renderHtml(text: string): string {
		return DOMPurify.sanitize(renderAgentMarkdown(text));
	}

	// `KHÔNG_RÕ` là rổ gom của backend, không phải chữ để đọc.
	const playbookLabel = (id: string | null) =>
		!id || id === 'KHÔNG_RÕ' ? 'Không rõ' : (PLAYBOOK_LABELS[id] ?? id);

	async function scrollToFocus(): Promise<void> {
		if (props.focusMessageId == null) return;
		await nextTick();
		scroller.value
			?.querySelector(`[data-message-id="${props.focusMessageId}"]`)
			?.scrollIntoView({ block: 'center' });
	}

	/**
	 * Chỉ tải đúng một lần lúc khung được mở. Mỗi lần gọi BE ghi một dòng nhật ký mang tên
	 * người xem, nên ở đây cố ý không có watch hay nút tải lại: đóng rồi mở lại mới là một
	 * lần xem mới.
	 */
	onMounted(async () => {
		try {
			data.value = await props.fetch(props.conversationId);
		} catch (err) {
			const apiMessage = (err as { data?: { error?: { message?: string } } })?.data?.error?.message;
			error.value = apiMessage ?? 'Không mở được hội thoại này';
		} finally {
			loading.value = false;
		}
		if (data.value) void scrollToFocus();
	});
</script>

<template>
	<Teleport to="body">
		<!-- z cao hơn AgentUserDetailModal (z-[60]) vì khung này mở chồng lên modal đó -->
		<div
			class="fixed inset-0 z-[70] flex items-start justify-center bg-black/60 p-2 backdrop-blur-sm sm:p-4"
			@click.self="emit('close')"
		>
			<div
				data-testid="agent-conversation-transcript"
				class="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900"
			>
				<header class="flex shrink-0 items-start justify-between gap-4 border-b border-gray-200 px-4 py-3 sm:px-6 sm:py-4 dark:border-gray-700">
					<div class="min-w-0">
						<h2 class="break-words text-base font-bold text-gray-900 dark:text-white">
							<template v-if="data">{{ data.conversation.fullName }}</template>
							<template v-else>Xem lại hội thoại</template>
						</h2>
						<p v-if="data" class="mt-0.5 break-words text-sm text-gray-700 dark:text-gray-200">
							{{ data.conversation.title || 'Hội thoại chưa có tiêu đề' }}
						</p>
						<p v-if="data && (data.conversation.employeeCode || data.conversation.department)" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
							{{ [data.conversation.employeeCode, data.conversation.department].filter(Boolean).join(' · ') }}
						</p>
						<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
							Mỗi lần mở hội thoại đều được ghi vào nhật ký hệ thống.
						</p>
					</div>
					<button
						type="button"
						class="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
						aria-label="Đóng"
						@click="emit('close')"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</header>

				<div ref="scroller" class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-6">
					<p v-if="loading" class="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
						Đang tải…
					</p>

					<div
						v-else-if="error"
						class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
					>
						{{ error }}
					</div>

					<p
						v-else-if="data && !data.messages.length"
						class="py-16 text-center text-sm text-gray-500 dark:text-gray-400"
					>
						Hội thoại này chưa có tin nhắn nào.
					</p>

					<ul v-else-if="data" class="space-y-4">
						<li
							v-for="m in data.messages"
							:key="m.id"
							:data-message-id="m.id"
							:class="[
								'rounded-xl',
								m.id === focusMessageId
									? 'bg-amber-50 p-2 ring-2 ring-amber-400 dark:bg-amber-500/10 dark:ring-amber-500/70'
									: '',
							]"
						>
							<!-- Dòng hệ thống: dấu vết một thao tác đã thực thi, không phải lời thoại -->
							<div v-if="m.role === 'system'" class="flex w-full justify-center">
								<p class="inline-flex max-w-full items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
									<Icon name="heroicons:check-circle" class="h-3.5 w-3.5 shrink-0" />
									<span class="min-w-0 break-words">{{ m.text }}</span>
								</p>
							</div>

							<div v-else-if="m.role === 'user'" class="flex w-full justify-end">
								<div class="flex min-w-0 max-w-[85%] flex-col items-end gap-1">
									<div class="min-w-0 max-w-full whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-[var(--color-accent)] px-4 py-3 text-sm leading-relaxed text-white shadow-sm">{{ m.text }}</div>
									<span class="px-1 text-[11px] text-gray-400 dark:text-gray-500">{{ formatDateTime(m.createdAt) }}</span>
								</div>
							</div>

							<div v-else class="flex w-full justify-start gap-3">
								<img
									:src="agentAvatar"
									alt=""
									draggable="false"
									class="hidden h-8 w-8 shrink-0 select-none object-contain sm:block"
								/>
								<!--
									`w-full` thay vì để cột co theo nội dung: biểu đồ và bảng cần có mốc
									bề rộng, không thì chúng đẩy cột tràn ra ngoài mép màn hình điện thoại.
								-->
								<div class="flex w-full min-w-0 max-w-full flex-col items-start gap-1.5 sm:max-w-[85%]">
									<div
										v-if="m.text"
										class="min-w-0 max-w-full break-words rounded-2xl rounded-tl-md border border-gray-200 bg-white px-4 py-3 text-sm leading-relaxed text-gray-800 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
									>
										<div class="agent-md" v-html="renderHtml(m.text)" />
									</div>

									<AgentChartBlock v-for="(c, i) in m.charts ?? []" :key="`chart-${i}`" :chart="c" />
									<AgentTableBlock v-for="(t, i) in m.tables ?? []" :key="`table-${i}`" :table="t" />

									<span class="px-1 text-[11px] text-gray-400 dark:text-gray-500">{{ formatDateTime(m.createdAt) }}</span>

									<div
										v-if="m.feedback"
										data-testid="agent-transcript-feedback"
										class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800/60"
									>
										<div class="flex flex-wrap items-center gap-2">
											<span class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
												<span :class="['h-1.5 w-1.5 rounded-full', RATING_COLORS[m.feedback.rating] ?? 'bg-gray-400']" />
												{{ m.feedback.ratingLabel }}
											</span>
											<span class="text-gray-400 dark:text-gray-500">{{ playbookLabel(m.feedback.playbookId) }}</span>
										</div>
										<p v-if="m.feedback.comment" class="mt-1.5 break-words text-sm text-gray-700 dark:text-gray-200">
											{{ m.feedback.comment }}
										</p>
									</div>
								</div>
							</div>
						</li>
					</ul>
				</div>
			</div>
		</div>
	</Teleport>
</template>

<style scoped>
	/*
		Style cho HTML do renderAgentMarkdown sinh ra, cùng bộ với AgentMessageBubble.
		`:deep` vì nội dung vào qua v-html.
	*/
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
