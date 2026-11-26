import { addDays, addMonths, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { formatVnDateTime } from '~/utils/date';
import { vnSearchText } from '~/utils/vn-text';
import type {
	SummaryRow,
	SupplyItem,
	SupplyLine,
	SupplyPeriodStatus,
	SupplyRequestStatus,
} from '~/types/office.types';

/**
 * Hàm thuần của module Hành chính văn phòng: đổi giờ Việt Nam, đếm ngược tới hạn chót, xếp
 * bảng tổng hợp theo nhóm, và đặt thanh lượt họp trên lưới phòng.
 *
 * Vì sao tách khỏi trang: giờ là chỗ dễ sai nhất của module này. Hạn chót khoá phiếu là 00:00
 * giờ Việt Nam ngày hôm sau, còn lượt họp gửi lên máy chủ bằng ISO UTC, nên nếu máy người dùng
 * đặt múi giờ khác thì mọi con số trên lưới lệch đi mà không ai thấy. Hàm thuần thì test được
 * mà không cần dựng cả trang.
 */

/** Việt Nam dùng UTC+7 cố định, không có giờ mùa hè, nên độ lệch là hằng số. */
const VN_OFFSET = '+07:00';

const VN_TIME = new Intl.DateTimeFormat('en-GB', {
	timeZone: 'Asia/Ho_Chi_Minh',
	hour: '2-digit',
	minute: '2-digit',
	hour12: false,
});

/** `en-CA` cho ra đúng dạng `YYYY-MM-DD`, cùng dạng mà máy chủ và ô chọn ngày dùng. */
const VN_DATE = new Intl.DateTimeFormat('en-CA', {
	timeZone: 'Asia/Ho_Chi_Minh',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
});

/** Giờ phút theo giờ Việt Nam, dạng `HH:mm`. */
export function vnTimeLabel(at: string | Date): string {
	return VN_TIME.format(new Date(at));
}

/** Độ dài một lượt họp: "30 phút", "1 giờ", "1 giờ 30 phút". */
export function bookingDurationLabel(startAt: string | Date, endAt: string | Date): string {
	const minutes = Math.max(0, Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000));
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	if (!hours) return `${rest} phút`;
	return rest ? `${hours} giờ ${rest} phút` : `${hours} giờ`;
}

/** Số phút kể từ 00:00 giờ Việt Nam của một thời điểm. */
export function vnMinutesOfDay(at: string | Date): number {
	const [hour, minute] = vnTimeLabel(at).split(':');
	return Number(hour) * 60 + Number(minute);
}

/**
 * Ghép ngày và giờ Việt Nam thành ISO UTC để gửi máy chủ.
 *
 * Không dùng `new Date('2026-11-20T14:00')` rồi `toISOString()`: chuỗi không có độ lệch được
 * hiểu theo múi giờ của MÁY, nên một người đặt máy giờ Tokyo sẽ đặt phòng lệch hai tiếng.
 */
export function vnDateTimeToIso(date: string, hhmm: string): string {
	return new Date(`${date}T${hhmm}:00.000${VN_OFFSET}`).toISOString();
}

