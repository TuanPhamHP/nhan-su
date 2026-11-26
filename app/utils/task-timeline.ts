import { addDays, differenceInCalendarDays, format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths } from 'date-fns';
import type { TaskListItem } from '~/types/tasks.types';

/**
 * Hàm thuần cho Biểu đồ tiến độ và Lịch (lô 2, mục 9.2). Mọi ngày là chuỗi `YYYY-MM-DD` theo lịch
 * Việt Nam như hạn của việc; không đổi qua lại múi giờ nên không có chỗ cho lệch một ngày.
 */

export type TimelineScale = 'day' | 'week' | 'month';

export const SCALE_LABELS: Record<TimelineScale, string> = { day: 'Ngày', week: 'Tuần', month: 'Tháng' };

/** Bề rộng một ngày theo thang: Ngày đọc được từng ngày, Tuần xem khoảng ba tháng, Tháng xem cả năm. */
export const DAY_WIDTH: Record<TimelineScale, number> = { day: 36, week: 14, month: 4 };

/** Khoảng tải mỗi thang: lùi bao nhiêu ngày trước mốc, xem bao nhiêu ngày (máy chủ cho tối đa 370). */
const WINDOW: Record<TimelineScale, { before: number; span: number }> = {
	day: { before: 7, span: 42 },
	week: { before: 21, span: 140 },
	month: { before: 31, span: 365 },
};

export function ymd(d: Date): string {
	return format(d, 'yyyy-MM-dd');
}

export function timelineAddDays(day: string, n: number): string {
	return ymd(addDays(parseISO(day), n));
}

export function diffDays(a: string, b: string): number {
	return differenceInCalendarDays(parseISO(a), parseISO(b));
}

/** Khoảng xem quanh `anchor`, bắt đầu từ thứ Hai cho dễ đọc. */
export function timelineWindow(scale: TimelineScale, anchor: string): { from: string; to: string } {
	const w = WINDOW[scale];
	const start = startOfWeek(parseISO(timelineAddDays(anchor, -w.before)), { weekStartsOn: 1 });
	const from = ymd(start);
	return { from, to: timelineAddDays(from, w.span - 1) };
}

/** Lùi hay tới một nửa khoảng đang xem. */
export function shiftAnchor(scale: TimelineScale, anchor: string, dir: -1 | 1): string {
	return timelineAddDays(anchor, dir * Math.round(WINDOW[scale].span / 2));
}

export interface TimelineBar {
	/** Tính bằng điểm ảnh từ mép trái khoảng xem. */
	left: number;
	width: number;
	/** Việc không có ngày bắt đầu: vẽ một chấm ở hạn. */
	dot: boolean;
	/** Vạch hạn ban đầu khi đã đổi hạn; null khi chưa đổi hoặc nằm ngoài khoảng. */
	originalLeft: number | null;
	/** Thanh bị cắt ở mép trái hoặc phải khoảng xem. */
	clippedStart: boolean;
	clippedEnd: boolean;
}

export function timelineBar(
	task: Pick<TaskListItem, 'startDate' | 'originalDueDate' | 'dueChangeCount'> & { dueDate: string },
	from: string,
	to: string,
	dayWidth: number,
): TimelineBar {
	const total = diffDays(to, from) + 1;
	const dueIdx = diffDays(task.dueDate, from);
	const dot = !task.startDate || task.startDate > task.dueDate;
	const startIdx = dot ? dueIdx : diffDays(task.startDate!, from);
	const s = Math.max(0, startIdx);
	const e = Math.min(total - 1, dueIdx);
	const originalIdx = task.dueChangeCount > 0 && task.originalDueDate ? diffDays(task.originalDueDate, from) : null;
	return {
		left: s * dayWidth,
		width: Math.max(1, e - s + 1) * dayWidth,
		dot,
		originalLeft: originalIdx != null && originalIdx >= 0 && originalIdx < total ? (originalIdx + 1) * dayWidth : null,
		clippedStart: startIdx < 0,
		clippedEnd: dueIdx > total - 1,
	};
}

export interface TimelineTick {
	left: number;
	width: number;
	label: string;
	/** Nhãn lớn ở hàng trên (tháng). */
	major: boolean;
	weekend?: boolean;
}

/**
 * Nhãn trục ngày: hàng trên là tháng, hàng dưới là ngày (thang Ngày), đầu tuần (thang Tuần) hoặc
 * bỏ trống (thang Tháng, chỉ cần tháng).
 */
