import { useAuthStore } from '~/stores/auth';
import type { TourEndReason, TourFactory, TourState } from '~/types/tour.types';
import { hasSeenTour, markTourSeen, nextStepIndex, stepCounter, tourStorageKey } from '~/utils/tour';

/**
 * Điều khiển hướng dẫn từng bước dùng chung cả app.
 *
 * Trang đăng ký tour của mình bằng `usePageTour`; nút Hướng dẫn ở đầu trang gọi `start(id)`;
 * `UiTourOverlay` (gắn một lần ở layout) đọc `state` để vẽ lớp phủ, chờ phần tử của từng bước và
 * gọi `skipCurrent` khi phần tử không xuất hiện. Mỗi lúc chỉ có một tour chạy.
 *
 * State nằm trong `useState` chứ không ở biến module, để không lẫn giữa các request khi SSR.
 */
export function useTour() {
	const state = useState<TourState | null>('tour-state', () => null);
	const registry = useState<Record<string, TourFactory>>('tour-registry', () => ({}));

	function register(id: string, factory: TourFactory) {
		registry.value = { ...registry.value, [id]: markRaw(factory) };
	}

	function unregister(id: string) {
		const { [id]: _removed, ...rest } = registry.value;
		registry.value = rest;
		if (state.value?.tour.id === id) finish('route');
	}

	function currentStep() {
		const s = state.value;
		return s ? (s.tour.steps[s.index] ?? null) : null;
	}

	/** Sang bước kế theo chiều `dir`. Hết bước khi đi tới là xong tour; hết khi lùi thì đứng yên. */
	function move(dir: 1 | -1) {
		const s = state.value;
		if (!s) return;
		const next = nextStepIndex(s.tour.steps, s.index, dir, s.skipped);
		if (next < 0) {
			if (dir === 1) finish('done');
			return;
		}
		currentStep()?.onExit?.();
		s.index = next;
		s.dir = dir;
		s.phase = 'waiting';
		s.tour.steps[next]?.onEnter?.();
	}

	/**
	 * Phần tử của bước hiện tại không xuất hiện: đi tiếp theo chiều đang đi.
	 *
	 * Chỉ khi đi tới mới ghi bước vào `skipped` (và bớt khỏi số bước). Khi lùi, bước vắng phần tử
	 * thường là bước trong khung nhập vừa đóng: bỏ qua lượt này thôi, lần đi tới sau vẫn phải có nó.
	 */
	function skipCurrent() {
		const s = state.value;
		if (!s) return;
		if (s.dir === 1) {
			s.skipped = [...s.skipped, s.index];
			move(1);
			return;
		}
		// Lùi mà không còn bước nào phía trước thì quay đầu đi tới, kẻo tour đứng trên một bước trống.
		if (nextStepIndex(s.tour.steps, s.index, -1, s.skipped) < 0) move(1);
		else move(-1);
	}

	function markShown() {
		if (state.value) state.value.phase = 'shown';
	}

	/** Kết thúc tour. Lý do chưa dùng tới, giữ lại để ghi số liệu khi cần. */
	function finish(_reason: TourEndReason) {
		const s = state.value;
		if (!s) return;
		state.value = null;
		const step = s.tour.steps[s.index];
		try {
			step?.onExit?.();
			s.tour.onEnd?.();
		} catch {
			// Dọn dẹp hỏng cũng không được giữ lớp phủ lại trên trang.
		}
	}

	/** Chạy tour `id` từ đầu. Trả `false` khi trang hiện tại không có tour đó. */
	function start(id: string): boolean {
		const factory = registry.value[id];
		if (!factory) return false;
		if (state.value) finish('replace');
		state.value = { tour: markRaw(factory()), index: -1, skipped: [], phase: 'waiting', dir: 1 };
		move(1);
		if (!state.value) return false;
		return true;
	}

	const counter = computed(() => {
		const s = state.value;
		return s ? stepCounter(s.tour.steps, s.index, s.skipped) : { number: 0, total: 0 };
	});

	return { state, counter, currentStep, register, unregister, start, move, skipCurrent, markShown, finish };
}

/**
 * Đăng ký tour cho trang đang mở và tự hiện tour một lần cho người mới.
 *
 * Tự hiện chỉ sau khi `ready()` trả true (trang đã tải xong dữ liệu, không lỗi, module dùng được).
 * Đánh dấu "đã xem" ngay lúc tự hiện, nên người dùng thoát giữa chừng cũng không bị hiện lại;
 * muốn xem lại thì bấm nút Hướng dẫn.
 */
export function usePageTour(id: string, factory: TourFactory, ready: () => boolean) {
	const tour = useTour();
	const authStore = useAuthStore();
	let autoTried = false;
	let timer: ReturnType<typeof setTimeout> | null = null;

	function tryAutoStart() {
		if (autoTried || !ready()) return;
		autoTried = true;
		const { version } = factory();
		const key = tourStorageKey(authStore.company?.code, authStore.user?.id, id, version);
		if (hasSeenTour(key)) return;
		// Chờ trang dựng xong một nhịp (thẻ, bảng vừa có dữ liệu) để ô sáng không nhảy.
		timer = setTimeout(() => {
			timer = null;
			if (tour.state.value) return;
			markTourSeen(key);
			tour.start(id);
		}, 500);
	}

	onMounted(() => {
		tour.register(id, factory);
		watch(ready, tryAutoStart, { immediate: true });
	});

	onBeforeUnmount(() => {
		if (timer) clearTimeout(timer);
		tour.unregister(id);
	});

	return { start: () => tour.start(id) };
}