/** `HH:mm` cộng thêm số phút, cắt tại 23:59 để không nhảy sang ngày khác. */
export function addMinutesToHhmm(hhmm: string, minutes: number): string {
	const [hour, minute] = hhmm.split(':');
	const total = Math.min(Number(hour) * 60 + Number(minute) + minutes, 23 * 60 + 59);
	const h = Math.floor(total / 60);
	const m = total % 60;
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Đếm ngược tới lúc phiếu tự khoá.
 *
 * Nói bằng đơn vị lớn nhất còn ý nghĩa: còn nhiều ngày thì ngày và giờ, còn trong ngày thì giờ
 * và phút. Hết hạn thì trả câu khẳng định chứ không phải số âm.
 */
export function lockCountdown(lockAt: string, now: Date = new Date()): string {
	const left = new Date(lockAt).getTime() - now.getTime();
	if (!Number.isFinite(left) || left <= 0) return 'Đã hết hạn nhập';

	const minutes = Math.floor(left / 60000);
	const days = Math.floor(minutes / (60 * 24));
	const hours = Math.floor((minutes % (60 * 24)) / 60);
	const mins = minutes % 60;

	if (days > 0) return hours > 0 ? `Còn ${days} ngày ${hours} giờ` : `Còn ${days} ngày`;
	if (hours > 0) return mins > 0 ? `Còn ${hours} giờ ${mins} phút` : `Còn ${hours} giờ`;
	return `Còn ${Math.max(mins, 1)} phút`;
}

/** "2026-12" thành "Tháng 12/2026". Chuỗi lạ thì giữ nguyên để người dùng còn thấy dữ liệu thật. */
export function monthLabel(month: string): string {
	const match = /^(\d{4})-(\d{2})$/.exec(month);
	if (!match) return month;
	return `Tháng ${Number(match[2])}/${match[1]}`;
}

/** Tháng của một mốc, dạng `YYYY-MM`. */
export function monthValue(at: Date = new Date()): string {
	return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Tháng sau của một mốc, dạng `YYYY-MM`. Dùng làm tháng mặc định khi mở kỳ, vì kỳ đăng ký luôn
 * mở trước cho tháng tới.
 *
 * Cộng tháng bằng `new Date(year, month + 1, 1)` chứ không `setMonth` trên ngày hiện tại: ngày 31
 * mà `setMonth` sang tháng chỉ có 30 ngày thì JavaScript đẩy sang tháng kế tiếp nữa.
 */
export function nextMonthValue(at: Date = new Date()): string {
	return monthValue(new Date(at.getFullYear(), at.getMonth() + 1, 1));
}

/** Số La Mã cho tiêu đề nhóm, giống cách đánh số trong file đăng ký của HCNS. */
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];

export function romanNumeral(index: number): string {
	return ROMAN[index] ?? String(index + 1);
}

export interface SummaryRowGroup {
	/** Số La Mã hiện ở đầu dòng tiêu đề nhóm. */
	numeral: string;
	groupName: string;
	rows: SummaryRow[];
}

/** Nhóm của các dòng ngoài danh mục, luôn xếp cuối bảng như file của HCNS. */
export const CUSTOM_GROUP_NAME = 'Mặt hàng ngoài danh mục';

/**
 * Xếp dòng bảng tổng hợp thành nhóm, giữ nguyên thứ tự máy chủ trả về.
 *
 * Dòng ngoài danh mục (`groupName` rỗng) gom vào một nhóm cuối bảng, vì chúng không thuộc nhóm
 * nào trong danh mục và cũng không có ô dự trù.
 */
export function groupSummaryRows(rows: SummaryRow[]): SummaryRowGroup[] {
	const named = new Map<string, SummaryRow[]>();
	const custom: SummaryRow[] = [];

	for (const row of rows) {
		if (!row.groupName) {
			custom.push(row);
			continue;
		}
		const list = named.get(row.groupName) ?? [];
		list.push(row);
		named.set(row.groupName, list);
	}

	const groups = [...named.entries()].map(([groupName, groupRows]) => ({ groupName, rows: groupRows }));
	if (custom.length) groups.push({ groupName: CUSTOM_GROUP_NAME, rows: custom });

	return groups.map((group, index) => ({ numeral: romanNumeral(index), ...group }));
}

export interface BookingBar {
	/** Phần trăm từ mép trái của dải giờ. */
	leftPercent: number;
	widthPercent: number;
	/** Lượt vắt ra ngoài dải giờ đang vẽ, để trang hiện dấu cho người dùng biết. */
	clippedStart: boolean;
	clippedEnd: boolean;
}

/**
 * Đặt một lượt họp lên dải giờ của lưới phòng.
 *
 * Lưới vẽ từ `startHour` tới `endHour` giờ Việt Nam. Lượt kéo dài qua hai ngày hoặc ra ngoài dải
 * giờ thì bị cắt về mép và trang hiện mũi nhọn, chứ không đẩy lượt ra khỏi lưới: người dùng phải
 * thấy phòng đang bận.
 *
 * Trả `null` khi lượt nằm hoàn toàn ngoài dải giờ.
 */
export function bookingBar(
	startAt: string,
	endAt: string,
	options: { startHour: number; endHour: number },
): BookingBar | null {
	const spanMinutes = (options.endHour - options.startHour) * 60;
	if (spanMinutes <= 0) return null;

	const dayStart = options.startHour * 60;
	const dayEnd = options.endHour * 60;

	// Lượt sang ngày hôm sau có số phút nhỏ hơn lúc bắt đầu: cộng một ngày để nó vẫn là một
	// khoảng tăng dần, nhờ vậy phần vắt qua nửa đêm được tính là bị cắt chứ không biến mất.
	const start = vnMinutesOfDay(startAt);
	const rawEnd = vnMinutesOfDay(endAt);
	const end = rawEnd <= start ? rawEnd + 24 * 60 : rawEnd;

	if (end <= dayStart || start >= dayEnd) return null;

	const clampedStart = Math.max(start, dayStart);
	const clampedEnd = Math.min(end, dayEnd);

	return {
		leftPercent: ((clampedStart - dayStart) / spanMinutes) * 100,
		widthPercent: ((clampedEnd - clampedStart) / spanMinutes) * 100,
		clippedStart: start < dayStart,
		clippedEnd: end > dayEnd,
	};
}

/**
 * Dải giờ mà lịch phòng cần vẽ cho một tập lượt họp: mặc định là giờ làm việc, nới ra khi có lượt
 * sớm hơn hoặc muộn hơn.
 *
 * Để cứng dải mặc định thì một cuộc họp lúc 21h biến mất khỏi lịch, người xem tưởng phòng trống
 * rồi đặt chồng lên và bị máy chủ từ chối mà không hiểu vì sao. Lượt đã huỷ không giữ phòng nên
 * không được kéo dải giờ ra.
 */
export function bookingHourRange(
	bookings: Iterable<{ status: string; startAt: string; endAt: string }>,
	defaults: { startHour: number; endHour: number },
): { start: number; end: number } {
	let start = defaults.startHour;
	let end = defaults.endHour;
	for (const booking of bookings) {
		if (booking.status === 'CANCELLED') continue;
		const from = Math.floor(vnMinutesOfDay(booking.startAt) / 60);
		const rawEnd = vnMinutesOfDay(booking.endAt);
		// Lượt kết thúc đúng nửa đêm hoặc vắt sang hôm sau thì coi như chạy tới hết ngày.
		const to = rawEnd <= from * 60 ? 24 : Math.ceil(rawEnd / 60);
		start = Math.min(start, from);
		end = Math.max(end, to);
	}
	return { start: Math.max(0, start), end: Math.min(24, Math.max(end, start + 1)) };
}

/**
 * Vị trí của vạch "bây giờ" trên dải giờ, tính bằng phần trăm từ mép trái.
 *
 * Trả `null` khi ngày đang xem không phải hôm nay hoặc giờ hiện tại nằm ngoài dải: vẽ vạch dính
 * ở mép thì người xem tưởng bây giờ là 7 giờ sáng hay 8 giờ tối.
 */
export function nowLinePercent(
	dateYmd: string,
	range: { start: number; end: number },
	now: Date = new Date(),
): number | null {
	if (dateYmd !== vnDateYmd(now)) return null;
	const span = (range.end - range.start) * 60;
	if (span <= 0) return null;
	const passed = vnMinutesOfDay(now) - range.start * 60;
	if (passed < 0 || passed > span) return null;
	return (passed / span) * 100;
}

/** Cộng hoặc trừ số ngày trên một ngày `YYYY-MM-DD`. */
export function addDaysYmd(dateYmd: string, days: number): string {
	return format(addDays(parseISO(dateYmd), days), 'yyyy-MM-dd');
}

/**
 * Bảy ngày của tuần chứa một ngày, từ thứ Hai tới Chủ nhật.
 *
 * Tuần bắt đầu từ thứ Hai như lịch làm việc ở Việt Nam, không phải Chủ nhật như mặc định của
 * date-fns: bắt đầu từ Chủ nhật thì thứ Hai của tuần đang xem rơi sang cột thứ hai và cả tuần
 * làm việc bị cắt đôi khi bấm sang tuần sau.
 */
export function weekDaysYmd(dateYmd: string): string[] {
	const monday = startOfWeek(parseISO(dateYmd), { weekStartsOn: 1 });
	return Array.from({ length: 7 }, (_, i) => format(addDays(monday, i), 'yyyy-MM-dd'));
}

/**
 * Chia lượt họp của một khoảng ngày vào từng ngày, theo ngày bắt đầu giờ Việt Nam.
 *
 * Máy chủ trả lượt của cả khoảng trong một danh sách, gồm cả lượt bắt đầu từ trước ngày đầu mà
 * vắt sang khoảng; lượt đó không thuộc ngày nào đang vẽ nên bỏ. Chia theo giờ UTC thì cuộc họp
 * lúc 6 giờ sáng rơi về ngày hôm trước, nên phải đổi sang ngày Việt Nam trước khi chia. Lượt đã
 * huỷ không giữ phòng nên cũng bỏ, còn thứ tự giữ nguyên theo giờ bắt đầu.
 */
export function splitBookingsByDay<T extends { status: string; startAt: string }>(
	bookings: T[],
	days: string[],
): T[][] {
	const index = new Map(days.map((day, i) => [day, i]));
	const result: T[][] = days.map(() => []);
	const sorted = [...bookings].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
	for (const booking of sorted) {
		if (booking.status === 'CANCELLED') continue;
		const i = index.get(vnDateYmd(booking.startAt));
		if (i !== undefined) result[i]?.push(booking);
	}
	return result;
}

/**
 * Nhãn của một tuần trên thanh điều hướng lịch.
 *
 * Cùng tháng thì gọn "16 – 22/11/2026"; vắt qua tháng hay qua năm thì ghi đủ hai đầu, nếu không
 * "30 – 06/12/2026" đọc như ngày 30 tháng 12.
 */
export function weekRangeLabel(days: string[]): string {
	const first = days[0];
	const last = days[days.length - 1];
	if (!first || !last) return '';
	const a = parseISO(first);
	const b = parseISO(last);
	if (a.getFullYear() !== b.getFullYear()) return `${format(a, 'dd/MM/yyyy')} – ${format(b, 'dd/MM/yyyy')}`;
	if (a.getMonth() !== b.getMonth()) return `${format(a, 'dd/MM')} – ${format(b, 'dd/MM/yyyy')}`;
	return `${format(a, 'dd')} – ${format(b, 'dd/MM/yyyy')}`;
}

/**
 * Các ngày của lịch tháng chứa một ngày: từ thứ Hai của tuần có ngày mùng một tới Chủ nhật của
 * tuần có ngày cuối tháng, nên luôn là bốn tới sáu tuần trọn.
 *
 * Vẽ đủ tuần như Google Calendar để cột nào cũng đúng thứ; ngày của tháng bên cạnh vẫn hiện, chỉ
 * mờ đi, nên cuộc họp đầu tháng sau vẫn thấy được từ cuối tháng này.
 */
export function monthGridDaysYmd(dateYmd: string): string[] {
	const first = startOfWeek(startOfMonth(parseISO(dateYmd)), { weekStartsOn: 1 });
	const last = endOfWeek(endOfMonth(parseISO(dateYmd)), { weekStartsOn: 1 });
	const days: string[] = [];
	for (let d = first; d <= last; d = addDays(d, 1)) days.push(format(d, 'yyyy-MM-dd'));
	return days;
}

/** Cộng hoặc trừ số tháng trên một ngày `YYYY-MM-DD`; ngày 31 sang tháng ngắn hơn thì về ngày cuối. */
export function addMonthsYmd(dateYmd: string, months: number): string {
	return format(addMonths(parseISO(dateYmd), months), 'yyyy-MM-dd');
}

/** Một lượt trên cột ngày của lịch giờ: vị trí dọc tính bằng phút, vị trí ngang bằng cột con. */
export interface DayEventSlot<T> {
	booking: T;
	/** Phút bắt đầu và kết thúc giờ Việt Nam, đã cắt về trong ngày. */
	startMin: number;
	endMin: number;
	/** Cột con của lượt trong cụm chồng giờ, và số cột của cả cụm. */
	column: number;
	columns: number;
}

/**
 * Xếp các lượt của một ngày thành cột con, kiểu Google Calendar: lượt chồng giờ nhau đứng cạnh
 * nhau thay vì đè lên nhau.
 *
 * Gom lượt thành cụm, mỗi cụm là một chuỗi lượt liền nhau có chồng giờ; trong cụm, lượt nào cũng
 * vào cột trống đầu tiên, rồi cả cụm chia đều bề ngang. Chia theo cụm chứ không theo cả ngày, để
 * hai cuộc họp trùng giờ buổi sáng không làm cuộc họp một mình buổi chiều bị hẹp đi một nửa.
 * Lượt đã huỷ không vẽ. Lượt vắt qua nửa đêm thì kéo tới hết ngày.
 */
export function layoutDayEvents<T extends { status: string; startAt: string; endAt: string }>(
	bookings: T[],
): DayEventSlot<T>[] {
	const items = bookings
		.filter(b => b.status !== 'CANCELLED')
		.map(booking => {
			const startMin = vnMinutesOfDay(booking.startAt);
			const rawEnd = vnMinutesOfDay(booking.endAt);
			const endMin = rawEnd <= startMin ? 24 * 60 : rawEnd;
			return { booking, startMin, endMin, column: 0, columns: 1 };
		})
		.sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

	const result: DayEventSlot<T>[] = [];
	let cluster: DayEventSlot<T>[] = [];
	/** Giờ kết thúc của lượt cuối cùng trong mỗi cột của cụm đang xét. */
	let columnEnds: number[] = [];
	let clusterEnd = -1;

	const closeCluster = () => {
		for (const item of cluster) item.columns = columnEnds.length;
		result.push(...cluster);
		cluster = [];
		columnEnds = [];
	};

	for (const item of items) {
		if (cluster.length && item.startMin >= clusterEnd) closeCluster();
		let column = columnEnds.findIndex(end => end <= item.startMin);
		if (column === -1) {
			column = columnEnds.length;
			columnEnds.push(item.endMin);
		} else {
			columnEnds[column] = item.endMin;
		}
		item.column = column;
		cluster.push(item);
		clusterEnd = cluster.length === 1 ? item.endMin : Math.max(clusterEnd, item.endMin);
	}
	if (cluster.length) closeCluster();
	return result;
}

/**
 * Câu trạng thái của một phòng lúc này, từ cờ `now` của máy chủ.
 *
 * `until` rỗng khi đang trống nghĩa là trống tới hết ngày; nói thẳng câu đó thay vì để trống chỗ.
 */
export function roomNowLabel(now: { busy: boolean; until: string | null } | null): string {
	if (!now) return '';
	if (now.busy) return now.until ? `Đang họp tới ${vnTimeLabel(now.until)}` : 'Đang họp';
	// "Trống cả ngày" là câu sai sự thật khi phòng vừa họp xong lúc sáng: cờ `now` chỉ nói từ bây
	// giờ trở đi, nên câu cũng phải nói từ bây giờ trở đi.
	return now.until ? `Trống đến ${vnTimeLabel(now.until)}` : 'Trống đến hết ngày';
}

/**
 * Mã lỗi nghiệp vụ của máy chủ, để trang đặt câu lỗi vào ĐÚNG ô thay vì chỉ toast.
 *
 * `auth.fetch.ts` giữ nguyên `data` và `status` của response khi bọc lỗi, nên mã nằm ở
 * `error.data.error.code`. Không có mã thì trả `null` và nơi gọi cứ toast như thường.
 */
export function officeErrorCode(error: unknown): string | null {
	const data = (error as { data?: { error?: { code?: string } } } | null)?.data;
	return data?.error?.code ?? null;
}

/** Câu lỗi của máy chủ, hoặc câu dự phòng của trang. */
export function officeErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Mã HTTP của lỗi, để phân biệt "bản ghi không còn nữa" với lỗi nghiệp vụ có mã riêng.
 *
 * Hai người cùng sửa một phiếu thì người chậm hơn nhận 404 ở dòng vừa bị xoá, mà 404 không mang
 * mã nghiệp vụ nào; trang cần biết để tự tải lại phiếu thay vì chỉ hiện một câu lỗi khó hiểu.
 */
export function officeErrorStatus(error: unknown): number | null {
	const e = error as { status?: number; statusCode?: number; response?: { status?: number } } | null;
	return e?.status ?? e?.statusCode ?? e?.response?.status ?? null;
}

/** Câu nhắc khi ô số lượng nhận chữ không phải chữ số. */
export const QTY_INTEGER_MESSAGE = 'Số lượng là số nguyên, ví dụ 2';

/**
 * Lượt họp "của tôi" xếp theo việc người dùng cần làm gì với chúng.
 *
 * Lượt sắp tới và đang họp lên trước, gần nhất trước; lượt đã kết thúc xuống cuối, mới nhất trước.
 * Xếp theo giờ thuần thì sáng nay đã xong lại nằm trên cuộc họp chiều nay, và người dùng phải
 * cuộn qua những thứ không còn làm gì được nữa.
 */
export function sortMyBookings<T extends { timing: string; startAt: string }>(list: T[]): T[] {
	const ended = (booking: T) => booking.timing === 'ENDED';
	return [...list].sort((a, b) => {
		if (ended(a) !== ended(b)) return ended(a) ? 1 : -1;
		const at = new Date(a.startAt).getTime();
		const bt = new Date(b.startAt).getTime();
		return ended(a) ? bt - at : at - bt;
	});
}

/**
 * Giờ này trên lịch đã qua chưa, tính theo giờ Việt Nam.
 *
 * Ô giờ đã qua phải mờ và không bấm được: bấm vào rồi mới nhận câu "Không đặt được giờ đã qua" là
 * bắt người dùng điền cả biểu mẫu để nhận một lời từ chối đã biết trước.
 */
export function isHourPast(dateYmd: string, hour: number, now: Date = new Date()): boolean {
	const today = vnDateYmd(now);
	if (dateYmd < today) return true;
	if (dateYmd > today) return false;
	// Giờ đang chạy vẫn đặt được: máy chủ nhận lượt bắt đầu trễ tới năm phút, và phần còn lại của
	// giờ này vẫn ở tương lai.
	return hour < Math.floor(vnMinutesOfDay(now) / 60);
}

/** Ngày theo giờ Việt Nam, dạng `YYYY-MM-DD`. */
export function vnDateYmd(at: string | Date): string {
	return VN_DATE.format(new Date(at));
}

/**
 * Giờ bắt đầu điền sẵn khi bấm một ô giờ trên lịch.
 *
 * Bấm ô của giờ đang chạy thì `09:00` đã là quá khứ, nên lấy mốc năm phút kế tiếp; các giờ khác
 * thì đúng đầu giờ.
 */
export function slotStartHhmm(dateYmd: string, hour: number, now: Date = new Date()): string {
	const hhmm = `${String(hour).padStart(2, '0')}:00`;
	if (dateYmd !== vnDateYmd(now)) return hhmm;
	const minutes = vnMinutesOfDay(now);
	if (hour !== Math.floor(minutes / 60)) return hhmm;
	const rounded = Math.min(Math.ceil((minutes + 1) / 5) * 5, 23 * 60 + 55);
	return `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`;
}

/**
 * Câu báo sau khi bấm "Lấy số tháng trước".
 *
 * Nói đủ ba điều người dùng cần: lấy từ kỳ nào, thêm được bao nhiêu dòng, và dòng nào bị bỏ kèm
 * lý do — vì dòng bị bỏ là dòng họ phải tự nhập lại, không nói ra thì họ tưởng đã có đủ.
 */
export function copyPreviousSummary(result: {
	previousTitle: string | null;
	added: number;
	/** Mặt hàng phiếu đã có nên không chép lại; máy chủ cũ không gửi trường này. */
	existing?: number;
	skippedItems: Array<{ name: string; reason: string }>;
}): string {
	if (!result.previousTitle) return 'Phòng chưa có kỳ trước ở văn phòng này nên chưa có số để lấy.';

	// Bấm lần thứ hai thì không thêm được gì nữa, mà câu "Đã thêm 0 dòng" làm người dùng tưởng
	// chức năng hỏng; nói thẳng là phiếu đã có đủ rồi.
	if (result.added === 0 && !result.skippedItems.length) {
		return `Phiếu đã có đủ các mặt hàng của ${result.previousTitle}, không có gì để thêm.`;
	}

	let head = `Đã lấy ${result.added} mặt hàng từ ${result.previousTitle}.`;
	// Mặt hàng phiếu đã có KHÔNG phải là dòng bị loại: nói rõ chúng được giữ nguyên.
	if (result.existing) head += ` ${result.existing} mặt hàng phiếu đã có nên giữ nguyên số của phòng.`;
	if (!result.skippedItems.length) return head;

	const list = result.skippedItems.map(item => `${item.name} (${item.reason})`).join('; ');
	return `${head} Bỏ qua ${result.skippedItems.length} dòng: ${list}.`;
}

const MONEY = new Intl.NumberFormat('vi-VN');

/**
 * Hiện tiền, hoặc dấu gạch khi máy chủ không gửi số.
 *
 * `null` ở trường tiền của module này mang hai nghĩa: người xem không có quyền xem chi phí, hoặc
 * mặt hàng chưa có đơn giá. Cả hai đều KHÁC "bằng không", nên không được hiện là 0.
 */
export function officeMoney(amount: number | null | undefined): string {
	if (amount == null) return '—';
	return MONEY.format(amount);
}

/**
 * Tên file lấy từ `Content-Disposition` của máy chủ.
 *
 * Máy chủ đặt tên theo kỳ và văn phòng ("van-phong-pham-12-2026-huu-nghi.xlsx"), nên FE không tự
 * đặt nữa. Nhận cả `filename*=UTF-8''…` (có dấu tiếng Việt) lẫn `filename="…"`; không đọc được
 * thì trả chuỗi rỗng để nơi gọi dùng tên dự phòng của mình.
 */
export function fileNameFromDisposition(header: string | null | undefined): string {
	if (!header) return '';
	const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
	if (utf8?.[1]) {
		try {
			return decodeURIComponent(utf8[1].trim());
		} catch {
			return utf8[1].trim();
		}
	}
	const plain = /filename="?([^";]+)"?/i.exec(header);
	return plain?.[1]?.trim() ?? '';
}

