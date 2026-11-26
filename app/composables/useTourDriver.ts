import type { TourRect } from '~/types/tour.types';
import { padRect, placeTourBox, roundedRectPath, sheetSide, unionRects } from '~/utils/tour';

/**
 * Chờ phần tử của một bước tối đa bấy lâu rồi bỏ bước đó (đang tải, không có quyền, danh sách rỗng).
 * Đang chờ thì nút Tiếp vẫn bấm được để bỏ bước ngay, không bắt người dùng ngồi đợi.
 */
const WAIT_MS = 2000;
/** Chờ ngắn thì không hiện chữ "đang chờ", tránh chớp hộp khi khung nhập vừa mở. */
const WAIT_NOTICE_MS = 300;
const HOLE_PAD = 8;
const HOLE_RADIUS = 12;

function findTargets(selector: string): HTMLElement[] {
	try {
		return Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(el => el.getClientRects().length > 0);
	} catch {
		return [];
	}
}

/** Nút thật bên trong phần tử được trỏ, để "Bấm giúp tôi" bấm đúng chỗ người dùng sẽ bấm. */
function clickableOf(el: HTMLElement): HTMLElement | null {
	return el.matches('button, a, [role="button"]') ? el : el.querySelector<HTMLElement>('button, a, [role="button"]');
}

function sameRect(a: TourRect | null, b: TourRect | null) {
	if (!a || !b) return a === b;
	return (
		Math.abs(a.top - b.top) < 0.5 &&
		Math.abs(a.left - b.left) < 0.5 &&
		Math.abs(a.width - b.width) < 0.5 &&
		Math.abs(a.height - b.height) < 0.5
	);
}

/**
 * Phần chạy trên trình duyệt của hướng dẫn từng bước, dùng riêng cho `UiTourOverlay`.
 *
 * Việc của nó: chờ phần tử của bước hiện ra, cuộn tới, khoá bấm (bước `info`) hoặc nghe cú bấm
 * (bước `click`), bám theo phần tử khi trang cuộn hay đổi cỡ, giữ phím Tab trong hộp và Esc để bỏ
 * qua. Bám theo bằng một vòng `requestAnimationFrame` chỉ chạy khi tour đang mở: một vòng đọc vị
 * trí bắt được mọi kiểu dịch chuyển (cuộn trong `<main>` hay trong khung nhập, cửa sổ đổi cỡ, nội
 * dung phía trên vừa tải xong đẩy xuống) mà không phải gắn từng loại sự kiện.
 */
