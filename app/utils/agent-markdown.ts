/**
 * Render markdown do trợ lý AI sinh ra.
 *
 * KHÔNG dùng thư viện markdown đầy đủ: output của agent nằm trong một tập rất hẹp
 * (đậm, nghiêng, code, bảng, danh sách, tiêu đề) vì chính system prompt quy định.
 * Một bộ render gọn dễ kiểm thử hơn và không thêm dependency.
 *
 * AN TOÀN: escape toàn bộ HTML TRƯỚC, rồi mới chèn thẻ của chính mình. Nội dung do LLM
 * sinh (và có thể bị nhiễm từ dữ liệu người dùng qua tool result) không bao giờ được
 * hiểu là HTML. Gọi thêm DOMPurify ở component để chắc thêm một lớp.
 */

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/** `**đậm**`, `*nghiêng*`, `` `code` `` — chạy SAU khi đã escape. */
function inline(s: string): string {
	return s
		.replace(/`([^`]+)`/g, '<code class="agent-code">$1</code>')
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

function renderTable(lines: string[]): string {
	const head = splitCells(lines[0]!);
	const bodyLines = lines.slice(isTableDivider(lines[1] ?? '') ? 2 : 1);
	const th = head.map((c) => `<th>${inline(c)}</th>`).join('');
	const rows = bodyLines
		.map((l) => `<tr>${splitCells(l).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
		.join('');
	return `<div class="agent-table-wrap"><table class="agent-table"><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

export function renderAgentMarkdown(raw: string): string {
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
			out.push(block.length >= 2 ? renderTable(block) : `<p>${inline(block.join(' '))}</p>`);
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
