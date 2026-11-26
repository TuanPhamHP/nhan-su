import type { Ref } from 'vue';

const FOCUSABLE =
	'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Giữ Tab trong một hộp thoại: Tab ở phần tử cuối quay về phần tử đầu và ngược lại.
 *
 * Khi gắn vào trang thì đưa con trỏ vào `initial` (hoặc phần tử đầu tiên bấm được), khi gỡ thì trả
 * con trỏ về chỗ cũ, để người dùng bàn phím đóng hộp xong vẫn đứng đúng nút đã mở nó.
 */
export function useFocusTrap(container: Ref<HTMLElement | null>, initial?: () => HTMLElement | null | undefined) {
	let previous: HTMLElement | null = null;

	function focusables(): HTMLElement[] {
		return [...(container.value?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter(
			el => el.offsetParent !== null || el === document.activeElement,
		);
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key !== 'Tab' || !container.value) return;
		const list = focusables();
		const first = list[0];
		const last = list[list.length - 1];
		if (!first || !last) return;
		const active = document.activeElement;
		if (event.shiftKey && (active === first || !container.value.contains(active))) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && (active === last || !container.value.contains(active))) {
			event.preventDefault();
			first.focus();
		}
	}

	onMounted(() => {
		previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		document.addEventListener('keydown', onKeydown);
		nextTick(() => (initial?.() ?? focusables()[0])?.focus());
	});

	onUnmounted(() => {
		document.removeEventListener('keydown', onKeydown);
		previous?.focus();
	});
}
