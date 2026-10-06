/**
 * ============================================================
 * Test suite: block `table` của trợ lý AI
 * ============================================================
 *
 * Vì sao cần: bảng là thứ server dựng sẵn từng ô, FE chỉ được vẽ lại y nguyên. Mọi lỗi
 * ở đây đều là lỗi "trông rất thật mà sai": thiếu dòng, đổi chữ trong ô, sắp xếp lại,
 * hay bỏ qua hẳn event `table` — người đọc không có cách nào biết.
 *
 * Cấu trúc:
 *   1. AgentTableBlock       — render từng ô đúng chuỗi server gửi
 *   2. AgentMessageBubble    — gắn bảng vào đúng chỗ, không có bảng thì không có khung
 *   3. useAgentChat          — gom event SSE `table`, và nạp lại bảng từ hội thoại cũ
 *
 * Ký hiệu: [EDGE] trường hợp biên · [ERR] luồng lỗi
 * ============================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { onScopeDispose, defineComponent, h } from 'vue';

// `useAgentChat` gọi `onScopeDispose` qua auto-import của Nuxt — tests/setup.ts chưa khai.
Object.assign(globalThis, {
	onScopeDispose,
	onMounted: vi.fn(),
	onBeforeUnmount: vi.fn(),
	useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
});

const mockFetch = vi.hoisted(() => vi.fn());
const mockChatStream = vi.hoisted(() => vi.fn());

vi.mock('~/services/http/auth.fetch', () => ({
	useAuthFetch: () => mockFetch,
	setOnForceLogout: vi.fn(),
}));

import AgentTableBlock from '~/components/modules/agent/AgentTableBlock.vue';
import AgentMessageBubble from '~/components/modules/agent/AgentMessageBubble.vue';
import type {
	AgentChatMessage,
	AgentConversationMessage,
	AgentStreamEvent,
	AgentTable,
} from '~/types/agent.types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** Đúng shape trong docs/backend/bridges/ai-agent.md — mục "`table` — bảng chi tiết". */
const IRREGULAR_TABLE: AgentTable = {
	title: 'Ngày cần lưu ý — tháng 9/2026',
	columns: [
		{ key: 'date', label: 'Ngày' },
		{ key: 'status', label: 'Trạng thái' },
		{ key: 'checkIn', label: 'Giờ vào' },
		{ key: 'checkOut', label: 'Giờ ra' },
		{ key: 'issue', label: 'Ghi nhận' },
	],
	rows: [
		{
			date: '03/09/2026 (T5)',
			status: 'Đi muộn',
			checkIn: '08:17',
			checkOut: '17:35',
			issue: 'Muộn 17 phút',
		},
		{
			date: '11/09/2026 (T6)',
			status: 'Có mặt',
			checkIn: '08:05',
			checkOut: '—',
			issue: 'Thiếu giờ ra',
		},
	],
	source: '7 ngày có phát sinh',
};

/** Bảng dài như một tháng thật — dùng để chắc chắn KHÔNG dòng nào bị cắt. */
function longTable(rowCount: number): AgentTable {
	return {
		title: `Ngày cần lưu ý — ${rowCount} dòng`,
		columns: IRREGULAR_TABLE.columns,
		rows: Array.from({ length: rowCount }, (_, i) => ({
			date: `${String(i + 1).padStart(2, '0')}/09/2026`,
			status: 'Đi muộn',
			checkIn: '08:1' + (i % 10),
			checkOut: '17:35',
			issue: `Muộn ${i + 1} phút`,
		})),
	};
}

function assistantMessage(over: Partial<AgentChatMessage> = {}): AgentChatMessage {
	return { id: 'a-1', role: 'assistant', text: 'Tháng 9 bạn có 7 ngày cần lưu ý.', ...over };
}

/** Icon là auto-import của Nuxt — trong vitest phải stub, nếu không Vue báo thiếu component. */
const BUBBLE_MOUNT = {
	global: { stubs: { Icon: defineComponent({ render: () => h('i') }) } },
};

// ═════════════════════════════════════════════════════════════════════════════
// 1. AgentTableBlock — vẽ đúng những gì server gửi
// ═════════════════════════════════════════════════════════════════════════════