/** File tải về kèm tên do máy chủ đặt. */
export interface OfficeDownload {
	blob: Blob;
	/** Rỗng khi không đọc được `Content-Disposition`; nơi gọi tự đặt tên dự phòng. */
	fileName: string;
}

/**
 * Tải file về máy.
 *
 * Tên file ưu tiên tên của máy chủ; chỉ khi header không tới được trình duyệt (ví dụ CORS chưa
 * mở `Content-Disposition`) thì mới dùng tên dự phòng của trang.
 */
export function downloadOfficeFile(blob: Blob, fileName: string): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = fileName;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

// ─── Trang văn phòng phẩm của phòng tôi ───────────────────────────────────────

export type SupplyStatus = SupplyPeriodStatus | SupplyRequestStatus;

/** Nhãn và màu của một trạng thái kỳ hoặc phiếu văn phòng phẩm. */
export interface SupplyStatusMeta {
	/** Nhãn đầy đủ, nói cả việc tiếp theo: "Đã chốt, chờ cấp". */
	label: string;
	/** Nhãn ngắn cho số đếm và chỗ hẹp: "Đã chốt". */
	shortLabel: string;
	class: string;
}

/**
 * Nhãn trạng thái của kỳ và phiếu văn phòng phẩm, MỘT bảng cho cả hai cấp.
 *
 * Kỳ và phiếu cùng nằm trên một thanh, nên OPEN và LOCKED phải đọc giống nhau ở cả hai cấp:
 * trước đây kỳ ghi "Đang nhận đăng ký" còn phiếu ghi "Đang đăng ký", người đọc tưởng là hai việc
 * khác nhau. Nhãn dài của các bước sau khoá giữ đúng chữ của máy chủ. Khai báo bằng `Record` đủ
 * khoá nên máy chủ thêm trạng thái mới mà chưa có nhãn thì build báo lỗi ngay.
 */