export function timelineTicks(from: string, to: string, scale: TimelineScale): { months: TimelineTick[]; minor: TimelineTick[] } {
	const dw = DAY_WIDTH[scale];
	const total = diffDays(to, from) + 1;
	const months: TimelineTick[] = [];
	const minor: TimelineTick[] = [];
	let cursor = parseISO(from);
	const end = parseISO(to);
	while (cursor <= end) {
		const mEnd = endOfMonth(cursor) < end ? endOfMonth(cursor) : end;
		const startIdx = differenceInCalendarDays(cursor, parseISO(from));
		const days = differenceInCalendarDays(mEnd, cursor) + 1;
		months.push({ left: startIdx * dw, width: days * dw, label: `Tháng ${format(cursor, 'M/yyyy')}`, major: true });
		cursor = startOfMonth(addMonths(cursor, 1));
	}
	if (scale === 'day') {
		for (let i = 0; i < total; i++) {
			const d = parseISO(timelineAddDays(from, i));
			const dow = d.getDay();
			minor.push({ left: i * dw, width: dw, label: format(d, 'd'), major: false, weekend: dow === 0 || dow === 6 });
		}
	} else if (scale === 'week') {
		for (let i = 0; i < total; i += 7) {
			minor.push({ left: i * dw, width: Math.min(7, total - i) * dw, label: format(parseISO(timelineAddDays(from, i)), 'dd/MM'), major: false });
		}
	}
	return { months, minor };
}

/** Số ngày ứng với một đoạn kéo, làm tròn theo ô ngày gần nhất. */
export function dragDays(px: number, dayWidth: number): number {
	return Math.round(px / dayWidth);
}

/** Lịch tháng: lưới từ thứ Hai đầu tuần chứa ngày 1 tới Chủ nhật cuối tuần chứa ngày cuối (≤ 42 ngày). */
export function monthGrid(month: string): { from: string; to: string; days: string[] } {
	const first = parseISO(`${month}-01`);
	const start = startOfWeek(first, { weekStartsOn: 1 });
	const end = endOfWeek(endOfMonth(first), { weekStartsOn: 1 });
	const days: string[] = [];
	for (let d = start; d <= end; d = addDays(d, 1)) days.push(ymd(d));
	return { from: days[0]!, to: days[days.length - 1]!, days };
}

export function shiftMonth(month: string, n: number): string {
	return format(addMonths(parseISO(`${month}-01`), n), 'yyyy-MM');
}

export function calendarMonthLabel(month: string): string {
	return `Tháng ${format(parseISO(`${month}-01`), 'M/yyyy')}`;
}

/**
 * Xếp việc theo hạn, gom theo ngày (lịch, danh sách thay biểu đồ trên màn hẹp). Việc không có hạn
 * không thuộc ngày nào nên bị bỏ qua.
 */
export function tasksByDue<T extends Pick<TaskListItem, 'dueDate'>>(tasks: T[]): Map<string, T[]> {
	const map = new Map<string, T[]>();
	const dated = tasks.flatMap(t => (t.dueDate ? [{ day: t.dueDate, task: t }] : []));
	for (const { day, task } of dated.sort((a, b) => a.day.localeCompare(b.day))) {
		const list = map.get(day) ?? [];
		list.push(task);
		map.set(day, list);
	}
	return map;
}

export interface TimelineSection<T> {
	key: string;
	label: string;
	tasks: T[];
}

/**
 * Gom theo nhóm việc theo thứ tự nhóm của dự án; việc không thuộc nhóm nằm cuối. `byGroup` tắt thì
 * một khối duy nhất.
 */
export function timelineSections<T extends Pick<TaskListItem, 'group'>>(
	tasks: T[],
	byGroup: boolean,
	groupOrder: Array<{ id: number; name: string }> = [],
): Array<TimelineSection<T>> {
	if (!byGroup) return [{ key: 'all', label: '', tasks }];
	const order = new Map(groupOrder.map((g, i) => [g.id, i]));
	const map = new Map<string, TimelineSection<T>>();
	for (const t of tasks) {
		const key = t.group ? `g-${t.group.id}` : 'none';
		const sec = map.get(key) ?? { key, label: t.group?.name ?? 'Chưa có nhóm', tasks: [] };
		sec.tasks.push(t);
		map.set(key, sec);
	}
	return [...map.values()].sort((a, b) => {
		if (a.key === 'none') return 1;
		if (b.key === 'none') return -1;
		const ia = order.get(Number(a.key.slice(2))) ?? 999;
		const ib = order.get(Number(b.key.slice(2))) ?? 999;
		return ia - ib || a.label.localeCompare(b.label, 'vi');
	});
}
