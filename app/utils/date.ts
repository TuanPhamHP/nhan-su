import { format, parseISO, isValid, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

export function formatDate(date: string | null | undefined, pattern = 'dd/MM/yyyy'): string {
	if (!date) return '—';
	const parsed = parseISO(date);
	if (!isValid(parsed)) return '—';
	return format(parsed, pattern, { locale: vi });
}

export function formatDateTime(date: string | null | undefined): string {
	return formatDate(date, 'dd/MM/yyyy HH:mm');
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
