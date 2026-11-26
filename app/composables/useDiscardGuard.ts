import { useEscapeKey } from '~/composables/useEscapeKey';

/**
 * Hỏi lại trước khi đóng một form đang có chữ: Esc, nút X, bấm ra nền hay nút Huỷ đều đi qua
 * `requestClose`. Form trống thì đóng ngay; có chữ thì bật `asking` để hộp "Bỏ nội dung đang soạn?" hiện.
 *
 * Esc khi hộp hỏi đang hiện là "Soạn tiếp", không phải đóng form. Lớp nổi bên trong form (lịch, ô chọn)
 * giữ Esc của nó trước (`useEscapeLayer`), nên Esc lúc đang mở lịch chỉ đóng lịch.
 */
export function useDiscardGuard(isDirty: () => boolean, close: () => void, enabled: () => boolean = () => true) {
	const asking = ref(false);

	function requestClose() {
		if (!enabled()) return;
		if (isDirty()) asking.value = true;
		else close();
	}

	function keepEditing() {
		asking.value = false;
	}

	function discard() {
		asking.value = false;
		close();
	}

	useEscapeKey(() => (asking.value ? keepEditing() : requestClose()), enabled);

	return { asking, requestClose, keepEditing, discard };
}
