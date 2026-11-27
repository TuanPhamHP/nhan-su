/**
 * ============================================================
 * Test suite: trợ lý AI cho phân hệ Công việc và KPI (web)
 * ============================================================
 *
 * Vì sao cần: câu trả lời của trợ lý nay kèm đường dẫn trang trong app (`/cong-viec?task=HQ-2`,
 * `/kpi?reviewId=4`). Web biến chúng thành link mở bằng router. Câu trả lời do model viết và có
 * thể bị nhiễm từ dữ liệu người dùng qua tool, nên bộ nhận dạng đường dẫn là chỗ duy nhất đứng
 * giữa chữ của model và thuộc tính `href`: lỏng một ký tự là thành lỗ.
 *
 * Cấu trúc:
 *   1. isSafeInternalPath   — luật nhận một chuỗi làm đường dẫn
 *   2. splitInternalPaths   — tách câu thành chữ và đường dẫn, không thêm bớt chữ nào
 *   3. renderAgentMarkdown  — chỉ sinh link khi bật `links`, href luôn qua luật ở (1)
 *   4. Nhãn, gợi ý          — nhãn tool, chủ đề mới; gợi ý theo phân hệ đang bật
 *
 * Ký hiệu: [SEC] chặn chuỗi nguy hiểm · [EDGE] trường hợp biên
 * ============================================================
 */

import { describe, it, expect } from 'vitest';
import {
	isSafeInternalPath,
	renderAgentMarkdown,
	splitInternalPaths,
	type AgentTextSegment,
} from '~/utils/agent-markdown';
import {
	AGENT_SUGGESTIONS,
	AGENT_TOOL_LABELS,
	agentSuggestions,
	agentToolChipLabel,
} from '~/types/agent.types';
import { PLAYBOOK_LABELS } from '~/types/agent-analytics.types';

const links = (segs: AgentTextSegment[]): string[] =>
	segs.filter((s) => s.type === 'link').map((s) => s.value);
const joined = (segs: AgentTextSegment[]): string => segs.map((s) => s.value).join('');

// ═════════════════════════════════════════════════════════════════════════════
// 1. isSafeInternalPath
// ═════════════════════════════════════════════════════════════════════════════

