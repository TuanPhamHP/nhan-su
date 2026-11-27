/**
 * Render markdown do trợ lý AI sinh ra.
 *
 * KHÔNG dùng thư viện markdown đầy đủ: output của agent nằm trong một tập rất hẹp
 * (đậm, nghiêng, code, bảng, danh sách, tiêu đề) vì chính system prompt quy định.
 * Một bộ render gọn dễ kiểm thử hơn và không thêm dependency.
 *
 * AN TOÀN: escape toàn bộ HTML TRƯỚC, rồi mới chèn thẻ của chính mình. Nội dung do LLM
 * sinh (và có thể bị nhiễm từ dữ liệu người dùng qua tool result) không bao giờ được
 * hiểu là HTML. Gọi thêm DOMPurify ở component để chắc thêm một lớp. Link chỉ sinh cho
 * đường dẫn nội bộ đã qua `isSafeInternalPath`, và chỉ khi nơi gọi bật `links`.
 */

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/** Ngược lại đúng `escapeHtml` (`&amp;` thay sau cùng, nên `&amp;lt;` về lại `&lt;` chứ không về `<`). */
function unescapeHtml(s: string): string {
	return s
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&');
}

// ─── Đường dẫn nội bộ trong câu trả lời ──────────────────────────────────────

/**
 * Đường dẫn trang trong app mà trợ lý được phép biến thành link.
 *
 * Đúng MỘT `/` ở đầu, rồi các đoạn chữ (hoa hay thường), số, `-` ngăn bởi `/` (đoạn đầu phải bắt
 * đầu bằng chữ, để "4 /5" không thành link), có thể kèm query chỉ gồm chữ, số, `=`, `&`, `-`, `_`,
 * `%`. Chữ hoa cần cho mã dự án trên đường dẫn (`/cong-viec/du-an/HQ`) và không mở thêm đường nào:
 * vẫn không có `:`, `\`, `.`, nháy hay khoảng trắng. Không khớp thì giữ nguyên là chữ: `//host`,
 * `http:`, `javascript:`, dấu nháy, khoảng trắng, `<`, `#`, `..` đều rơi vào nhánh này. Câu trả lời
 * do model viết và có thể bị nhiễm từ dữ liệu người dùng qua tool, nên href KHÔNG BAO GIỜ được lấy
 * từ đó mà chưa qua hàm này.
 */
const SAFE_INTERNAL_PATH = /^\/[A-Za-z][A-Za-z0-9-]*(?:\/[A-Za-z0-9-]+)*\/?(?:\?[A-Za-z0-9=&\-_%]*)?$/;

export function isSafeInternalPath(s: string): boolean {
	return SAFE_INTERNAL_PATH.test(s);
}

/** `label`: chữ hiện của link markdown `[Mở việc HQ-2](/cong-viec?task=HQ-2)`; không có thì hiện chính đường dẫn. */
export type AgentTextSegment = { type: 'text'; value: string } | { type: 'link'; value: string; label?: string };

/**
 * Ứng viên: một cụm không có khoảng trắng bắt đầu bằng `/`, đứng đầu chuỗi hoặc sau khoảng trắng,
 * dấu mở ngoặc, nháy, hay dấu hai chấm dính liền ("Mở trên web:/cong-viec?task=CV-9"). Lấy CẢ cụm
 * chứ không dừng ở ký tự lạ đầu tiên: `/a'onclick=…` phải bị loại cả cụm, không được cắt lấy `/a`
 * làm link. Sau dấu hai chấm của `http://host/x` là cụm `//host/x`, cụm đó không qua được luật
 * đường dẫn nên vẫn là chữ.
 */
