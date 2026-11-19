/**
 * So chữ tiếng Việt khi tìm kiếm: bỏ dấu, bỏ dấu câu, không phân biệt hoa thường.
 *
 * Vì sao cần: bàn phím máy tính của nhiều người không bật bộ gõ tiếng Việt khi họ đang gõ nhanh,
 * nên họ tìm "but chi" để ra "Bút chì gỗ". Tìm kiếm so từng ký tự thì không ra gì và người dùng
 * kết luận là danh mục thiếu mặt hàng. Máy chủ cũng so tên theo cách này khi kiểm mặt hàng trùng,
 * nên hai bên hiểu giống nhau.
 */

/**
 * Chuỗi đã chuẩn hoá để so khi tìm kiếm.
 *
 * `normalize('NFD')` tách chữ và dấu thành hai ký tự rồi bỏ phần dấu, nên "ế" thành "e". Chữ đ và
 * Đ không có dạng tách nên phải đổi riêng. Mọi thứ không phải chữ hay số đều thành khoảng trắng,
 * nhờ vậy "Bút bi (Note màu xanh)" và "but bi note mau xanh" là cùng một chuỗi.
 */
export function vnSearchText(text: string | null | undefined): string {
	return String(text ?? '')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/đ/g, 'd')
		.replace(/Đ/g, 'D')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

/** Chuỗi `haystack` có chứa `needle` hay không, so theo cách bỏ dấu ở trên. */
export function vnSearchIncludes(haystack: string | null | undefined, needle: string | null | undefined): boolean {
	const query = vnSearchText(needle);
	if (!query) return true;
	return vnSearchText(haystack).includes(query);
}
