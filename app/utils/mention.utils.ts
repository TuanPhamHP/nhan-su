export interface ContentSegment {
	type: 'text' | 'mention';
	text: string;
	id?: number;
	name?: string;
}

export function parseMentionContent(content: string): string {
	let html = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

	html = html.replace(
		/@\[([^\]]+)\]\((\d+)\)/g,
		(_, name, id) => `<span class="mention-badge" data-employee-id="${id}">@${name}</span>`,
	);

	html = html.replace(/(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/g, url => {
		const trimmed = url.replace(/[.,;:!?)]+$/, '');
		return `<a href="${trimmed}" target="_blank" rel="noopener noreferrer" class="comment-link">${trimmed}</a>`;
	});

	html = html.replace(/\n/g, '<br>');

	return html;
}

export function buildMentionContent(segments: ContentSegment[]): string {
	return segments
		.map(seg => {
			if (seg.type === 'mention') {
				return `@[${seg.name}](${seg.id})`;
			}
			return seg.text;
		})
		.join('');
}