export const SUPPLY_STATUS: Record<SupplyStatus, SupplyStatusMeta> = {
	OPEN: {
		label: 'Đang đăng ký',
		shortLabel: 'Đang đăng ký',
		class: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
	},
	LOCKED: {
		label: 'Đã khoá',
		shortLabel: 'Đã khoá',
		class: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
	},
	CLOSED: {
		label: 'Đã đóng',
		shortLabel: 'Đã đóng',
		class: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
	},
	FINALIZED: {
		label: 'Đã chốt, chờ cấp',
		shortLabel: 'Đã chốt',
		class: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
	},
	ISSUED: {
		label: 'Đã cấp, chờ nhận',
		shortLabel: 'Đã cấp',
		class: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400',
	},
	RECEIVED: {
		label: 'Đã nhận',
		shortLabel: 'Đã nhận',
		class: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
	},
};

/** Phiếu không có dòng nào khi đã khoá; cùng chữ với máy chủ. */
export const SUPPLY_EMPTY_REQUEST_LABEL = 'Không đăng ký';

/**
 * Nhãn hiện cho một kỳ hoặc một phiếu.
 *
 * Biết số dòng thì phiếu rỗng sau khi khoá ghi "Không đăng ký" thay vì nhãn chung "Đã khoá", để
 * HCNS và phòng thấy ngay phòng không xin gì kỳ đó.
 */
