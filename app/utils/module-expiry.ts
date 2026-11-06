import { formatVnDate, vnCalendarDaysBetween } from '~/utils/date';
import type { ModuleCode, ModuleEntitlement } from '~/types/entitlement.types';

/** Còn tối đa bấy nhiêu ngày đến hạn (kể cả ngày cuối) thì báo cho admin. */
export const EXPIRY_WARNING_DAYS = 14;

const DISMISS_KEY_PREFIX = 'module-expiry-banner-dismissed:';

export interface ModuleExpiryNotice {
	code: ModuleCode;
	message: string;
}

/** Câu báo module quá hạn đã tắt, dùng chung cho dòng báo trong trang và toast khi bị chặn màn hình. */
export function moduleLapsedMessage(label: string): string {
	return `${label} đã hết hạn dùng nên đang tạm tắt, dữ liệu vẫn được giữ nguyên.`;
}

function expiryNoticeMessage(entitlement: ModuleEntitlement, now: Date): string | null {
	const { label, state, reason, expiresAt, graceEndsAt } = entitlement;
	if (!expiresAt) return null;
	const expiresOn = formatVnDate(expiresAt);

	if (reason === 'LAPSED') {
		return `${label} đã hết hạn dùng ngày ${expiresOn} nên đang tạm tắt, dữ liệu vẫn được giữ nguyên.`;
	}
	if (reason === 'EXPIRED') {
		const until = graceEndsAt ? ` đến hết ngày ${formatVnDate(graceEndsAt)}` : '';
		return `${label} đã hết hạn dùng ngày ${expiresOn} nên chỉ còn xem được${until}.`;
	}
	// Tắt tay hoặc chưa đăng ký thì không phải chuyện hạn dùng, kể cả khi có `expiresAt`.
	if (state === 'DISABLED') return null;

	const daysLeft = vnCalendarDaysBetween(now, expiresAt);
	if (daysLeft < 0 || daysLeft > EXPIRY_WARNING_DAYS) return null;
	return daysLeft === 0
		? `${label} hết hạn vào cuối hôm nay, ngày ${expiresOn}.`
		: `${label} còn ${daysLeft} ngày, hết hạn ngày ${expiresOn}.`;
}

/** Các module admin cần biết về hạn dùng. Hạn sớm nhất lên đầu, nên module đã tắt đứng trước. */
export function moduleExpiryNotices(modules: ModuleEntitlement[], now: Date = new Date()): ModuleExpiryNotice[] {
	return modules
		.filter(entitlement => entitlement.expiresAt)
		.sort((a, b) => new Date(a.expiresAt as string).getTime() - new Date(b.expiresAt as string).getTime())
		.flatMap(entitlement => {
			const message = expiryNoticeMessage(entitlement, now);
			return message ? [{ code: entitlement.code, message }] : [];
		});
}

// sessionStorage có thể bị chặn (chế độ riêng tư, chính sách trình duyệt). Khi đó banner vẫn đóng
// được, chỉ là tải lại trang thì hiện lại.

export function isExpiryBannerDismissed(companyCode: string): boolean {
	try {
		return sessionStorage.getItem(`${DISMISS_KEY_PREFIX}${companyCode}`) === '1';
	} catch {
		return false;
	}
}

export function rememberExpiryBannerDismissed(companyCode: string): void {
	try {
		sessionStorage.setItem(`${DISMISS_KEY_PREFIX}${companyCode}`, '1');
	} catch {
		// Xem ghi chú ở trên.
	}
}

/** Đăng nhập lại là phiên mới, nên mọi banner đã đóng của phiên trước trong cùng tab phải hiện lại. */
export function clearExpiryBannerDismissals(): void {
	try {
		Object.keys(sessionStorage)
			.filter(key => key.startsWith(DISMISS_KEY_PREFIX))
			.forEach(key => sessionStorage.removeItem(key));
	} catch {
		// Xem ghi chú ở trên.
	}
}
