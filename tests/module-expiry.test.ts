import { beforeEach, describe, expect, it } from 'vitest';
import { formatVnDate, vnCalendarDate, vnCalendarDaysBetween } from '~/utils/date';
import {
	clearExpiryBannerDismissals,
	isExpiryBannerDismissed,
	moduleExpiryNotices,
	moduleLapsedMessage,
	rememberExpiryBannerDismissed,
} from '~/utils/module-expiry';
import type { ModuleEntitlement } from '~/types/entitlement.types';

/** Hạn dùng tính hết ngày giờ Việt Nam: 23:59:59.999 giờ VN là 16:59:59.999Z cùng ngày. */
const endOfVnDay = (ymd: string) => `${ymd}T16:59:59.999Z`;

/** 09:00 sáng 06/11/2026 giờ Việt Nam. */
const NOW = new Date('2026-11-06T02:00:00.000Z');

function entitlement(overrides: Partial<ModuleEntitlement>): ModuleEntitlement {
	return {
		code: 'OVERTIME',
		label: 'Làm thêm giờ',
		state: 'ENABLED',
		reason: null,
		expiresAt: null,
		graceEndsAt: null,
		...overrides,
	};
}

const expiring = (ymd: string) => entitlement({ expiresAt: endOfVnDay(ymd), graceEndsAt: endOfVnDay('2027-01-01') });

describe('vnCalendarDate', () => {
	it('đổi ngày theo giờ Việt Nam, không theo UTC', () => {
		expect(vnCalendarDate('2026-11-05T16:59:59.999Z')).toBe('2026-11-05');
		expect(vnCalendarDate('2026-11-05T17:00:00.000Z')).toBe('2026-11-06');
	});
});

describe('vnCalendarDaysBetween', () => {
	it('đếm theo ngày lịch, không lấy hiệu số giờ chia 24', () => {
		// Chỉ cách nhau 1 phút nhưng đã sang ngày mới theo giờ Việt Nam.
		expect(vnCalendarDaysBetween('2026-11-05T16:59:00.000Z', '2026-11-05T17:00:00.000Z')).toBe(1);
		// Cách nhau gần 24 giờ nhưng vẫn cùng một ngày theo giờ Việt Nam.
		expect(vnCalendarDaysBetween('2026-11-05T17:00:00.000Z', '2026-11-06T16:59:00.000Z')).toBe(0);
	});

	it('ngày cuối của hạn là 0, đã qua hạn là số âm', () => {
		expect(vnCalendarDaysBetween(NOW, endOfVnDay('2026-11-13'))).toBe(7);
		expect(vnCalendarDaysBetween(NOW, endOfVnDay('2026-11-06'))).toBe(0);
		expect(vnCalendarDaysBetween(NOW, endOfVnDay('2026-11-05'))).toBe(-1);
	});

	it('qua ranh giới tháng và năm vẫn đúng', () => {
		expect(vnCalendarDaysBetween(endOfVnDay('2026-12-31'), endOfVnDay('2027-01-01'))).toBe(1);
	});
});

describe('formatVnDate', () => {
	it('hiện đúng ngày hết hạn theo lịch Việt Nam', () => {
		expect(formatVnDate(endOfVnDay('2026-11-13'))).toBe('13/11/2026');
	});
});

