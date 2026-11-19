/**
 * So khớp chữ khi người dùng gõ tìm trong một danh sách có sẵn.
 *
 * Người Việt gõ tìm thường bỏ dấu và bỏ cả hoa thường, nên gõ "ghe" phải ra "Ghế" và gõ "da nang"
 * phải ra "Đà Nẵng". Muốn vậy thì cả nhãn và từ khoá đều được đưa về một dạng trung gian không
 * dấu, không hoa thường trước khi so. Dấu tiếng Việt tách ra được bằng chuẩn Unicode NFD rồi bỏ
 * các dấu kết hợp, riêng chữ đ không tách được nên phải đổi thẳng sang d.
 *
 * Đây là hàm thuần, không dùng gì của Vue, nên đặt ở utils và kiểm được bằng vitest.
 */

/** Dải dấu kết hợp của Unicode, tức phần dấu còn lại sau khi tách bằng NFD. */
const COMBINING_MARKS = /[̀-ͯ]/g;

/** Bỏ dấu tiếng Việt, giữ nguyên hoa thường: "Đà Nẵng" thành "Da Nang". */
export function removeDiacritics(input: string): string {
	return input.normalize('NFD').replace(COMBINING_MARKS, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

/** Dạng trung gian để so khớp: bỏ dấu, bỏ hoa thường và cắt khoảng trắng hai đầu. */
export function searchKey(input: string): string {
	return removeDiacritics(input).toLowerCase().trim();
}

/**
 * Nhãn có chứa từ khoá hay không, bỏ qua dấu và hoa thường.
 *
 * Từ khoá rỗng coi như khớp mọi nhãn, để chỗ gọi không phải tự kiểm trước.
 */
export function matchesSearch(label: string, query: string): boolean {
	const key = searchKey(query);
	if (!key) return true;
	return searchKey(label).includes(key);
}
