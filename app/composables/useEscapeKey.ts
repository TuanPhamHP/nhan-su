/**
 * Gọi `handler` khi người dùng nhấn Esc, dùng cho hộp thoại tự vẽ bằng `Teleport`.
 *
 * Đăng ký khi component gắn vào trang và gỡ khi nó rời đi, nên hộp thoại nào đang mở thì hộp
 * đó nghe. `enabled` cho phép tạm tắt, ví dụ lúc đang gửi để không đóng giữa chừng.
 *
 * Phím Esc mà một lớp nằm trên đã dùng (lịch chọn ngày, ô chọn, menu, xem `useEscapeLayer`) thì
 * hộp thoại bỏ qua, nên một lần Esc chỉ đóng thứ trên cùng.
 */
export function useEscapeKey(handler: () => void, enabled: () => boolean = () => true) {
	function onKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape' || e.defaultPrevented || !enabled()) return;
		handler();
	}
	onMounted(() => window.addEventListener('keydown', onKeydown));
	onUnmounted(() => window.removeEventListener('keydown', onKeydown));
}

/**
 * Cho một lớp nổi nhỏ (lịch, danh sách chọn, menu) giữ phím Esc khi đang mở: Esc chỉ đóng lớp đó
 * và đánh dấu đã dùng, hộp thoại chứa nó không đóng theo.
 *
 * Nghe ở pha capture của `window` nên chạy trước `useEscapeKey` dù con trỏ đang ở đâu trong trang.
 */
export function useEscapeLayer(isOpen: () => boolean, close: () => void) {
	function onKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape' || e.defaultPrevented || !isOpen()) return;
		e.preventDefault();
		close();
	}
	onMounted(() => window.addEventListener('keydown', onKeydown, true));
	onUnmounted(() => window.removeEventListener('keydown', onKeydown, true));
}