export function supplyStatusLabel(status: string, lineCount?: number): string {
	if (status !== 'OPEN' && lineCount === 0) return SUPPLY_EMPTY_REQUEST_LABEL;
	return supplyStatusMeta(status).label;
}

const SUPPLY_STATUS_UNKNOWN_CLASS = 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';

function isSupplyStatus(status: string): status is SupplyStatus {
	return Object.prototype.hasOwnProperty.call(SUPPLY_STATUS, status);
}

/**
 * Nhãn và màu của một trạng thái, kể cả trạng thái trang chưa biết.
 *
 * Máy chủ thêm trạng thái mới trước khi web kịp phát hành thì trang vẫn chạy: hiện nguyên mã trạng
 * thái trên nền xám thay vì ném lỗi làm trắng cả danh sách.
 */
export function supplyStatusMeta(status: string): SupplyStatusMeta {
	if (isSupplyStatus(status)) return SUPPLY_STATUS[status];
	return { label: status, shortLabel: status, class: SUPPLY_STATUS_UNKNOWN_CLASS };
}

/** Mốc phiếu tự khoá theo giờ Việt Nam: "00:00 ngày 28/11/2026". */
export function supplyLockLabel(lockAt: string): string {
	const [year, month, day] = vnDateYmd(lockAt).split('-');
	return `${vnTimeLabel(lockAt)} ngày ${day}/${month}/${year}`;
}

/** Một dòng của form danh mục: mặt hàng được phép đặt, kèm dòng phiếu nếu phòng đã đăng ký. */
export interface SupplyCatalogRow {
	/** `i<itemId>` với mặt hàng danh mục, `c<lineId>` với dòng ngoài danh mục. */
	key: string;
	itemId: number | null;
	name: string;
	unit: string | null;
	groupName: string;
	/** Định mức tháng của phòng; `null` là không giới hạn. */
	quota: number | null;
	line: SupplyLine | null;
	/** Tên đã bỏ dấu, để ô tìm không phải chuẩn hoá lại mỗi lần gõ. */
	searchText: string;
}

export interface SupplyCatalogGroup {
	name: string;
	isCustom: boolean;
	rows: SupplyCatalogRow[];
}

