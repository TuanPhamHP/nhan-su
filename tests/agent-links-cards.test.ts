/**
 * ============================================================
 * Test suite: trợ lý AI trên web sau thử nghiệm người dùng (UI-21)
 * ============================================================
 *
 * Vì sao cần: người thử trên điện thoại gặp ba chỗ khó. Nhãn "máy đoán" khó hiểu và giải thích chỉ
 * nằm trong `title` (điện thoại không rê chuột được). Đường dẫn trong thẻ xác nhận, cảnh báo, tin hệ
 * thống là chữ thô không bấm được. Bảng nhiều cột trong câu trả lời bị cắt ở màn 390 px.
 *
 * Cấu trúc:
 *   1. splitInternalPaths, renderAgentMarkdown — đường dẫn sau dấu hai chấm; nhãn cột cho dạng thẻ
 *   2. AgentLinkedText    — chữ của server thành chữ và link, link qua đúng luật an toàn
 *   3. AgentActionForm    — nhãn "Trợ lý điền sẵn" bấm mở giải thích; link ở cảnh báo, dữ liệu, kết quả
 *   4. AgentTableBlock    — dạng thẻ khi khung hẹp, đủ dòng, đúng thứ tự, đúng chữ
 *   5. AgentMessageBubble — tin hệ thống có link, bấm thì đi bằng router
 *
 * Ký hiệu: [SEC] chặn chuỗi nguy hiểm · [EDGE] trường hợp biên
 * ============================================================
 */

import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, getCurrentInstance, h, onBeforeUnmount, onMounted } from 'vue';

Object.assign(globalThis, {
	onMounted: (fn: () => void) => (getCurrentInstance() ? onMounted(fn) : undefined),
	onBeforeUnmount: (fn: () => void) => (getCurrentInstance() ? onBeforeUnmount(fn) : undefined),
	useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
});

import AgentActionForm from '~/components/modules/agent/AgentActionForm.vue';
import AgentLinkedText from '~/components/modules/agent/AgentLinkedText.vue';
import AgentMessageBubble from '~/components/modules/agent/AgentMessageBubble.vue';
import AgentTableBlock from '~/components/modules/agent/AgentTableBlock.vue';
import type { AgentChatMessage, AgentPendingAction, AgentTable } from '~/types/agent.types';
import { renderAgentMarkdown, splitInternalPaths } from '~/utils/agent-markdown';

const STUBS = {
	global: {
		stubs: {
			Icon: defineComponent({ render: () => h('i') }),
			UiDatePicker: defineComponent({ render: () => h('input') }),
		},
	},
};

const linksOf = (text: string): string[] =>
	splitInternalPaths(text)
		.filter((s) => s.type === 'link')
		.map((s) => s.value);

// ═════════════════════════════════════════════════════════════════════════════
// 1. Bộ nhận đường dẫn, bảng markdown
// ═════════════════════════════════════════════════════════════════════════════

describe('Đường dẫn đứng sau dấu hai chấm', () => {
	it('TC01: "Mở trên web:/cong-viec?task=CV-9" không có khoảng trắng vẫn thành link', () => {
		const text = 'Đã giao việc CV-9. Mở trên web:/cong-viec?task=CV-9';
		expect(linksOf(text)).toEqual(['/cong-viec?task=CV-9']);
		expect(
			splitInternalPaths(text)
				.map((s) => s.value)
				.join(''),
		).toBe(text);
	});

	it('TC02: dấu hai chấm toàn khổ "：" cũng nhận', () => {
		expect(linksOf('Phiếu：/kpi?reviewId=4')).toEqual(['/kpi?reviewId=4']);
	});

	it('TC03 [SEC]: http://, https://, javascript: sau dấu hai chấm vẫn là chữ', () => {
		expect(linksOf('Xem http://evil.example/cong-viec hoặc https://evil.example/kpi')).toEqual([]);
		expect(linksOf('Bấm javascript:/cong-viec')).toEqual(['/cong-viec']);
		expect(linksOf('Bấm javascript://%0aalert(1)')).toEqual([]);
	});

	it('TC04 [EDGE]: giờ "08:17/17:35" không thành link', () => {
		expect(linksOf('Giờ vào ra 08:17/17:35')).toEqual([]);
	});
});

