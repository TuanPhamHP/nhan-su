import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { vnCalendarDate } from '~/utils/date';
import type {
	TaskAction,
	TaskConflictSnapshot,
	TaskDependency,
	TaskListItem,
	TaskPriority,
	TaskStatus,
} from '~/types/tasks.types';

/**
 * Hàm thuần của module Công việc. Không hỏi quyền: ai được làm gì là việc của máy chủ
 * (`allowedActions`, `columnRules`, `permissions`), ở đây chỉ chia nhóm, tô màu, đặt chữ.
 */

/** Năm cột cố định của bảng việc, đúng thứ tự trạng thái. Cột Đã huỷ ẩn mặc định. */
export const BOARD_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'];

/** Nhãn dự phòng khi trang tự dựng cột (máy chủ vẫn trả `statusLabel` kèm mỗi việc). */
export const STATUS_LABELS: Record<TaskStatus, string> = {
	TODO: 'Chưa làm',
	IN_PROGRESS: 'Đang làm',
	IN_REVIEW: 'Chờ nghiệm thu',
	DONE: 'Hoàn thành',
	CANCELLED: 'Đã huỷ',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
	LOW: 'Thấp',
	NORMAL: 'Bình thường',
	HIGH: 'Cao',
	URGENT: 'Gấp',
};

/**
 * Bảng màu trạng thái dùng chung cho nhãn, đầu cột bảng việc và ô chọn trạng thái: nền nhạt, viền cùng
 * tông, chấm đậm phía trước. Mỗi trạng thái một tông để nhìn lướt là phân biệt được.
 */
export const STATUS_TONE: Record<TaskStatus, { badge: string; dot: string }> = {
	TODO: {
		badge: 'bg-slate-100 text-slate-700 ring-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600',
		dot: 'bg-slate-400',
	},
	IN_PROGRESS: {
		badge: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-800',
		dot: 'bg-blue-500',
	},
	IN_REVIEW: {
		badge: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:ring-violet-800',
		dot: 'bg-violet-500',
	},
	DONE: {
		badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800',
		dot: 'bg-emerald-500',
	},
	CANCELLED: {
		badge: 'bg-gray-100 text-gray-500 ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700',
		dot: 'bg-gray-400',
	},
};

/** Bảng màu ưu tiên: thấp xám, bình thường xanh, cao cam, gấp đỏ, kèm mũi tên chỉ mức. */
export const PRIORITY_TONE: Record<TaskPriority, { badge: string; icon: string }> = {
	LOW: {
		badge: 'bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
		icon: 'heroicons:chevron-down',
	},
	NORMAL: {
		badge: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:ring-sky-800',
		icon: 'heroicons:bars-2',
	},
	HIGH: {
		badge: 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:ring-orange-800',
		icon: 'heroicons:chevron-up',
	},
	URGENT: {
		badge: 'bg-rose-50 text-rose-700 ring-rose-300 dark:bg-rose-900/40 dark:text-rose-300 dark:ring-rose-700',
		icon: 'heroicons:chevron-double-up',
	},
};

export const POINT_SCALE = [1, 2, 3, 5, 8] as const;

export const ACTION_LABELS: Record<TaskAction, string> = {
	start: 'Bắt đầu làm',
	back_to_todo: 'Về Chưa làm',
	submit: 'Báo xong',
	accept: 'Nghiệm thu',
	return: 'Trả lại',
	self_close: 'Đóng việc',
	reopen: 'Mở lại',
	cancel: 'Huỷ việc',
	withdraw: 'Rút lại báo xong',
};

/** Trạng thái đích của từng thao tác, để menu "Chuyển sang" và câu đọc cho trình đọc màn hình. */
export const ACTION_TARGET: Record<TaskAction, TaskStatus> = {
	start: 'IN_PROGRESS',
	back_to_todo: 'TODO',
	submit: 'IN_REVIEW',
	accept: 'DONE',
	return: 'IN_PROGRESS',
	self_close: 'DONE',
	reopen: 'IN_PROGRESS',
	cancel: 'CANCELLED',
	withdraw: 'IN_PROGRESS',
};

/**
 * Thao tác hỏi lại khi việc còn phải chờ việc khác chưa xong (bridge mục 28): bắt đầu, báo xong, tự đóng,
 * nghiệm thu. Chỉ cảnh báo, không chặn.
 */