/**
 * Ghép danh mục với dòng của phiếu thành các nhóm của form.
 *
 * Nhóm và mặt hàng giữ thứ tự máy chủ trả về. Dòng của phiếu mà danh mục không còn (mặt hàng ngừng
 * dùng, nhóm chỉ HCNS đặt do HCNS nhập thay) vẫn phải hiện, nên chúng xếp cuối nhóm của mình; dòng
 * ngoài danh mục luôn ở nhóm cuối cùng. `onlyLines` bỏ những mặt hàng phòng chưa đăng ký, dùng
 * khi phiếu chỉ còn để xem.
 */
export function buildSupplyCatalog(items: SupplyItem[], lines: SupplyLine[], onlyLines = false): SupplyCatalogGroup[] {
	const lineByItem = new Map<number, SupplyLine>();
	for (const line of lines) if (line.itemId != null) lineByItem.set(line.itemId, line);

	const groups = new Map<string, SupplyCatalogRow[]>();
	const push = (row: SupplyCatalogRow) => {
		if (onlyLines && !row.line) return;
		const list = groups.get(row.groupName) ?? [];
		list.push(row);
		groups.set(row.groupName, list);
	};

	const listed = new Set<number>();
	for (const item of items) {
		listed.add(item.id);
		const line = lineByItem.get(item.id) ?? null;
		push({
			key: `i${item.id}`,
			itemId: item.id,
			name: item.name,
			unit: item.unit,
			groupName: item.groupName,
			quota: line ? line.quota : (item.quota ?? null),
			line,
			searchText: vnSearchText(item.name),
		});
	}

	const custom: SupplyCatalogRow[] = [];
	for (const line of lines) {
		if (line.itemId != null && listed.has(line.itemId)) continue;
		const row: SupplyCatalogRow = {
			key: line.itemId != null ? `i${line.itemId}` : `c${line.id}`,
			itemId: line.itemId,
			name: line.name,
			unit: line.unit,
			groupName: line.itemId != null && line.groupName ? line.groupName : CUSTOM_GROUP_NAME,
			quota: line.quota,
			line,
			searchText: vnSearchText(line.name),
		};
		if (row.groupName === CUSTOM_GROUP_NAME) custom.push(row);
		else push(row);
	}

	const result = [...groups.entries()]
		.filter(([name]) => name !== CUSTOM_GROUP_NAME)
		.map(([name, rows]) => ({ name, isCustom: false, rows }));
	if (custom.length) result.push({ name: CUSTOM_GROUP_NAME, isCustom: true, rows: custom });
	return result;
}

/** Câu "Bạn 16 · Nguyễn Thị Hương Quỳnh 5": ai xin bao nhiêu trong tổng của dòng. */
export function supplySharesLabel(line: SupplyLine): string {
	return line.shares.map(s => `${s.isMine ? 'Bạn' : s.employee.fullName} ${s.qty}`).join(' · ');
}

// ─── Trang Kỳ văn phòng phẩm và hộp Mở kỳ ─────────────────────────────────────

/** Tháng hiện tại theo giờ Việt Nam, dạng `YYYY-MM`; máy đặt múi giờ khác vẫn ra đúng tháng. */
export function vnMonthValue(now: Date = new Date()): string {
	return vnDateYmd(now).slice(0, 7);
}

/** Cộng tháng cho chuỗi `YYYY-MM`, không qua `Date` để khỏi lệch múi giờ. */
export function addMonthsYm(month: string, months: number): string {
	const [year, mon] = month.split('-').map(Number);
	const index = (year ?? 0) * 12 + (mon ?? 1) - 1 + months;
	return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** Số tháng từ `from` tới `to`, cả hai dạng `YYYY-MM`. */
function monthsBetween(from: string, to: string): number {
	const [fy, fm] = from.split('-').map(Number);
	const [ty, tm] = to.split('-').map(Number);
	return ((ty ?? 0) - (fy ?? 0)) * 12 + ((tm ?? 0) - (fm ?? 0));
}

function daysInMonth(month: string): number {
	const [year, mon] = month.split('-').map(Number);
	return new Date(Date.UTC(year ?? 0, mon ?? 1, 0)).getUTCDate();
}

/** Kỳ có tháng muộn nhất của một văn phòng (trùng tháng thì kỳ mở sau). */
export function latestPeriodOf<T extends { id: number; month: string; officeSite: { id: number } }>(
	periods: T[],
	siteId: number,
): T | null {
	let latest: T | null = null;
	for (const period of periods) {
		if (period.officeSite.id !== siteId) continue;
		if (!latest || period.month > latest.month || (period.month === latest.month && period.id > latest.id)) {
			latest = period;
		}
	}
	return latest;
}

/** Kỳ có tháng muộn nhất trong mọi văn phòng; dùng để chọn sẵn văn phòng khi mở kỳ. */
export function latestPeriod<T extends { id: number; month: string }>(periods: T[]): T | null {
	return periods.reduce<T | null>(
		(best, p) => (!best || p.month > best.month || (p.month === best.month && p.id > best.id) ? p : best),
		null,
	);
}

/**
 * Tháng chi phí mặc định khi mở kỳ: tháng sau kỳ gần nhất của văn phòng, nhưng không trước tháng
 * hiện tại vì máy chủ không cho mở kỳ của tháng đã qua. Chưa có kỳ nào thì tháng hiện tại.
 */
export function defaultPeriodMonth(latest: { month: string } | null, nowMonth: string): string {
	if (!latest) return nowMonth;
	const next = addMonthsYm(latest.month, 1);
	return next > nowMonth ? next : nowMonth;
}

/**
 * Hạn chót mặc định cho kỳ của `month`, theo thói quen của kỳ gần nhất.
 *
 * Giữ nguyên ngày trong tháng và cả khoảng cách giữa tháng hạn chót với tháng chi phí: kỳ tháng 12
 * hạn ngày 27/11 thì kỳ tháng 1 hạn ngày 27/12, kỳ tháng 11 hạn ngày 27/11 thì kỳ tháng 12 hạn 27/12.
 * Tháng đích ngắn hơn thì kẹp về ngày cuối tháng (31 thành 28/2). Ngày tính ra đã qua, hoặc chưa có
 * kỳ trước, thì để trống cho người dùng chọn.
 */
export function defaultPeriodDeadline(
	latest: { month: string; deadline: string } | null,
	month: string,
	todayYmd: string,
): string {
	if (!latest) return '';
	const offset = monthsBetween(latest.month, latest.deadline.slice(0, 7));
	const deadlineMonth = addMonthsYm(month, offset);
	const day = Math.min(Number(latest.deadline.slice(8, 10)), daysInMonth(deadlineMonth));
	const ymd = `${deadlineMonth}-${String(day).padStart(2, '0')}`;
	return ymd < todayYmd ? '' : ymd;
}

const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/** Thứ trong tuần của một ngày `YYYY-MM-DD`; tính theo UTC nên không lệch ngày vì múi giờ máy. */
export function weekdayOf(ymd: string): { label: string; weekend: boolean } {
	const [year, month, day] = ymd.split('-').map(Number);
	const index = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1)).getUTCDay();
	return { label: WEEKDAYS[index] ?? '', weekend: index === 0 || index === 6 };
}

