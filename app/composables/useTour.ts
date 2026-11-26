import { useAuthStore } from '~/stores/auth';
import type { TourEndReason, TourFactory, TourState } from '~/types/tour.types';
import { countSteps, hasSeenTour, markTourSeen, nextStepIndex, stepEnabled, tourCounter, tourStorageKey } from '~/utils/tour';

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
	/** Tour được chọn từ danh sách hướng dẫn trước khi trang đích kịp đăng ký nó (đang chuyển trang). */
	const pending = useState<string | null>('tour-pending', () => null);
	/** Khoá "đã xem" của các tour tự hiện (`usePageTour`), để Xong hay Bỏ qua ghi nhớ cả khi mở bằng tay. */
	const seenKeys = useState<Record<string, () => string>>('tour-seen-keys', () => ({}));

	function register(id: string, factory: TourFactory) {
		registry.value = { ...registry.value, [id]: markRaw(factory) };
		if (pending.value === id) {
			pending.value = null;
			// Đợi trang vẽ xong một nhịp; phần tử nào chưa có thì tour vẫn tự chờ từng bước.
			setTimeout(() => start(id), 300);
		}
	}

	/**
	 * Chạy tour `id` ngay nếu trang hiện tại đã đăng ký, không thì chờ trang đích đăng ký rồi mới
	 * chạy. Dùng khi chọn hướng dẫn ở trang khác: gọi hàm này rồi mới chuyển trang.
	 */
	function startWhenReady(id: string) {
		if (registry.value[id]) {
			start(id);
			return;
		}
		pending.value = id;
	}

	function cancelPending() {
		pending.value = null;
	}

	/**
	 * Gỡ tour khi trang rời đi. Truyền `factory` thì chỉ gỡ khi tour đang đăng ký đúng là của trang
	 * này: hai trang có thể đăng ký cùng `id` (nửa đầu ở trang danh sách, nửa sau ở trang tạo), và
	 * trang cũ gỡ muộn không được xoá tour trang mới vừa đăng ký.
	 */
	function unregister(id: string, factory?: TourFactory) {
		if (factory && registry.value[id] !== factory) return;
		const { [id]: _removed, ...rest } = registry.value;
		registry.value = rest;
		if (state.value?.tour.id === id) finish('route');
	}

	function currentStep() {
		const s = state.value;
		return s ? (s.tour.steps[s.index] ?? null) : null;
	}

	/** Đổi sang bước `index` (đã chọn sẵn), gọi `onExit` của bước cũ và `onEnter` của bước mới. */
	function enter(s: TourState, index: number, dir: 1 | -1) {
		currentStep()?.onExit?.();
		s.index = index;
		s.dir = dir;
		s.phase = 'waiting';
		// Số bước đã khác lúc bắt đầu (dữ liệu về làm `when` đổi, có bước bị bỏ) thì thôi ghi tổng.
		if (s.exact && countSteps(s.tour.steps, s.skipped) !== s.total) s.exact = false;
		s.tour.steps[index]?.onEnter?.();
	}

	/**
	 * Sang bước kế theo chiều `dir`. Đi tới thì tìm bước kế còn hiện, hết bước là xong tour. Lùi thì
	 * về đúng bước vừa xem trước đó (theo `history`), hết thì đứng yên.
	 */
	function move(dir: 1 | -1) {
		const s = state.value;
		if (!s) return;
		if (dir === 1) {
			const next = nextStepIndex(s.tour.steps, s.index, 1, s.skipped);
			if (next < 0) {
				finish('done');
				return;
			}
			s.history = [...s.history, next];
			enter(s, next, 1);
			return;
		}
		// Bước trước giờ không còn hiện (dữ liệu vừa đổi) thì lùi qua luôn.
		const earlier = s.history.slice(0, -1).filter(i => stepEnabled(s.tour.steps[i]!));
		const prev = earlier[earlier.length - 1];
		if (prev === undefined) return;
		s.history = earlier;
		enter(s, prev, -1);
	}

	/**
	 * Phần tử của bước hiện tại không xuất hiện: đi tiếp theo chiều đang đi.
	 *
	 * Chỉ khi đi tới mới ghi bước vào `skipped`. Khi lùi, bước vắng phần tử thường là bước trong khung
	 * nhập vừa đóng: bỏ qua lượt này thôi, lần đi tới sau vẫn phải có nó.
	 */
	function skipCurrent() {
		const s = state.value;
		if (!s) return;
		// Bước không hiện thì không tính là đã xem: gỡ khỏi `history` để số "Bước n" không nhảy.
		s.history = s.history.slice(0, -1);
		if (s.dir === 1) {
			s.skipped = [...s.skipped, s.index];
			move(1);
			return;
		}
		const prev = s.history[s.history.length - 1];
		if (prev !== undefined) {
			enter(s, prev, -1);
			return;
		}
		// Lùi mà không còn bước nào phía trước thì quay đầu đi tới, kẻo tour đứng trên một bước trống.
		move(1);
	}

	function markShown() {
		if (state.value) state.value.phase = 'shown';
	}

	/**
	 * Kết thúc tour. Chỉ Xong (`done`) và Bỏ qua (`skip`, gồm cả phím Esc) mới ghi "đã xem": đổi trang,
	 * tải lại hay mở tour khác giữa chừng là bỏ dở, lần sau tour tự hiện lại từ đầu.
	 */
	function finish(reason: TourEndReason) {
		const s = state.value;
		if (!s) return;
		state.value = null;
		if (reason === 'done' || reason === 'skip') {
			const key = seenKeys.value[s.tour.id]?.();
			if (key) markTourSeen(key);
		}
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
		const def = markRaw(factory());
		state.value = {
			tour: def,
			index: -1,
			skipped: [],
			history: [],
			total: countSteps(def.steps),
			exact: true,
			phase: 'waiting',
			dir: 1,
		};
		move(1);
		if (!state.value) return false;
		return true;
	}

	/** Gắn khoá "đã xem" cho tour `id`. Gỡ (`key` null) chỉ khi khoá đang gắn đúng là `owner`, như `unregister`. */
	function setSeenKey(id: string, key: (() => string) | null, owner?: () => string) {
		if (!key && owner && seenKeys.value[id] !== owner) return;
		const { [id]: _removed, ...rest } = seenKeys.value;
		seenKeys.value = key ? { ...rest, [id]: markRaw(key) } : rest;
	}

	const counter = computed(() => {
		const s = state.value;
		return s ? tourCounter(s.history.length, s.total, s.exact) : { number: 0, total: null };
	});

	/** Bước đang đứng là bước cuối còn hiện: nút chính ghi Xong. */
	const isLast = computed(() => {
		const s = state.value;
		return !!s && nextStepIndex(s.tour.steps, s.index, 1, s.skipped) < 0;
	});

	return {
		state,
		counter,
		isLast,
		currentStep,
		pending,
		setSeenKey,
		register,
		unregister,
		start,
		startWhenReady,
		cancelPending,
		move,
		skipCurrent,
		markShown,
		finish,
	};
}

