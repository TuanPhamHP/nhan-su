/**
 * Mẫu in tờ trình: giá trị nhân viên gõ phải được escape trước khi ghép vào mẫu HTML của HR,
 * vì cửa sổ in là about:blank cùng origin (document.write) — HTML lọt vào sẽ chạy bằng phiên
 * của người duyệt/HR đang xem.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockPrint = vi.hoisted(() => vi.fn());
vi.mock('~/services/general-request.service', () => ({
	useGeneralRequestService: () => ({ print: mockPrint }),
}));

import { buildPrintHtml, escapePrintValue } from '~/utils/print-template';
import { usePrint } from '~/composables/usePrint';
import type { GeneralRequestResponse } from '~/types/general-request.types';

const XSS = '<img src=x onerror=alert(1)>';
const TEMPLATE =
	'<h1 style="text-align:center">TỜ TRÌNH</h1>' +
	'<p>Kính gửi: <b>{{recipient}}</b></p>' +
	'<p title="{{title}}">Nội dung: {{content}}</p>' +
	'<table><tr><td>Số tiền</td><td>{{amount}}</td></tr></table>';

function parse(html: string): Document {
	return new DOMParser().parseFromString(html, 'text/html');
}

describe('escapePrintValue', () => {
	it('escape đủ 5 ký tự & < > " \'', () => {
		expect(escapePrintValue(`a & b < c > d " e ' f`)).toBe('a &amp; b &lt; c &gt; d &quot; e &#39; f');
	});

	it('null/undefined thành chuỗi rỗng, số và boolean giữ như String()', () => {
		expect(escapePrintValue(null)).toBe('');
		expect(escapePrintValue(undefined)).toBe('');
		expect(escapePrintValue(1500000)).toBe('1500000');
		expect(escapePrintValue(true)).toBe('true');
	});
});

describe('buildPrintHtml', () => {
	it('payload <img onerror> thành chữ thường, không sinh thẻ', () => {
		const out = buildPrintHtml(TEMPLATE, { recipient: 'Ban Giám đốc', content: XSS, title: 'x', amount: 1 });
		expect(out).toContain('&lt;img src=x onerror=alert(1)&gt;');
		expect(out).not.toContain('<img');

		const doc = parse(out);
		expect(doc.querySelector('img')).toBeNull();
		expect(doc.querySelector('[onerror]')).toBeNull();
		// Người xem vẫn đọc được đúng nguyên văn những gì nhân viên đã gõ.
		expect(doc.querySelectorAll('p')[1]?.textContent).toBe(`Nội dung: ${XSS}`);
	});

	it('không thoát được khỏi thuộc tính có nháy của mẫu', () => {
		const out = buildPrintHtml(TEMPLATE, { title: '" onmouseover="alert(1)', content: 'a' });
		const p = parse(out).querySelectorAll('p')[1];
		expect(p?.getAttribute('onmouseover')).toBeNull();
		expect(p?.getAttribute('title')).toBe('" onmouseover="alert(1)');
	});

	it('chặn </script>, <svg onload>, <iframe>', () => {
		const out = buildPrintHtml(TEMPLATE, {
			recipient: '</b><script>alert(1)</script>',
			content: '<svg onload=alert(1)><iframe src="javascript:alert(1)"></iframe>',
		});
		const doc = parse(out);
		expect(doc.querySelector('script, svg, iframe')).toBeNull();
		expect(doc.querySelector('b')?.textContent).toBe('</b><script>alert(1)</script>');
	});

	it('chữ tiếng Việt bình thường giữ nguyên từng ký tự', () => {
		const text = 'Đề nghị thanh toán chi phí công tác Hà Nội – TP. Hồ Chí Minh, tháng 11/2026';
		const out = buildPrintHtml(TEMPLATE, { recipient: 'Phòng Hành chính – Nhân sự', content: text, amount: '1.500.000 đ' });
		expect(out).toContain(text);
		expect(out).toContain('Phòng Hành chính – Nhân sự');
		expect(out).toContain('1.500.000 đ');
	});

	it('markup của mẫu (HR soạn) giữ nguyên, placeholder không có giá trị để nguyên', () => {
		const out = buildPrintHtml(TEMPLATE, { recipient: 'A', content: 'B', amount: 'C' });
		expect(out).toBe(
			'<h1 style="text-align:center">TỜ TRÌNH</h1>' +
				'<p>Kính gửi: <b>A</b></p>' +
				'<p title="{{title}}">Nội dung: B</p>' +
				'<table><tr><td>Số tiền</td><td>C</td></tr></table>',
		);
	});

	it('mọi lần xuất hiện của cùng placeholder đều được thay', () => {
		expect(buildPrintHtml('{{a}} và {{a}}', { a: '<x>' })).toBe('&lt;x&gt; và &lt;x&gt;');
	});

	it("giá trị chứa $' / $& không còn bị hiểu là mẫu thay thế", () => {
		const out = buildPrintHtml('<p>{{a}}</p><i>sau</i>', { a: "giá $' và $&" });
		expect(out).toBe("<p>giá $&#39; và $&amp;</p><i>sau</i>");
	});

	it('giữ nguyên xuống dòng như trước (không đổi thành <br>)', () => {
		expect(buildPrintHtml('<p>{{a}}</p>', { a: 'dòng 1\ndòng 2' })).toBe('<p>dòng 1\ndòng 2</p>');
	});

	it('[key độc] key chứa }} không xoá được markup của mẫu nằm giữa hai placeholder', () => {
		// BE chỉ kiểm trường bắt buộc, không chặn key thừa trong fieldValues. Nếu dựng chuỗi tìm từ key
		// thì key `title}}">Nội dung: {{content` xoá luôn dấu nháy đóng của title="...", làm giá trị
		// của placeholder phía sau rơi ra ngữ cảnh thuộc tính không nháy, nơi dấu cách và = không bị
		// escape, nên chèn được onfocus + autofocus vào cửa sổ in.
		const tmpl = '<p title="{{title}}">Nội dung: {{content}}</p><span class="{{cls}}">x</span>';
		const out = buildPrintHtml(tmpl, {
			'title}}">Nội dung: {{content': 'v',
			cls: 'x tabindex=0 autofocus onfocus=alert(1) ',
		});
		const doc = parse(out);
		expect(doc.querySelector('[onfocus]')).toBeNull();
		expect(doc.querySelector('[autofocus]')).toBeNull();
		// Key lạ không khớp placeholder nào nên mẫu giữ nguyên; giá trị hợp lệ vẫn nằm trong nháy.
		expect(doc.querySelector('p')?.getAttribute('title')).toBe('{{title}}');
		expect(doc.querySelector('span')?.getAttribute('class')).toBe('x tabindex=0 autofocus onfocus=alert(1) ');
	});

	it('giá trị đã chèn không bị quét lại để thay placeholder khác', () => {
		expect(buildPrintHtml('<p>{{a}}</p><p>{{b}}</p>', { a: '{{b}}', b: 'B' })).toBe('<p>{{b}}</p><p>B</p>');
	});

	it('key trùng tên thuộc tính của Object không thay placeholder không có giá trị', () => {
		expect(buildPrintHtml('<p>{{constructor}}</p><p>{{toString}}</p>', {})).toBe(
			'<p>{{constructor}}</p><p>{{toString}}</p>',
		);
	});
});

describe('usePrint — đi qua đúng đường mở cửa sổ in', () => {
	let written = '';
	const openSpy = vi.fn();

	beforeEach(() => {
		written = '';
		mockPrint.mockReset();
		openSpy.mockReset();
		openSpy.mockImplementation(() => ({
			document: {
				write: (s: string) => {
					written += s;
				},
				close: () => {},
			},
			focus: () => {},
		}));
		vi.stubGlobal('open', openSpy);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('printRequest: payload trong fieldValues không thành thẻ trong cửa sổ in', async () => {
		mockPrint.mockResolvedValue({ printTemplate: TEMPLATE, fieldValues: { recipient: 'HR', content: XSS } });
		await usePrint().printRequest(7);

		expect(mockPrint).toHaveBeenCalledWith(7);
		expect(openSpy).toHaveBeenCalledWith('', '_blank');
		const doc = parse(written);
		expect(doc.querySelector('img')).toBeNull();
		expect(doc.querySelector('[onerror]')).toBeNull();
		expect(doc.body.textContent).toContain(XSS);
		// Khung của cửa sổ in (nút In ngay / Đóng) và mẫu của HR vẫn còn.
		expect(doc.querySelector('h1')?.textContent).toBe('TỜ TRÌNH');
		expect(doc.querySelectorAll('.no-print button')).toHaveLength(2);
	});

	it('previewRequest: cùng luật escape với mẫu truyền vào', () => {
		const req = { fieldValues: { content: XSS }, printTemplate: null } as unknown as GeneralRequestResponse;
		usePrint().previewRequest(req, '<div>{{content}}</div>');

		const doc = parse(written);
		expect(doc.querySelector('img')).toBeNull();
		expect(doc.querySelector('body > div')?.textContent).toBe(XSS);
	});
});
