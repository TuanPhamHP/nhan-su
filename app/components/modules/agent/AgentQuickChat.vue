<script setup lang="ts">
	import agentAvatar from '~/assets/icons/ONGO_AI_BOT.png';
	import AgentMessageBubble from '~/components/modules/agent/AgentMessageBubble.vue';
	import AgentComposer from '~/components/modules/agent/AgentComposer.vue';
	import AgentEmptyState from '~/components/modules/agent/AgentEmptyState.vue';
	import { AGENT_SUGGESTIONS, type AgentFeedbackRating } from '~/types/agent.types';

	/**
	 * Cửa sổ chat nhanh với trợ lý, nổi ở góc phải như bong bóng chat của Messenger.
	 *
	 * Luôn là một hội thoại MỚI và không có danh sách hội thoại cũ: việc của cửa sổ này là hỏi
	 * nhanh một câu mà không rời trang đang làm. Muốn xem lại hay chọn cuộc cũ thì sang trang Trợ
	 * lý, và nút "Mở ở trang Trợ lý" mang theo đúng hội thoại đang gõ để không mất mạch.
	 *
	 * Thu nhỏ thì cha giữ component sống bằng `v-show`, nên câu trả lời đang chảy về vẫn tiếp tục;
	 * đóng hẳn thì cha gỡ component và phiên chat bị huỷ, còn hội thoại đã lưu ở máy chủ.
	 */
	const emit = defineEmits<{
		minimize: [];
		close: [];
		expand: [conversationId: number | undefined];
		/** Cho nút nổi biết có hội thoại dở và trợ lý có đang trả lời không, để hiện chấm báo. */
		status: [status: { sending: boolean; hasMessages: boolean }];
	}>();

	const { messages, input, sending, canSend, conversationId, send, stop, reset, confirmPending, cancelPending, rateMessage } =
		useAgentChat();

	const toast = useToast();
	const { scroller, forceScroll, onScroll, showScrollDown, scrollToBottom, onComposerFocus } =
		useAgentAutoScroll(messages);

	function ask(text?: string): void {
		forceScroll.value = true;
		void send(text);
	}

	/** Bắt đầu lại từ đầu trong cùng cửa sổ; hội thoại vừa rồi vẫn còn ở trang Trợ lý. */
	function newConversation(): void {
		reset();
	}

	/**
	 * Người dùng bấm nút trong form. Đây là đường DUY NHẤT trợ lý ghi được dữ liệu —
	 * model không tự gọi được, nó chỉ dựng sẵn form.
	 */
	async function onConfirm(id: number, payload: Record<string, unknown>): Promise<void> {
		forceScroll.value = true;
		const ok = await confirmPending(id, payload);
		if (ok) toast.success('Đã thực hiện thao tác');
	}

	async function onRate(messageId: number, rating: AgentFeedbackRating, comment?: string): Promise<void> {
		await rateMessage(messageId, rating, comment);
	}

	watch(
		[sending, () => messages.value.length],
		([isSending, count]) => emit('status', { sending: isSending, hasMessages: count > 0 }),
		{ immediate: true },
	);
</script>

