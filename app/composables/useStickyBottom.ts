import type { Ref } from 'vue';

/**
 * Mép dưới của một thanh dính (`sticky`), để các tiêu đề dính bên dưới đặt `top` ngay dưới nó chứ
 * không chui vào.
 *
 * Thanh dính trong `<main>` dùng `top` âm bằng đúng phần đệm của `<main>` (`-top-4 lg:-top-6`): vị trí
 * dính tính từ mép trong phần đệm, nên `top: 0` để hở một khe cho dòng lọt qua khi cuộn. Vì vậy mép
 * dưới là `top` cộng chiều cao, đo lại khi thanh đổi cỡ hay khi cửa sổ đổi khổ (đổi `lg`).
 */
export function useStickyBottom(el: Ref<HTMLElement | null>) {
	const bottom = ref(0);
	let observer: ResizeObserver | null = null;

	function measure() {
		const node = el.value;
		if (!node) return;
		bottom.value = (parseFloat(getComputedStyle(node).top) || 0) + node.offsetHeight;
	}

	onMounted(() => {
		// Thanh thường chỉ có sau khi dữ liệu tải xong, nên tạo sẵn bộ quan sát và gắn vào khi nó hiện.
		observer = new ResizeObserver(measure);
		if (el.value) observer.observe(el.value);
		window.addEventListener('resize', measure);
	});

	watch(el, node => {
		observer?.disconnect();
		if (node) observer?.observe(node);
	});

	onUnmounted(() => {
		observer?.disconnect();
		window.removeEventListener('resize', measure);
	});

	return { bottom };
}
