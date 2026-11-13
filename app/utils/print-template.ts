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
export function buildPrintHtml(template: string, fieldValues: Record<string, unknown>): string {
	const values = fieldValues ?? {};
	return template.replace(PLACEHOLDER, (match: string, key: string) =>
		Object.prototype.hasOwnProperty.call(values, key) ? escapePrintValue(values[key]) : match,
	);
}
