import DOMPurify from 'dompurify';

/**
 * Lọc HTML bình luận và mô tả việc trước khi `v-html`.
 *
 * Máy chủ lưu HTML nguyên văn và ai được bình luận cũng gửi thẳng API được, không qua Tiptap. Cấu hình mặc định của
 * DOMPurify vẫn giữ `<form>`, `<input>`, `style`, `class` nên dựng được một khung "đăng nhập lại" giả phủ kín trang.
 * Ở đây chỉ giữ đúng những gì Tiptap của hai ô soạn sinh ra, `style` chỉ còn màu chữ, màu nền, căn lề, `class` chỉ còn
 * các lớp của editor, mọi liên kết mở tab mới kèm `noopener`.
 */

// Bản riêng, không thêm hook vào DOMPurify dùng chung của các màn khác.
const purifier = DOMPurify();

const ALLOWED_STYLES = new Set(['color', 'background-color', 'text-align']);
const ALLOWED_CLASSES = new Set(['task-mention', 'tt-image', 'img-align-left', 'img-align-center', 'img-align-right']);

purifier.addHook('afterSanitizeAttributes', node => {
	if (node.tagName === 'A') {
		node.setAttribute('target', '_blank');
		node.setAttribute('rel', 'noopener noreferrer');
	}
	const style = node.getAttribute('style');
	if (style !== null) {
		const kept = style
			.split(';')
			.map(d => d.trim())
			.filter(d => {
				const prop = d.split(':')[0]?.trim().toLowerCase() ?? '';
				return ALLOWED_STYLES.has(prop) && !/url\s*\(|expression|var\s*\(/i.test(d);
			});
		if (kept.length) node.setAttribute('style', kept.join('; '));
		else node.removeAttribute('style');
	}
	const cls = node.getAttribute('class');
	if (cls !== null) {
		const kept = cls.split(/\s+/).filter(c => ALLOWED_CLASSES.has(c));
		if (kept.length) node.setAttribute('class', kept.join(' '));
		else node.removeAttribute('class');
	}
});

const INLINE_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 's', 'u', 'code', 'ul', 'ol', 'li', 'a', 'span'];

const COMMENT_CONFIG = {
	ALLOWED_TAGS: INLINE_TAGS,
	ALLOWED_ATTR: ['href', 'class', 'data-type', 'data-id', 'data-label'],
};

const DESCRIPTION_CONFIG = {
	ALLOWED_TAGS: [...INLINE_TAGS, 'h1', 'h2', 'h3', 'h4', 'blockquote', 'pre', 'hr', 'mark', 'img'],
	ALLOWED_ATTR: ['href', 'class', 'style', 'src', 'alt', 'title', 'data-type', 'data-id', 'data-label'],
};

export function sanitizeTaskComment(html: string | null | undefined): string {
	return html ? purifier.sanitize(html, COMMENT_CONFIG) : '';
}

export function sanitizeTaskDescription(html: string | null | undefined): string {
	return html ? purifier.sanitize(html, DESCRIPTION_CONFIG) : '';
}
