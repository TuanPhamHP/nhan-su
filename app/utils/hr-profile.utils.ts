import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { Relative } from '~/types/hr-profile.types';

/**
 * Tháng giảm trừ hiện dạng `MM/yyyy`, vì giảm trừ người phụ thuộc tính theo tháng chứ không
 * theo ngày. Server luôn đưa ngày về ngày 1 của tháng nên ở đây chỉ việc đổi cách hiện.
 */
export function formatMonth(date: string | null | undefined): string {
	if (!date) return '—';
	try {
		return format(parseISO(date), 'MM/yyyy');
	} catch {
		return '—';
	}
}

/** Khoảng giảm trừ của một người phụ thuộc, ví dụ "01/2025 → nay". */
export function dependentPeriodText(relative: Relative): string {
	if (!relative.isDependent) return '—';
	const from = formatMonth(relative.dependentFrom);
	if (!relative.dependentTo) return `${from} → nay`;
	return `${from} → ${formatMonth(relative.dependentTo)}`;
}

/**
 * Tình trạng hạn của một giấy tờ.
 *
 * Giấy tờ sắp hết hạn trong 30 ngày tới được tô vàng để phòng nhân sự kịp xin bản mới, giấy
 * tờ đã hết hạn tô đỏ. Giấy tờ không có ngày hết hạn thì không có gì để nhắc.
 */
export type DocumentExpiryTone = 'expired' | 'soon' | 'ok';

export function documentExpiryTone(expiryDate: string | null, soonInDays = 30): DocumentExpiryTone | null {
	if (!expiryDate) return null;
	let days: number;
	try {
		days = differenceInCalendarDays(parseISO(expiryDate), new Date());
	} catch {
		return null;
	}
	if (days < 0) return 'expired';
	if (days <= soonInDays) return 'soon';
	return 'ok';
}

export const DOCUMENT_EXPIRY_CLASS: Record<DocumentExpiryTone, string> = {
	expired: 'text-rose-600 dark:text-rose-400 font-medium',
	soon: 'text-amber-600 dark:text-amber-400 font-medium',
	ok: 'text-gray-600 dark:text-gray-300',
};

/** Câu giải thích kèm ngày hết hạn, để người đọc biết vì sao dòng bị tô màu. */
export function documentExpiryNote(expiryDate: string | null): string | null {
	const tone = documentExpiryTone(expiryDate);
	if (tone === 'expired') return 'Đã hết hạn';
	if (tone === 'soon') return 'Sắp hết hạn';
	return null;
}

/**
 * Các vai của một thân nhân, hiện thành nhãn nhỏ trên bảng.
 *
 * Một người có thể vừa là người phụ thuộc vừa là liên hệ khẩn cấp, nên đây là danh sách chứ
 * không phải một giá trị.
 */
export function relativeRoleTags(relative: Relative): string[] {
	const tags: string[] = [];
	if (relative.isPrimaryEmergency) tags.push('Liên hệ chính');
	else if (relative.isEmergencyContact) tags.push('Liên hệ khẩn cấp');
	if (relative.isDependent) tags.push('Người phụ thuộc');
	if (relative.livesWith) tags.push('Sống cùng');
	return tags;
}
