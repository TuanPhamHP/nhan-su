/**
 * Ghép giá trị của tờ trình vào mẫu in.
 *
 * Mẫu in (`printTemplate`) do HR/ADMIN soạn nên giữ nguyên là HTML. Còn `fieldValues` là thứ
 * nhân viên tự gõ, nên PHẢI escape trước khi ghép: cửa sổ in mở bằng `window.open('')` +
 * `document.write` là about:blank cùng origin, HTML/script lọt vào đây sẽ chạy bằng phiên của
 * người xem hoặc in tờ trình (người duyệt, HR).
 *
 * Escape chỉ an toàn khi placeholder nằm trong nội dung chữ hoặc trong thuộc tính có dấu nháy
 * (`title="{{x}}"`). Mẫu in không được đặt placeholder trong thuộc tính không có nháy, trong
 * `href`/`src`, hay trong `<script>`/`<style>`.
 */

const HTML_ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;',
};

export function escapePrintValue(value: unknown): string {
	return String(value ?? '').replace(/[&<>"']/g, ch => HTML_ESCAPES[ch] ?? ch);
}

/** Đúng một placeholder `{{key}}`; key không chứa ngoặc nhọn nên không khớp vắt qua hai placeholder. */
const PLACEHOLDER = /\{\{([^{}]+)\}\}/g;

/**
 * Quét mẫu MỘT lượt, mỗi lần khớp đúng một placeholder rồi tra giá trị theo key.
 *
 * Không dựng chuỗi tìm từ key của `fieldValues`: key do nhân viên gửi (BE không chặn key thừa),
 * nên một key như `a}}">{{b` từng xoá được cả đoạn markup của mẫu nằm giữa hai placeholder, kể cả
 * dấu nháy đóng thuộc tính, đẩy giá trị phía sau ra ngữ cảnh thuộc tính không nháy. Quét một lượt
 * cũng làm giá trị đã chèn không bị quét lại. Dùng hàm thay thế thay vì chuỗi vì chuỗi thay thế hiểu
 * `$&`, `$'`... là mẫu đặc biệt.
 */
/** `YYYY-MM-DD` → `dd/mm/yyyy`; chuỗi không đúng dạng ngày thì giữ nguyên. */
function vnDate(value: string): string {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
	return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
}

/**
 * Ghép giá trị vào mẫu in.
 *
 * `dateKeys` là những trường kiểu ngày của biểu mẫu. Giá trị ngày được lưu dạng `YYYY-MM-DD`
 * để so sánh và gửi lên máy chủ, nhưng văn bản hành chính tiếng Việt viết `16/11/2026`, nên
 * nơi gọi truyền danh sách khoá ngày vào để bản in đọc như một tờ trình thật thay vì như dữ
 * liệu máy. Thiếu danh sách đó thì mọi giá trị vẫn in nguyên văn như trước.
 */
export function buildPrintHtml(
	template: string,
	fieldValues: Record<string, unknown>,
	dateKeys: readonly string[] = [],
): string {
	const values = fieldValues ?? {};
	const dates = new Set(dateKeys);
	return template.replace(PLACEHOLDER, (match: string, key: string) => {
		if (!Object.prototype.hasOwnProperty.call(values, key)) return match;
		const value = values[key];
		if (dates.has(key) && typeof value === 'string') return escapePrintValue(vnDate(value));
		return escapePrintValue(value);
	});
}

/** Khoá của những trường kiểu ngày trong một biểu mẫu, để truyền vào `buildPrintHtml`. */
export function dateFieldKeys(fields: ReadonlyArray<{ key: string; type: string }> | undefined): string[] {
	return (fields ?? []).filter(f => f.type === 'date').map(f => f.key);
}

/** Khoá của những trường kiểu số, để bản in viết `108.000.000` thay vì `108000000`. */
export function numberFieldKeys(fields: ReadonlyArray<{ key: string; type: string }> | undefined): string[] {
	return (fields ?? []).filter(f => f.type === 'number').map(f => f.key);
}

const PRINT_NUMBER = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });

/** Mọi khoá của biểu mẫu, kể cả trường người dùng để trống, để bản in không in ra `{{key}}`. */
export function allFieldKeys(fields: ReadonlyArray<{ key: string }> | undefined): string[] {
	return (fields ?? []).map(f => f.key);
}

export interface PrintFormatting {
	/** Trường kiểu ngày: `2026-11-16` thành `16/11/2026`. */
	dateKeys?: readonly string[];
	/** Trường kiểu số: `108000000` thành `108.000.000`. */
	numberKeys?: readonly string[];
	/**
	 * Mọi khoá của biểu mẫu.
	 *
	 * Khoá nằm trong danh sách này mà không có trong `fieldValues` là trường tuỳ chọn người dùng
	 * để trống, nên in ra rỗng. Khoá KHÔNG nằm trong danh sách là mẫu gõ sai tên trường, giữ
	 * nguyên `{{…}}` để người soạn mẫu nhìn thấy mà sửa.
	 */
	knownKeys?: readonly string[];
}

/** Một giá trị biểu mẫu, đã escape và đã định dạng theo kiểu của trường. */
function printValue(key: string, value: unknown, format: PrintFormatting): string {
	if (format.dateKeys?.includes(key) && typeof value === 'string') return escapePrintValue(vnDate(value));
	if (format.numberKeys?.includes(key)) {
		const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^\d.-]/g, ''));
		if (value !== '' && value != null && Number.isFinite(n)) return escapePrintValue(PRINT_NUMBER.format(n));
	}
	return escapePrintValue(value);
}