export function needsBlockerWarning(action: TaskAction, openBlockers: string[] | undefined): boolean {
	return (
		(action === 'start' || action === 'submit' || action === 'self_close' || action === 'accept') &&
		!!openBlockers?.length
	);
}

/** Chữ ngắn trên dòng và thẻ: "Chờ HQ-1", nhiều việc thì "Chờ HQ-1, HQ-3"; không phải chờ gì thì `null`. */
export function waitingText(openBlockers: string[] | undefined): string | null {
	return openBlockers?.length ? `Chờ ${openBlockers.join(', ')}` : null;
}

export function blockerWarningText(openBlockers: string[]): string {
	return `Việc này đang phải chờ ${openBlockers.join(', ')} chưa xong. Vẫn tiếp tục?`;
}

/** Thao tác cần mở hộp trước khi gửi: ba thao tác bắt buộc lý do, nghiệm thu có điểm chất lượng tuỳ chọn. */
export function actionNeedsDialog(action: TaskAction): boolean {
	return action === 'return' || action === 'reopen' || action === 'cancel' || action === 'accept';
}

export function actionNeedsReason(action: TaskAction): boolean {
	return action === 'return' || action === 'reopen' || action === 'cancel';
}

/** Giới hạn danh sách kiểm tra khi tạo việc hay đặt việc định kỳ, theo API. */
export const CHECKLIST_MAX_ITEMS = 100;
export const CHECKLIST_ITEM_MAX = 300;

/** Số mục kiểm tra chưa tick của một việc. */
export function checklistLeft(checklist: { total: number; done: number }): number {
	return Math.max(0, checklist.total - checklist.done);
}

/**
 * Báo xong hay tự đóng việc mà còn mục kiểm tra chưa tick thì hỏi lại trước khi gửi. API không chặn,
 * đây là cảnh báo của giao diện (bridge tasks mục 3).
 */
export function needsChecklistWarning(action: TaskAction, checklist: { total: number; done: number }): boolean {
	return (action === 'submit' || action === 'self_close') && checklistLeft(checklist) > 0;
}

/**
 * Một đến hai nút chính cho đầu khung chi tiết và dòng Việc của tôi, xếp theo việc người xem
 * hay làm nhất. Huỷ và Về Chưa làm là thao tác hiếm, nằm trong menu ba chấm.
 */
const PRIMARY_ORDER: TaskAction[] = ['accept', 'return', 'submit', 'self_close', 'start', 'reopen', 'withdraw'];

export function primaryActions(allowed: TaskAction[], max = 2): TaskAction[] {
	return PRIMARY_ORDER.filter(a => allowed.includes(a)).slice(0, max);
}

/** Thao tác còn lại cho menu ba chấm (sau khi đã bày nút chính). */
export function secondaryActions(allowed: TaskAction[], max = 2): TaskAction[] {
	const primary = primaryActions(allowed, max);
	return allowed.filter(a => !primary.includes(a));
}

// ─── Ngày và hạn ──────────────────────────────────────────────────────────────

/** Hôm nay theo lịch Việt Nam, dạng `YYYY-MM-DD`, vì hạn của việc tính theo giờ Việt Nam. */
export function vnToday(now: Date = new Date()): string {
	return vnCalendarDate(now);
}

export type DueTone = 'overdue' | 'today' | 'soon' | 'normal' | 'done';

/**
 * Màu của hạn: đỏ khi quá hạn, cam khi đến hạn hôm nay. "Quá hạn" lấy đúng cờ `overdue` của máy
 * chủ (chưa báo xong và hạn đã qua), không tự so ngày, để hai bên không lệch nhau.
 */
export function dueTone(task: Pick<TaskListItem, 'dueDate' | 'overdue' | 'status'>, today: string): DueTone {
	if (task.status === 'DONE' || task.status === 'CANCELLED') return 'done';
	if (task.overdue) return 'overdue';
	if (task.status === 'IN_REVIEW' || !task.dueDate) return 'normal';
	const days = differenceInCalendarDays(parseISO(task.dueDate), parseISO(today));
	if (days === 0) return 'today';
	if (days > 0 && days <= 2) return 'soon';
	return 'normal';
}