export function useTourDriver() {
	const tour = useTour();
	const { state, counter, isLast, currentStep, move, skipCurrent, markShown, finish } = tour;
	const route = useRoute();

	const targetEls = shallowRef<HTMLElement[]>([]);
	const hole = ref<TourRect | null>(null);
	const view = reactive({ width: 0, height: 0 });
	const boxSize = reactive({ width: 0, height: 0 });
	const boxRef = ref<HTMLElement | null>(null);
	const primaryRef = ref<HTMLButtonElement | null>(null);
	const waitingLong = ref(false);

	const step = computed(() => currentStep());
	const mode = computed(() => step.value?.mode ?? 'info');
	const shown = computed(() => state.value?.phase === 'shown');
	const isPhone = computed(() => view.width > 0 && view.width < 640);
	const canBack = computed(() => counter.value.number > 1);

	let token = 0;
	let pollTimer: ReturnType<typeof setTimeout> | null = null;
	let noticeTimer: ReturnType<typeof setTimeout> | null = null;
	let raf = 0;
	let unbind: (() => void) | null = null;
	let returnFocus: HTMLElement | null = null;

	function clearTimers() {
		if (pollTimer) clearTimeout(pollTimer);
		if (noticeTimer) clearTimeout(noticeTimer);
		pollTimer = null;
		noticeTimer = null;
	}

	function cleanupStep() {
		clearTimers();
		unbind?.();
		unbind = null;
		targetEls.value = [];
		hole.value = null;
		waitingLong.value = false;
	}

	function reducedMotion() {
		return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
	}

	/** Đưa phần tử vào giữa vùng nhìn; phần tử cao hơn nửa màn thì đưa mép trên vào. */
	function reveal(els: HTMLElement[]) {
		const first = els[0];
		if (!first) return;
		const rect = unionRects(els.map(el => el.getBoundingClientRect()));
		const tall = !!rect && rect.height > window.innerHeight * 0.55;
		first.scrollIntoView({ block: tall ? 'start' : 'center', inline: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
	}

	/**
	 * Bước `info`: gắn `inert` cho phần tử, vì có phần tử nằm TRÊN lớp phủ (menu Tác vụ có z-index
	 * riêng) mà lớp chắn của tour không che được. Bước `click`: nghe cú bấm thật rồi sang bước sau,
	 * để trang kịp mở khung nhập hay menu trước.
	 */
	function bind(els: HTMLElement[], stepMode: 'info' | 'click', current: number) {
		if (stepMode === 'info') {
			const prev = els.map(el => el.inert);
			els.forEach(el => (el.inert = true));
			unbind = () => els.forEach((el, i) => (el.inert = prev[i] ?? false));
			return;
		}
		const onClick = () => {
			setTimeout(() => {
				if (token === current && state.value) move(1);
			}, 0);
		};
		els.forEach(el => el.addEventListener('click', onClick, true));
		unbind = () => els.forEach(el => el.removeEventListener('click', onClick, true));
	}

	function focusPrimary() {
		nextTick(() => primaryRef.value?.focus({ preventScroll: true }));
	}

	/** Bắt đầu một bước: tìm phần tử, chờ nếu chưa có, bỏ bước nếu chờ quá lâu. */
	function begin() {
		cleanupStep();
		const s = state.value;
		const st = step.value;
		if (!s || !st) return;
		const current = ++token;

		if (!st.target) {
			markShown();
			focusPrimary();
			return;
		}

		// Lùi về một bước mà phần tử đã mất (khung nhập đã đóng) thì bỏ ngay, không chờ.
		const deadline = Date.now() + (s.dir === -1 ? 0 : WAIT_MS);
		noticeTimer = setTimeout(() => {
			if (token === current) waitingLong.value = true;
		}, WAIT_NOTICE_MS);

		const selector = st.target;
		const stepMode = st.mode ?? 'info';
		const attempt = () => {
			if (token !== current || !state.value) return;
			const els = findTargets(selector);
			if (els.length) {
				clearTimers();
				waitingLong.value = false;
				targetEls.value = els;
				reveal(els);
				bind(els, stepMode, current);
				markShown();
				focusPrimary();
				return;
			}
			if (Date.now() >= deadline) {
				clearTimers();
				skipCurrent();
				return;
			}
			pollTimer = setTimeout(attempt, 100);
		};
		attempt();
	}

	function frame() {
		raf = 0;
		if (!state.value) return;
		view.width = window.innerWidth;
		view.height = window.innerHeight;

		let els = targetEls.value;
		// Trang vẽ lại phần tử (tải lại danh sách, đổi khổ màn) thì tìm lại theo bộ chọn.
		if (els.length && els.some(el => !el.isConnected) && step.value?.target) {
			els = findTargets(step.value.target);
			targetEls.value = els;
		}
		const next = shown.value && els.length ? unionRects(els.map(el => el.getBoundingClientRect())) : null;
		const padded = next ? padRect(next, HOLE_PAD) : null;
		if (!sameRect(hole.value, padded)) hole.value = padded;

		const box = boxRef.value;
		if (box && (box.offsetWidth !== boxSize.width || box.offsetHeight !== boxSize.height)) {
			boxSize.width = box.offsetWidth;
			boxSize.height = box.offsetHeight;
		}
		raf = requestAnimationFrame(frame);
	}

	function startLoop() {
		if (!raf) raf = requestAnimationFrame(frame);
	}

	function stopLoop() {
		if (raf) cancelAnimationFrame(raf);
		raf = 0;
	}

	// ─── Nút trong hộp ───────────────────────────────────────────────────────────

	function onPrimary() {
		if (!shown.value) {
			// Đã báo "đang hiện ra" mà người dùng bấm Tiếp: bỏ bước này, sang bước sau. Chưa báo thì
			// bỏ qua cú bấm, kẻo bấm đúp nút Tiếp làm mất luôn bước kế tiếp.
			if (state.value && waitingLong.value) {
				clearTimers();
				skipCurrent();
			}
			return;
		}
		if (mode.value === 'click') {
			const el = targetEls.value[0];
			const btn = el ? clickableOf(el) : null;
			if (btn) btn.click();
			else move(1);
			return;
		}
		move(1);
	}

	function onBack() {
		move(-1);
	}

	function onSkip() {
		finish('skip');
	}

	// ─── Bàn phím ────────────────────────────────────────────────────────────────

	/**
	 * Nghe ở pha capture của `window` để Esc của tour chạy trước và chặn Esc của khung nhập bên
	 * dưới; khung đó vẫn đóng nhờ `onEnd` của tour.
	 */
	function onKeydown(e: KeyboardEvent) {
		if (!state.value) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopImmediatePropagation();
			finish('skip');
			return;
		}
		if (e.key !== 'Tab' || !boxRef.value) return;
		const focusables = Array.from(boxRef.value.querySelectorAll<HTMLElement>('button:not([disabled])'));
		if (!focusables.length) return;
		const first = focusables[0]!;
		const last = focusables[focusables.length - 1]!;
		const active = document.activeElement as HTMLElement | null;
		const inside = !!active && boxRef.value.contains(active);
		if (e.shiftKey && (!inside || active === first)) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && (!inside || active === last)) {
			e.preventDefault();
			first.focus();
		}
	}

	// ─── Vị trí hộp ──────────────────────────────────────────────────────────────

	const sheetAtTop = computed(() => isPhone.value && sheetSide(hole.value, boxSize.height, view.height) === 'top');

	const boxStyle = computed<Record<string, string>>(() => {
		if (!boxSize.height) return { visibility: 'hidden' };
		if (isPhone.value) return {};
		const pos = placeTourBox(hole.value, boxSize, view);
		return { top: `${pos.top}px`, left: `${pos.left}px` };
	});

	const dimPath = computed(() => {
		const full = `M0 0H${view.width}V${view.height}H0Z`;
		return hole.value ? `${full} ${roundedRectPath(hole.value, HOLE_RADIUS)}` : full;
	});

	const holeStyle = computed<Record<string, string>>(() => {
		const h = hole.value;
		if (!h) return {};
		return { top: `${h.top}px`, left: `${h.left}px`, width: `${h.width}px`, height: `${h.height}px` };
	});

	/** Bốn tấm chắn trong suốt quanh ô sáng: bấm ra ngoài không chạm được trang. */
	const blockers = computed<Record<string, string>[]>(() => {
		const h = hole.value;
		if (!h) return [];
		const bottom = h.top + h.height;
		const right = h.left + h.width;
		return [
			{ top: '0px', left: '0px', right: '0px', height: `${Math.max(0, h.top)}px` },
			{ top: `${bottom}px`, left: '0px', right: '0px', bottom: '0px' },
			{ top: `${h.top}px`, left: '0px', width: `${Math.max(0, h.left)}px`, height: `${h.height}px` },
			{ top: `${h.top}px`, left: `${right}px`, right: '0px', height: `${h.height}px` },
		];
	});

	// ─── Vòng đời ───────────────────────────────────────────────────────────────

	watch(
		() => [state.value?.tour, state.value?.index] as const,
		([tourDef]) => {
			if (!tourDef) {
				cleanupStep();
				stopLoop();
				token++;
				if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
				returnFocus = null;
				return;
			}
			if (!returnFocus && document.activeElement instanceof HTMLElement) returnFocus = document.activeElement;
			begin();
			startLoop();
		},
	);

	// Đổi trang giữa chừng (kể cả nút back của trình duyệt) thì tắt tour, không để lớp phủ sót lại.
	watch(
		() => route.path,
		() => finish('route'),
	);

	onMounted(() => window.addEventListener('keydown', onKeydown, true));
	onBeforeUnmount(() => {
		window.removeEventListener('keydown', onKeydown, true);
		finish('route');
		cleanupStep();
		stopLoop();
	});

	return {
		state,
		counter,
		step,
		mode,
		shown,
		isPhone,
		isLast,
		canBack,
		waitingLong,
		boxRef,
		primaryRef,
		boxStyle,
		sheetAtTop,
		dimPath,
		hole,
		holeStyle,
		blockers,
		onPrimary,
		onBack,
		onSkip,
	};
}
