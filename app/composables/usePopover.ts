import type { Ref } from 'vue';

/** Chỗ trống tối thiểu bên dưới nút để mở hộp xuống dưới; ít hơn thì mở lên trên. */
const MIN_SPACE_BELOW = 280;

/**
 * Hộp nhỏ neo vào một nút: đặt `absolute` trong khung `relative` của nút nên không đẩy trang.
 *
 * Bấm ra ngoài khung hoặc nhấn Esc thì đóng. Nút ở gần đáy màn hình thì hộp mở lên trên, để dòng
 * cuối danh sách không mở ra một hộp nằm khuất dưới thanh dưới cùng. Trình nghe sự kiện chỉ gắn
 * khi hộp đang mở: một trang có cả trăm hộp như vậy, gắn sẵn hết thì mỗi cú bấm chạy cả trăm hàm.
 *
 * Truyền `open` từ ngoài vào khi nơi khác cũng cần đóng mở hộp, ví dụ hướng dẫn từng bước.
 */
export function usePopover(open: Ref<boolean> = ref(false)) {
	const root = ref<HTMLElement | null>(null);
	const above = ref(false);
	/** Nút ở nửa phải màn hình thì hộp canh theo mép phải nút, không thì theo mép trái, để không bị cắt. */
	const alignEnd = ref(true);

	function show() {
		const rect = root.value?.getBoundingClientRect();
		above.value = !!rect && window.innerHeight - rect.bottom < MIN_SPACE_BELOW && rect.top > MIN_SPACE_BELOW;
		alignEnd.value = !rect || rect.right > window.innerWidth / 2;
		open.value = true;
	}

	function close() {
		open.value = false;
	}

	function toggle() {
		if (open.value) close();
		else show();
	}

	function onPointerDown(event: PointerEvent) {
		if (root.value && event.target instanceof Node && !root.value.contains(event.target)) close();
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || event.defaultPrevented) return;
		// Esc đã đóng popover thì không đóng tiếp khung chứa nó (hộp thoại, bảng toàn màn hình).
		event.preventDefault();
		close();
		root.value?.querySelector<HTMLElement>('[data-popover-trigger]')?.focus();
	}

	function unbind() {
		document.removeEventListener('pointerdown', onPointerDown);
		document.removeEventListener('keydown', onKeydown);
	}

	watch(open, value => {
		if (!import.meta.client) return;
		unbind();
		if (value) {
			document.addEventListener('pointerdown', onPointerDown);
			document.addEventListener('keydown', onKeydown);
		}
	});

	onUnmounted(unbind);

	return { open, root, above, alignEnd, show, close, toggle };
}