export const DUE_TONE_CLASS: Record<DueTone, string> = {
	overdue: 'text-rose-600 dark:text-rose-400 font-semibold',
	today: 'text-orange-600 dark:text-orange-400 font-semibold',
	soon: 'text-amber-700 dark:text-amber-400',
	normal: 'text-gray-600 dark:text-gray-300',
	done: 'text-gray-400 dark:text-gray-500',
};

/** "28/11" trong năm nay, "28/11/2027" khác năm. */
export function shortDate(ymd: string | null | undefined, today: string = vnToday()): string {
	if (!ymd) return '—';
	const d = parseISO(ymd);
	return ymd.slice(0, 4) === today.slice(0, 4) ? format(d, 'dd/MM') : format(d, 'dd/MM/yyyy');
}

export const NO_DUE_TEXT = 'Chưa có hạn';

/** Việc có hạn: biểu đồ tiến độ và lịch chỉ đặt được những việc này lên trục ngày. */
export function hasDueDate<T extends { dueDate: string | null }>(task: T): task is T & { dueDate: string } {
	return !!task.dueDate;
}

/** Chữ ngắn cho hạn trên thẻ: "Hôm nay", "Ngày mai", "Quá 2 ngày", ngày, hoặc "Chưa có hạn". */
export function taskDueText(task: Pick<TaskListItem, 'dueDate' | 'overdue' | 'status'>, today: string): string {
	if (!task.dueDate) return NO_DUE_TEXT;
	const days = differenceInCalendarDays(parseISO(task.dueDate), parseISO(today));
	if (task.status !== 'DONE' && task.status !== 'CANCELLED') {
		if (task.overdue && days < 0) return `Quá ${-days} ngày`;
		if (days === 0) return 'Hôm nay';
		if (days === 1) return 'Ngày mai';
	}
	return shortDate(task.dueDate, today);
}

export type MyGroupKey = 'overdue' | 'today' | 'upcoming' | 'later' | 'noDue';

export const MY_GROUP_LABELS: Record<MyGroupKey, string> = {
	overdue: 'Quá hạn',
	today: 'Hôm nay',
	upcoming: 'Sắp tới 7 ngày',
	later: 'Sau đó',
	noDue: NO_DUE_TEXT,
};

/**
 * Chia Việc của tôi thành Quá hạn, Hôm nay, Sắp tới 7 ngày, Sau đó, Chưa có hạn (UI-01). Việc đã báo
 * xong (Chờ nghiệm thu) không bao giờ "quá hạn" vì máy chủ chỉ gắn cờ đó khi chưa báo xong, nên nó rơi
 * vào nhóm theo ngày như mọi việc khác. Việc không có hạn không bao giờ quá hạn, nằm nhóm cuối.
 */
export function groupMyTasks<T extends Pick<TaskListItem, 'dueDate' | 'overdue' | 'status'>>(
	tasks: T[],
	today: string,
): Record<MyGroupKey, T[]> {
	const groups: Record<MyGroupKey, T[]> = { overdue: [], today: [], upcoming: [], later: [], noDue: [] };
	for (const task of tasks) {
		if (!task.dueDate) {
			groups.noDue.push(task);
			continue;
		}
		const days = differenceInCalendarDays(parseISO(task.dueDate), parseISO(today));
		if (task.overdue) groups.overdue.push(task);
		else if (days <= 0) groups.today.push(task);
		else if (days <= 7) groups.upcoming.push(task);
		else groups.later.push(task);
	}
	return groups;
}

/**
 * Khi tìm ở mọi ngăn, việc này thuộc ngăn nào của người xem: "Tôi làm", "Tôi giao", "Tôi theo dõi",
 * "Tôi nghiệm thu", còn lại (việc của phòng mình, của dự án mình) là "Việc bạn xem được". Việc tự giao
 * cho mình tính là Tôi làm.
 */
export function taskRelation(
	task: Pick<TaskListItem, 'id' | 'assignee' | 'assigner' | 'reviewer'>,
	meId: number | null | undefined,
	watchingIds: ReadonlySet<number> = new Set(),
): string {
	if (meId != null && task.assignee.id === meId) return 'Tôi làm';
	if (meId != null && task.assigner.id === meId) return 'Tôi giao';
	if (watchingIds.has(task.id)) return 'Tôi theo dõi';
	if (meId != null && task.reviewer.id === meId) return 'Tôi nghiệm thu';
	return 'Việc bạn xem được';
}

