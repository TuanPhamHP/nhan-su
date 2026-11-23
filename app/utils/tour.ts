import type { TourRect, TourStep } from '~/types/tour.types';

/**
 * Hàm thuần cho hướng dẫn từng bước: chọn bước, đánh số, khoá nhớ "đã xem", đặt chỗ hộp.
 * Tách khỏi `useTour` để kiểm thử được mà không cần trình duyệt.
 */

function stepEnabled(step: TourStep): boolean {
	try {
		return step.when ? step.when() : true;
	} catch {
		return false;
	}
}

/** Bước kế tiếp theo chiều `dir`, bỏ qua bước `when` trả false và bước đã bị bỏ. `-1` nếu hết. */
export function nextStepIndex(steps: TourStep[], from: number, dir: 1 | -1, skipped: number[] = []): number {
	for (let i = from + dir; i >= 0 && i < steps.length; i += dir) {
		if (skipped.includes(i)) continue;
		if (!stepEnabled(steps[i]!)) continue;
		return i;
	}
	return -1;
}

/** "Bước 3/12": chỉ đếm những bước thật sự hiện. */
export function stepCounter(steps: TourStep[], index: number, skipped: number[] = []) {
	const visible = steps.map((s, i) => i).filter(i => !skipped.includes(i) && stepEnabled(steps[i]!));
	return { number: visible.indexOf(index) + 1, total: visible.length };
}

/** Khoá "đã xem" riêng cho từng công ty, từng người, từng tour và từng phiên bản nội dung. */
export function tourStorageKey(companyCode: string | null | undefined, userId: number | string | null | undefined, tourId: string, version: number) {
	return `tour:${companyCode || '-'}:${userId ?? '-'}:${tourId}:v${version}`;
}

/**
 * Lấy localStorage mà không văng lỗi. Trình duyệt chặn lưu trữ (ẩn danh nghiêm ngặt, tắt cookie)
 * thì ngay việc đọc `window.localStorage` cũng ném lỗi; khi đó tour vẫn chạy, chỉ không nhớ.
 */
export function safeStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
	try {
		return typeof window === 'undefined' ? null : window.localStorage;
	} catch {
		return null;
	}
}

export function hasSeenTour(key: string, storage: Pick<Storage, 'getItem'> | null = safeStorage()): boolean {
	try {
		return storage?.getItem(key) === '1';
	} catch {
		return false;
	}
}

export function markTourSeen(key: string, storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
	try {
		storage?.setItem(key, '1');
	} catch {
		// Không lưu được thì lần sau tour tự hiện lại, không có gì hỏng.
	}
}

/** Hình chữ nhật bao trọn mọi hình đưa vào; `null` khi không có hình nào. */
export function unionRects(rects: TourRect[]): TourRect | null {
	const list = rects.filter(r => r.width > 0 || r.height > 0);
	if (!list.length) return null;
	const top = Math.min(...list.map(r => r.top));
	const left = Math.min(...list.map(r => r.left));
	const bottom = Math.max(...list.map(r => r.top + r.height));
	const right = Math.max(...list.map(r => r.left + r.width));
	return { top, left, width: right - left, height: bottom - top };
}

export function padRect(r: TourRect, pad: number): TourRect {
	return { top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 };
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));

export type TourBoxSide = 'bottom' | 'top' | 'right' | 'left' | 'center';

/**
 * Chỗ đặt hộp hướng dẫn trên màn rộng: ưu tiên dưới phần tử, rồi trên, phải, trái. Không chỗ
 * nào đủ (phần tử to gần bằng màn) thì đặt sát đáy màn, chấp nhận đè lên một phần phần tử.
 */
export function placeTourBox(
	target: TourRect | null,
	box: { width: number; height: number },
	view: { width: number; height: number },
	gap = 12,
	margin = 16,
): { top: number; left: number; side: TourBoxSide } {
	const maxLeft = view.width - box.width - margin;
	const maxTop = view.height - box.height - margin;
	if (!target) {
		return { top: clamp((view.height - box.height) / 2, margin, maxTop), left: clamp((view.width - box.width) / 2, margin, maxLeft), side: 'center' };
	}
	const centerX = clamp(target.left + target.width / 2 - box.width / 2, margin, maxLeft);
	const centerY = clamp(target.top + target.height / 2 - box.height / 2, margin, maxTop);
	const bottom = target.top + target.height;
	const right = target.left + target.width;

	if (bottom + gap + box.height <= view.height - margin) return { top: bottom + gap, left: centerX, side: 'bottom' };
	if (target.top - gap - box.height >= margin) return { top: target.top - gap - box.height, left: centerX, side: 'top' };
	if (right + gap + box.width <= view.width - margin) return { top: centerY, left: right + gap, side: 'right' };
	if (target.left - gap - box.width >= margin) return { top: centerY, left: target.left - gap - box.width, side: 'left' };
	return { top: clamp(maxTop, margin, maxTop), left: centerX, side: 'center' };
}

/**
 * Trên điện thoại hộp là tấm dưới đáy màn. Phần tử bị tấm che thì đưa tấm lên đỉnh màn, miễn là
 * phần tử không nằm sát đỉnh; to quá cả hai phía thì vẫn để dưới đáy.
 */
export function sheetSide(target: TourRect | null, sheetHeight: number, viewHeight: number, gap = 8): 'bottom' | 'top' {
	if (!target) return 'bottom';
	if (target.top + target.height + gap <= viewHeight - sheetHeight) return 'bottom';
	if (target.top - gap >= sheetHeight) return 'top';
	return 'bottom';
}

/** Đường viền chữ nhật bo góc, dùng làm lỗ khoét trong lớp phủ SVG. */
export function roundedRectPath(r: TourRect, radius: number): string {
	const rad = Math.max(0, Math.min(radius, r.width / 2, r.height / 2));
	const { top: y, left: x, width: w, height: h } = r;
	return [
		`M${x + rad} ${y}`,
		`H${x + w - rad}`,
		`A${rad} ${rad} 0 0 1 ${x + w} ${y + rad}`,
		`V${y + h - rad}`,
		`A${rad} ${rad} 0 0 1 ${x + w - rad} ${y + h}`,
		`H${x + rad}`,
		`A${rad} ${rad} 0 0 1 ${x} ${y + h - rad}`,
		`V${y + rad}`,
		`A${rad} ${rad} 0 0 1 ${x + rad} ${y}`,
		'Z',
	].join(' ');
}