describe('moduleExpiryNotices', () => {
	it('còn 7 ngày thì nêu số ngày và ngày hết hạn', () => {
		const [notice] = moduleExpiryNotices([expiring('2026-11-13')], NOW);
		expect(notice?.message).toBe('Làm thêm giờ còn 7 ngày, hết hạn ngày 13/11/2026.');
	});

	it('báo từ mốc 14 ngày, mốc 15 ngày chưa báo', () => {
		expect(moduleExpiryNotices([expiring('2026-11-20')], NOW)).toHaveLength(1);
		expect(moduleExpiryNotices([expiring('2026-11-21')], NOW)).toHaveLength(0);
	});

	it('ngày cuối của hạn vẫn báo, nói rõ là hôm nay', () => {
		const [notice] = moduleExpiryNotices([expiring('2026-11-06')], NOW);
		expect(notice?.message).toBe('Làm thêm giờ hết hạn vào cuối hôm nay, ngày 06/11/2026.');
	});

	it('EXPIRED nêu ngày cuối xem được theo graceEndsAt, không tự cộng 14 ngày', () => {
		const [notice] = moduleExpiryNotices(
			[
				entitlement({
					state: 'READ_ONLY',
					reason: 'EXPIRED',
					expiresAt: endOfVnDay('2026-11-05'),
					graceEndsAt: endOfVnDay('2026-12-25'),
				}),
			],
			NOW,
		);
		expect(notice?.message).toBe('Làm thêm giờ đã hết hạn dùng ngày 05/11/2026 nên chỉ còn xem được đến hết ngày 25/12/2026.');
	});

	it('LAPSED báo đã tạm tắt, dữ liệu vẫn giữ', () => {
		const [notice] = moduleExpiryNotices(
			[
				entitlement({
					state: 'DISABLED',
					reason: 'LAPSED',
					expiresAt: endOfVnDay('2026-10-22'),
					graceEndsAt: endOfVnDay('2026-11-05'),
				}),
			],
			NOW,
		);
		expect(notice?.message).toBe('Làm thêm giờ đã hết hạn dùng ngày 22/10/2026 nên đang tạm tắt, dữ liệu vẫn được giữ nguyên.');
	});

	it('tắt tay và chưa đăng ký không phải chuyện hạn dùng, kể cả khi có hạn sắp tới hoặc đã qua', () => {
		const soon = endOfVnDay('2026-11-10');
		const past = endOfVnDay('2026-10-01');
		expect(
			moduleExpiryNotices(
				[
					entitlement({ state: 'DISABLED', reason: 'SUSPENDED', expiresAt: soon }),
					entitlement({ state: 'DISABLED', reason: 'SUSPENDED', expiresAt: past }),
					entitlement({ state: 'DISABLED', reason: 'NOT_SUBSCRIBED', expiresAt: soon }),
				],
				NOW,
			),
		).toEqual([]);
	});

	it('người vận hành đặt chỉ xem mà sắp đến hạn thì vẫn báo', () => {
		const notices = moduleExpiryNotices(
			[entitlement({ state: 'READ_ONLY', reason: 'READ_ONLY', expiresAt: endOfVnDay('2026-11-13') })],
			NOW,
		);
		expect(notices).toHaveLength(1);
	});

	it('không có hạn thì không báo', () => {
		expect(moduleExpiryNotices([entitlement({})], NOW)).toEqual([]);
	});

	it('nhiều module thì liệt kê đủ, hạn sớm nhất lên đầu, không đổi mảng gốc', () => {
		const list = [
			entitlement({ code: 'REPORTS', label: 'Báo cáo', expiresAt: endOfVnDay('2026-11-13') }),
			entitlement({
				code: 'OVERTIME',
				state: 'DISABLED',
				reason: 'LAPSED',
				expiresAt: endOfVnDay('2026-10-22'),
				graceEndsAt: endOfVnDay('2026-11-05'),
			}),
		];
		expect(moduleExpiryNotices(list, NOW).map(n => n.code)).toEqual(['OVERTIME', 'REPORTS']);
		expect(list.map(m => m.code)).toEqual(['REPORTS', 'OVERTIME']);
	});
});

describe('moduleLapsedMessage', () => {
	it('không dùng câu "chưa được mở"', () => {
		const message = moduleLapsedMessage('Làm thêm giờ');
		expect(message).toContain('tạm tắt');
		expect(message).not.toContain('chưa được mở');
	});
});

describe('ghi nhớ đóng banner', () => {
	beforeEach(() => {
		sessionStorage.clear();
	});

	it('mỗi công ty một khoá', () => {
		rememberExpiryBannerDismissed('ongo');
		expect(isExpiryBannerDismissed('ongo')).toBe(true);
		expect(isExpiryBannerDismissed('cty-sth')).toBe(false);
	});

	it('đăng nhập lại thì xoá mọi lần đóng, không đụng khoá khác', () => {
		rememberExpiryBannerDismissed('ongo');
		rememberExpiryBannerDismissed('cty-sth');
		sessionStorage.setItem('khoa-khac', '1');

		clearExpiryBannerDismissals();

		expect(isExpiryBannerDismissed('ongo')).toBe(false);
		expect(isExpiryBannerDismissed('cty-sth')).toBe(false);
		expect(sessionStorage.getItem('khoa-khac')).toBe('1');
	});
});