describe('AgentTableBlock', () => {
	it('TC01: hiện tiêu đề và dòng nguồn do server gửi', () => {
		const w = mount(AgentTableBlock, { props: { table: IRREGULAR_TABLE } });
		expect(w.text()).toContain('Ngày cần lưu ý — tháng 9/2026');
		expect(w.text()).toContain('7 ngày có phát sinh');
	});

	it('TC02: đủ 5 cột, nhãn đúng thứ tự server gửi', () => {
		const w = mount(AgentTableBlock, { props: { table: IRREGULAR_TABLE } });
		const th = w.findAll('th').map((h) => h.text());
		expect(th).toEqual(['Ngày', 'Trạng thái', 'Giờ vào', 'Giờ ra', 'Ghi nhận']);
	});

	it('TC03: mỗi ô là ĐÚNG chuỗi server gửi — không format lại', () => {
		const w = mount(AgentTableBlock, { props: { table: IRREGULAR_TABLE } });
		const cells = w.findAll('tbody tr').map((tr) => tr.findAll('td').map((td) => td.text()));
		expect(cells).toEqual([
			['03/09/2026 (T5)', 'Đi muộn', '08:17', '17:35', 'Muộn 17 phút'],
			['11/09/2026 (T6)', 'Có mặt', '08:05', '—', 'Thiếu giờ ra'],
		]);
	});

	it('TC04: ô trống `—` giữ nguyên, KHÔNG đổi sang chữ khác', () => {
		const w = mount(AgentTableBlock, { props: { table: IRREGULAR_TABLE } });
		expect(w.text()).toContain('—');
		expect(w.text()).not.toContain('Không có');
		expect(w.text()).not.toContain('N/A');
	});

	it('TC05: thứ tự dòng y như server gửi — KHÔNG sắp xếp lại', () => {
		const reversed: AgentTable = {
			...IRREGULAR_TABLE,
			// Ngày GIẢM dần: nếu FE tự sort tăng dần thì test này đỏ.
			rows: [...IRREGULAR_TABLE.rows].reverse(),
		};
		const w = mount(AgentTableBlock, { props: { table: reversed } });
		const firstCol = w.findAll('tbody tr').map((tr) => tr.findAll('td')[0]!.text());
		expect(firstCol).toEqual(['11/09/2026 (T6)', '03/09/2026 (T5)']);
	});

	it('TC06: 30 dòng → render ĐỦ 30, không cắt bớt', () => {
		const w = mount(AgentTableBlock, { props: { table: longTable(30) } });
		expect(w.findAll('tbody tr')).toHaveLength(30);
	});

	it('TC07: KHÔNG tự thêm dòng tổng / dòng đếm', () => {
		const w = mount(AgentTableBlock, { props: { table: longTable(30) } });
		// Đúng 30 dòng dữ liệu + 1 dòng tiêu đề, không hơn.
		expect(w.findAll('tr')).toHaveLength(31);
		expect(w.text()).not.toContain('Tổng');
	});

	it('TC08: bảng dài vẫn có khung CUỘN (max-h + overflow), không phải khung cắt', () => {
		const w = mount(AgentTableBlock, { props: { table: longTable(30) } });
		const wrap = w.find('.agent-table-wrap');
		expect(wrap.exists()).toBe(true);
		// `overflow-auto` cho cả 2 chiều: dọc cho 30 dòng, ngang cho 5 cột trên mobile.
		expect(wrap.classes()).toContain('overflow-auto');
		expect(wrap.classes().some((c) => c.startsWith('max-h-'))).toBe(true);
		// overflow-hidden ở đây đồng nghĩa với mất dòng — tuyệt đối không được có.
		expect(wrap.classes()).not.toContain('overflow-hidden');
	});

	it('TC09: cuộn ngang được — bảng rộng theo nội dung, khung bọc mới là chỗ cuộn', () => {
		const w = mount(AgentTableBlock, { props: { table: IRREGULAR_TABLE } });
		const table = w.find('table');
		// `w-max` = rộng theo nội dung (5 cột không ép vừa màn hình hẹp được),
		// `min-w-full` = bảng ngắn vẫn phủ kín khung.
		expect(table.classes()).toContain('w-max');
		expect(table.classes()).toContain('min-w-full');
		// Khung ngoài phải `min-w-0` nếu không bảng đẩy giãn cả bong bóng chat ra ngoài mép.
		expect(w.find('figure').classes()).toContain('min-w-0');
	});

	it('TC10: tiêu đề cột dính trên khi cuộn dọc (sticky)', () => {
		const w = mount(AgentTableBlock, { props: { table: longTable(30) } });
		expect(w.find('th').classes()).toContain('sticky');
	});

	it('TC11: align `number` → canh phải; mặc định → canh trái', () => {
		const table: AgentTable = {
			title: 'Có cột số',
			columns: [
				{ key: 'name', label: 'Tên' },
				{ key: 'days', label: 'Số ngày', align: 'number' },
				{ key: 'note', label: 'Ghi chú', align: 'text' },
			],
			rows: [{ name: 'Nguyễn Văn A', days: '12', note: '—' }],
		};
		const w = mount(AgentTableBlock, { props: { table } });
		const th = w.findAll('th');
		expect(th[0]!.classes()).toContain('text-left');
		expect(th[1]!.classes()).toContain('text-right');
		expect(th[2]!.classes()).toContain('text-left');
		const td = w.findAll('td');
		expect(td[0]!.classes()).toContain('text-left');
		expect(td[1]!.classes()).toContain('text-right');
		expect(td[2]!.classes()).toContain('text-left');
	});

	it('TC12 [EDGE]: cột không có khoá trong row → ô TRỐNG, không in "undefined"', () => {
		// Chỉ xảy ra khi server gửi sai contract. Không được tự điền `—` để che lỗi đó.
		const table: AgentTable = {
			title: 'Thiếu khoá',
			columns: [
				{ key: 'date', label: 'Ngày' },
				{ key: 'missing', label: 'Vắng khoá' },
			],
			rows: [{ date: '03/09/2026' }] as Record<string, string>[],
		};
		const w = mount(AgentTableBlock, { props: { table } });
		const td = w.findAll('td');
		expect(td[1]!.text()).toBe('');
		expect(w.text()).not.toContain('undefined');
	});

	it('TC13 [EDGE]: khung chart và khung table dùng cùng một hệ khung', () => {
		const w = mount(AgentTableBlock, { props: { table: IRREGULAR_TABLE } });
		// Giống AgentChartBlock: figure mt-3 w-full min-w-0 rounded-xl border bg-white p-3
		const fig = w.find('figure').classes();
		for (const c of ['mt-3', 'w-full', 'min-w-0', 'rounded-xl', 'border', 'bg-white', 'p-3']) {
			expect(fig).toContain(c);
		}
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. AgentMessageBubble — bảng gắn vào câu trả lời
// ═════════════════════════════════════════════════════════════════════════════

describe('AgentMessageBubble — message.tables', () => {
	it('TC14: có `tables` → hiện bảng dưới câu trả lời', () => {
		const w = mount(AgentMessageBubble, {
			props: { message: assistantMessage({ tables: [IRREGULAR_TABLE] }) },
			...BUBBLE_MOUNT,
		});
		expect(w.findAll('table')).toHaveLength(1);
		expect(w.text()).toContain('Ngày cần lưu ý — tháng 9/2026');
		expect(w.text()).toContain('Tháng 9 bạn có 7 ngày cần lưu ý.');
	});

	it('TC15: KHÔNG có `tables` → KHÔNG có khung bảng nào (không hiện bảng rỗng)', () => {
		const w = mount(AgentMessageBubble, {
			props: { message: assistantMessage() },
			...BUBBLE_MOUNT,
		});
		expect(w.findAll('table')).toHaveLength(0);
		expect(w.findAll('.agent-table-wrap')).toHaveLength(0);
	});

	it('TC16 [EDGE]: `tables: []` → vẫn KHÔNG có khung bảng', () => {
		const w = mount(AgentMessageBubble, {
			props: { message: assistantMessage({ tables: [] }) },
			...BUBBLE_MOUNT,
		});
		expect(w.findAll('table')).toHaveLength(0);
	});

	it('TC17: nhiều bảng trong một lượt → hiện đủ, đúng thứ tự', () => {
		const second: AgentTable = { ...IRREGULAR_TABLE, title: 'Bảng thứ hai' };
		const w = mount(AgentMessageBubble, {
			props: { message: assistantMessage({ tables: [IRREGULAR_TABLE, second] }) },
			...BUBBLE_MOUNT,
		});
		const titles = w.findAll('figure figcaption p:first-child').map((p) => p.text());
		expect(titles).toEqual(['Ngày cần lưu ý — tháng 9/2026', 'Bảng thứ hai']);
	});

	it('TC18: bảng đứng TRƯỚC form xác nhận — dữ liệu đọc trước, việc phải làm sau', () => {
		const w = mount(AgentMessageBubble, {
			props: {
				message: assistantMessage({
					tables: [IRREGULAR_TABLE],
					pending: {
						pendingActionId: 9,
						state: 'idle',
						form: {
							title: 'Xác nhận đơn',
							confirmLevel: 'L1_CREATE',
							fields: [],
							context: [],
							warnings: [],
							submitLabel: 'Gửi',
						},
					},
				}),
			},
			...BUBBLE_MOUNT,
		});
		const html = w.html();
		expect(html.indexOf('Ngày cần lưu ý')).toBeGreaterThan(-1);
		expect(html.indexOf('Xác nhận đơn')).toBeGreaterThan(-1);
		expect(html.indexOf('Ngày cần lưu ý')).toBeLessThan(html.indexOf('Xác nhận đơn'));
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. useAgentChat — gom event SSE và nạp lại từ hội thoại cũ
// ═════════════════════════════════════════════════════════════════════════════

vi.mock('~/services/agent.service', () => ({
	useAgentService: () => ({
		chatStream: mockChatStream,
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

import { useAgentChat } from '~/composables/useAgentChat';

/** Phát lại một chuỗi event SSE y như server gửi. */
function stream(events: AgentStreamEvent[]) {
	return async function* () {
		for (const e of events) yield e;
	};
}

describe('useAgentChat — event `table`', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockChatStream.mockReset();
	});

	it('TC19: event `table` được gom vào message.tables, KHÔNG chèn vào text', async () => {
		mockChatStream.mockImplementation(
			stream([
				{ type: 'delta', text: 'Tháng 9 bạn có 7 ngày cần lưu ý.' },
				{ type: 'table', table: IRREGULAR_TABLE, tool: 'attendance_listMyIrregularDays' },
			]),
		);
		const { messages, send } = useAgentChat();
		await send('tháng trước tôi đi muộn những ngày nào');

		const reply = messages.value.at(-1)!;
		expect(reply.tables).toHaveLength(1);
		expect(reply.tables![0]!.title).toBe('Ngày cần lưu ý — tháng 9/2026');
		// Bảng đi kênh riêng — không được lẫn vào luồng chữ.
		expect(reply.text).toBe('Tháng 9 bạn có 7 ngày cần lưu ý.');
	});

	it('TC20: lượt không có event `table` → message.tables vẫn undefined', async () => {
		mockChatStream.mockImplementation(stream([{ type: 'delta', text: 'Tháng 9 không có ngày nào.' }]));
		const { messages, send } = useAgentChat();
		await send('tháng 9 tôi đi muộn ngày nào');
		expect(messages.value.at(-1)!.tables).toBeUndefined();
	});

	it('TC21: một lượt có CẢ chart và table → gom vào hai mảng riêng', async () => {
		mockChatStream.mockImplementation(
			stream([
				{ type: 'delta', text: 'Đây là số liệu tháng 9.' },
				{
					type: 'chart',
					tool: 'report_getAttendance',
					chart: {
						type: 'bar',
						title: 'Đi muộn theo nhân viên',
						labels: ['A'],
						series: [{ name: 'Đi muộn', data: [2] }],
					},
				},
				{ type: 'table', table: IRREGULAR_TABLE, tool: 'attendance_listMyIrregularDays' },
			]),
		);
		const { messages, send } = useAgentChat();
		await send('thống kê tháng 9');
		const reply = messages.value.at(-1)!;
		expect(reply.charts).toHaveLength(1);
		expect(reply.tables).toHaveLength(1);
	});

	it('TC22: nhiều event `table` trong một lượt → giữ đủ, đúng thứ tự', async () => {
		mockChatStream.mockImplementation(
			stream([
				{ type: 'table', table: IRREGULAR_TABLE, tool: 't1' },
				{ type: 'table', table: { ...IRREGULAR_TABLE, title: 'Bảng 2' }, tool: 't2' },
			]),
		);
		const { messages, send } = useAgentChat();
		await send('hỏi gì đó');
		expect(messages.value.at(-1)!.tables?.map((t) => t.title)).toEqual([
			'Ngày cần lưu ý — tháng 9/2026',
			'Bảng 2',
		]);
	});

	it('TC23: mở lại hội thoại cũ — bảng đã lưu được nạp lại từ message', async () => {
		const rows: AgentConversationMessage[] = [
			{ id: 1, role: 'user', text: 'tháng trước tôi đi muộn ngày nào', createdAt: 'x' },
			{
				id: 2,
				role: 'assistant',
				text: 'Tháng 9 bạn có 7 ngày cần lưu ý.',
				tables: [IRREGULAR_TABLE],
				createdAt: 'x',
			},
		];
		mockFetch.mockResolvedValue(rows);
		const { messages, openConversation } = useAgentChat();
		await openConversation(12);
		expect(messages.value).toHaveLength(2);
		expect(messages.value[1]!.tables?.[0]?.rows).toHaveLength(2);
	});

	it('TC24 [EDGE]: tin nhắn cũ KHÔNG có trường `tables` → không gắn mảng rỗng', async () => {
		mockFetch.mockResolvedValue([
			{ id: 2, role: 'assistant', text: 'Câu trả lời cũ', createdAt: 'x' },
		] as AgentConversationMessage[]);
		const { messages, openConversation } = useAgentChat();
		await openConversation(12);
		expect(messages.value[0]!.tables).toBeUndefined();
	});
});
