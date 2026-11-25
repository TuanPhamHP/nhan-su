/**
 * Khung chi tiết việc trượt từ phải, mở từ mọi danh sách (UI-02).
 *
 * Mở khung thì đường dẫn trên trình duyệt đổi thành `/cong-viec/<số hiệu>` để sao chép, gửi cho
 * đồng nghiệp được; nút Quay lại của trình duyệt đóng khung. Đường dẫn đổi bằng `history.pushState`
 * chứ không qua router, vì đi qua router thì trang danh sách phía sau bị gỡ và người dùng mất chỗ
 * đang xem. `state` của router được chép nguyên (cùng `position`), nên khi bấm Quay lại router thấy
 * vẫn là trang danh sách cũ và không điều hướng gì; ở đây nghe `popstate` để đóng khung.
 *
 * Mở thẳng đường dẫn đó (tải lại trang, bấm từ thông báo) thì là trang đầy đủ `pages/cong-viec/[code].vue`.
 */
export function useTaskPanel() {
	const code = useState<string | null>('task-panel-code', () => null);
	/** Đường dẫn trang danh sách lúc mở khung, để đóng khung thì trả đúng về đó. */
	const baseUrl = useState<string | null>('task-panel-base', () => null);
	const pushed = useState<boolean>('task-panel-pushed', () => false);

	function open(taskCode: string) {
		if (!import.meta.client) return;
		const url = `/cong-viec/${encodeURIComponent(taskCode)}`;
		if (code.value) {
			// Đang mở việc khác: thay đường dẫn tại chỗ, không chồng thêm một bước Quay lại.
			window.history.replaceState(window.history.state, '', url);
		} else {
			baseUrl.value = window.location.pathname + window.location.search;
			window.history.pushState(window.history.state, '', url);
			pushed.value = true;
		}
		code.value = taskCode;
	}

	/** Đóng khung; `fromPopstate` khi trình duyệt đã tự lùi đường dẫn. */
	function close(fromPopstate = false) {
		if (!code.value) return;
		code.value = null;
		if (!import.meta.client) return;
		if (pushed.value && !fromPopstate) {
			pushed.value = false;
			window.history.back();
			return;
		}
		pushed.value = false;
		if (!fromPopstate && baseUrl.value) window.history.replaceState(window.history.state, '', baseUrl.value);
	}

	/** Gắn ở trang có khung: nghe nút Quay lại, và đóng khung khi rời trang. */
	function bindPage() {
		function onPopState() {
			if (code.value) {
				code.value = null;
				pushed.value = false;
			}
		}
		onMounted(() => window.addEventListener('popstate', onPopState));
		onBeforeUnmount(() => {
			window.removeEventListener('popstate', onPopState);
			code.value = null;
			pushed.value = false;
		});
	}

	return { code, open, close, bindPage };
}
