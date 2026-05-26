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
