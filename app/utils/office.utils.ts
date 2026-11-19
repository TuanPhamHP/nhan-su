import type { SummaryRow } from '~/types/office.types';

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

	let head = `Đã thêm ${result.added} dòng từ ${result.previousTitle}.`;
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