/**
 * Câu nói rõ việc phải chờ nào đang làm trễ việc này, thay cho "Đang chờ việc bị trễ" khó hiểu: nêu số
 * hiệu và hai cái hạn để người đọc thấy ngay vì sao. Không có việc phải chờ nào trễ thì trả `null`.
 */
export function lateBlockerText(
	task: Pick<TaskListItem, 'dueDate'>,
	blockers: Array<Pick<TaskDependency, 'code' | 'dueDate' | 'late' | 'visible'>>,
	today: string = vnToday(),
): string | null {
	const b = blockers.find(x => x.late);
	if (!b) return null;
	if (!b.visible) return 'Phải chờ một việc bạn không xem được, việc đó đang trễ hạn.';
	if (b.dueDate && task.dueDate && b.dueDate > task.dueDate) {
		return `Phải chờ ${b.code}, hạn ${b.code} (${shortDate(b.dueDate, today)}) muộn hơn hạn việc này (${shortDate(task.dueDate, today)}).`;
	}
	return `Phải chờ ${b.code}, việc đó đang trễ hạn.`;
}

export interface QuickDueOption {
	label: string;
	value: string;
}

/** Lựa chọn nhanh cho ô Hạn khi tạo nhanh: Hôm nay, Ngày mai, Thứ sáu này, Tuần sau (thứ Hai tới). */
export function quickDueOptions(today: string): QuickDueOption[] {
	const base = parseISO(today);
	const dow = base.getDay(); // 0 = Chủ nhật
	const toFriday = (5 - dow + 7) % 7;
	const toNextMonday = ((1 - dow + 7) % 7) || 7;
	const ymd = (d: Date) => format(d, 'yyyy-MM-dd');
	const options: QuickDueOption[] = [
		{ label: 'Hôm nay', value: ymd(base) },
		{ label: 'Ngày mai', value: ymd(addDays(base, 1)) },
	];
	if (toFriday > 1) options.push({ label: 'Thứ sáu này', value: ymd(addDays(base, toFriday)) });
	options.push({ label: 'Tuần sau', value: ymd(addDays(base, toNextMonday)) });
	return options;
}

// ─── Điểm ──────────────────────────────────────────────────────────────────────

/** Chữ điểm trên thẻ và dòng việc: "3 điểm" ("3 đ" dễ đọc thành 3 đồng), hoặc "—" khi chưa chấm điểm. */
export function taskPointsText(points: number | null | undefined): string {
	return points == null ? '—' : `${points} điểm`;
}

export type PointsOperator = '=' | '!=' | '>' | '>=' | '<' | '<=';

export interface PointsCondition {
	op: PointsOperator;
	value: number;
}

const POINTS_CONDITION = /^(!=|>=|<=|=|>|<)\s*(\d{1,3})$/;
const POINTS_OPERATORS: readonly PointsOperator[] = ['=', '!=', '>', '>=', '<', '<='];

function isPointsOperator(v: string | undefined): v is PointsOperator {
	return POINTS_OPERATORS.some(op => op === v);
}

/**
 * Đọc bộ lọc điểm kiểu JQL (`>=3`, `>=2,<=5`, `=0`): các điều kiện cách dấu phẩy, ghép bằng VÀ. Trả
 * `null` khi có điều kiện sai cú pháp, để ô lọc báo lỗi ngay thay vì đợi máy chủ trả 400. Chuỗi rỗng là
 * không lọc (mảng rỗng).
 */
export function parsePointsFilter(raw: string): PointsCondition[] | null {
	const parts = raw
		.split(',')
		.map(p => p.trim())
		.filter(Boolean);
	const out: PointsCondition[] = [];
	for (const part of parts) {
		const m = POINTS_CONDITION.exec(part.replace(/\s+/g, ''));
		const op = m?.[1];
		if (!m || !isPointsOperator(op)) return null;
		out.push({ op, value: Number(m[2]) });
	}
	return out;
}

/** Chuỗi gửi máy chủ, đã bỏ khoảng trắng: `>=2,<=5`. */
export function pointsFilterParam(conditions: PointsCondition[]): string {
	return conditions.map(c => `${c.op}${c.value}`).join(',');
}

/**
 * Tham số `points` cho API từ giá trị trên đường dẫn. Rỗng hoặc sai cú pháp (đường dẫn dán tay) thì
 * không lọc, để máy chủ không trả 400 cho cả trang.
 */
