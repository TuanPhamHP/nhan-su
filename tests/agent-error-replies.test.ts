/**
 * ============================================================
 * Test suite: lời báo lỗi của trợ lý được lưu và nạp lại
 * ============================================================
 *
 * Vì sao cần: trước đây bong bóng đỏ chỉ sống trong một lần stream, F5 là mất. Nay BE lưu câu
 * lỗi vào hội thoại, nên cái dễ sai nằm ở chỗ nạp lại: hiện chữ dở thay vì câu lỗi, hiện cả hai
 * làm một câu lặp hai lần, hay vẽ bong bóng thường khiến người đọc tưởng trợ lý đã trả lời.
 *
 * Cấu trúc:
 *   1. useAgentChat.openConversation — nạp lại lượt hỏng thành bong bóng lỗi
 *   2. AgentMessageBubble            — tin lỗi không có nút sao chép, không có thanh chấm điểm
 *   3. AgentConversationTranscript   — màn ADMIN vẽ khung lỗi, không lặp câu
 *
 * Ký hiệu: [EDGE] trường hợp biên · [ERR] luồng lỗi
 * ============================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { getCurrentInstance, onBeforeUnmount, onMounted, onScopeDispose } from 'vue';

/**
 * Nuxt auto-import mấy hook này; `tests/setup.ts` chưa khai nên gắn tay.
 *
 * Trong component thì gọi hook THẬT, vì `AgentConversationTranscript` tải dữ liệu ở `onMounted`;
 * ngoài component thì bỏ qua, vì `useAgentChat` gọi hook ngay trong thân `it()`.
 */
Object.assign(globalThis, {
	onScopeDispose,
	onMounted: (fn: () => void) => (getCurrentInstance() ? onMounted(fn) : undefined),
	onBeforeUnmount: (fn: () => void) => (getCurrentInstance() ? onBeforeUnmount(fn) : undefined),
	useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
});

const mockFetch = vi.hoisted(() => vi.fn());

vi.mock('~/services/http/auth.fetch', () => ({
	useAuthFetch: () => mockFetch,
	setOnForceLogout: vi.fn(),
}));

vi.mock('~/services/agent.service', () => ({
	useAgentService: () => ({
		chatStream: vi.fn(),
		listConversations: vi.fn().mockResolvedValue([]),
		conversationMessages: mockFetch,
		pendingActions: vi.fn().mockResolvedValue([]),
		confirmAction: vi.fn(),
		cancelAction: vi.fn(),
		submitFeedback: vi.fn(),
		archiveConversation: vi.fn(),
		renameConversation: vi.fn(),
	}),
}));

import AgentMessageBubble from '~/components/modules/agent/AgentMessageBubble.vue';
import AgentConversationTranscript from '~/components/modules/agent/AgentConversationTranscript.vue';
import { useAgentChat } from '~/composables/useAgentChat';
import type { AgentChatMessage, AgentConversationMessage } from '~/types/agent.types';
import type { AgentConversationTranscript as Transcript } from '~/types/agent-analytics.types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** Đúng những gì sandbox trả ngày 19/11/2026: hỏng trước khi sinh chữ thì `text` bằng `error`. */
const FAIL_403 = 'Khoá API của trợ lý không được phép dùng mô hình này. Vui lòng báo quản trị viên.';
/** Đứt giữa chừng: `text` là phần chữ dở, `error` là câu lỗi. */
const PARTIAL_TEXT = 'Tháng 9 anh có';
const PARTIAL_ERROR = 'Kết nối tới dịch vụ AI bị ngắt giữa chừng. Bạn thử lại giúp mình nhé.';

const HISTORY: AgentConversationMessage[] = [
	{ id: 1, role: 'user', text: 'Tôi còn mấy ngày phép?', createdAt: 'x' },
	{ id: 2, role: 'assistant', text: FAIL_403, error: FAIL_403, createdAt: 'x' },
	{ id: 3, role: 'user', text: 'Bảng công tháng 9 của tôi?', createdAt: 'x' },
	{ id: 4, role: 'assistant', text: PARTIAL_TEXT, error: PARTIAL_ERROR, createdAt: 'x' },
	{ id: 5, role: 'user', text: 'Tôi còn mấy ngày phép?', createdAt: 'x' },
	{ id: 6, role: 'assistant', text: 'Bạn còn 12 ngày phép năm.', createdAt: 'x' },
];

