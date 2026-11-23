/**
 * Chữ cái hiện trong avatar khi người đó chưa có ảnh.
 *
 * Lấy chữ đầu của HAI TỪ CUỐI: tên người Việt đặt tên gọi ở cuối, nên "Đỗ Hồng Hạnh" ra "HH" chứ
 * không ra "Đ" như khi lấy chữ đầu của họ (cả công ty họ Nguyễn thì avatar nào cũng là "N").
 * Chuẩn hoá NFC trước để chữ có dấu gõ kiểu tổ hợp vẫn giữ nguyên dấu.
 */
export function personInitials(name: string | null | undefined): string {
	return (name ?? '')
		.normalize('NFC')
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.slice(-2)
		.map(w => w.charAt(0).toUpperCase())
		.join('');
}