/**
 * Ghép giá trị vào mẫu in, có định dạng theo kiểu trường và xử lý trường để trống.
 *
 * Dùng cho cả bản in và khung xem nội dung trong trang, nên hai chỗ đó luôn hiện cùng một con số
 * và cùng một ngày.
 */
export function renderPrintHtml(
	template: string,
	fieldValues: Record<string, unknown>,
	format: PrintFormatting = {},
): string {
	const values = fieldValues ?? {};
	return template.replace(PLACEHOLDER, (match: string, key: string) => {
		if (Object.prototype.hasOwnProperty.call(values, key)) return printValue(key, values[key], format);
		// Trường của mẫu mà người gửi để trống: in ra rỗng, không in tên khoá.
		if (format.knownKeys?.includes(key)) return '';
		return match;
	});
}

const DANGEROUS_TAGS = 'script, iframe, object, embed, link, meta[http-equiv], base, form';

/**
 * Lọc mẫu in trước khi đưa vào trang.
 *
 * Mẫu in là HTML do người có quyền cấu hình loại phiếu soạn, nhưng người ĐỌC nó là người duyệt
 * và phòng nhân sự, nên script trong mẫu sẽ chạy bằng phiên của họ. Khung xem nội dung và cửa sổ
 * in đều đã chạy trong iframe không có `allow-scripts`; lọc ở đây là lớp thứ hai, để một chỗ nào
 * khác lỡ dựng chuỗi này mà quên sandbox thì cũng không mở cửa cho script.
 *
 * Bỏ hẳn thẻ chạy được mã, mọi thuộc tính `on*`, và mọi địa chỉ `javascript:`. Giữ nguyên phần
 * còn lại, kể cả `<style>`, vì mẫu in dựa vào CSS để ra đúng khổ giấy.
 */
export function sanitizePrintTemplate(html: string): string {
	if (typeof DOMParser === 'undefined') return html;
	const doc = new DOMParser().parseFromString(html, 'text/html');
	doc.querySelectorAll(DANGEROUS_TAGS).forEach(el => el.remove());
	doc.querySelectorAll('*').forEach(el => {
		for (const attr of [...el.attributes]) {
			const name = attr.name.toLowerCase();
			const value = attr.value.replace(/[\s\u0000-\u001f]/g, '').toLowerCase();
			if (name.startsWith('on')) el.removeAttribute(attr.name);
			else if (/^(href|src|xlink:href|action|formaction|data)$/.test(name) && value.startsWith('javascript:')) {
				el.removeAttribute(attr.name);
			}
		}
	});
	return doc.documentElement.outerHTML;
}

/**
 * Dọn bản in sau khi ghép giá trị: bỏ những dòng danh sách rỗng.
 *
 * Mẫu "Tờ trình" có ba dòng căn cứ, mà căn cứ hai và ba là tuỳ chọn. Để trống thì dòng `<li>`
 * chỉ còn dấu gạch đầu dòng, trông như dữ liệu bị mất.
 */
export function tidyPrintHtml(html: string): string {
	if (typeof DOMParser === 'undefined') return html;
	const doc = new DOMParser().parseFromString(html, 'text/html');
	doc.querySelectorAll('li').forEach(li => {
		const hasMedia = li.querySelector('img, svg, table, input');
		if (!hasMedia && !li.textContent?.trim()) li.remove();
	});
	return doc.documentElement.outerHTML;
}

/**
 * Mẫu in sẵn sàng để hiện: đã lọc script, ghép giá trị, dọn dòng rỗng, và ẩn nút "In trang này"
 * của chính mẫu.
 *
 * Nút đó là `button.preview-badge` nằm trong mẫu "Tờ trình", chỉ hoạt động khi mẫu chạy được
 * script. Trong iframe không có `allow-scripts` thì bấm vào không có gì xảy ra, nên ẩn đi thay vì
 * để một nút chết trên tài liệu.
 */
export function printDocumentHtml(
	template: string,
	fieldValues: Record<string, unknown>,
	format: PrintFormatting = {},
): string {
	const safe = sanitizePrintTemplate(template);
	const filled = renderPrintHtml(safe, fieldValues, format);
	return tidyPrintHtml(filled);
}

/** CSS chèn thêm vào tài liệu in và khung xem nội dung. */
export const PRINT_EXTRA_CSS =
	'.preview-badge,.no-print{display:none !important}';

/**
 * Bản xem trước mẫu in ở màn cấu hình loại phiếu: như `buildPrintHtml` nhưng tô vàng chỗ ghép
 * giá trị, để người soạn mẫu thấy placeholder của mình rơi vào đâu.
 *
 * Giá trị mẫu lấy từ nhãn và gợi ý của từng trường, tức là chữ người soạn tự gõ, nên PHẢI escape
 * trước khi ghép: màn này dựng chuỗi rồi đưa vào `v-html`, nên một nhãn trường như
 * `<img src=x onerror=…>` sẽ chạy ngay trong phiên của chính người soạn mẫu nếu không escape.
 * Markup của mẫu in vẫn giữ nguyên vì đó là HTML do người soạn mẫu cố ý viết ra.
 */
export function buildPreviewHtml(template: string, sampleValues: Record<string, unknown>): string {
	const values = sampleValues ?? {};
	return template.replace(PLACEHOLDER, (match: string, key: string) => {
		if (!Object.prototype.hasOwnProperty.call(values, key)) return match;
		return `<span style="background:#fef9c3;padding:0 2px;">${escapePrintValue(values[key])}</span>`;
	});
}
