<script setup lang="ts">
	import agentAvatar from '~/assets/icons/ONGO_AI_BOT.png';
	import AgentQuickChat from '~/components/modules/agent/AgentQuickChat.vue';

	const route = useRoute();
	const { canUse, canWrite } = useModuleAccess();

	/** Đang ở ngay trang chat rồi thì nút nổi chỉ che mất ô nhập — ẩn đi. Công ty chưa mở trợ lý cũng ẩn. */
	const hidden = computed(() => route.path.startsWith('/assistant') || !canUse('AI_AGENT'));

	/**
	 * Chat nhanh chỉ có nghĩa khi hỏi được: module ở chế độ chỉ xem thì cửa sổ mới tinh không có
	 * gì để đọc, nên nút nổi giữ đúng một việc cũ là mở trang Trợ lý để xem lại hội thoại cũ.
	 */
	const canQuickChat = computed(() => canWrite('AI_AGENT'));

	/**
	 * `closed`: chưa mở hoặc đã đóng hẳn, component chat bị gỡ. `open`: cửa sổ đang hiện.
	 * `minimized`: cửa sổ ẩn nhưng component vẫn sống, nên câu trả lời đang chảy về không bị cắt
	 * và mở lại là thấy nguyên hội thoại — đúng cách bong bóng chat của Messenger thu nhỏ.
	 */
	type QuickState = 'closed' | 'open' | 'minimized';
	const quick = ref<QuickState>('closed');
	const quickStatus = ref({ sending: false, hasMessages: false });

	const menuOpen = ref(false);
	/** Menu mở do rê chuột: cú bấm ngay sau đó là "chọn nút", không phải "đóng menu". */
	let openedByHover = false;
	let closeTimer: ReturnType<typeof setTimeout> | null = null;
	const root = ref<HTMLElement | null>(null);

	/** Có hội thoại dở đang thu nhỏ: hiện chấm trên nút để người dùng biết còn cửa sổ đang chờ. */
	const showDot = computed(() => quick.value === 'minimized' && quickStatus.value.hasMessages);

	function clearCloseTimer(): void {
		if (closeTimer) clearTimeout(closeTimer);
		closeTimer = null;
	}

	/** Rê chuột vào là bung menu; chỉ với chuột, vì trên màn cảm ứng `pointerenter` đến cùng cú chạm. */
	function onPointerEnter(e: PointerEvent): void {
		if (e.pointerType !== 'mouse' || quick.value === 'open' || !canQuickChat.value) return;
		clearCloseTimer();
		if (!menuOpen.value) openedByHover = true;
		menuOpen.value = true;
	}

	/** Trễ một nhịp mới đóng, để kịp đưa chuột từ nút lên menu mà menu không biến mất giữa đường. */
	function onPointerLeave(e: PointerEvent): void {
		if (e.pointerType !== 'mouse') return;
		clearCloseTimer();
		closeTimer = setTimeout(() => (menuOpen.value = false), 250);
	}

	function onFabClick(): void {
		// Cửa sổ đang mở thì nút nổi là nút thu nhỏ, như bấm vào bong bóng chat đang mở.
		if (quick.value === 'open') {
			quick.value = 'minimized';
			return;
		}
		if (!canQuickChat.value) {
			void navigateTo('/assistant');
			return;
		}
		if (openedByHover) {
			openedByHover = false;
			menuOpen.value = true;
			return;
		}
		menuOpen.value = !menuOpen.value;
	}

	function openQuickChat(): void {
		menuOpen.value = false;
		openedByHover = false;
		quick.value = 'open';
	}

	function openAssistantPage(): void {
		menuOpen.value = false;
		openedByHover = false;
		void navigateTo('/assistant');
	}

	function closeQuickChat(): void {
		quick.value = 'closed';
		quickStatus.value = { sending: false, hasMessages: false };
	}

	/** Sang trang Trợ lý với đúng hội thoại đang gõ; ở đó nút nổi tự ẩn nên cửa sổ đóng luôn. */
	function expandQuickChat(conversationId: number | undefined): void {
		closeQuickChat();
		void navigateTo(conversationId ? `/assistant?conversation_id=${conversationId}` : '/assistant');
	}

	/** Bấm ra ngoài nút và menu thì đóng menu; không đụng tới cửa sổ chat. */
	function onDocumentPointerDown(e: PointerEvent): void {
		if (!menuOpen.value) return;
		if (root.value && e.target instanceof Node && root.value.contains(e.target)) return;
		menuOpen.value = false;
		openedByHover = false;
	}

	function onKeydown(e: KeyboardEvent): void {
		if (e.key !== 'Escape') return;
		if (menuOpen.value) menuOpen.value = false;
		else if (quick.value === 'open') quick.value = 'minimized';
	}

	onMounted(() => {
		document.addEventListener('pointerdown', onDocumentPointerDown);
		window.addEventListener('keydown', onKeydown);
	});

	onBeforeUnmount(() => {
		clearCloseTimer();
		document.removeEventListener('pointerdown', onDocumentPointerDown);
		window.removeEventListener('keydown', onKeydown);
	});

	// Chuyển trang thì menu đóng lại; cửa sổ chat thì giữ nguyên, đó là lý do nó tồn tại.
	watch(
		() => route.path,
		() => (menuOpen.value = false),
	);

	// Vị trí: mobile nâng lên trên (bottom-24) vì một số trang đã có FAB "tạo đơn"
	// riêng ở góc `bottom-6 right-6` (chỉ hiện dưới sm) — để nguyên góc sẽ chồng nút.