const PATH_CANDIDATE = /(^|[\s([{"'“‘`*:：])(\/\S*)/g;
/**
 * Dấu câu, dấu đóng ngoặc, dấu đậm dính sau đường dẫn ("(/cong-viec).", "…: /kpi?reviewId=4.",
 * hai dấu sao của chữ đậm): không thuộc link.
 */
const TRAILING_PUNCT = /[.,;:!?)\]}"'”’`*]+$/;

/**
 * Tách một đoạn chữ THUẦN (chưa escape) thành chữ và đường dẫn nội bộ an toàn.
 *
 * Ghép `value` của mọi đoạn lại luôn ra đúng chuỗi ban đầu: hàm chỉ đánh dấu, không thêm bớt chữ.
 */
export function splitInternalPaths(text: string): AgentTextSegment[] {
	const out: AgentTextSegment[] = [];
	let last = 0;
	const pushText = (value: string): void => {
		if (!value) return;
		const prev = out[out.length - 1];
		if (prev?.type === 'text') prev.value += value;
		else out.push({ type: 'text', value });
	};

	for (const m of text.matchAll(PATH_CANDIDATE)) {
		const start = (m.index ?? 0) + m[1]!.length;
		const token = m[2]!;
		const path = token.replace(TRAILING_PUNCT, '');
		if (!isSafeInternalPath(path)) continue;
		pushText(text.slice(last, start));
		out.push({ type: 'link', value: path });
		last = start + path.length;
	}
	pushText(text.slice(last));
	return out;
}

/** Link markdown trong chữ THUẦN (chưa escape): `[chữ](đích)`, đích không có khoảng trắng, không có `)`. */
const MD_LINK_RAW = /\[([^\]\n]+)\]\(([^)\s]*)\)/g;

/**
 * Như `splitInternalPaths`, thêm link markdown có chữ: từ 27/11/2026 câu báo của confirm (và câu trả lời) ghi
 * `[Mở việc HQ-2](/cong-viec?task=HQ-2)` thay cho đường dẫn trần. Đích phải qua `isSafeInternalPath`; đích khác
 * (`javascript:`, `//host`, `http:`) thì cả cụm giữ nguyên là chữ.
 */
export function splitAgentLinks(text: string): AgentTextSegment[] {
	const out: AgentTextSegment[] = [];
	const push = (segs: AgentTextSegment[]): void => {
		for (const seg of segs) {
			const prev = out[out.length - 1];
			if (seg.type === 'text' && prev?.type === 'text') prev.value += seg.value;
			else out.push(seg);
		}
	};
	let last = 0;
	for (const m of text.matchAll(MD_LINK_RAW)) {
		const target = m[2]!.trim();
		if (!isSafeInternalPath(target)) continue;
		const start = m.index ?? 0;
		push(splitInternalPaths(text.slice(last, start)));
		out.push({ type: 'link', value: target, label: m[1]!.trim() });
		last = start + m[0].length;
	}
	push(splitInternalPaths(text.slice(last)));
	return out;
}

function linkHtml(path: string, inner: string): string {
	// `path` đã qua isSafeInternalPath nên không có nháy, `<`, khoảng trắng; vẫn escape cho chắc (`&`).
	return `<a href="${escapeHtml(path)}" class="agent-link" data-agent-link="">${inner}</a>`;
}

/** Đoạn chữ ĐÃ escape → đường dẫn an toàn thành link, phần còn lại giữ nguyên. */
function linkifyEscaped(escaped: string): string {
	return splitInternalPaths(unescapeHtml(escaped))
		.map((seg) => (seg.type === 'link' ? linkHtml(seg.value, escapeHtml(seg.value)) : escapeHtml(seg.value)))
		.join('');
}

/** `` `code` `` — nội dung đã escape. Cả cụm là đường dẫn an toàn thì bọc link quanh khối code. */
function codeSpan(escapedInner: string, links: boolean): string {
	const code = `<code class="agent-code">${escapedInner}</code>`;
	if (!links) return code;
	const raw = unescapeHtml(escapedInner).trim();
	return isSafeInternalPath(raw) ? linkHtml(raw, code) : code;
}

/** Link markdown `[chữ](đích)`, nhận trên chuỗi ĐÃ escape (đích không có khoảng trắng, không có `)`). */
const MD_LINK = /^\[([^\]\n]+)\]\(([^)\s]*)\)$/;

/**
 * `[Xem](/cong-viec?task=CV-8)`: đích là đường dẫn nội bộ an toàn thì thành link mang đúng chữ trong `[]`.
 * Đích khác (`javascript:`, `data:`, `//host`, `http:`) giữ nguyên CẢ cụm là chữ, không có thẻ `<a>`.
 */
function markdownLink(escaped: string, links: boolean): string {
	const m = MD_LINK.exec(escaped);
	if (!links || !m) return escaped;
	const target = unescapeHtml(m[2]!).trim();
	return isSafeInternalPath(target) ? linkHtml(target, m[1]!) : escaped;
}

/** `**đậm**`, `*nghiêng*`, `` `code` ``, link markdown, đường dẫn nội bộ — chạy SAU khi đã escape. */
function inlineMd(s: string, links: boolean): string {
	const withCode = s
		// `<br>` do chính bộ render chèn khi nối dòng của đoạn văn: phải đi nguyên, không escape lại.
		.split(/(`[^`]+`|\[[^\]`\n]+\]\([^)\s]*\)|<br>)/g)
		.map((part) => {
			if (part === '<br>') return part;
			if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) return codeSpan(part.slice(1, -1), links);
			if (part.startsWith('[') && MD_LINK.test(part)) return markdownLink(part, links);
			return links ? linkifyEscaped(part) : part;
		})
		.join('');
	// Đậm, nghiêng chạy trên cả chuỗi đã ghép để `**`code`**` vẫn đậm như trước. Đường dẫn không
	// chứa `*` nên không bao giờ bị tách đôi.
	return withCode
		.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
		.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
}

