/**
 * UI-21b (UAT 26/11/2026, phần 2): câu báo sau khi xác nhận thẻ trợ lý có link markdown `[Mở việc HQ-2](…)`, và nội
 * dung do trợ lý soạn có đuôi `⟦Trợ lý AI⟧ …` phải thay bằng nhãn "Soạn qua Trợ lý AI".
 *
 * Ký hiệu: [SEC] an toàn link, [EDGE] trường hợp biên.
 */
import { describe, expect, it } from 'vitest';
import { splitAgentLinks } from '~/utils/agent-markdown';
import { AGENT_MARK, agentTraceDetail, splitAgentMark } from '~/utils/agent-source';

const TRACE = `${AGENT_MARK} Soạn qua Trợ lý AI · Lê Thị Lan xác nhận lúc 27/11/2026 09:12`;

describe('splitAgentMark: cắt đuôi trợ lý', () => {
	it('chữ thường (lý do, phản hồi): cắt từ ký hiệu, giữ phần người dùng viết', () => {
		const r = splitAgentMark(`Hãng tàu chưa trả lệnh\n\n${TRACE}`);
		expect(r).toEqual({
			text: 'Hãng tàu chưa trả lệnh',
			viaAgent: true,
			trace: 'Soạn qua Trợ lý AI · Lê Thị Lan xác nhận lúc 27/11/2026 09:12',
		});
	});

	it('mô tả HTML: bỏ cả đoạn <p> chứa đuôi, không để lại đoạn rỗng', () => {
		const r = splitAgentMark(`<p>Rà soát tờ khai</p><p>Đối chiếu hoá đơn &amp; vận đơn</p><p>${TRACE}</p>`);
		expect(r.text).toBe('<p>Rà soát tờ khai</p><p>Đối chiếu hoá đơn &amp; vận đơn</p>');
		expect(r.viaAgent).toBe(true);
		expect(r.trace).toBe('Soạn qua Trợ lý AI · Lê Thị Lan xác nhận lúc 27/11/2026 09:12');
	});

	it('[EDGE] mô tả chỉ có đuôi: chữ rỗng, vẫn ghi là trợ lý soạn', () => {
		expect(splitAgentMark(`<p>${TRACE}</p>`)).toMatchObject({ text: '', viaAgent: true });
		expect(splitAgentMark(TRACE)).toMatchObject({ text: '', viaAgent: true });
	});

	it('[EDGE] ký hiệu giữa đoạn HTML (người dùng sửa tay): cắt từ ký hiệu, đoạn trước giữ nguyên', () => {
		const r = splitAgentMark(`<p>Dòng một</p><p>Dòng hai ${TRACE}</p>`);
		expect(r.text).toBe('<p>Dòng một</p><p>Dòng hai');
		expect(r.viaAgent).toBe(true);
	});

	it('không có ký hiệu: trả nguyên, không nhãn', () => {
		expect(splitAgentMark('<p>Việc bình thường</p>')).toEqual({ text: '<p>Việc bình thường</p>', viaAgent: false, trace: null });
		expect(splitAgentMark(null)).toEqual({ text: '', viaAgent: false, trace: null });
	});

	it('câu chi tiết dưới nhãn bỏ phần "Soạn qua Trợ lý AI ·" lặp lại', () => {
		expect(agentTraceDetail('Soạn qua Trợ lý AI · Lê Thị Lan xác nhận lúc 27/11/2026 09:12')).toBe(
			'Lê Thị Lan xác nhận lúc 27/11/2026 09:12',
		);
		expect(agentTraceDetail(null)).toBeNull();
	});
});

describe('splitAgentLinks: câu báo sau xác nhận', () => {
	it('link markdown nội bộ thành link mang đúng chữ trong ngoặc vuông', () => {
		const segs = splitAgentLinks('Đã giao việc CV-40 cho Đỗ Minh Đức. [Mở việc CV-40](/cong-viec?task=CV-40)');
		expect(segs).toEqual([
			{ type: 'text', value: 'Đã giao việc CV-40 cho Đỗ Minh Đức. ' },
			{ type: 'link', value: '/cong-viec?task=CV-40', label: 'Mở việc CV-40' },
		]);
	});

	it('số hiệu có chữ số trong mã dự án (L25-1) vẫn là đường dẫn hợp lệ', () => {
		const segs = splitAgentLinks('[Mở việc L25-1](/cong-viec?task=L25-1)');
		expect(segs).toEqual([{ type: 'link', value: '/cong-viec?task=L25-1', label: 'Mở việc L25-1' }]);
	});

	it('đường dẫn trần cũ vẫn thành link như trước', () => {
		const segs = splitAgentLinks('Mở trên web: /cong-viec?task=HQ-2');
		expect(segs[1]).toEqual({ type: 'link', value: '/cong-viec?task=HQ-2' });
	});

	it('[SEC] đích không phải đường dẫn nội bộ thì cả cụm là chữ', () => {
		for (const bad of ['[Bấm](javascript:alert(1))', '[Bấm](//evil.example/x)', '[Bấm](https://evil.example)']) {
			const segs = splitAgentLinks(bad);
			expect(segs.every(s => s.type === 'text')).toBe(true);
			expect(segs.map(s => s.value).join('')).toBe(bad);
		}
	});
});
