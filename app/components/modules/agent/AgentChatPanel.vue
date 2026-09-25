<script setup lang="ts">
	import AgentMessageBubble from '~/components/modules/agent/AgentMessageBubble.vue';
	import AgentConversationList from '~/components/modules/agent/AgentConversationList.vue';
	import AgentComposer from '~/components/modules/agent/AgentComposer.vue';
	import AgentEmptyState from '~/components/modules/agent/AgentEmptyState.vue';
	import type { AgentSuggestion } from '~/types/agent.types';

	const {
		messages,
		conversations,
		input,
		sending,
		loadingHistory,
		canSend,
		conversationId,
		send,
		stop,
		reset,
		loadConversations,
		openConversation,
		archiveConversation,
		confirmPending,
		cancelPending,
	} = useAgentChat();

	const toast = useToast();

	const scroller = ref<HTMLElement | null>(null);
	const showList = ref(true);
	const mobileList = ref(false);
	const fullscreen = ref(false);
	/** Bật khi chính người dùng vừa hành động → luôn kéo xuống đáy dù đang đọc ở trên. */
	const forceScroll = ref(false);

	/**
	 * Toàn màn hình: khung chat phủ kín viewport, thoát khỏi chiều cao của trang.
	 *
	 * Dùng `<Teleport>` chứ không chỉ `position: fixed`: bất kỳ tổ tiên nào có `transform`
	 * hay `filter` đều biến `fixed` thành "cố định so với tổ tiên đó" — page transition của
	 * Nuxt đúng là dùng transform. Teleport đưa hẳn ra `body` nên không phụ thuộc vào đó.
	 */
	function toggleFullscreen(): void {
		fullscreen.value = !fullscreen.value;
		mobileList.value = false;
		// Teleport dời DOM sang chỗ khác → `scrollTop` của khung tin nhắn bị xoá. Không kéo
		// lại thì người dùng bấm mở rộng xong thấy mình nhảy về đầu hội thoại.
		forceScroll.value = true;
		void nextTick(() => {
			if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
		});
	}

	/** Khoá cuộn nền khi toàn màn hình — không khoá thì trang dưới vẫn trôi theo ngón tay. */
	watch(fullscreen, (on) => {
		document.body.style.overflow = on ? 'hidden' : '';
	});

	function onKeydown(e: KeyboardEvent): void {
		if (e.key === 'Escape' && fullscreen.value) toggleFullscreen();
	}

	onMounted(() => window.addEventListener('keydown', onKeydown));
	onBeforeUnmount(() => {
		window.removeEventListener('keydown', onKeydown);
		// Rời trang khi đang toàn màn hình mà không trả lại thì cả app mất cuộn
		document.body.style.overflow = '';
	});

	const SUGGESTIONS: AgentSuggestion[] = [
		{ icon: 'heroicons:sun', label: 'Tôi còn mấy ngày phép?' },
		{ icon: 'heroicons:clock', label: 'Tháng này tôi đi muộn mấy lần?' },
		{ icon: 'heroicons:table-cells', label: 'Cho xem bảng công tháng trước' },
	];

	onMounted(loadConversations);

	// Cuộn theo cả tin nhắn mới lẫn từng mảnh stream — nhưng chỉ khi người dùng đang
	// ở sát đáy. Đang đọc lại đoạn trên mà bị kéo xuống theo từng mảnh stream thì rất khó chịu.
	watch(
		// Kèm cả trạng thái form: nó hiện ra sau khi chữ đã chảy xong, không theo dõi thì
		// khung cao thêm cả trăm px mà không tự cuộn, người dùng không thấy nút xác nhận.
		() => messages.value.map((m) => `${m.text}|${m.pending?.state ?? ''}`).join(''),
		async () => {
			const stick = forceScroll.value || nearBottom();
			await nextTick();
			if (!stick) return;
			forceScroll.value = false;
			if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
		},
	);

	/** Đo TRƯỚC khi DOM cập nhật — sau khi thêm nội dung thì không còn ở đáy nữa. */
	function nearBottom(): boolean {
		const el = scroller.value;
		if (!el) return true;
		return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
	}

	/**
	 * Đang ở sát đáy hay không — quyết định có hiện nút "xuống cuối".
	 *
	 * Ngưỡng RỘNG HƠN `nearBottom()` (240 vs 120): dùng chung một ngưỡng thì nút nhấp nháy
	 * ở đúng vùng ranh giới, cuộn nhẹ một chút là nó hiện rồi lại biến mất.
	 */
	const atBottom = ref(true);

	function onScroll(): void {
		const el = scroller.value;
		if (!el) return;
		atBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 240;
	}

	const showScrollDown = computed(() => !atBottom.value && messages.value.length > 0);

	function scrollToBottom(smooth = true): void {
		const el = scroller.value;
		if (!el) return;
		el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
		atBottom.value = true;
	}

	/**
	 * Chạm vào ô nhập là kéo thẳng xuống tin mới nhất.
	 *
	 * Trên điện thoại, bàn phím bật lên ăn mất nửa màn hình; đang đọc lại đoạn cũ mà gõ
	 * tiếp thì câu trả lời mới chảy ra ngoài tầm nhìn. `false` = không cuộn mượt: lúc này
	 * viewport đang co lại vì bàn phím, animation mượt sẽ chạy đua với nó và dừng sai chỗ.
	 */
	function onComposerFocus(): void {
		void nextTick(() => scrollToBottom(false));
	}

	function ask(text?: string): void {
		forceScroll.value = true;
		void send(text);
	}

	function pickConversation(id: number): void {
		mobileList.value = false;
		forceScroll.value = true;
		void openConversation(id);
	}

	function newConversation(): void {
		mobileList.value = false;
		reset();
	}

	/**
	 * Người dùng bấm nút trong form. Đây là đường DUY NHẤT trợ lý ghi được dữ liệu —
	 * model không tự gọi được, nó chỉ dựng sẵn form.
	 */
	async function onConfirm(id: number, payload: Record<string, unknown>): Promise<void> {
		forceScroll.value = true;
		const ok = await confirmPending(id, payload);
		// Thẻ form đã tự hiện kết quả; toast chỉ để người đang cuộn ở chỗ khác cũng thấy
		if (ok) toast.success('Đã thực hiện thao tác');
		void loadConversations();
	}

	async function onArchive(id: number): Promise<void> {
		if (!confirm('Lưu trữ hội thoại này? Dữ liệu vẫn được giữ, chỉ ẩn khỏi danh sách.')) return;
		await archiveConversation(id);
	}
