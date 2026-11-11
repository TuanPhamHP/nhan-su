/**
 * Tách nội dung ô nhắc tên thành phần gửi lên API tuyển dụng.
 *
 * `MentionInput` (dùng chung với module Thông báo) trả nội dung thô có dấu `@[Tên](id)` ở chỗ
 * nhắc người. Nhưng API tuyển dụng mang người được nhắc ở MẢNG `mentionIds` riêng chứ không dò
 * dấu trong `body` như module Thông báo, nên FE phải tự tách hai thứ ra.
 *
 * Dấu được đổi thành `@Tên` thay vì xoá hẳn: `body` còn đi tới trang quản lý của khu tuyển dụng
 * và file Excel xuất ra, những nơi không có bộ dò dấu. Để nguyên `@[Tên](7)` thì người đọc thấy
 * cú pháp thô.
 */
const MENTION_MARKER = /@\[([^\]]+)\]\((\d+)\)/g;

/** BE nhận tối đa 20 id người được nhắc. */
export const MAX_MENTION_IDS = 20;

export interface SplitMentionResult {
	body: string;
	mentionIds: number[];
}

export function splitMentionDraft(raw: string): SplitMentionResult {
	const ids: number[] = [];
	const body = raw.replace(MENTION_MARKER, (_, name: string, id: string) => {
		const n = Number(id);
		// Nhắc cùng một người hai lần trong một bình luận vẫn chỉ là một id.
		if (Number.isFinite(n) && n > 0 && !ids.includes(n)) ids.push(n);
		return `@${name}`;
	});
	return { body: body.trim(), mentionIds: ids.slice(0, MAX_MENTION_IDS) };
}