</script>

<template>
	<template v-if="!hidden">
		<AgentQuickChat
			v-if="quick !== 'closed'"
			v-show="quick === 'open'"
			@minimize="quick = 'minimized'"
			@close="closeQuickChat"
			@expand="expandQuickChat"
			@status="quickStatus = $event"
		/>

		<div
			ref="root"
			class="fixed right-5 bottom-24 z-30 sm:right-6 sm:bottom-6"
			@pointerenter="onPointerEnter"
			@pointerleave="onPointerLeave"
		>
			<Transition
				enter-active-class="transition duration-150 ease-out"
				enter-from-class="opacity-0 translate-y-1 scale-95"
				leave-active-class="transition duration-100 ease-in"
				leave-to-class="opacity-0 translate-y-1 scale-95"
			>
				<!-- `pb-3` thay cho khoảng hở: đưa chuột từ nút lên menu vẫn nằm trong vùng của menu. -->
				<div v-if="menuOpen" class="absolute right-0 bottom-full origin-bottom-right pb-3">
					<div
						role="menu"
						aria-label="Trợ lý AI"
						class="w-72 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl dark:border-gray-700 dark:bg-gray-800"
					>
						<button
							type="button"
							role="menuitem"
							class="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-gray-100 dark:hover:bg-gray-700"
							@click="openQuickChat"
						>
							<span
								class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)] text-white"
							>
								<Icon name="heroicons:chat-bubble-oval-left-ellipsis" class="h-4 w-4" />
							</span>
							<span class="min-w-0">
								<span class="block text-sm font-semibold text-gray-900 dark:text-gray-50">
									{{ quick === 'minimized' ? 'Tiếp tục chat nhanh' : 'Chat nhanh' }}
								</span>
								<span class="block text-xs text-gray-500 dark:text-gray-400">
									{{
										quick === 'minimized'
											? 'Mở lại cửa sổ chat đang thu nhỏ.'
											: 'Hỏi ngay tại trang này, không cần chuyển trang.'
									}}
								</span>
							</span>
						</button>
						<button
							type="button"
							role="menuitem"
							class="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-gray-100 dark:hover:bg-gray-700"
							@click="openAssistantPage"
						>
							<span
								class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
							>
								<Icon name="heroicons:arrow-top-right-on-square" class="h-4 w-4" />
							</span>
							<span class="min-w-0">
								<span class="block text-sm font-semibold text-gray-900 dark:text-gray-50">Mở trang Trợ lý</span>
								<span class="block text-xs text-gray-500 dark:text-gray-400">
									Xem và tiếp tục các cuộc trò chuyện cũ.
								</span>
							</span>
						</button>
					</div>
				</div>
			</Transition>

			<button
				type="button"
				:title="quick === 'open' ? 'Thu nhỏ chat nhanh' : 'Trợ lý AI'"
				:aria-label="quick === 'open' ? 'Thu nhỏ cửa sổ chat nhanh' : 'Mở trợ lý AI'"
				:aria-haspopup="canQuickChat && quick !== 'open' ? 'menu' : undefined"
				:aria-expanded="canQuickChat && quick !== 'open' ? menuOpen : undefined"
				class="group relative flex items-center rounded-full bg-[var(--color-accent)] p-4 text-white shadow-lg transition duration-200 hover:scale-105 hover:shadow-xl active:scale-95"
				@click="onFabClick"
			>
				<Icon v-if="quick === 'open'" name="heroicons:chevron-down" class="h-7 w-7 shrink-0" />
				<img v-else :src="agentAvatar" alt="" draggable="false" class="h-7 w-7 shrink-0 object-contain select-none" />

				<!-- Nhãn chỉ bung ra khi hover trên máy có chuột; mobile giữ nguyên nút tròn. Menu đang mở thì thôi. -->
				<span
					v-if="quick !== 'open' && !menuOpen"
					class="ml-0 hidden max-w-0 overflow-hidden text-sm font-semibold whitespace-nowrap opacity-0 transition-all duration-300 group-hover:ml-2 group-hover:max-w-[8rem] group-hover:opacity-100 lg:block"
				>
					Trợ lý AI
				</span>

				<!-- Chấm báo hội thoại dở; nhấp nháy khi trợ lý vẫn đang trả lời trong cửa sổ đã thu nhỏ. -->
				<span
					v-if="showDot"
					:class="[
						'absolute top-1 right-1 h-3 w-3 rounded-full border-2 border-white',
						quickStatus.sending ? 'animate-pulse bg-amber-400' : 'bg-emerald-400',
					]"
				/>
			</button>
		</div>
	</template>
</template>