</script>

<template>
	<Teleport to="body" :disabled="!fullscreen">
		<div
			:class="[
				'flex overflow-hidden bg-white dark:bg-gray-800',
				fullscreen
					? // `fixed inset-0` chứ không `h-screen`: trên Safari iOS thanh địa chỉ co giãn
						// làm 100vh vượt quá phần nhìn thấy, ô nhập bị đẩy xuống dưới mép màn hình.
						'fixed inset-0 z-50'
					: 'relative h-full rounded-2xl border border-gray-200 shadow-sm dark:border-gray-700',
			]"
			:style="
				fullscreen
					? // Vùng an toàn của máy có notch / thanh home — không có thì ô nhập bị che
						{
							paddingTop: 'env(safe-area-inset-top, 0px)',
							paddingBottom: 'env(safe-area-inset-bottom, 0px)',
						}
					: undefined
			"
		>
			<AgentConversationList
				v-if="showList"
				class="hidden md:flex"
				:conversations="conversations"
				:active-id="conversationId"
				:disabled="sending"
				@select="pickConversation"
				@create="newConversation"
				@archive="onArchive"
			/>

			<!-- Mobile: danh sách hội thoại mở dạng drawer, không chiếm chỗ cố định -->
			<div v-if="mobileList" class="absolute inset-0 z-20 flex md:hidden">
				<div class="absolute inset-0 bg-black/40" @click="mobileList = false" />
				<AgentConversationList
					class="relative z-10 shadow-xl"
					:conversations="conversations"
					:active-id="conversationId"
					:disabled="sending"
					@select="pickConversation"
					@create="newConversation"
					@archive="onArchive"
				/>
			</div>

			<div class="flex min-w-0 flex-1 flex-col bg-gray-50 dark:bg-gray-900/30">
				<header
					class="flex items-center justify-between gap-3 border-b border-gray-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-gray-700 dark:bg-gray-800/80"
				>
					<div class="flex min-w-0 items-center gap-3">
						<button
							type="button"
							class="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 md:hidden dark:hover:bg-gray-700 dark:hover:text-gray-200"
							title="Danh sách hội thoại"
							@click="mobileList = true"
						>
							<Icon name="heroicons:bars-3" class="h-5 w-5" />
						</button>
						<button
							type="button"
							class="hidden rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 md:block dark:hover:bg-gray-700 dark:hover:text-gray-200"
							:title="showList ? 'Ẩn danh sách' : 'Hiện danh sách'"
							@click="showList = !showList"
						>
							<Icon
								:name="showList ? 'heroicons:chevron-double-left' : 'heroicons:bars-3'"
								class="h-5 w-5"
							/>
						</button>

						<div
							class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)] text-white shadow-sm"
						>
							<Icon name="heroicons:sparkles" class="h-5 w-5" />
						</div>
						<div class="min-w-0">
							<h2 class="truncate text-sm font-semibold text-gray-900 dark:text-gray-50">
								Trợ lý nhân sự
							</h2>
							<p class="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
								<span
									:class="[
										'h-1.5 w-1.5 rounded-full',
										sending ? 'animate-pulse bg-amber-500' : 'bg-emerald-500',
									]"
								/>
								{{ sending ? 'Đang trả lời…' : 'Sẵn sàng' }}
							</p>
						</div>
					</div>

					<div class="flex shrink-0 items-center gap-1">
						<button
							v-if="messages.length"
							type="button"
							class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
							@click="newConversation"
						>
							<Icon name="heroicons:pencil-square" class="h-4 w-4" />
							<span class="hidden sm:inline">Hội thoại mới</span>
						</button>

						<button
							type="button"
							class="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
							:title="fullscreen ? 'Thu nhỏ (Esc)' : 'Mở toàn màn hình'"
							:aria-label="fullscreen ? 'Thu nhỏ khung chat' : 'Mở khung chat toàn màn hình'"
							:aria-pressed="fullscreen"
							@click="toggleFullscreen"
						>
							<Icon
								:name="
									fullscreen
										? 'heroicons:arrows-pointing-in'
										: 'heroicons:arrows-pointing-out'
								"
								class="h-5 w-5"
							/>
						</button>
					</div>
				</header>

				<!--
					Bọc `relative` quanh RIÊNG vùng cuộn để neo nút "xuống cuối" ngay phía trên
					ô nhập. Neo vào khung ngoài rồi căn bằng `bottom-<số cố định>` là hỏng: ô
					nhập cao thấp khác nhau tuỳ số dòng đang gõ.
				-->
				<div class="relative flex min-h-0 flex-1 flex-col">
					<div
						ref="scroller"
						class="flex-1 overflow-y-auto px-3 py-4 sm:px-4 sm:py-6"
						@scroll.passive="onScroll"
					>
						<div
							v-if="loadingHistory"
							class="flex h-full items-center justify-center gap-2 text-sm text-gray-400"
						>
							<Icon name="heroicons:arrow-path" class="h-4 w-4 animate-spin" />
							Đang tải hội thoại…
						</div>

						<AgentEmptyState
							v-else-if="!messages.length"
							:suggestions="SUGGESTIONS"
							@pick="ask($event)"
						/>

						<div v-else class="flex w-full flex-col gap-4 sm:gap-5">
							<AgentMessageBubble
								v-for="m in messages"
								:key="m.id"
								:message="m"
								@confirm="onConfirm"
								@cancel="cancelPending"
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
			</div>
		</div>
	</Teleport>
</template>
