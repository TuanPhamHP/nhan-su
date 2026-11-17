/**
 * Gọi `handler` khi người dùng nhấn Esc, dùng cho hộp thoại tự vẽ bằng `Teleport`.
 *
 * Đăng ký khi component gắn vào trang và gỡ khi nó rời đi, nên hộp thoại nào đang mở thì hộp
 * đó nghe. `enabled` cho phép tạm tắt, ví dụ lúc đang gửi để không đóng giữa chừng.
 */
export function useEscapeKey(handler: () => void, enabled: () => boolean = () => true) {
	function onKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape' || e.defaultPrevented || !enabled()) return;
		handler();
	}
	onMounted(() => window.addEventListener('keydown', onKeydown));
	onUnmounted(() => window.removeEventListener('keydown', onKeydown));
}