<template>
	<!--
		Máy tính: khung 400px neo trên nút nổi, chừa đúng chỗ cho nút ở `bottom-6`. Điện thoại:
		phủ kín màn hình như một trang, vì khung nổi rộng 400px trên màn 390px chỉ còn là một dải
		hẹp không đọc nổi bảng, và bàn phím bật lên sẽ che hết phần còn lại.
	-->
	<section
		role="dialog"
		aria-label="Chat nhanh với trợ lý"
		class="fixed inset-0 z-40 flex flex-col overflow-hidden bg-white sm:inset-auto sm:right-6 sm:bottom-24 sm:h-[min(620px,calc(100dvh-8rem))] sm:w-[400px] sm:rounded-2xl sm:border sm:border-gray-200 sm:shadow-2xl dark:bg-gray-800 dark:sm:border-gray-700"
		:style="{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }"
	>
		<header
			class="flex items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800"
		>
			<div class="flex min-w-0 items-center gap-2.5">
				<img :src="agentAvatar" alt="" draggable="false" class="h-8 w-8 shrink-0 object-contain select-none" />
				<div class="min-w-0">
					<h2 class="truncate text-sm font-semibold text-gray-900 dark:text-gray-50">Chat nhanh</h2>
					<p class="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
						<span :class="['h-1.5 w-1.5 rounded-full', sending ? 'animate-pulse bg-amber-500' : 'bg-emerald-500']" />
						{{ sending ? 'Đang trả lời…' : 'Sẵn sàng' }}
					</p>
				</div>
			</div>

			<div class="flex shrink-0 items-center gap-0.5">
				<button
					v-if="messages.length"
					type="button"
					class="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
					title="Hội thoại mới"
					aria-label="Bắt đầu hội thoại mới"
					@click="newConversation"
				>
					<Icon name="heroicons:pencil-square" class="h-5 w-5" />
				</button>
				<!--
					Đang trả lời thì chưa cho sang trang Trợ lý: rời cửa sổ là huỷ luồng stream, sang
					trang kia chỉ thấy câu trả lời bị cắt ngang.
				-->
				<button
					type="button"
					:disabled="sending"
					class="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-gray-700 dark:hover:text-gray-200"
					:title="sending ? 'Đợi trợ lý trả lời xong rồi mở ở trang Trợ lý' : 'Mở ở trang Trợ lý'"
					aria-label="Mở hội thoại này ở trang Trợ lý"
					@click="emit('expand', conversationId)"
				>
					<Icon name="heroicons:arrows-pointing-out" class="h-5 w-5" />
				</button>
				<button
					type="button"
					class="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
					title="Thu nhỏ"
					aria-label="Thu nhỏ cửa sổ chat nhanh"
					@click="emit('minimize')"
				>
					<Icon name="heroicons:minus" class="h-5 w-5" />
				</button>
				<button
					type="button"
					class="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
					title="Đóng. Hội thoại vẫn được lưu ở trang Trợ lý."
					aria-label="Đóng cửa sổ chat nhanh"
					@click="emit('close')"
				>
					<Icon name="heroicons:x-mark" class="h-5 w-5" />
				</button>
			</div>
		</header>

		<!-- `relative` riêng quanh vùng cuộn để neo nút "xuống cuối" ngay trên ô nhập. -->
		<div class="relative flex min-h-0 flex-1 flex-col bg-gray-50 dark:bg-gray-900/30">
			<!-- `overscroll-contain`: cuộn tới đáy khung chat không kéo trang bên dưới trôi theo. -->
			<div ref="scroller" class="flex-1 overflow-y-auto overscroll-contain px-2.5 py-3" @scroll.passive="onScroll">
				<AgentEmptyState v-if="!messages.length" compact :suggestions="AGENT_SUGGESTIONS" @pick="ask($event)" />

				<div v-else class="flex w-full flex-col gap-3">
					<AgentMessageBubble
						v-for="m in messages"
						:key="m.id"
						:message="m"
						:read-only="false"
						compact
						@confirm="onConfirm"
						@cancel="cancelPending"
						@rate="onRate"
					/>
				</div>
			</div>

			<Transition
				enter-active-class="transition duration-150"
				enter-from-class="opacity-0 translate-y-1"
				leave-active-class="transition duration-150"
				leave-to-class="opacity-0 translate-y-1"
			>
				<button
					v-if="showScrollDown"
					type="button"
					title="Xuống tin mới nhất"
					aria-label="Cuộn xuống tin nhắn mới nhất"
					class="absolute bottom-3 left-1/2 z-10 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-md transition hover:text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:text-gray-50"
					@click="scrollToBottom()"
				>
					<Icon name="heroicons:arrow-down" class="h-4 w-4" />
				</button>
			</Transition>
		</div>

		<AgentComposer
			v-model="input"
			:sending="sending"
			:can-send="canSend"
			@send="ask()"
			@stop="stop"
			@focus="onComposerFocus"
		/>
	</section>
</template>
