/**
 * Tên icon `@nuxt/icon` cho một tệp đính kèm, chọn theo kiểu MIME rồi tới phần mở rộng.
 *
 * Trước đây ba chỗ (thẻ đính kèm của thông báo, hộp xem trước, trang soạn thông báo) mỗi chỗ tự
 * viết một hàm trả về emoji 📕 📊 📝 📎. Gom về một chỗ khi bỏ emoji ngày 19/11/2026, để ba màn
 * cùng vẽ một kiểu và thêm một định dạng mới thì chỉ sửa một nơi.
 *
 * `mimeType` chỉ có khi tệp còn nằm trên máy người dùng (`File.type`); tệp đã lưu trên máy chủ thì
 * chỉ còn tên, nên hàm nhận cả hai và tên luôn đủ để quyết định.
 */
export function fileIconName(fileName: string, mimeType?: string): string {
	const lower = fileName.toLowerCase();
	const mime = mimeType ?? '';
	if (mime === 'application/pdf' || lower.endsWith('.pdf')) return 'mdi:file-pdf-box';
	if (mime.includes('spreadsheet') || lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
		return 'mdi:file-excel-box';
	}
	if (mime.includes('word') || lower.endsWith('.docx') || lower.endsWith('.doc')) {
		return 'mdi:file-word-box';
	}
	return 'heroicons:paper-clip';
}