export function pointsQuery(raw: string | null | undefined): string | undefined {
	const parsed = raw ? parsePointsFilter(raw) : null;
	return parsed?.length ? pointsFilterParam(parsed) : undefined;
}

const POINTS_OP_TEXT: Record<PointsOperator, string> = {
	'=': 'bằng',
	'!=': 'khác',
	'>': 'lớn hơn',
	'>=': 'từ',
	'<': 'nhỏ hơn',
	'<=': 'tối đa',
};

export interface PointsRange {
	from: number | null;
	to: number | null;
}

/**
 * Bộ lọc điểm cho người mới: hai ô "Từ … đến … điểm" ghép thành cú pháp `>=2,<=5`. Hai ô trống là không
 * lọc. Người quen vẫn gõ cú pháp ở ô Nâng cao, hai cách cùng ra một tham số.
 */
export function pointsRangeParam(range: PointsRange): string {
	const parts: string[] = [];
	if (range.from != null) parts.push(`>=${range.from}`);
	if (range.to != null) parts.push(`<=${range.to}`);
	return parts.join(',');
}

/**
 * Đọc ngược bộ lọc thành hai ô Từ, Đến. Bộ lọc không viết được bằng hai ô (`!=3`, `>2`, hai điều kiện
 * "từ") thì trả `null`, để ô Từ, Đến để trống và ô Nâng cao giữ nguyên chữ.
 */
export function pointsRangeOf(conditions: PointsCondition[]): PointsRange | null {
	const range: PointsRange = { from: null, to: null };
	for (const c of conditions) {
		if (c.op === '>=' && range.from == null) range.from = c.value;
		else if (c.op === '<=' && range.to == null) range.to = c.value;
		else if (c.op === '=' && range.from == null && range.to == null && conditions.length === 1) return { from: c.value, to: c.value };
		else return null;
	}
	return range;
}

/** Câu đọc của bộ lọc cho nhãn và trình đọc màn hình: "Điểm từ 2 và tối đa 5", "Chưa có điểm". */
export function pointsFilterLabel(conditions: PointsCondition[]): string {
	if (conditions.length === 1 && conditions[0]?.op === '=' && conditions[0].value === 0) return 'Chưa có điểm';
	return `Điểm ${conditions.map(c => `${POINTS_OP_TEXT[c.op]} ${c.value}`).join(' và ')}`;
}

/** Gợi ý bấm nhanh trong ô lọc điểm. */
export const POINTS_FILTER_PRESETS: Array<{ label: string; value: string }> = [
	{ label: 'Chưa có điểm', value: '=0' },
	{ label: 'Có điểm', value: '>0' },
	{ label: 'Từ 3 điểm', value: '>=3' },
	{ label: 'Từ 5 điểm', value: '>=5' },
	{ label: 'Từ 2 tới 5', value: '>=2,<=5' },
];

// ─── Lỗi máy chủ ──────────────────────────────────────────────────────────────

export interface TaskErrorInfo {
	status: number | undefined;
	code: string | undefined;
	message: string;
	/** Bản mới rút gọn của `TASK_VERSION_CONFLICT`, `TASK_STATUS_INVALID`. */
	task: TaskConflictSnapshot | null;
	/** Tên người giao của `TASK_NOT_VISIBLE`. */
	assignerName: string | null;
}

/** Đọc lỗi `useAuthFetch` (đã mang câu tiếng Việt) thành mã, câu và phần `details`. */
export function taskErrorInfo(err: unknown, fallback = 'Chưa thực hiện được thao tác này.'): TaskErrorInfo {
	const e = err as {
		message?: string;
		status?: number;
		data?: { error?: { code?: string; message?: string; details?: Record<string, unknown> } };
	} | null;
	const details = e?.data?.error?.details ?? {};
	const task = details.task && typeof details.task === 'object' ? (details.task as TaskConflictSnapshot) : null;
	const assignerName = typeof details.assignerName === 'string' ? details.assignerName : null;
	return {
		status: e?.status,
		code: e?.data?.error?.code,
		message: e?.data?.error?.message || e?.message || fallback,
		task,
		assignerName,
	};
}

// ─── Bình luận ────────────────────────────────────────────────────────────────