// ═════════════════════════════════════════════════════════════════════════════
// 1. useAgentChat.openConversation
// ═════════════════════════════════════════════════════════════════════════════

describe('useAgentChat — mở lại hội thoại có lượt hỏng', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('TC01: lượt có `error` được đánh dấu lỗi để vẽ bong bóng đỏ', async () => {
		mockFetch.mockResolvedValue(HISTORY);
		const { messages, openConversation } = useAgentChat();
		await openConversation(1);

		expect(messages.value).toHaveLength(6);
		expect(messages.value[1]!.error).toBe(true);
		expect(messages.value[1]!.text).toBe(FAIL_403);
	});

	it('TC02: đứt giữa chừng thì bong bóng hiện CÂU LỖI, không phải chữ dở', async () => {
		// Giống hệt nhánh `ev.type === 'error'` lúc đang chat: câu lỗi thay cả phần chữ dở, nên
		// cùng một lượt trông y nhau trước và sau khi F5.
		mockFetch.mockResolvedValue(HISTORY);
		const { messages, openConversation } = useAgentChat();
		await openConversation(1);

		expect(messages.value[3]!.error).toBe(true);
		expect(messages.value[3]!.text).toBe(PARTIAL_ERROR);
		expect(messages.value[3]!.text).not.toContain(PARTIAL_TEXT);
	});

	it('TC03: lượt trả lời trọn vẹn không bị gắn cờ lỗi', async () => {
		mockFetch.mockResolvedValue(HISTORY);
		const { messages, openConversation } = useAgentChat();
		await openConversation(1);

		expect(messages.value[5]!.error).toBeUndefined();
		expect(messages.value[5]!.text).toBe('Bạn còn 12 ngày phép năm.');
	});

	it('TC04 [EDGE]: tin nhắn cũ không có trường `error` → không gắn cờ thừa', async () => {
		// BE cũ và mọi lượt trước 19/11/2026 đều không có trường này.
		mockFetch.mockResolvedValue([
			{ id: 9, role: 'assistant', text: 'Bạn còn 12 ngày phép năm.', createdAt: 'x' },
		] satisfies AgentConversationMessage[]);
		const { messages, openConversation } = useAgentChat();
		await openConversation(2);

		expect(messages.value[0]!.error).toBeUndefined();
		expect('error' in messages.value[0]!).toBe(false);
	});

	it('TC05 [EDGE]: `error` rỗng thì coi như không có lỗi, không nuốt mất câu trả lời', async () => {
		mockFetch.mockResolvedValue([
			{ id: 9, role: 'assistant', text: 'Bạn còn 12 ngày phép năm.', error: '', createdAt: 'x' },
		] satisfies AgentConversationMessage[]);
		const { messages, openConversation } = useAgentChat();
		await openConversation(3);

		expect(messages.value[0]!.error).toBeUndefined();
		expect(messages.value[0]!.text).toBe('Bạn còn 12 ngày phép năm.');
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. AgentMessageBubble — tin lỗi nạp lại không có nút bấm nào ghi dữ liệu
// ═════════════════════════════════════════════════════════════════════════════

function bubble(message: Partial<AgentChatMessage>) {
	return mount(AgentMessageBubble, {
		props: {
			message: { id: 'h-2', role: 'assistant', text: FAIL_403, messageId: 2, ...message } as AgentChatMessage,
		},
		// `AgentFeedbackBar` để NGUYÊN, không stub: chính nó quyết định có hiện thanh chấm điểm hay
		// không, stub đi thì bài kiểm chỉ còn kiểm cái stub.
		global: { stubs: { Icon: true } },
	});
}

/** Nút sao chép nhận ra qua `title`, component không gắn `data-testid` cho nó. */
const copyButton = (w: ReturnType<typeof bubble>) =>
	w.findAll('button').filter((b) => (b.attributes('title') ?? '').includes('Sao chép'));

describe('AgentMessageBubble — bong bóng lỗi nạp lại', () => {
	it('TC06: bong bóng lỗi hiện đúng câu lỗi', () => {
		expect(bubble({ error: true }).text()).toContain(FAIL_403);
	});

	it('TC07: tin lỗi không có nút sao chép', () => {
		// Sao chép một câu báo lỗi thì chẳng để làm gì, mà nút "Sao chép câu trả lời" ngay dưới
		// câu lỗi khiến người dùng tưởng vẫn có câu trả lời để mang đi dùng.
		expect(copyButton(bubble({ error: true }))).toHaveLength(0);
		// Lượt bình thường thì vẫn còn nút, để bài kiểm trên không xanh chỉ vì tìm sai chỗ.
		expect(copyButton(bubble({ text: 'Bạn còn 12 ngày phép năm.' }))).toHaveLength(1);
	});

	it('TC08: tin lỗi nạp lại không có thanh chấm điểm', () => {
		// `AgentFeedbackBar` chỉ hiện khi có `feedbackPrompt` hoặc `feedback`; tin lỗi nạp lại
		// không mang hai thứ đó.
		const w = bubble({ error: true });
		expect(w.find('[data-testid="agent-feedback-bar"]').exists()).toBe(false);

		const rated = bubble({
			text: 'Bạn còn 12 ngày phép năm.',
			feedback: { rating: 'good', ratingLabel: 'Hữu ích', comment: null, playbookId: null },
		} as Partial<AgentChatMessage>);
		expect(rated.find('[data-testid="agent-feedback-bar"]').exists()).toBe(true);
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. AgentConversationTranscript — màn ADMIN xem hội thoại của nhân viên
// ═════════════════════════════════════════════════════════════════════════════

function transcript(messages: Transcript['messages']) {
	return mount(AgentConversationTranscript, {
		props: {
			conversationId: 1,
			fetch: async () => ({
				conversation: {
					id: 1,
					employeeId: 7,
					fullName: 'Nguyễn Văn A',
					employeeCode: 'NV001',
					department: 'Kinh doanh',
					title: 'Hỏi phép',
					createdAt: 'x',
					lastMessageAt: 'x',
				},
				messages,
			}) as unknown as Promise<Transcript>,
		},
		global: { stubs: { Icon: true, teleport: true, AgentChartBlock: true, AgentTableBlock: true } },
	});
}

/** Component tải dữ liệu trong `onMounted`, nên chờ promise đó xong rồi mới đọc DOM. */
async function mountedWith(messages: Transcript['messages']) {
	const w = transcript(messages);
	await flushPromises();
	return w;
}

const reviewMsg = (over: Record<string, unknown>) => ({
	id: 2,
	role: 'assistant',
	text: FAIL_403,
	feedback: null,
	createdAt: '2026-11-19T03:27:26.000Z',
	...over,
}) as unknown as Transcript['messages'][number];

describe('AgentConversationTranscript — lượt hỏng', () => {
	it('TC09: lượt hỏng có khung lỗi đỏ mang đúng câu lỗi', async () => {
		const w = await mountedWith([reviewMsg({ error: FAIL_403 })]);
		const box = w.find('[data-testid="agent-transcript-error"]');

		expect(box.exists()).toBe(true);
		expect(box.text()).toBe(FAIL_403);
	});

	it('TC10: hỏng trước khi sinh chữ thì KHÔNG lặp câu — chỉ một lần trên màn hình', async () => {
		const w = await mountedWith([reviewMsg({ error: FAIL_403 })]);
		const html = w.html();

		expect(html.split(FAIL_403).length - 1).toBe(1);
	});

	it('TC11: đứt giữa chừng thì có cả chữ dở lẫn khung lỗi, chữ dở ở trên', async () => {
		const w = await mountedWith([reviewMsg({ text: PARTIAL_TEXT, error: PARTIAL_ERROR })]);
		const html = w.html();

		expect(w.find('[data-testid="agent-transcript-error"]').text()).toBe(PARTIAL_ERROR);
		expect(html).toContain(PARTIAL_TEXT);
		expect(html.indexOf(PARTIAL_TEXT)).toBeLessThan(html.indexOf('agent-transcript-error'));
	});

	it('TC12: lượt trả lời trọn vẹn không có khung lỗi', async () => {
		const w = await mountedWith([reviewMsg({ text: 'Bạn còn 12 ngày phép năm.', error: undefined })]);

		expect(w.find('[data-testid="agent-transcript-error"]').exists()).toBe(false);
		expect(w.text()).toContain('Bạn còn 12 ngày phép năm.');
	});
});
