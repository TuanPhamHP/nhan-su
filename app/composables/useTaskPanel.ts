/**
 * Khung chi tiết việc trượt từ phải, mở từ mọi danh sách (UI-02).
 *
 * Việc đang mở nằm trên đường dẫn của chính trang danh sách (`?task=HQ-12`), cạnh bộ lọc, thẻ, chế độ
 * xem đang có, nên tải lại trang hay gửi đường dẫn cho đồng nghiệp vẫn ra đúng danh sách đó kèm khung.
 * `route.query.task` là nguồn duy nhất: khung mở khi có, đóng khi không. Trang dùng `ssr: false` nên đổi
 * query không gỡ trang phía sau.
 *
 * Mở khung là một bước lịch sử mới (Quay lại thì đóng khung); đang mở mà chọn việc khác thì thay tại chỗ.
 * Bấm X hay Esc: bước hiện tại do khung đẩy vào (bước trước đúng là trang này khi chưa mở khung) thì lùi
 * lại một bước, còn vào thẳng từ đường dẫn thì bỏ `task` tại chỗ và ở lại trang.
 *
 * Trang đầy đủ `pages/cong-viec/[code].vue` vẫn dùng cho thông báo, Ctrl+bấm, nút Mở trang đầy đủ.
 */
export function useTaskPanel() {
	const route = useRoute();
	const router = useRouter();

	const code = computed<string | null>(() => {
		const raw = route.query.task;
		const v = Array.isArray(raw) ? raw[0] : raw;
		return v ? String(v) : null;
	});

	function open(taskCode: string) {
		const query = { ...route.query, task: taskCode };
		// Đang mở việc khác: thay tại chỗ, không chồng thêm một bước Quay lại.
		if (code.value) router.replace({ query });
		else router.push({ query });
	}

	/** Query của trang khi không có khung: bỏ việc đang mở. */
	function queryWithoutPanel() {
		const query = { ...route.query };
		delete query.task;
		return query;
	}

	function close() {
		if (!code.value) return;
		const query = queryWithoutPanel();
		// Vue Router giữ đường dẫn bước trước ở `history.state.back`.
		const back = import.meta.client ? (window.history.state as { back?: string | null } | null)?.back : null;
		if (back && back === router.resolve({ path: route.path, query }).fullPath) router.back();
		else router.replace({ query });
	}

	return { code, open, close };
}