describe('isSafeInternalPath', () => {
	it.each([
		'/cong-viec',
		'/cong-viec?task=HQ-2',
		'/cong-viec?task=CV-10',
		'/kpi?reviewId=12',
		'/kpi/danh-gia?reviewId=12',
		'/cong-viec/du-an',
		'/management/office/supply-periods',
		'/cong-viec/',
		'/cong-viec?task=HQ-2&view=board',
		'/cong-viec?q=vi%E1%BB%87c',
		'/cong-viec?sort=due_date',
		'/cong-viec/du-an/HQ',
		'/cong-viec/du-an/HQ2026',
		'/Cong-viec',
	])('TC01: nhận "%s"', (path) => {
		expect(isSafeInternalPath(path)).toBe(true);
	});

	it.each([
		['//evil.example/x', 'hai dấu / ở đầu (đường dẫn sang máy khác)'],
		['/\\evil.example', 'gạch chéo ngược'],
		['javascript:alert(1)', 'giao thức javascript'],
		['/cong-viec?x=javascript:alert(1)', 'dấu hai chấm trong query'],
		['http://evil.example/cong-viec', 'đường dẫn tuyệt đối'],
		['https:/cong-viec', 'tiền tố giao thức'],
		["/cong-viec?task=HQ-2'onmouseover=alert(1)", 'dấu nháy đơn'],
		['/cong-viec?task="x"', 'dấu nháy kép'],
		['/cong-viec?task=<script>', 'dấu <'],
		['/cong-viec ?task=HQ-2', 'khoảng trắng'],
		['/cong-viec\n?task=HQ-2', 'xuống dòng'],
		['/cong-viec#x', 'dấu #'],
		['/../admin', 'đường dẫn đi lùi'],
		['/\\evil', 'gạch chéo ngược ngay sau /'],
		['/HQ:x', 'dấu hai chấm sau chữ hoa'],
		['//HQ', 'hai dấu / rồi chữ hoa'],
		['/HQ\\x', 'gạch chéo ngược sau chữ hoa'],
		['/cong-viec/du-an/HQ.x', 'dấu chấm trong đoạn chữ hoa'],
		['/JAVASCRIPT:alert(1)', 'giao thức viết hoa sau /'],
		['/công-việc', 'chữ có dấu'],
		['/5', 'đoạn đầu là số ("4 /5")'],
		['/', 'chỉ một dấu /'],
		['', 'chuỗi rỗng'],
		['cong-viec', 'không có / ở đầu'],
		['/cong-viec?task=HQ-2&amp;x', 'dấu ; của thực thể HTML'],
		['/cong-viec?a=(1)', 'dấu ngoặc'],
	])('TC02 [SEC]: loại "%s" (%s)', (path) => {
		expect(isSafeInternalPath(path)).toBe(false);
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. splitInternalPaths
// ═════════════════════════════════════════════════════════════════════════════

describe('splitInternalPaths', () => {
	it('TC03: câu báo sau khi giao việc → đúng một link, chữ giữ nguyên', () => {
		const text =
			'Đã giao việc CV-10 "Soát tờ khai" cho Lê Thị Lan, hạn 30/11/2026. Mở trên web: /cong-viec?task=CV-10';
		const segs = splitInternalPaths(text);
		expect(links(segs)).toEqual(['/cong-viec?task=CV-10']);
		expect(joined(segs)).toBe(text);
	});

	it('TC04: dấu câu, ngoặc đóng sau đường dẫn KHÔNG thuộc link', () => {
		const segs = splitInternalPaths('Xem ở trang Việc của tôi (/cong-viec). Phiếu: /kpi?reviewId=4.');
		expect(links(segs)).toEqual(['/cong-viec', '/kpi?reviewId=4']);
		expect(joined(segs)).toBe('Xem ở trang Việc của tôi (/cong-viec). Phiếu: /kpi?reviewId=4.');
	});

	it('TC05: nhiều đường dẫn trong một câu, đứng đầu câu', () => {
		const segs = splitInternalPaths('/cong-viec?task=HQ-2 và /kpi/danh-gia?reviewId=7');
		expect(links(segs)).toEqual(['/cong-viec?task=HQ-2', '/kpi/danh-gia?reviewId=7']);
	});

	it('TC06 [EDGE]: ngày, phân số, "và/hoặc" KHÔNG thành link', () => {
		const text = 'Hạn 28/11/2026, đạt 4/5 sao, nhận và/hoặc trả, điểm 4 /5.';
		const segs = splitInternalPaths(text);
		expect(links(segs)).toEqual([]);
		expect(segs).toEqual([{ type: 'text', value: text }]);
	});

	it('TC07 [SEC]: cả cụm có ký tự lạ thì bỏ CẢ cụm, không cắt lấy phần đầu', () => {
		const text = "Bấm /cong-viec?task=HQ-2'onmouseover=alert(1) để mở";
		expect(links(splitInternalPaths(text))).toEqual([]);
	});

	it('TC08 [SEC]: javascript:, //host, http: giữ nguyên là chữ', () => {
		const text = 'Thử javascript:alert(1) hoặc //evil.example/x hoặc http://evil.example/cong-viec';
		const segs = splitInternalPaths(text);
		expect(links(segs)).toEqual([]);
		expect(joined(segs)).toBe(text);
	});

	it('TC09 [EDGE]: đường dẫn trong dấu nháy, ngoặc kép kiểu Việt, dấu đậm', () => {
		expect(links(splitInternalPaths('Mở “/cong-viec?task=HQ-2” nhé'))).toEqual(['/cong-viec?task=HQ-2']);
		expect(links(splitInternalPaths('Mở "/kpi" nhé'))).toEqual(['/kpi']);
		expect(links(splitInternalPaths('Mở **/cong-viec/bao-cao** nhé'))).toEqual(['/cong-viec/bao-cao']);
	});

	it('TC09b: mã dự án chữ hoa trên đường dẫn thành link; //HQ, /HQ:x, /\\evil vẫn là chữ', () => {
		const text = 'Dự án HQ: /cong-viec/du-an/HQ. Thử //HQ, /HQ:x và /\\evil.';
		const segs = splitInternalPaths(text);
		expect(links(segs)).toEqual(['/cong-viec/du-an/HQ']);
		expect(joined(segs)).toBe(text);
		const html = renderAgentMarkdown('Mở `/cong-viec/du-an/HQ` hoặc [dự án HQ](/cong-viec/du-an/HQ)', { links: true });
		expect(html.match(/<a href="\/cong-viec\/du-an\/HQ"/g)).toHaveLength(2);
	});

	it('TC10 [EDGE]: chuỗi rỗng → không đoạn nào', () => {
		expect(splitInternalPaths('')).toEqual([]);
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. renderAgentMarkdown
// ═════════════════════════════════════════════════════════════════════════════

describe('renderAgentMarkdown — đường dẫn nội bộ', () => {
	it('TC11: mặc định KHÔNG sinh link (màn ADMIN xem lại hội thoại giữ như cũ)', () => {
		const html = renderAgentMarkdown('Xem `/cong-viec?task=HQ-2` nhé');
		expect(html).not.toContain('<a');
		expect(html).toContain('<code class="agent-code">/cong-viec?task=HQ-2</code>');
	});

	it('TC12: bật links → đường dẫn trong `code` thành link bọc khối code', () => {
		const html = renderAgentMarkdown('Xem `/cong-viec?task=HQ-2` nhé', { links: true });
		expect(html).toBe(
			'<p>Xem <a href="/cong-viec?task=HQ-2" class="agent-link" data-agent-link=""><code class="agent-code">/cong-viec?task=HQ-2</code></a> nhé</p>',
		);
	});

	it('TC13: đường dẫn chữ thường trong đoạn văn, danh sách, bảng', () => {
		const md = [
			'Mở trên web: /cong-viec?task=CV-10.',
			'',
			'- Phiếu của tôi: /kpi?reviewId=4',
			'',
			'| Việc | Mở |',
			'|---|---|',
			'| HQ-2 | /cong-viec?task=HQ-2 |',
		].join('\n');
		const html = renderAgentMarkdown(md, { links: true });
		expect(html).toContain('<a href="/cong-viec?task=CV-10" class="agent-link" data-agent-link="">/cong-viec?task=CV-10</a>.');
		expect(html).toContain('<li>Phiếu của tôi: <a href="/kpi?reviewId=4"');
		expect(html).toContain('<td data-label="Mở"><a href="/cong-viec?task=HQ-2"');
	});

	it('TC14: query có & đi qua đúng một lần escape', () => {
		const html = renderAgentMarkdown('Xem /cong-viec?task=HQ-2&view=board', { links: true });
		expect(html).toContain('href="/cong-viec?task=HQ-2&amp;view=board"');
		expect(html).not.toContain('&amp;amp;');
	});

	it('TC15 [SEC]: chuỗi nguy hiểm vẫn là chữ đã escape, không có thẻ <a> nào', () => {
		const md = [
			'`javascript:alert(1)`',
			'//evil.example/x',
			"/cong-viec?task=HQ-2'onmouseover=alert(1)",
			'`/cong-viec?task="x"`',
			'<a href="/cong-viec">bấm</a>',
		].join('\n');
		const html = renderAgentMarkdown(md, { links: true });
		expect(html).not.toContain('<a ');
		expect(html).toContain('&lt;a href=&quot;/cong-viec&quot;&gt;');
		expect(html).toContain('&#39;onmouseover=alert(1)');
	});

	it('TC16: đậm, nghiêng, xuống dòng vẫn như trước khi bật links', () => {
		const md = '**Việc của tôi**: *3 việc*\ndòng hai `x`';
		expect(renderAgentMarkdown(md, { links: true })).toBe(renderAgentMarkdown(md));
		expect(renderAgentMarkdown(md)).toBe(
			'<p><strong>Việc của tôi</strong>: <em>3 việc</em><br>dòng hai <code class="agent-code">x</code></p>',
		);
	});

	it('TC17a: link markdown [Xem](/cong-viec?task=CV-8) → thẻ a mang chữ trong []', () => {
		const html = renderAgentMarkdown('Việc quá hạn: [Xem](/cong-viec?task=CV-8). Phiếu: [phiếu KPI](/kpi?reviewId=4)', {
			links: true,
		});
		expect(html).toBe(
			'<p>Việc quá hạn: <a href="/cong-viec?task=CV-8" class="agent-link" data-agent-link="">Xem</a>. ' +
				'Phiếu: <a href="/kpi?reviewId=4" class="agent-link" data-agent-link="">phiếu KPI</a></p>',
		);
	});

	it('TC17b: mô hình trả CẢ hai dạng trong một câu (dấu mã và link markdown)', () => {
		const html = renderAgentMarkdown('Mở `/cong-viec?task=HQ-1` hoặc [Xem](/cong-viec?task=CV-8)', { links: true });
		expect(html).toContain('<a href="/cong-viec?task=HQ-1" class="agent-link" data-agent-link=""><code class="agent-code">');
		expect(html).toContain('<a href="/cong-viec?task=CV-8" class="agent-link" data-agent-link="">Xem</a>');
		expect(html.match(/<a /g)).toHaveLength(2);
	});

	it.each([
		'[x](javascript:alert(1))',
		'[x](//evil.com)',
		'[x](http://evil.com/cong-viec)',
		'[x](https://evil.com)',
		'[x](data:text/html;base64,PHNjcmlwdD4=)',
		'[x](/cong-viec?task="x")',
		'[x](//HQ)',
		'[x](/HQ:x)',
		'[x](JAVASCRIPT:alert(1))',
	])('TC17c [SEC]: link markdown "%s" ra chữ thường, không có thẻ a', (md) => {
		const html = renderAgentMarkdown(md, { links: true });
		expect(html).not.toContain('<a');
		expect(html).not.toContain('href');
		// Chữ giữ nguyên, chỉ escape: người dùng đọc được đúng thứ model viết.
		expect(html).toBe(`<p>${md.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}</p>`);
	});

	it('TC17d: tắt links (màn ADMIN) → link markdown giữ nguyên là chữ như trước', () => {
		expect(renderAgentMarkdown('[Xem](/cong-viec?task=CV-8)')).toBe('<p>[Xem](/cong-viec?task=CV-8)</p>');
	});

	it('TC17e [EDGE]: chữ đậm trong [] vẫn đậm, link vẫn đúng', () => {
		expect(renderAgentMarkdown('[**Xem việc**](/cong-viec?task=CV-8)', { links: true })).toBe(
			'<p><a href="/cong-viec?task=CV-8" class="agent-link" data-agent-link=""><strong>Xem việc</strong></a></p>',
		);
	});

	it('TC17 [EDGE]: **`code`** vẫn đậm, đường dẫn trong đó vẫn thành link', () => {
		const html = renderAgentMarkdown('Mở **`/cong-viec`**', { links: true });
		expect(html).toBe(
			'<p>Mở <strong><a href="/cong-viec" class="agent-link" data-agent-link=""><code class="agent-code">/cong-viec</code></a></strong></p>',
		);
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. Nhãn, gợi ý
// ═════════════════════════════════════════════════════════════════════════════

describe('Nhãn tool, chủ đề và gợi ý của Công việc và KPI', () => {
	const TASK_TOOLS = [
		'task_myAgenda',
		'task_search',
		'task_getDetail',
		'task_departmentOverview',
		'task_projectOverview',
		'task_progressReport',
		'kpi_myReviews',
		'kpi_getReview',
		'kpi_toReview',
		'kpi_periodResults',
		'task_create',
		'task_transition',
		'task_changeDue',
		'kpi_giveFeedback',
	];

	it('TC18: đủ nhãn cho 14 tool, tool ghi nói "chuẩn bị" (chưa làm ngay)', () => {
		for (const t of TASK_TOOLS) expect(AGENT_TOOL_LABELS[t], t).toBeTruthy();
		for (const t of ['task_create', 'task_transition', 'task_changeDue', 'kpi_giveFeedback']) {
			expect(AGENT_TOOL_LABELS[t]).toMatch(/^Đang chuẩn bị/);
		}
	});

	it('TC19: nhãn chủ đề cho năm playbook mới và ba playbook văn phòng', () => {
		for (const id of [
			'task-my',
			'task-assign',
			'task-team',
			'kpi-my',
			'kpi-review',
			'office-room-booking',
			'office-supply-my',
			'office-overview',
		]) {
			expect(PLAYBOOK_LABELS[id], id).toBeTruthy();
		}
	});

	it('TC20: phần KPI không nhắc lương, thưởng', () => {
		const texts = [
			...Object.entries(AGENT_TOOL_LABELS)
				.filter(([k]) => k.startsWith('kpi_') || k.startsWith('task_'))
				.map(([, v]) => v),
			PLAYBOOK_LABELS['kpi-my'],
			PLAYBOOK_LABELS['kpi-review'],
		];
		for (const t of texts) expect(t!.toLowerCase()).not.toMatch(/lương|thưởng/);
	});

	it('TC21: phân hệ bật → thêm "Hôm nay tôi có việc gì?"; tắt → giữ nguyên ba gợi ý', () => {
		const on = agentSuggestions({ tasks: true });
		expect(on.map((s) => s.label)).toContain('Hôm nay tôi có việc gì?');
		expect(on.find((s) => s.label === 'Hôm nay tôi có việc gì?')?.icon).toBe('heroicons:check-circle');
		expect(on).toHaveLength(AGENT_SUGGESTIONS.length + 1);

		const off = agentSuggestions({ tasks: false });
		expect(off.map((s) => s.label)).not.toContain('Hôm nay tôi có việc gì?');
		expect(off).toEqual(AGENT_SUGGESTIONS);
	});

	it('TC22 [EDGE]: gọi nhiều lần không làm dài mảng gợi ý dùng chung', () => {
		agentSuggestions({ tasks: true });
		agentSuggestions({ tasks: true });
		expect(AGENT_SUGGESTIONS).toHaveLength(3);
	});
});

describe('Thẻ "đã tra gì" dưới câu trả lời', () => {
	it('dùng nhãn tiếng Việt, bỏ "Đang" và dấu ba chấm', () => {
		expect(agentToolChipLabel('task_myAgenda')).toBe('Tra việc của bạn');
		expect(agentToolChipLabel('task_create')).toBe('Chuẩn bị giao việc');
	});

	it('tool chưa có nhãn không bao giờ hiện tên thô', () => {
		expect(agentToolChipLabel('employee_searchDirectory')).toBe('Tra cứu dữ liệu');
		for (const tool of ['report_getLeave', 'app_findScreen', 'xyz_unknown']) {
			expect(agentToolChipLabel(tool)).not.toContain('_');
		}
	});
});
