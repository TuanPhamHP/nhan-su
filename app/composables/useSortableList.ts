import Sortable from 'sortablejs';
import type { Ref } from 'vue';

/**
 * Bọc SortableJS cho một vùng thả (một cột bảng việc, một nhóm danh sách).
 *
 * Vì sao trả DOM về chỗ cũ trước khi báo ra ngoài: SortableJS tự dời phần tử trong DOM, còn Vue
 * giữ danh sách theo dữ liệu. Để cả hai cùng sửa thì Vue và DOM lệch nhau, thẻ nhân đôi hoặc biến
 * mất. Nên khi thả, ở đây đọc vị trí mới (thẻ ngay trên, ngay dưới, vùng đích) rồi đặt phần tử về
 * đúng chỗ cũ; trang đổi dữ liệu và để Vue vẽ lại. Máy chủ từ chối thì trang chỉ cần không đổi gì.
 *
 * Mọi vùng cùng `group` kéo qua lại được. Thẻ phải có `data-sortable-id`; phần tử khác trong vùng
 * (ô tạo nhanh, dòng trống) không kéo được và không tính khi tìm thẻ cạnh.
 */
export interface SortableDropEvent {
	id: number;
	/** `data-sortable-zone` của vùng bắt đầu và vùng thả. */
	fromZone: string;
	toZone: string;
	/** Thẻ ngay trên chỗ thả (`beforeId` của API) và ngay dưới (`afterId`). */
	beforeId: number | null;
	afterId: number | null;
	/** Vị trí mới trong vùng thả, tính trên các thẻ kéo được, bắt đầu từ 0. */
	newIndex: number;
}

export interface SortableListOptions {
	group: string;
	/** Bắt đầu kéo một thẻ: trang làm mờ vùng không thả được. */
	onStart?: (id: number, fromZone: string) => void;
	/** Thả xong (kể cả thả về chỗ cũ). */
	onDrop: (event: SortableDropEvent) => void;
	/** Kéo xong dù thả hay không, để trang bỏ trạng thái mờ. */
	onEnd?: () => void;
	disabled?: () => boolean;
}

const ITEM_SELECTOR = '[data-sortable-id]';

function idOf(el: Element | null): number | null {
	const raw = el?.getAttribute('data-sortable-id');
	return raw ? Number(raw) : null;
}

function siblingId(el: Element, dir: 'prev' | 'next'): number | null {
	let cur = dir === 'prev' ? el.previousElementSibling : el.nextElementSibling;
	while (cur) {
		if (cur.matches(ITEM_SELECTOR)) return idOf(cur);
		cur = dir === 'prev' ? cur.previousElementSibling : cur.nextElementSibling;
	}
	return null;
}

export function useSortableList(el: Ref<HTMLElement | null | undefined>, options: SortableListOptions) {
	let instance: Sortable | null = null;
	let startNext: Node | null = null;

	function create(target: HTMLElement) {
		instance = Sortable.create(target, {
			group: options.group,
			draggable: ITEM_SELECTOR,
			animation: 150,
			// Kéo bằng sự kiện chuột/cảm ứng thay vì kéo thả HTML5: chạy được trên điện thoại và tự
			// cuộn khi kéo gần mép, đúng hai việc kéo thả HTML5 tự viết hiện có không làm được.
			forceFallback: true,
			fallbackOnBody: true,
			fallbackTolerance: 4,
			// Trên màn cảm ứng phải giữ một nhịp mới kéo, để vuốt cuộn cột không thành kéo nhầm thẻ.
			delay: 180,
			delayOnTouchOnly: true,
			scroll: true,
			bubbleScroll: true,
			ghostClass: 'task-sortable-ghost',
			chosenClass: 'task-sortable-chosen',
			dragClass: 'task-sortable-drag',
			filter: '[data-no-drag]',
			preventOnFilter: false,
			disabled: options.disabled?.() ?? false,
			onStart(evt) {
				startNext = evt.item.nextSibling;
				const id = idOf(evt.item);
				if (id != null) options.onStart?.(id, evt.from.dataset.sortableZone ?? '');
			},
			onEnd(evt) {
				const item = evt.item;
				const id = idOf(item);
				const toZone = evt.to.dataset.sortableZone ?? '';
				const fromZone = evt.from.dataset.sortableZone ?? '';
				const beforeId = siblingId(item, 'prev');
				const afterId = siblingId(item, 'next');
				const items = Array.from(evt.to.querySelectorAll(`:scope > ${ITEM_SELECTOR}`));
				const newIndex = items.indexOf(item);
				// Trả phần tử về chỗ cũ, để Vue là bên duy nhất vẽ lại theo dữ liệu.
				if (item.parentNode) item.parentNode.removeChild(item);
				evt.from.insertBefore(item, startNext && startNext.parentNode === evt.from ? startNext : null);
				startNext = null;
				options.onEnd?.();
				if (id != null) options.onDrop({ id, fromZone, toZone, beforeId, afterId, newIndex });
			},
		});
	}

	function destroy() {
		instance?.destroy();
		instance = null;
	}

	onMounted(() => {
		watch(
			el,
			target => {
				destroy();
				if (target) create(target);
			},
			{ immediate: true },
		);
		if (options.disabled) {
			watch(options.disabled, value => instance?.option('disabled', value));
		}
	});

	onBeforeUnmount(destroy);

	return { destroy };
}
