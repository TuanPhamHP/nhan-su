/**
 * Đuôi truy vết của nội dung do Trợ lý AI soạn.
 *
 * Server đóng dấu mô tả việc, bình luận, lý do do trợ lý soạn bằng một đuôi
 * `⟦Trợ lý AI⟧ Soạn qua Trợ lý AI · {người} xác nhận lúc {giờ}` (bridge tasks.md mục 32). Dữ liệu giữ nguyên để
 * truy vết; khi hiện, web cắt đuôi này và thay bằng nhãn nhỏ "Soạn qua Trợ lý AI", vì ký hiệu ⟦⟧ giữa câu làm
 * người đọc tưởng lỗi chữ.
 *
 * Mô tả việc là HTML (mỗi dòng một `<p>`, đuôi nằm trong `<p>` cuối); lý do, phản hồi là chữ thường (đuôi sau hai
 * dấu xuống dòng). Hàm nhận cả hai.
 */
export const AGENT_MARK = '⟦Trợ lý AI⟧';

export interface AgentMarkSplit {
	/** Nội dung người dùng thật sự thấy, đã bỏ đuôi (cùng dạng với đầu vào: HTML vẫn là HTML). */
	text: string;
	/** Nội dung có đuôi của trợ lý. */
	viaAgent: boolean;
	/** Phần chữ sau ký hiệu, đã bỏ thẻ HTML: "Soạn qua Trợ lý AI · Lê Thị Lan xác nhận lúc 27/11/2026 09:12". */
	trace: string | null;
}

/** Thẻ mở khối chứa đuôi: chỉ có thẻ mở (và khoảng trắng) đứng trước ký hiệu thì bỏ cả khối. */
const BLOCK_OPEN_BEFORE_MARK = /^<(p|div|li)\b[^>]*>(?:\s|<(?:span|strong|em|b|i)\b[^>]*>)*$/i;
/** Đoạn rỗng còn sót cuối mô tả sau khi cắt (`<p></p>`, `<p><br></p>`). */
const TRAILING_EMPTY_BLOCKS = /(?:<p\b[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>\s*)+$/i;

function decodeEntities(s: string): string {
	return s
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&');
}

export function splitAgentMark(input: string | null | undefined): AgentMarkSplit {
	const raw = input ?? '';
	const idx = raw.indexOf(AGENT_MARK);
	if (idx === -1) return { text: raw, viaAgent: false, trace: null };

	const trace =
		decodeEntities(raw.slice(idx + AGENT_MARK.length).replace(/<[^>]*>/g, ' '))
			.replace(/\s+/g, ' ')
			.trim() || null;

	let cut = idx;
	if (/<[a-z][\s\S]*>/i.test(raw)) {
		// HTML: bỏ luôn khối `<p>` chứa đuôi nếu ký hiệu đứng đầu khối, để không còn đoạn rỗng.
		const blockStart = Math.max(raw.lastIndexOf('<p', idx), raw.lastIndexOf('<div', idx), raw.lastIndexOf('<li', idx));
		if (blockStart !== -1 && BLOCK_OPEN_BEFORE_MARK.test(raw.slice(blockStart, idx))) cut = blockStart;
		const text = raw.slice(0, cut).trimEnd().replace(TRAILING_EMPTY_BLOCKS, '').trimEnd();
		return { text, viaAgent: true, trace };
	}
	return { text: raw.slice(0, cut).trimEnd(), viaAgent: true, trace };
}

/**
 * Câu chi tiết dưới nhãn: phần sau "Soạn qua Trợ lý AI ·" ("Lê Thị Lan xác nhận lúc 27/11/2026 09:12"). Không có
 * thì `null`.
 */
export function agentTraceDetail(trace: string | null | undefined): string | null {
	if (!trace) return null;
	const detail = trace.replace(/^Soạn qua Trợ lý AI\s*[·\-:]?\s*/, '').trim();
	return detail || null;
}