/** Thời điểm phiếu tự khoá của một hạn chót: 00:00 giờ Việt Nam ngày hôm sau, dạng ISO. */
export function lockAtOfDeadline(deadlineYmd: string): string {
	return `${addDaysYmd(deadlineYmd, 1)}T00:00:00+07:00`;
}

/** Số ngày theo lịch từ `fromYmd` tới `toYmd`; số âm là đã qua. */
export function daysBetweenYmd(fromYmd: string, toYmd: string): number {
	const toUtc = (ymd: string) => {
		const [y, m, d] = ymd.split('-').map(Number);
		return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1);
	};
	return Math.round((toUtc(toYmd) - toUtc(fromYmd)) / 86_400_000);
}

/** Kỳ đã có của một văn phòng trong một tháng; máy chủ không cho mở kỳ thứ hai. */
export function findPeriodFor<T extends { month: string; officeSite: { id: number } }>(
	periods: T[],
	siteId: number,
	month: string,
): T | null {
	return periods.find(p => p.officeSite.id === siteId && p.month === month) ?? null;
}

export interface NextPeriodSuggestion<S> {
	site: S;
	/** Tháng nên mở, `YYYY-MM`. */
	month: string;
}

/**
 * Văn phòng nên mở kỳ tiếp theo: kỳ gần nhất đã khoá hoặc đã đóng mà chưa có kỳ của tháng sau.
 *
 * Kỳ gần nhất còn đang đăng ký thì không nhắc, vì nhắc lúc các phòng còn đang nhập chỉ là nhắc sớm.
 * Văn phòng chưa có kỳ nào cũng không nhắc: việc đó là "Mở kỳ đầu tiên" ở trạng thái trống.
 */
export function nextPeriodSuggestions<
	S extends { id: number },
	P extends { id: number; month: string; status: string; officeSite: { id: number } },
>(sites: S[], periods: P[], nowMonth: string): NextPeriodSuggestion<S>[] {
	const result: NextPeriodSuggestion<S>[] = [];
	for (const site of sites) {
		const latest = latestPeriodOf(periods, site.id);
		if (!latest || latest.status === 'OPEN') continue;
		const month = defaultPeriodMonth(latest, nowMonth);
		if (findPeriodFor(periods, site.id, month)) continue;
		result.push({ site, month });
	}
	return result;
}

/** Kỳ đang diễn ra (OPEN, LOCKED) ở trên, kỳ đã đóng ở dưới; trong nhóm tháng mới trước. */
export function groupSupplyPeriods<T extends { id: number; month: string; status: string }>(
	periods: T[],
): { active: T[]; closed: T[] } {
	const sorted = [...periods].sort((a, b) => (a.month === b.month ? b.id - a.id : a.month < b.month ? 1 : -1));
	return {
		active: sorted.filter(p => p.status !== 'CLOSED'),
		closed: sorted.filter(p => p.status === 'CLOSED'),
	};
}