/**
 * Id người được nhắc trong HTML Tiptap (`<span data-type="mention" data-id="6">`), không trùng.
 * Dùng regex thay vì DOMParser để chạy được cả khi kiểm thử không có trình duyệt.
 */
export function mentionIdsFromHtml(html: string): number[] {
	const ids = new Set<number>();
	const re = /<span[^>]*data-type="mention"[^>]*>/g;
	for (const tag of html.match(re) ?? []) {
		const m = tag.match(/data-id="(\d+)"/);
		if (m) ids.add(Number(m[1]));
	}
	return [...ids];
}

/** HTML Tiptap rỗng (`<p></p>`) hay chỉ có khoảng trắng thì coi như chưa gõ gì. */
export function isBlankHtml(html: string): boolean {
	return !html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() && !/data-type="mention"/.test(html);
}

export function taskFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

/** Loại file máy chủ nhận (bridge mục 4). Máy chủ vẫn kiểm chữ ký file; ở đây chỉ để chọn file. */
export const TASK_FILE_ACCEPT =
	'.pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip';
export const TASK_FILE_MAX_MB = 20;

/**
 * Mã dự án: 2–6 ký tự, chữ cái đầu rồi chữ cái hoặc chữ số (`HQ`, `L25`, `KT2`; bridge mục 29), `CV` dành
 * cho việc lẻ. Máy chủ viết hoa giúp.
 */
export function projectCodeError(code: string): string | null {
	const c = code.trim().toUpperCase();
	if (!c) return 'Nhập mã dự án';
	if (!/^[A-Z][A-Z0-9]{1,5}$/.test(c)) return 'Mã dự án gồm 2 đến 6 chữ cái không dấu hoặc chữ số, bắt đầu bằng chữ cái, ví dụ HQ hay L25';
	if (c === 'CV') return 'Mã CV dành cho việc lẻ, bạn chọn mã khác';
	return null;
}

/** Số hiệu việc (`HQ-12`, `cv-3`, `L25-1`) hay id số, để trang chi tiết nhận cả hai. */
export function isTaskRef(value: string): boolean {
	return /^[A-Za-z][A-Za-z0-9]{1,5}-\d+$/.test(value) || /^\d+$/.test(value);
}

// ─── Lô 2 ─────────────────────────────────────────────────────────────────────

/** Câu ⓘ một dòng cho các khái niệm mới (mục 9.2 "Hướng dẫn người mới"). */
export const TASK_HINTS = {
	sprint: 'Đợt là một khoảng ngắn, thường một hai tuần. Cả nhóm chọn việc làm trong khoảng đó rồi đóng đợt.',
	backlog: 'Việc chờ xếp là việc của dự án chưa đưa vào đợt nào.',
	points: 'Điểm khối lượng: việc càng nặng điểm càng cao, từ 1 rất nhẹ tới 8 rất nặng.',
	group: 'Nhóm việc gom các việc cùng một phần của dự án, ví dụ Chứng từ hay Tờ khai. Khoảng thời gian thì dùng đợt.',
	dependency: 'Việc này chỉ nên bắt đầu khi việc nó chờ đã xong. Hệ thống chỉ cảnh báo, không chặn.',
	wip: 'Số thẻ tối đa nên có trong cột. Vượt thì cột báo đỏ, vẫn kéo thẻ vào được.',
} as const;

export const WEEKDAY_LABELS: Record<number, string> = {
	1: 'Thứ Hai',
	2: 'Thứ Ba',
	3: 'Thứ Tư',
	4: 'Thứ Năm',
	5: 'Thứ Sáu',
	6: 'Thứ Bảy',
	7: 'Chủ nhật',
};

