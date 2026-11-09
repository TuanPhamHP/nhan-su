import { differenceInCalendarDays, format, parseISO, isValid, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

/** Hôm nay dạng "YYYY-MM-DD" (giờ máy) — dùng cho các input ngày gửi lên BE. */
export function todayYmd(): string {
	return format(new Date(), 'yyyy-MM-dd');
}

export function formatDate(date: string | null | undefined, pattern = 'dd/MM/yyyy'): string {
	if (!date) return '—';
	const parsed = parseISO(date);
	if (!isValid(parsed)) return '—';
	return format(parsed, pattern, { locale: vi });
}

export function formatDateTime(date: string | null | undefined): string {
	return formatDate(date, 'dd/MM/yyyy HH:mm');
}

const VN_CALENDAR = new Intl.DateTimeFormat('en-CA', {
	timeZone: 'Asia/Ho_Chi_Minh',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
});

/** Ngày theo lịch Việt Nam của một thời điểm, dạng "YYYY-MM-DD", dù máy đặt múi giờ nào. */
export function vnCalendarDate(at: string | Date): string {
	const parts = VN_CALENDAR.formatToParts(new Date(at));
	const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value;
	return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Từ `from` tới `at` cách nhau bao nhiêu ngày theo lịch Việt Nam: 0 là cùng ngày, số âm là đã qua. */
export function vnCalendarDaysBetween(from: string | Date, at: string | Date): number {
	return differenceInCalendarDays(parseISO(vnCalendarDate(at)), parseISO(vnCalendarDate(from)));
}

/** Hiện ngày theo lịch Việt Nam, dùng cho mốc tính hết ngày giờ Việt Nam như hạn dùng module. */
export function formatVnDate(at: string | Date): string {
	return formatDate(vnCalendarDate(at));
}

export function formatRelativeTime(date: string | null | undefined): string {
	if (!date) return '—';
	const parsed = parseISO(date);
	if (!isValid(parsed)) return '—';
	return formatDistanceToNow(parsed, { addSuffix: true, locale: vi });
}

export function formatTimeAgo(isoDate: string): string {
	const now = new Date();
	const date = new Date(isoDate);
	const diffMs = now.getTime() - date.getTime();
	const diffMin = Math.floor(diffMs / 60000);

	if (diffMin < 1) return 'Vừa xong';
	if (diffMin < 60) return `${diffMin} phút trước`;

	const diffHour = Math.floor(diffMin / 60);
	if (diffHour < 24) return `${diffHour} giờ trước`;

	const diffDay = Math.floor(diffHour / 24);
	if (diffDay < 7) return `${diffDay} ngày trước`;

	return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