/** Tiến độ đăng ký của kỳ; kỳ không có phòng nào thì 0%, không chia cho 0. */
export function periodProgress(period: { departmentsTotal?: number; departmentsWithLines?: number }): {
	done: number;
	total: number;
	percent: number;
} {
	const total = period.departmentsTotal ?? 0;
	const done = Math.min(period.departmentsWithLines ?? 0, total);
	return { done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
}

// ─── Chi tiết kỳ: giai đoạn, phòng đã đăng ký, bảng tổng hợp ───────────────────

export interface PeriodStageStep {
	status: 'OPEN' | 'LOCKED' | 'CLOSED';
	label: string;
	state: 'done' | 'current' | 'todo';
	/** Câu thời điểm dưới bước: đã xảy ra thì giờ thật, chưa tới thì "dự kiến" nếu tính được. */
	at: string;
}

/** Ba bước của kỳ theo đúng enum OPEN → LOCKED → CLOSED, kèm thời điểm có trong dữ liệu. */
export function periodStageSteps(period: {
	status: string;
	lockAt: string;
	lockedAt: string | null;
	closedAt: string | null;
}): PeriodStageStep[] {
	const order = ['OPEN', 'LOCKED', 'CLOSED'] as const;
	const current = Math.max(order.findIndex(status => status === period.status), 0);
	const at: Record<(typeof order)[number], string> = {
		OPEN: '',
		LOCKED: period.lockedAt
			? `Khoá lúc ${formatVnDateTime(period.lockedAt)}`
			: current === 0
				? `Dự kiến ${supplyLockLabel(period.lockAt)}`
				: '',
		CLOSED: period.closedAt ? `Đóng lúc ${formatVnDateTime(period.closedAt)}` : '',
	};
	return order.map((status, index) => ({
		status,
		label: SUPPLY_STATUS[status].label,
		state: index < current ? 'done' : index === current ? 'current' : 'todo',
		at: at[status],
	}));
}

interface SummaryDepartmentLike {
	departmentId: number;
	name: string;
	requests: Array<{ id: number; sequence: number; status: string; lineCount: number }>;
}

/** Phòng đã đăng ký = phòng có ít nhất một dòng ở phiếu chính hoặc phiếu bổ sung; đếm theo phòng. */
export function departmentRegistration(departments: SummaryDepartmentLike[]): { done: number; total: number } {
	return {
		done: departments.filter(d => d.requests.some(r => r.lineCount > 0)).length,
		total: departments.length,
	};
}

/**
 * Tiến độ phiếu sau khi khoá, đếm theo phiếu có dòng (phiếu rỗng là "Không đăng ký", không có gì để
 * chốt hay cấp). Mỗi bước đếm cả phiếu đã đi qua nó: phiếu đã nhận cũng đã chốt và đã cấp.
 */
export function requestStageCounts(departments: SummaryDepartmentLike[]): {
	total: number;
	finalized: number;
	issued: number;
	received: number;
} {
	const requests = departments.flatMap(d => d.requests).filter(r => r.lineCount > 0);
	const reached = (statuses: string[]) => requests.filter(r => statuses.includes(r.status)).length;
	return {
		total: requests.length,
		finalized: reached(['FINALIZED', 'ISSUED', 'RECEIVED']),
		issued: reached(['ISSUED', 'RECEIVED']),
		received: reached(['RECEIVED']),
	};
}

export interface PeriodNextStep {
	kind: 'finalize' | 'issue' | 'close';
	/** Phiếu cần mở cho bước chốt hay cấp; bước đóng kỳ thì không có. */
	requestId?: number;
	departmentName?: string;
	/** 0 là phiếu chính, lớn hơn 0 là phiếu bổ sung. */
	sequence?: number;
}

/**
 * Việc tiếp theo của HCNS trên kỳ đã khoá, theo đúng các nút đang có: chốt phiếu đầu tiên chưa chốt,
 * rồi cấp phiếu đầu tiên đã chốt, xong hết (hoặc phiếu nào cũng rỗng) thì đóng kỳ. Còn phiếu đã cấp
 * chờ phòng bấm Đã nhận thì không có việc chính, trả `null`.
 */
export function periodNextStep(periodStatus: string, departments: SummaryDepartmentLike[]): PeriodNextStep | null {
	if (periodStatus !== 'LOCKED') return null;
	const withLines = departments.flatMap(d => d.requests.filter(r => r.lineCount > 0).map(r => ({ ...r, name: d.name })));
	const toFinalize = withLines.find(r => r.status === 'LOCKED');
	if (toFinalize) {
		return { kind: 'finalize', requestId: toFinalize.id, departmentName: toFinalize.name, sequence: toFinalize.sequence };
	}
	const toIssue = withLines.find(r => r.status === 'FINALIZED');
	if (toIssue) return { kind: 'issue', requestId: toIssue.id, departmentName: toIssue.name, sequence: toIssue.sequence };
	if (withLines.every(r => r.status === 'RECEIVED')) return { kind: 'close' };
	return null;
}

/**
 * Chưa có đơn giá: `null` hoặc trống. Đơn giá 0 là ĐÃ có giá, nên không kiểm tra kiểu falsy.
 *
 * Một tiêu chí cho cả danh mục (Cài đặt hành chính) lẫn bảng tổng hợp kỳ, để "N mặt hàng chưa có
 * đơn giá" ở hai nơi luôn đếm cùng một thứ.
 */
export function isPriceMissing(unitPrice: number | null | undefined): boolean {
	return unitPrice == null;
}

/**
 * Dòng bảng tổng hợp thiếu đơn giá, cùng tiêu chí máy chủ dùng để đếm `unpricedRows`: có số cần mua
 * mà chưa có đơn giá (máy chủ để thành tiền `null` đúng khi thiếu giá).
 */
export function isRowUnpriced(row: { purchaseQty: number; unitPrice: number | null }): boolean {
	return row.purchaseQty > 0 && isPriceMissing(row.unitPrice);
}

/** Ô nhập của bảng tổng hợp đang khác giá trị đã lưu; ô trống so với `null` là chưa đổi. */
export function isDraftDirty(draft: number | undefined, saved: number | null | undefined): boolean {
	return (draft ?? null) !== (saved ?? null);
}

// ─── Cài đặt hành chính: danh mục văn phòng phẩm ──────────────────────────────

interface CatalogGroupLike {
	id: number;
	name: string;
	hrOnly: boolean;
	isActive: boolean;
}

interface CatalogItemLike {
	groupId: number;
	name: string;
	unitPrice: number | null;
	isActive: boolean;
}

export interface CatalogSection<G, I> {
	group: G;
	items: I[];
}

export interface CatalogView<G, I> {
	sections: CatalogSection<G, I>[];
	/** Chip lọc nhóm, kèm số mặt hàng của nhóm (theo công tắc ngừng dùng, chưa tính ô tìm). */
	chips: Array<{ group: G; count: number }>;
	/** Tổng mặt hàng cho chip "Tất cả". */
	total: number;
	/** Mặt hàng đang hiện (theo công tắc ngừng dùng) mà chưa có đơn giá; đúng tập công tắc "Thiếu đơn giá" lọc ra. */
	unpriced: number;
}

/**
 * Danh mục đã lọc, chia theo nhóm, giữ thứ tự nhóm và mặt hàng máy chủ trả về (theo `sortOrder`).
 *
 * Tìm theo tên không dấu, lọc một nhóm, chỉ mặt hàng thiếu đơn giá (cùng tiêu chí `isPriceMissing`
 * với kỳ), và ẩn nhóm, mặt hàng đã ngừng dùng trừ khi bật xem. Nhóm trống vẫn hiện khi không tìm,
 * không lọc thiếu giá, để còn nút thêm mặt hàng ngay trong nhóm đó.
 */
export function filterCatalogSections<G extends CatalogGroupLike, I extends CatalogItemLike>(
	groups: G[],
	items: I[],
	options: { search: string; groupId?: number; onlyUnpriced: boolean; showInactive: boolean },
): CatalogView<G, I> {
	const q = vnSearchText(options.search);
	const visibleGroups = groups.filter(g => options.showInactive || g.isActive);
	const shownGroupIds = new Set(visibleGroups.map(g => g.id));
	// Mặt hàng còn dùng mà nằm trong nhóm đã ngừng thì cũng ẩn theo nhóm, để số đếm khớp danh sách.
	const visibleItems = items.filter(i => (options.showInactive || i.isActive) && shownGroupIds.has(i.groupId));
	const byGroup = new Map<number, I[]>();
	for (const item of visibleItems) {
		const list = byGroup.get(item.groupId) ?? [];
		list.push(item);
		byGroup.set(item.groupId, list);
	}
	const chips = visibleGroups.map(group => ({ group, count: byGroup.get(group.id)?.length ?? 0 }));
	const narrowing = !!q || options.onlyUnpriced;
	const sections = visibleGroups
		.filter(group => !options.groupId || group.id === options.groupId)
		.map(group => ({
			group,
			items: (byGroup.get(group.id) ?? []).filter(
				item => (!q || vnSearchText(item.name).includes(q)) && (!options.onlyUnpriced || isPriceMissing(item.unitPrice)),
			),
		}))
		.filter(section => section.items.length > 0 || !narrowing);
	return {
		sections,
		chips,
		total: chips.reduce((sum, chip) => sum + chip.count, 0),
		unpriced: visibleItems.filter(item => isPriceMissing(item.unitPrice)).length,
	};
}
