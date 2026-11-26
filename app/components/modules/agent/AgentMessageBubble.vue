<script setup lang="ts">
	import DOMPurify from 'dompurify';
	import agentAvatar from '~/assets/icons/ONGO_AI_BOT.png';
	import AgentActionForm from '~/components/modules/agent/AgentActionForm.vue';
	import AgentChartBlock from '~/components/modules/agent/AgentChartBlock.vue';
	import AgentFeedbackBar from '~/components/modules/agent/AgentFeedbackBar.vue';
	import AgentLinkedText from '~/components/modules/agent/AgentLinkedText.vue';
	import AgentTableBlock from '~/components/modules/agent/AgentTableBlock.vue';
	import { agentToolChipLabel } from '~/types/agent.types';
	import type {
		AgentChatMessage as ChatMsg,
		AgentFeedbackRating,
	} from '~/types/agent.types';
	import { isSafeInternalPath, renderAgentMarkdown } from '~/utils/agent-markdown';

	const props = defineProps<{
		message: ChatMsg;
		/** Module chỉ xem: không xác nhận form hay chấm điểm được nữa. */
		readOnly?: boolean;
		/**
		 * Khung hẹp như cửa sổ chat nhanh: avatar, đệm và cỡ chữ nhỏ lại, form cũng thu gọn.
		 * Cỡ của trang Trợ lý đặt cho khung rộng; giữ nguyên trong khung 400px thì một form nghỉ
		 * phép dài hơn hai màn hình và người dùng phải cuộn mới thấy nút xác nhận.
		 */
		compact?: boolean;
	}>();

	const emit = defineEmits<{
		confirm: [pendingActionId: number, payload: Record<string, unknown>];
		cancel: [pendingActionId: number];
		rate: [messageId: number, rating: AgentFeedbackRating, comment?: string];
		/** Người dùng vừa bấm một đường dẫn trong câu trả lời và app đang chuyển trang. */
		navigate: [path: string];
	}>();

	const toast = useToast();

	const copied = ref(false);

	/**
	 * Khung chat hẹp (điện thoại, cửa sổ chat nhanh 400 px) thì bảng từ ba cột hiện thành thẻ, mỗi dòng
	 * một thẻ: bảng 5 cột ở màn 390 px phải vuốt ngang mới đọc hết một dòng, cột đầu trôi mất nên không
	 * biết đang đọc dòng nào. Đo bề rộng hàng tin nhắn (luôn rộng hết khung chat, không co theo chữ)
	 * chứ không đo màn hình, vì cửa sổ chat nhanh trên máy tính cũng hẹp như điện thoại.
	 *
	 * Chưa đo được (0, như khi chạy test) thì coi là rộng: giữ dạng bảng như trước.
	 */
	const NARROW_ROW_WIDTH = 560;
	const rowEl = ref<HTMLElement | null>(null);
	const rowWidth = ref(0);
	const narrow = computed(() => rowWidth.value > 0 && rowWidth.value < NARROW_ROW_WIDTH);
	let resizeObserver: ResizeObserver | null = null;

	const isUser = computed(() => props.message.role === 'user');
	const isSystem = computed(() => props.message.role === 'system');

	/** Form không kèm chữ (VD dựng lại sau F5) thì không vẽ bong bóng rỗng. */
	const hasBubble = computed(() => !!props.message.text || !!props.message.status);

	/**
	 * Chỉ render markdown KHI ĐÃ STREAM XONG. Lúc đang chảy từng mảnh, một bảng mới
	 * được nửa dòng sẽ hiện ra méo mó rồi nhảy — hiện text thô mượt hơn nhiều.
	 */
	/** Thẻ "đã tra gì" dưới câu trả lời: chữ tiếng Việt, gộp trùng; không hiện tên tool thô. */
	const toolChips = computed(() => [...new Set((props.message.toolsCalled ?? []).map(agentToolChipLabel))]);

	const html = computed(() => {
		if (isUser.value || props.message.streaming || props.message.error) return null;
		if (!props.message.text) return null;
		return DOMPurify.sanitize(renderAgentMarkdown(props.message.text, { links: true }));
	});

	/**
	 * Bấm đường dẫn nội bộ trong câu trả lời, bảng hay thẻ kết quả: đi bằng router, không tải lại trang.
	 *
	 * Bắt ở một chỗ cho mọi `a[data-agent-link]` bên trong, kể cả phần vào qua `v-html`. `href` được
	 * kiểm LẠI ở đây chứ không tin thuộc tính trên DOM. Ctrl, Cmd, Shift, chuột giữa thì để trình duyệt
	 * tự mở tab mới như mọi link khác.
	 */
	function onLinkClick(e: MouseEvent): void {
		if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		const a = (e.target as Element | null)?.closest?.('a[data-agent-link]');
		if (!a) return;
		const href = a.getAttribute('href') ?? '';
		if (!isSafeInternalPath(href)) return;
		e.preventDefault();
		emit('navigate', href);
		void navigateTo(href);
	}

	/**
	 * Hiện nút copy khi câu trả lời đã xong và có nội dung.
	 *
	 * Lượt hỏng thì không: thứ nằm trong bong bóng là câu báo lỗi chứ không phải câu trả lời, mà
	 * một nút "Sao chép câu trả lời" ngay dưới đó khiến người dùng tưởng vẫn có gì để mang đi dùng.
	 * Chữ lỗi vẫn bôi đen chép tay được, và ADMIN tra lại được ở màn xem hội thoại.
	 */
	const canCopy = computed(
		() =>
			!isUser.value
			&& !props.message.error
			&& !props.message.streaming
			&& !props.message.status
			&& !!props.message.text,
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

	onMounted(() => {
		const el = rowEl.value;
		if (!el || typeof ResizeObserver === 'undefined') return;
		rowWidth.value = el.clientWidth;
		resizeObserver = new ResizeObserver((entries) => {
			rowWidth.value = entries[0]?.contentRect.width ?? el.clientWidth;
		});
		resizeObserver.observe(el);
	});

	onBeforeUnmount(() => resizeObserver?.disconnect());
</script>

<template>
	<!-- Dấu vết một thao tác đã thực thi — dải mảnh giữa khung, không phải lời thoại -->
	<!-- Câu do server dựng có thể kèm đường dẫn ("Mở trên web: /cong-viec?task=CV-9"): thành link. -->
	<div v-if="isSystem" class="flex w-full justify-center animate-fade-in" @click="onLinkClick">
		<p
			class="inline-flex min-w-0 max-w-full items-start gap-1.5 rounded-2xl bg-emerald-50 px-3 py-1 text-[12px] font-medium break-words text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
		>
			<Icon name="heroicons:check-circle" class="mt-px h-3.5 w-3.5 shrink-0" />
			<span class="min-w-0"><AgentLinkedText :text="message.text" /></span>
		</p>
	</div>

	<div
		v-else
		ref="rowEl"
		:class="[
			'group flex w-full animate-fade-in',
			compact ? 'gap-2' : 'gap-3',
			isUser ? 'justify-end' : 'justify-start',
		]"
	>
		<!-- Lỗi thì vẫn dùng icon cảnh báo; bình thường là mascot (ảnh tự đủ tương phản
		     trên cả nền sáng lẫn tối nên không cần đĩa nền phía sau) -->
		<div
			v-if="!isUser && message.error"
			:class="[
				'flex shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 shadow-sm dark:bg-red-500/20 dark:text-red-300',
				compact ? 'h-6 w-6' : 'h-8 w-8',
			]"
		>
			<Icon name="heroicons:exclamation-triangle" :class="compact ? 'h-3.5 w-3.5' : 'h-4 w-4'" />
		</div>
		<img
			v-else-if="!isUser"
			:src="agentAvatar"
			alt=""
			draggable="false"
			:class="['shrink-0 object-contain select-none', compact ? 'h-6 w-6' : 'h-8 w-8']"
		/>

		<div
			:class="[
				'flex min-w-0 flex-col',
				compact ? 'gap-1' : 'gap-1.5',
				// Form cần chỗ để điền — bong bóng chữ thì hẹp cho dễ đọc
				message.pending ? 'w-full max-w-xl' : compact ? 'max-w-[88%]' : 'max-w-[85%]',
				isUser ? 'items-end' : 'items-start',
			]"
			@click="onLinkClick"
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
					'min-w-0 max-w-full break-words shadow-sm',
					compact ? 'px-3 py-2 text-[13px] leading-normal' : 'px-4 py-3 text-sm leading-relaxed',
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
				<div v-else-if="html" :class="['agent-md', narrow ? 'agent-md--narrow' : '']" v-html="html" />

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

			<!--
				Bảng đứng SAU biểu đồ, vẫn trước form: một lượt có cả hai thì biểu đồ là cái
				nhìn tổng, bảng là chi tiết từng dòng — đọc tổng trước rồi mới soi chi tiết.
			-->
			<AgentTableBlock
				v-for="(t, i) in message.tables ?? []"
				:key="`table-${i}`"
				:table="t"
				links
				:cards="narrow"
			/>

			<AgentActionForm
				v-if="message.pending && !readOnly"
				:pending="message.pending"
				:compact="compact"
				@confirm="emit('confirm', message.pending!.pendingActionId, $event)"
				@cancel="emit('cancel', message.pending!.pendingActionId)"
			/>

			<div v-if="canCopy || toolChips.length" class="flex flex-wrap items-center gap-1.5 px-1">
				<span
					v-for="chip in toolChips"
					:key="chip"
					class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-700/60 dark:text-gray-300"
				>
					<Icon name="heroicons:magnifying-glass" class="h-3 w-3" />
					{{ chip }}
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

			<!--
				Thanh chấm điểm đứng CUỐI, sau cả nút sao chép: nó là việc làm thêm cho hệ
				thống, không phải phần câu trả lời. Component tự ẩn khi server không mời và
				lượt đó chưa được chấm.
			-->
			<AgentFeedbackBar
				v-if="!isUser && !message.streaming && !readOnly"
				:message="message"
				@rate="(id, rating, comment) => emit('rate', id, rating, comment)"
			/>
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
	/* Đường dẫn nội bộ: gạch chân để nhận ra bấm được, kể cả khi bọc khối code. */
	.agent-md :deep(a.agent-link) {
		color: var(--color-accent);
		text-decoration: underline;
		text-underline-offset: 2px;
		overflow-wrap: anywhere;
	}
	.agent-md :deep(a.agent-link:hover) {
		text-decoration-thickness: 2px;
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
	/*
		Khung hẹp: bảng từ ba cột thành thẻ, mỗi dòng một thẻ, mỗi ô một hàng "nhãn cột: giá trị".
		Nhãn lấy từ `data-label` do renderAgentMarkdown gắn vào từng ô. Ô đầu là tên của dòng nên
		in đậm, không cần nhãn.
	*/
	.agent-md--narrow :deep(.agent-table--cards),
	.agent-md--narrow :deep(.agent-table--cards tbody),
	.agent-md--narrow :deep(.agent-table--cards tr),
	.agent-md--narrow :deep(.agent-table--cards td) {
		display: block;
		width: auto;
		min-width: 0;
	}
	.agent-md--narrow :deep(.agent-table--cards thead) {
		display: none;
	}
	.agent-md--narrow :deep(.agent-table--cards tr) {
		padding: 0.5rem 0.7rem;
		border-bottom: 1px solid rgb(0 0 0 / 0.07);
	}
	.dark .agent-md--narrow :deep(.agent-table--cards tr) {
		border-color: rgb(255 255 255 / 0.1);
	}
	.agent-md--narrow :deep(.agent-table--cards tr:last-child) {
		border-bottom: 0;
	}
	.agent-md--narrow :deep(.agent-table--cards td) {
		display: flex;
		gap: 0.6rem;
		padding: 0.1rem 0;
		border: 0;
		white-space: normal;
		overflow-wrap: anywhere;
	}
	.agent-md--narrow :deep(.agent-table--cards td::before) {
		content: attr(data-label);
		flex: 0 0 38%;
		color: rgb(0 0 0 / 0.5);
	}
	.dark .agent-md--narrow :deep(.agent-table--cards td::before) {
		color: rgb(255 255 255 / 0.55);
	}
	.agent-md--narrow :deep(.agent-table--cards td:first-child) {
		font-weight: 600;
		padding-bottom: 0.2rem;
	}
	.agent-md--narrow :deep(.agent-table--cards td:first-child::before) {
		display: none;
	}
</style>
