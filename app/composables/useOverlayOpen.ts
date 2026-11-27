/**
 * Có hộp thoại hay khung trượt nào đang mở trên trang không (phần tử `role="dialog"`, `alertdialog` hoặc
 * `aria-modal`), để các nút nổi như Hướng dẫn tự ẩn, không đè lên khung chi tiết việc hay hộp xác nhận.
 *
 * Theo dõi thay đổi của `body` (các hộp được `Teleport` ra đó), gom lại mỗi khung hình một lần. Phần tử
 * có `data-overlay-ignore` (bảng của chính nút nổi) không tính.
 */
export function useOverlayOpen() {
	const open = ref(false);
	let observer: MutationObserver | null = null;
	let frame = 0;

	function check() {
		frame = 0;
		open.value = !!document.querySelector(
			'[role="dialog"]:not([data-overlay-ignore]), [role="alertdialog"]:not([data-overlay-ignore]), [aria-modal="true"]:not([data-overlay-ignore])',
		);
	}

	onMounted(() => {
		check();
		observer = new MutationObserver(() => {
			if (!frame) frame = requestAnimationFrame(check);
		});
		observer.observe(document.body, { childList: true, subtree: true });
	});
	onBeforeUnmount(() => {
		observer?.disconnect();
		if (frame) cancelAnimationFrame(frame);
	});

	return open;
}