export const WEEKDAY_SHORT: Record<number, string> = { 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7', 7: 'CN' };

export const FREQUENCY_LABELS = {
	WEEKLY: 'Hằng tuần',
	MONTHLY: 'Hằng tháng',
	QUARTERLY: 'Hằng quý',
	YEARLY: 'Hằng năm',
} as const;

const PERIOD_WORD = { WEEKLY: 'tuần', MONTHLY: 'tháng', QUARTERLY: 'quý', YEARLY: 'năm' } as const;

/**
 * Câu đời thường cho một quy tắc lặp: "Thứ Hai hằng tuần", "Ngày 31 hằng tháng", "Ngày 15 tháng thứ 2
 * mỗi quý", "Ngày 20/12 hằng năm", "Ngày 5, mỗi 2 tháng".
 */
export function recurrenceText(r: {
	frequency: keyof typeof FREQUENCY_LABELS;
	interval?: number;
	weekdays?: number[];
	dayOfMonth?: number | null;
	monthOfPeriod?: number | null;
}): string {
	const n = r.interval && r.interval > 1 ? r.interval : 1;
	const every = n > 1 ? `mỗi ${n} ${PERIOD_WORD[r.frequency]}` : FREQUENCY_LABELS[r.frequency].toLowerCase();
	if (r.frequency === 'WEEKLY') {
		const days = [...(r.weekdays ?? [])].sort((a, b) => a - b).map(d => WEEKDAY_LABELS[d] ?? `Thứ ${d}`);
		return `${days.length ? days.join(', ') : 'Chưa chọn thứ'} ${every}`;
	}
	const day = r.dayOfMonth ?? 1;
	if (r.frequency === 'MONTHLY') return `Ngày ${day} ${every}`;
	if (r.frequency === 'QUARTERLY') return `Ngày ${day} tháng thứ ${r.monthOfPeriod ?? 1} của quý, ${every}`;
	return `Ngày ${day}/${r.monthOfPeriod ?? 1} ${every}`;
}

export interface ProgressColumn {
	metric: 'assigned' | 'cancelled' | 'done' | 'onTimeOriginal' | 'onTimeCurrent' | 'noDue' | 'overdueOpen' | 'returned' | 'points' | 'quality';
	label: string;
	hint: string;
	/** Tỷ lệ đi kèm (trường `…Pct`). */
	pct?: 'donePct' | 'onTimeOriginalPct' | 'onTimeCurrentPct';
}

/** Cột báo cáo tiến độ, đúng thứ tự và cách tính của bridge mục 16. */
export const PROGRESS_COLUMNS: ProgressColumn[] = [
	{ metric: 'assigned', label: 'Được giao', hint: 'Việc người khác giao, hạn ban đầu trong khoảng, kể cả việc đã huỷ.' },
	{ metric: 'cancelled', label: 'Đã huỷ', hint: 'Việc được giao rồi bị huỷ, tính riêng.' },
	{ metric: 'done', label: 'Hoàn thành', hint: 'Đã nghiệm thu.', pct: 'donePct' },
	// Sau UAT 27/11/2026 (bridge mục 31): việc chưa có hạn không còn tính là đúng hạn, tỷ lệ chỉ chia cho việc có hạn.
	{
		metric: 'onTimeOriginal',
		label: 'Báo xong đúng hạn ban đầu',
		hint: 'Báo xong lần đầu không muộn hơn hạn lúc giao. Tỷ lệ chỉ tính việc có hạn ban đầu.',
		pct: 'onTimeOriginalPct',
	},
	{
		metric: 'onTimeCurrent',
		label: 'Báo xong đúng hạn hiện tại',
		hint: 'Báo xong lần đầu không muộn hơn hạn sau khi đổi. Tỷ lệ chỉ tính việc có hạn.',
		pct: 'onTimeCurrentPct',
	},
	{ metric: 'noDue', label: 'Chưa có hạn', hint: 'Việc chưa có hạn: không tính đúng hạn, không vào tỷ lệ đúng hạn.' },
	{ metric: 'overdueOpen', label: 'Quá hạn còn mở', hint: 'Chưa báo xong mà hạn đã qua tại cuối khoảng.' },
	{ metric: 'returned', label: 'Bị trả lại', hint: 'Đã bị trả lại hoặc mở lại ít nhất một lần.' },
	{ metric: 'points', label: 'Khối lượng', hint: 'Tổng điểm việc nghiệm thu trong khoảng.' },
	{ metric: 'quality', label: 'Chất lượng', hint: 'Điểm chất lượng trung bình của việc có chấm.' },
];

/** "66,7%"; null thì "—". */
export function pctText(v: number | null | undefined): string {
	if (v == null) return '—';
	return `${String(Math.round(v * 10) / 10).replace('.', ',')}%`;
}

/** Tải blob về máy (tên file do nơi gọi đặt, `$fetch` blob không đưa header ra). */
export function downloadTaskBlob(blob: Blob, fileName: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = fileName;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