/**
 * Đăng ký một tour theo tính năng cho trang đang mở, KHÔNG tự hiện cho người mới.
 *
 * Một trang có thể có nhiều tour kiểu này (trang Cài đặt có tour danh mục và tour định mức);
 * người dùng mở chúng từ nút Hướng dẫn nổi bên phải (`AppGuideFab`).
 */
export function useGuideTour(id: string, factory: TourFactory) {
	const tour = useTour();
	onMounted(() => tour.register(id, factory));
	onBeforeUnmount(() => tour.unregister(id, factory));
}

/**
 * Đăng ký tour cho trang đang mở và tự hiện tour một lần cho người mới.
 *
 * Tự hiện chỉ sau khi `ready()` trả true (trang đã tải xong dữ liệu, không lỗi, module dùng được).
 * Chỉ ghi "đã xem" khi người dùng bấm Xong hoặc Bỏ qua (xem `finish`); bỏ dở giữa chừng (đổi
 * trang, tải lại) thì lần sau tour hiện lại từ đầu.
 */
export function usePageTour(id: string, factory: TourFactory, ready: () => boolean) {
	const tour = useTour();
	const authStore = useAuthStore();
	let autoTried = false;
	let timer: ReturnType<typeof setTimeout> | null = null;
	const seenKey = () => tourStorageKey(authStore.company?.code, authStore.user?.id, id, factory().version);

	function tryAutoStart() {
		if (autoTried || !ready()) return;
		autoTried = true;
		if (hasSeenTour(seenKey())) return;
		// Chờ trang dựng xong một nhịp (thẻ, bảng vừa có dữ liệu) để ô sáng không nhảy.
		timer = setTimeout(() => {
			timer = null;
			if (tour.state.value) return;
			tour.start(id);
		}, 500);
	}

	onMounted(() => {
		tour.register(id, factory);
		tour.setSeenKey(id, seenKey);
		watch(ready, tryAutoStart, { immediate: true });
	});

	onBeforeUnmount(() => {
		if (timer) clearTimeout(timer);
		// Gỡ theo đúng hàm của trang, như `useGuideTour`: Dự án và trang một dự án đăng ký chung `id`.
		tour.unregister(id, factory);
		tour.setSeenKey(id, null, seenKey);
	});

	return { start: () => tour.start(id) };
}