describe('Bảng markdown có nhãn cột cho dạng thẻ', () => {
	const md = ['| Số hiệu | Tiêu đề | Hạn |', '|---|---|---|', '| CV-3 | Soát tờ khai | 28/11/2026 |'].join('\n');

	it('TC05: mỗi ô mang data-label đúng tên cột, bảng từ ba cột có lớp dạng thẻ', () => {
		const html = renderAgentMarkdown(md, { links: true });
		expect(html).toContain('class="agent-table agent-table--cards"');
		expect(html).toContain('<td data-label="Số hiệu">CV-3</td>');
		expect(html).toContain('<td data-label="Tiêu đề">Soát tờ khai</td>');
		expect(html).toContain('<td data-label="Hạn">28/11/2026</td>');
	});

	it('TC06: bảng hai cột giữ dạng bảng', () => {
		const html = renderAgentMarkdown('| Việc | Mở |\n|---|---|\n| HQ-2 | x |');
		expect(html).toContain('class="agent-table"');
		expect(html).not.toContain('agent-table--cards');
	});

	it('TC07 [SEC]: tên cột có nháy, dấu < vẫn đã escape trong data-label, bỏ dấu đậm', () => {
		const html = renderAgentMarkdown('| **A"x** | <b>B</b> | C |\n|---|---|---|\n| 1 | 2 | 3 |');
		expect(html).toContain('data-label="A&quot;x"');
		expect(html).toContain('data-label="&lt;b&gt;B&lt;/b&gt;"');
		expect(html).not.toContain('<b>');
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. AgentLinkedText
// ═════════════════════════════════════════════════════════════════════════════

describe('AgentLinkedText', () => {
	it('TC08: đường dẫn an toàn thành link có data-agent-link, chữ còn lại giữ nguyên', () => {
		// Bọc trong <p> để đọc textContent nguyên văn: `text()` của test-utils cắt khoảng trắng hai đầu
		// từng nút chữ khi gốc là fragment.
		const Host = defineComponent({
			render: () => h('p', [h(AgentLinkedText, { text: 'Mở trên web: /cong-viec?task=CV-9.' })]),
		});
		const w = mount(Host);
		const a = w.find('a');
		expect(a.attributes('href')).toBe('/cong-viec?task=CV-9');
		expect(a.attributes('data-agent-link')).toBe('');
		expect(w.element.textContent).toBe('Mở trên web: /cong-viec?task=CV-9.');
	});

	it('TC09 [SEC]: //host, javascript:, chữ có nháy không sinh thẻ a', () => {
		const w = mount(AgentLinkedText, {
			props: { text: "Thử //evil.example/x, javascript:alert(1), /cong-viec?task=HQ-2'onclick=x" },
		});
		expect(w.findAll('a')).toHaveLength(0);
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. AgentActionForm
// ═════════════════════════════════════════════════════════════════════════════

function pending(over: Partial<AgentPendingAction> = {}): AgentPendingAction {
	return {
		pendingActionId: 7,
		state: 'idle',
		form: {
			title: 'Giao việc',
			confirmLevel: 'L1_CREATE',
			fields: [
				{ name: 'title', label: 'Tiêu đề', type: 'text', required: true, value: 'Soát tờ khai', source: 'llm' },
				{ name: 'note', label: 'Ghi chú', type: 'text', required: false, value: '', source: 'system' },
			],
			context: [{ label: 'Việc liên quan', value: 'Xem ở /cong-viec?task=HQ-1' }],
			warnings: ['Hạn HQ-1 muộn hơn hạn việc này, xem:/cong-viec?task=HQ-1'],
			submitLabel: 'Giao việc',
		},
		...over,
	} as AgentPendingAction;
}

describe('AgentActionForm', () => {
	it('TC10: ô trợ lý điền ghi "Trợ lý điền sẵn", không còn chữ "máy đoán"', () => {
		const w = mount(AgentActionForm, { props: { pending: pending() }, ...STUBS });
		const badges = w.findAll('[data-testid="agent-llm-badge"]');
		expect(badges).toHaveLength(1);
		expect(badges[0]!.text()).toContain('Trợ lý điền sẵn');
		expect(w.text()).not.toContain('máy đoán');
	});

	it('TC11: bấm nhãn thì hiện câu giải thích, bấm lần nữa thì ẩn (điện thoại không có title)', async () => {
		const w = mount(AgentActionForm, { props: { pending: pending() }, ...STUBS });
		const badge = w.find('[data-testid="agent-llm-badge"]');
		expect(badge.element.tagName).toBe('BUTTON');
		expect(badge.attributes('type')).toBe('button');
		expect(w.find('[data-testid="agent-llm-hint"]').exists()).toBe(false);
		await badge.trigger('click');
		expect(badge.attributes('aria-expanded')).toBe('true');
		expect(w.find('[data-testid="agent-llm-hint"]').text()).toContain('Trợ lý điền ô này từ câu bạn nhắn');
		await badge.trigger('click');
		expect(w.find('[data-testid="agent-llm-hint"]').exists()).toBe(false);
	});

	it('TC12: bấm nhãn không gửi form', async () => {
		const w = mount(AgentActionForm, { props: { pending: pending() }, ...STUBS });
		await w.find('[data-testid="agent-llm-badge"]').trigger('click');
		expect(w.emitted('confirm')).toBeUndefined();
	});

	it('TC13: đường dẫn trong cảnh báo (sau dấu hai chấm) và dòng dữ liệu thành link', () => {
		const w = mount(AgentActionForm, { props: { pending: pending() }, ...STUBS });
		const hrefs = w.findAll('a[data-agent-link]').map((a) => a.attributes('href'));
		expect(hrefs).toEqual(['/cong-viec?task=HQ-1', '/cong-viec?task=HQ-1']);
	});

	it('TC14: câu báo đã xong và câu lỗi có link', () => {
		const done = mount(AgentActionForm, {
			props: { pending: pending({ state: 'done', message: 'Đã giao CV-9. Mở trên web: /cong-viec?task=CV-9' }) },
			...STUBS,
		});
		expect(done.find('a[data-agent-link]').attributes('href')).toBe('/cong-viec?task=CV-9');
		const failed = mount(AgentActionForm, {
			props: { pending: pending({ state: 'failed', message: 'Việc đã đổi, xem lại ở /cong-viec?task=CV-9' }) },
			...STUBS,
		});
		expect(failed.find('a[data-agent-link]').attributes('href')).toBe('/cong-viec?task=CV-9');
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. AgentTableBlock dạng thẻ
// ═════════════════════════════════════════════════════════════════════════════

const TASKS: AgentTable = {
	title: 'Việc đang mở',
	columns: [
		{ key: 'code', label: 'Số hiệu' },
		{ key: 'title', label: 'Tiêu đề' },
		{ key: 'due', label: 'Hạn' },
		{ key: 'points', label: 'Điểm', align: 'number' },
		{ key: 'open', label: 'Mở' },
	],
	rows: [
		{ code: 'CV-9', title: 'Soát tờ khai', due: '28/11/2026', points: '3', open: '/cong-viec?task=CV-9' },
		{ code: 'CV-3', title: 'Nộp chứng từ', due: '—', points: '', open: '/cong-viec?task=CV-3' },
	],
};

describe('AgentTableBlock — dạng thẻ', () => {
	it('TC15: không bật cards thì vẫn là bảng như trước', () => {
		const w = mount(AgentTableBlock, { props: { table: TASKS } });
		expect(w.find('table').exists()).toBe(true);
		expect(w.find('[data-testid="agent-table-cards"]').exists()).toBe(false);
	});

	it('TC16: bật cards → mỗi dòng một thẻ, đủ dòng, đúng thứ tự, ô đầu làm tên thẻ', () => {
		const w = mount(AgentTableBlock, { props: { table: TASKS, cards: true, links: true } });
		expect(w.find('table').exists()).toBe(false);
		const cards = w.findAll('[data-testid="agent-table-cards"] li');
		expect(cards).toHaveLength(2);
		expect(cards.map((c) => c.find('p').text())).toEqual(['CV-9', 'CV-3']);
		expect(cards[0]!.findAll('dt').map((d) => d.text())).toEqual(['Tiêu đề', 'Hạn', 'Điểm', 'Mở']);
		expect(cards[0]!.findAll('dd').map((d) => d.text())).toEqual([
			'Soát tờ khai',
			'28/11/2026',
			'3',
			'/cong-viec?task=CV-9',
		]);
		// `—` và ô trống giữ nguyên như server gửi.
		expect(cards[1]!.findAll('dd').map((d) => d.text())).toEqual(['Nộp chứng từ', '—', '', '/cong-viec?task=CV-3']);
	});

	it('TC17: link trong thẻ vẫn qua luật an toàn', () => {
		const w = mount(AgentTableBlock, { props: { table: TASKS, cards: true, links: true } });
		expect(w.findAll('a[data-agent-link]').map((a) => a.attributes('href'))).toEqual([
			'/cong-viec?task=CV-9',
			'/cong-viec?task=CV-3',
		]);
		const evil: AgentTable = { ...TASKS, rows: [{ ...TASKS.rows[0]!, open: '//evil.example/x' }] };
		expect(mount(AgentTableBlock, { props: { table: evil, cards: true, links: true } }).findAll('a')).toHaveLength(0);
	});

	it('TC18 [EDGE]: bảng hai cột giữ dạng bảng kể cả khi bật cards', () => {
		const two: AgentTable = {
			title: 'Hai cột',
			columns: [
				{ key: 'a', label: 'Ngày' },
				{ key: 'b', label: 'Ghi nhận' },
			],
			rows: [{ a: '03/09/2026', b: 'Muộn 17 phút' }],
		};
		const w = mount(AgentTableBlock, { props: { table: two, cards: true } });
		expect(w.find('table').exists()).toBe(true);
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. AgentMessageBubble — tin hệ thống
// ═════════════════════════════════════════════════════════════════════════════

describe('AgentMessageBubble — tin hệ thống có đường dẫn', () => {
	const systemMsg: AgentChatMessage = {
		id: 's-1',
		role: 'system',
		text: 'Đã giao việc CV-9 cho Lê Thị Lan. Mở trên web: /cong-viec?task=CV-9',
	};

	it('TC19: đường dẫn trong tin hệ thống thành link', () => {
		const w = mount(AgentMessageBubble, { props: { message: systemMsg }, ...STUBS });
		expect(w.find('a[data-agent-link]').attributes('href')).toBe('/cong-viec?task=CV-9');
		expect(w.text()).toContain('Đã giao việc CV-9 cho Lê Thị Lan.');
	});

	it('TC20: bấm link thì phát navigate và đi bằng router, không tải lại trang', async () => {
		const nav = globalThis.navigateTo as unknown as ReturnType<typeof vi.fn>;
		nav.mockClear();
		const w = mount(AgentMessageBubble, { props: { message: systemMsg }, ...STUBS });
		await w.find('a[data-agent-link]').trigger('click', { button: 0 });
		expect(w.emitted('navigate')?.[0]).toEqual(['/cong-viec?task=CV-9']);
		expect(nav).toHaveBeenCalledWith('/cong-viec?task=CV-9');
	});

	it('TC21: link trong thẻ xác nhận cũng được bubble bắt và đi bằng router', async () => {
		const w = mount(AgentMessageBubble, {
			props: {
				message: {
					id: 'a-2',
					role: 'assistant',
					text: '',
					pending: pending({ state: 'done', message: 'Đã giao. Mở trên web:/cong-viec?task=CV-9' }),
				},
			},
			...STUBS,
		});
		await w.find('a[data-agent-link]').trigger('click', { button: 0 });
		expect(w.emitted('navigate')?.[0]).toEqual(['/cong-viec?task=CV-9']);
	});
});