const isTableRow = (l: string): boolean => /^\s*\|.*\|\s*$/.test(l);
/** Dòng phân cách kiểu `|:---|---:|` */
const isTableDivider = (l: string): boolean => /^\s*\|[\s:|-]+\|\s*$/.test(l) && l.includes('-');

function splitCells(line: string): string[] {
	return line
		.trim()
		.replace(/^\||\|$/g, '')
		.split('|')
		.map((c) => c.trim());
}

/**
 * Bảng từ ngần này cột trở lên thì trên khung hẹp (điện thoại, cửa sổ chat nhanh) hiện thành thẻ,
 * mỗi dòng một thẻ. Hai cột vẫn vừa màn 390 px nên giữ dạng bảng. AgentTableBlock dùng chung số này.
 */
export const AGENT_TABLE_CARD_MIN_COLUMNS = 3;

/** Nhãn cột cho thẻ (`data-label`): chữ trong ô tiêu đề, bỏ dấu đậm, nghiêng, code. Chuỗi đã escape. */
function cellLabel(escaped: string): string {
	return escaped.replace(/[*`]/g, '');
}

function renderTable(lines: string[], links: boolean): string {
	const head = splitCells(lines[0]!);
	const bodyLines = lines.slice(isTableDivider(lines[1] ?? '') ? 2 : 1);
	const th = head.map((c) => `<th>${inlineMd(c, links)}</th>`).join('');
	const rows = bodyLines
		.map(
			(l) =>
				`<tr>${splitCells(l)
					.map((c, i) => `<td data-label="${cellLabel(head[i] ?? '')}">${inlineMd(c, links)}</td>`)
					.join('')}</tr>`,
		)
		.join('');
	const cls = head.length >= AGENT_TABLE_CARD_MIN_COLUMNS ? 'agent-table agent-table--cards' : 'agent-table';
	return `<div class="agent-table-wrap"><table class="${cls}"><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

export interface AgentMarkdownOptions {
	/**
	 * Biến đường dẫn nội bộ an toàn (`/cong-viec?task=HQ-2`) thành `<a data-agent-link>`. Nơi render
	 * phải tự bắt cú bấm và đi bằng router (xem AgentMessageBubble). Tắt ở màn ADMIN xem lại hội
	 * thoại: đường dẫn ở đó là của người hỏi ("việc của tôi"), mở ra là thấy việc của chính ADMIN.
	 */
	links?: boolean;
}

export function renderAgentMarkdown(raw: string, opts: AgentMarkdownOptions = {}): string {
	const links = !!opts.links;
	const inline = (s: string): string => inlineMd(s, links);
	const lines = escapeHtml(raw).split(/\r?\n/);
	const out: string[] = [];
	let i = 0;

	while (i < lines.length) {
		const line = lines[i]!;

		// Bảng: gom các dòng liên tiếp bắt đầu bằng |
		if (isTableRow(line)) {
			const block: string[] = [];
			while (i < lines.length && isTableRow(lines[i]!)) block.push(lines[i++]!);
			// Cần ít nhất header + 1 dòng nữa mới coi là bảng
			out.push(block.length >= 2 ? renderTable(block, links) : `<p>${inline(block.join(' '))}</p>`);
			continue;
		}

		// Danh sách: - hoặc * hoặc 1.
		const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
		const numbered = /^\s*\d+\.\s+(.*)$/.exec(line);
		if (bullet || numbered) {
			const ordered = !!numbered;
			const items: string[] = [];
			while (i < lines.length) {
				const m = ordered
					? /^\s*\d+\.\s+(.*)$/.exec(lines[i]!)
					: /^\s*[-*]\s+(.*)$/.exec(lines[i]!);
				if (!m) break;
				items.push(`<li>${inline(m[1]!)}</li>`);
				i++;
			}
			out.push(`<${ordered ? 'ol' : 'ul'} class="agent-list">${items.join('')}</${ordered ? 'ol' : 'ul'}>`);
			continue;
		}

		// Tiêu đề ### / ## / #
		const heading = /^\s*(#{1,4})\s+(.*)$/.exec(line);
		if (heading) {
			out.push(`<p class="agent-heading">${inline(heading[2]!)}</p>`);
			i++;
			continue;
		}

		// Dòng trống → ngắt đoạn
		if (!line.trim()) {
			i++;
			continue;
		}

		// Đoạn văn: gom tới dòng trống hoặc tới khi gặp khối khác
		const para: string[] = [];
		while (
			i < lines.length &&
			lines[i]!.trim() &&
			!isTableRow(lines[i]!) &&
			!/^\s*[-*]\s+/.test(lines[i]!) &&
			!/^\s*\d+\.\s+/.test(lines[i]!) &&
			!/^\s*#{1,4}\s+/.test(lines[i]!)
		) {
			para.push(lines[i]!);
			i++;
		}
		out.push(`<p>${inline(para.join('<br>'))}</p>`);
	}

	return out.join('');
}
