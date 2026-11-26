/**
 * ============================================================
 * Test suite: hàm thuần của module Hành chính văn phòng (lô 1)
 * ============================================================
 *
 * Vì sao cần: ba chỗ trong module này sai là người dùng không nhận ra ngay mà vẫn tin con số
 * trên màn. Một là đếm ngược tới hạn chót: nói "còn 2 ngày" trong khi phiếu khoá sau hai tiếng
 * thì cả phòng mất lượt đăng ký. Hai là lưới phòng họp: thanh lượt họp đặt theo phần trăm của
 * dải giờ, lệch một chút là người xem tưởng phòng trống trong khi phòng đang có người. Ba là
 * đổi giờ Việt Nam sang ISO UTC khi đặt phòng: máy đặt múi giờ khác sẽ đặt lệch giờ mà không có
 * dấu hiệu nào trên màn.
 *
 * Bảng tổng hợp kỳ cũng được kiểm ở đây, vì nhóm và số La Mã phải khớp cách đánh số trong file
 * đăng ký mà HCNS đang dùng, còn mặt hàng ngoài danh mục luôn phải nằm cuối bảng.
 *
 * Ký hiệu: [EDGE] trường hợp biên
 * ============================================================
 */

import { describe, expect, it } from 'vitest';
import {
	addMinutesToHhmm,
	bookingBar,
	copyPreviousSummary,
	CUSTOM_GROUP_NAME,
	fileNameFromDisposition,
	groupSummaryRows,
	isHourPast,
	lockCountdown,
	monthLabel,
	monthValue,
	nextMonthValue,
	officeErrorCode,
	officeErrorStatus,
	officeMoney,
	roomNowLabel,
	romanNumeral,
	slotStartHhmm,
	sortMyBookings,
	vnDateTimeToIso,
	vnDateYmd,
	vnMinutesOfDay,
	vnTimeLabel,
} from '~/utils/office.utils';
import { vnSearchIncludes, vnSearchText } from '~/utils/vn-text';
import { resolveNotificationRoute } from '~/utils/notification-route';
import { moduleOfPath } from '~/composables/useModuleAccess';
import type { SummaryRow } from '~/types/office.types';

// ─── Giờ Việt Nam ─────────────────────────────────────────────────────────────

describe('giờ Việt Nam', () => {
	it('đọc giờ phút theo múi giờ Việt Nam, không theo múi giờ của máy', () => {
		expect(vnTimeLabel('2026-11-20T07:00:00.000Z')).toBe('14:00');
		expect(vnMinutesOfDay('2026-11-20T07:00:00.000Z')).toBe(14 * 60);
	});

	it('ghép ngày và giờ Việt Nam thành ISO UTC', () => {
		expect(vnDateTimeToIso('2026-11-20', '14:00')).toBe('2026-11-20T07:00:00.000Z');
		expect(vnDateTimeToIso('2026-11-20', '08:30')).toBe('2026-11-20T01:30:00.000Z');
	});

	it('[EDGE] giờ sáng sớm giờ Việt Nam thuộc ngày trước đó theo UTC', () => {
		expect(vnDateTimeToIso('2026-11-20', '06:00')).toBe('2026-11-19T23:00:00.000Z');
	});

	it('cộng phút vào HH:mm, chặn ở 23:59 để không nhảy sang ngày khác', () => {
		expect(addMinutesToHhmm('09:00', 60)).toBe('10:00');
		expect(addMinutesToHhmm('09:45', 30)).toBe('10:15');
		expect(addMinutesToHhmm('23:30', 60)).toBe('23:59');
	});
});

// ─── Đếm ngược tới hạn chót ───────────────────────────────────────────────────

describe('lockCountdown', () => {
	const lockAt = '2026-11-29T17:00:00.000Z';

	it('nói ngày và giờ khi còn nhiều ngày', () => {
		expect(lockCountdown(lockAt, new Date('2026-11-27T12:00:00.000Z'))).toBe('Còn 2 ngày 5 giờ');
	});

	it('nói giờ và phút khi còn trong ngày', () => {
		expect(lockCountdown(lockAt, new Date('2026-11-29T13:40:00.000Z'))).toBe('Còn 3 giờ 20 phút');
	});

	it('nói phút khi sắp hết hạn, và không bao giờ nói 0 phút', () => {
		expect(lockCountdown(lockAt, new Date('2026-11-29T16:48:00.000Z'))).toBe('Còn 12 phút');
		expect(lockCountdown(lockAt, new Date('2026-11-29T16:59:40.000Z'))).toBe('Còn 1 phút');
	});

	it('[EDGE] qua mốc thì nói đã hết hạn, không ra số âm', () => {
		expect(lockCountdown(lockAt, new Date('2026-11-29T17:00:00.000Z'))).toBe('Đã hết hạn nhập');
		expect(lockCountdown(lockAt, new Date('2026-12-02T08:00:00.000Z'))).toBe('Đã hết hạn nhập');
	});

	it('[EDGE] mốc không đọc được thì coi như đã hết hạn chứ không hiện NaN', () => {
		expect(lockCountdown('không phải ngày', new Date('2026-11-27T12:00:00.000Z'))).toBe('Đã hết hạn nhập');
	});
});

// ─── Tháng của kỳ ─────────────────────────────────────────────────────────────

describe('tháng của kỳ', () => {
	it('hiện tháng bằng câu tiếng Việt', () => {
		expect(monthLabel('2026-12')).toBe('Tháng 12/2026');
		expect(monthLabel('2027-01')).toBe('Tháng 1/2027');
	});

	it('[EDGE] chuỗi lạ thì giữ nguyên để người dùng còn thấy dữ liệu thật', () => {
		expect(monthLabel('12/2026')).toBe('12/2026');
	});

	it('lấy tháng và tháng sau của một mốc', () => {
		expect(monthValue(new Date(2026, 10, 18))).toBe('2026-11');
		expect(nextMonthValue(new Date(2026, 10, 18))).toBe('2026-12');
	});

	it('[EDGE] tháng 12 sang tháng 1 năm sau', () => {
		expect(nextMonthValue(new Date(2026, 11, 5))).toBe('2027-01');
	});

	it('[EDGE] ngày 31 không bị đẩy vượt một tháng', () => {
		// `setMonth` trên ngày 31 tháng 1 sẽ ra tháng 3; hàm này phải ra tháng 2.
		expect(nextMonthValue(new Date(2026, 0, 31))).toBe('2026-02');
	});
});

// ─── Thanh lượt họp trên lưới phòng ───────────────────────────────────────────

describe('bookingBar', () => {
	const span = { startHour: 7, endHour: 20 };

	it('đặt đúng chỗ và đúng độ dài trong dải giờ', () => {
		// 14:00–15:00 giờ Việt Nam trong dải 7h–20h: bắt đầu ở 7/13 dải, dài 1/13 dải.
		const bar = bookingBar('2026-11-20T07:00:00.000Z', '2026-11-20T08:00:00.000Z', span);
		expect(bar).not.toBeNull();
		expect(bar?.leftPercent).toBeCloseTo((7 / 13) * 100, 6);
		expect(bar?.widthPercent).toBeCloseTo((1 / 13) * 100, 6);
		expect(bar?.clippedStart).toBe(false);
		expect(bar?.clippedEnd).toBe(false);
	});

	it('nửa giờ cũng ra đúng độ dài, không bị làm tròn về một giờ', () => {
		const bar = bookingBar('2026-11-20T02:00:00.000Z', '2026-11-20T02:30:00.000Z', span);
		expect(bar?.widthPercent).toBeCloseTo((0.5 / 13) * 100, 6);
	});

	it('cắt về mép và báo đã cắt khi lượt vắt ra ngoài dải giờ', () => {
		// 06:00–08:00 giờ Việt Nam: nửa đầu nằm trước 7h.
		const bar = bookingBar('2026-11-19T23:00:00.000Z', '2026-11-20T01:00:00.000Z', span);
		expect(bar?.leftPercent).toBe(0);
		expect(bar?.clippedStart).toBe(true);
		expect(bar?.widthPercent).toBeCloseTo((1 / 13) * 100, 6);
	});

	it('[EDGE] lượt nằm hoàn toàn ngoài dải giờ thì không vẽ', () => {
		// 04:00–05:00 giờ Việt Nam, trước cả 7h.
		expect(bookingBar('2026-11-19T21:00:00.000Z', '2026-11-19T22:00:00.000Z', span)).toBeNull();
	});

	it('[EDGE] lượt chạy qua nửa đêm thì kéo tới hết dải giờ và báo đã cắt', () => {
		// 19:00 tới 01:00 hôm sau: trên lưới của ngày đầu, thanh chạy tới mép phải.
		const bar = bookingBar('2026-11-20T12:00:00.000Z', '2026-11-20T18:00:00.000Z', span);
		expect(bar?.clippedEnd).toBe(true);
		expect((bar?.leftPercent ?? 0) + (bar?.widthPercent ?? 0)).toBeCloseTo(100, 6);
	});

	it('[EDGE] lượt bắt đầu sau khi dải giờ đã hết thì không vẽ', () => {
		// 23:00 tới 01:00 hôm sau: cả hai đầu đều ngoài dải 7h–20h.
		expect(bookingBar('2026-11-20T16:00:00.000Z', '2026-11-20T18:00:00.000Z', span)).toBeNull();
	});

	it('[EDGE] dải giờ rỗng thì không vẽ gì, không chia cho 0', () => {
		expect(bookingBar('2026-11-20T07:00:00.000Z', '2026-11-20T08:00:00.000Z', { startHour: 9, endHour: 9 })).toBeNull();
	});
});

describe('roomNowLabel', () => {
	it('nói phòng trống tới mấy giờ, hoặc đang họp tới mấy giờ', () => {
		expect(roomNowLabel({ busy: false, until: '2026-11-20T07:00:00.000Z' })).toBe('Trống đến 14:00');
		expect(roomNowLabel({ busy: true, until: '2026-11-20T08:30:00.000Z' })).toBe('Đang họp tới 15:30');
	});

	it('[EDGE] trống mà không có mốc nghĩa là trống tới hết ngày', () => {
		// Không nói "trống cả ngày": cờ `now` chỉ nói từ bây giờ, mà sáng nay phòng có thể đã họp.
		expect(roomNowLabel({ busy: false, until: null })).toBe('Trống đến hết ngày');
	});

	it('[EDGE] ngày không phải hôm nay thì máy chủ không gửi `now`, nên không nói gì', () => {
		expect(roomNowLabel(null)).toBe('');
	});
});

// ─── Bảng tổng hợp kỳ ─────────────────────────────────────────────────────────

function row(name: string, groupName: string | null, itemId: number | null = 1): SummaryRow {
	return {
		itemId,
		name,
		unit: 'Chiếc',
		groupName,
		cells: [],
		totalQty: 0,
		reserveQty: 0,
		purchaseQty: 0,
		unitPrice: null,
		amount: null,
	};
}

describe('groupSummaryRows', () => {
	it('gom theo nhóm, giữ thứ tự máy chủ trả về và đánh số La Mã', () => {
		const groups = groupSummaryRows([
			row('Bút bi xanh', 'Bút & gim'),
			row('Giấy A4', 'Sổ & Giấy'),
			row('Bút chì', 'Bút & gim'),
		]);
		expect(groups.map(g => [g.numeral, g.groupName])).toEqual([
			['I', 'Bút & gim'],
			['II', 'Sổ & Giấy'],
		]);
		expect(groups[0]?.rows.map(r => r.name)).toEqual(['Bút bi xanh', 'Bút chì']);
	});

	it('mặt hàng ngoài danh mục gom thành nhóm cuối bảng', () => {
		const groups = groupSummaryRows([
			row('Pin 3A', null, null),
			row('Giấy A4', 'Sổ & Giấy'),
		]);
		expect(groups.map(g => g.groupName)).toEqual(['Sổ & Giấy', CUSTOM_GROUP_NAME]);
		expect(groups[1]?.numeral).toBe('II');
	});

	it('[EDGE] không có dòng nào thì không có nhóm nào', () => {
		expect(groupSummaryRows([])).toEqual([]);
	});

	it('[EDGE] quá mười lăm nhóm thì đánh số bằng chữ số, không trả về undefined', () => {
		expect(romanNumeral(0)).toBe('I');
		expect(romanNumeral(14)).toBe('XV');
		expect(romanNumeral(15)).toBe('16');
	});
});

// ─── Tiền và mã lỗi ───────────────────────────────────────────────────────────

describe('officeMoney', () => {
	it('hiện tiền theo cách viết Việt Nam', () => {
		expect(officeMoney(845000)).toBe('845.000');
		expect(officeMoney(0)).toBe('0');
	});

	it('[EDGE] không có số thì hiện dấu gạch, vì null là "chưa có giá" chứ không phải bằng 0', () => {
		expect(officeMoney(null)).toBe('—');
		expect(officeMoney(undefined)).toBe('—');
	});
});

describe('officeErrorCode', () => {
	it('đọc được mã lỗi nghiệp vụ mà `auth.fetch` giữ lại', () => {
		const error = Object.assign(new Error('Kỳ đã đóng'), {
			data: { error: { code: 'OFFICE_SUPPLY_PERIOD_LOCKED', message: 'Kỳ đã đóng' } },
		});
		expect(officeErrorCode(error)).toBe('OFFICE_SUPPLY_PERIOD_LOCKED');
	});

	it('[EDGE] lỗi mạng không mang mã thì trả null, nơi gọi cứ toast như thường', () => {
		expect(officeErrorCode(new Error('Failed to fetch'))).toBeNull();
		expect(officeErrorCode(null)).toBeNull();
	});
});

// ─── Tên file tải về ──────────────────────────────────────────────────────────

describe('fileNameFromDisposition', () => {
	it('đọc tên file dạng thường', () => {
		expect(fileNameFromDisposition('attachment; filename="van-phong-pham-12-2026-huu-nghi.xlsx"')).toBe(
			'van-phong-pham-12-2026-huu-nghi.xlsx',
		);
		expect(fileNameFromDisposition('attachment; filename=chi-phi.xlsx')).toBe('chi-phi.xlsx');
	});

	it('đọc được tên có dấu tiếng Việt ở dạng UTF-8', () => {
		expect(
			fileNameFromDisposition("attachment; filename=\"bao-cao.xlsx\"; filename*=UTF-8''b%C3%A1o-c%C3%A1o.xlsx"),
		).toBe('báo-cáo.xlsx');
	});

	it('[EDGE] không có header thì trả rỗng để nơi gọi dùng tên dự phòng', () => {
		// Trình duyệt chỉ thấy header này khi máy chủ mở `Access-Control-Expose-Headers`, nên
		// rỗng là chuyện bình thường chứ không phải lỗi.
		expect(fileNameFromDisposition(null)).toBe('');
		expect(fileNameFromDisposition(undefined)).toBe('');
		expect(fileNameFromDisposition('attachment')).toBe('');
	});

	it('[EDGE] phần trăm hỏng thì giữ nguyên chuỗi thay vì ném lỗi', () => {
		expect(fileNameFromDisposition("attachment; filename*=UTF-8''bao%-cao.xlsx")).toBe('bao%-cao.xlsx');
	});
});

// ─── Câu báo sau khi lấy số kỳ trước ──────────────────────────────────────────

describe('copyPreviousSummary', () => {
	it('nói rõ lấy từ kỳ nào và thêm được bao nhiêu dòng', () => {
		expect(copyPreviousSummary({ previousTitle: 'Tháng 11/2026', added: 8, skippedItems: [] })).toBe(
			'Đã lấy 8 mặt hàng từ Tháng 11/2026.',
		);
	});

	it('liệt kê từng dòng bỏ qua kèm lý do, vì đó là việc người dùng phải tự làm lại', () => {
		expect(
			copyPreviousSummary({
				previousTitle: 'Tháng 11/2026',
				added: 6,
				skippedItems: [
					{ name: 'Giấy in A4 IK Plus', reason: 'vượt định mức 5, bạn tự nhập kèm lý do' },
					{ name: 'Pin 3A', reason: 'mặt hàng đã ngừng dùng' },
				],
			}),
		).toBe(
			'Đã lấy 6 mặt hàng từ Tháng 11/2026. Bỏ qua 2 dòng: Giấy in A4 IK Plus (vượt định mức 5, bạn tự nhập kèm lý do); Pin 3A (mặt hàng đã ngừng dùng).',
		);
	});

	it('[EDGE] chưa có kỳ trước thì nói thẳng, không hiện "thêm 0 dòng"', () => {
		expect(copyPreviousSummary({ previousTitle: null, added: 0, skippedItems: [] })).toBe(
			'Phòng chưa có kỳ trước ở văn phòng này nên chưa có số để lấy.',
		);
	});

	it('[EDGE] bấm lần thứ hai thì nói phiếu đã đủ, không nói "thêm 0 dòng"', () => {
		// "Đã thêm 0 dòng" làm người dùng tưởng chức năng hỏng rồi bấm thêm mấy lần nữa.
		expect(copyPreviousSummary({ previousTitle: 'Tháng 11/2026', added: 0, skippedItems: [] })).toBe(
			'Phiếu đã có đủ các mặt hàng của Tháng 11/2026, không có gì để thêm.',
		);
		expect(
			copyPreviousSummary({ previousTitle: 'Tháng 11/2026', added: 0, existing: 3, skippedItems: [] }),
		).toBe('Phiếu đã có đủ các mặt hàng của Tháng 11/2026, không có gì để thêm.');
	});

	it('mặt hàng phiếu đã có thì nói là giữ nguyên, không đếm vào dòng bỏ qua', () => {
		// Đợt UAT C: `existing` tách khỏi `skipped`, nên câu phải nói rõ hai chuyện khác nhau.
		expect(
			copyPreviousSummary({ previousTitle: 'Tháng 11/2026', added: 2, existing: 3, skippedItems: [] }),
		).toBe('Đã lấy 2 mặt hàng từ Tháng 11/2026. 3 mặt hàng phiếu đã có nên giữ nguyên số của phòng.');
	});

	it('vừa có mặt hàng đã có, vừa có dòng bỏ qua thì nói cả hai', () => {
		expect(
			copyPreviousSummary({
				previousTitle: 'Tháng 11/2026',
				added: 1,
				existing: 2,
				skippedItems: [{ name: 'Giấy in A4 IK Plus', reason: 'vượt định mức 5, bạn tự nhập kèm lý do' }],
			}),
		).toBe(
			'Đã lấy 1 mặt hàng từ Tháng 11/2026. 2 mặt hàng phiếu đã có nên giữ nguyên số của phòng. Bỏ qua 1 dòng: Giấy in A4 IK Plus (vượt định mức 5, bạn tự nhập kèm lý do).',
		);
	});
});

// ─── Giờ đã qua trên lịch phòng ───────────────────────────────────────────────

describe('isHourPast và slotStartHhmm', () => {
	// 10:30 giờ Việt Nam ngày 19/11/2026.
	const now = new Date('2026-11-19T03:30:00.000Z');

	it('ngày hôm qua thì mọi giờ đều đã qua', () => {
		expect(isHourPast('2026-11-18', 23, now)).toBe(true);
		expect(isHourPast('2026-11-18', 7, now)).toBe(true);
	});

	it('ngày mai thì chưa giờ nào qua', () => {
		expect(isHourPast('2026-11-20', 0, now)).toBe(false);
	});

	it('hôm nay: giờ trước giờ hiện tại đã qua, giờ đang chạy thì chưa', () => {
		expect(isHourPast('2026-11-19', 9, now)).toBe(true);
		// Máy chủ nhận lượt bắt đầu trễ tới năm phút, và phần còn lại của giờ này vẫn ở tương lai.
		expect(isHourPast('2026-11-19', 10, now)).toBe(false);
		expect(isHourPast('2026-11-19', 11, now)).toBe(false);
	});

	it('bấm ô giờ đang chạy thì điền mốc năm phút kế tiếp, không điền đầu giờ đã qua', () => {
		expect(slotStartHhmm('2026-11-19', 10, now)).toBe('10:35');
		expect(slotStartHhmm('2026-11-19', 14, now)).toBe('14:00');
		expect(slotStartHhmm('2026-11-20', 10, now)).toBe('10:00');
	});

	it('[EDGE] 23:58 thì mốc kế tiếp vẫn nằm trong ngày', () => {
		const late = new Date('2026-11-19T16:58:00.000Z');
		expect(slotStartHhmm('2026-11-19', 23, late)).toBe('23:55');
	});

	it('đọc ngày theo giờ Việt Nam, không theo giờ của máy', () => {
		// 23:30 giờ UTC đã là hôm sau ở Việt Nam.
		expect(vnDateYmd('2026-11-19T17:30:00.000Z')).toBe('2026-11-20');
	});
});

// ─── Thứ tự lượt họp của tôi ──────────────────────────────────────────────────

describe('sortMyBookings', () => {
	it('lượt sắp tới và đang họp lên trước, lượt đã kết thúc xuống cuối', () => {
		const list = [
			{ id: 1, timing: 'ENDED', startAt: '2026-11-19T01:00:00.000Z' },
			{ id: 2, timing: 'UPCOMING', startAt: '2026-11-20T02:00:00.000Z' },
			{ id: 3, timing: 'ONGOING', startAt: '2026-11-19T03:00:00.000Z' },
			{ id: 4, timing: 'ENDED', startAt: '2026-11-18T01:00:00.000Z' },
		];
		expect(sortMyBookings(list).map(b => b.id)).toEqual([3, 2, 1, 4]);
	});

	it('[EDGE] danh sách rỗng và danh sách một phần tử không bị đổi', () => {
		expect(sortMyBookings([])).toEqual([]);
		const one = [{ id: 9, timing: 'ENDED', startAt: '2026-11-19T01:00:00.000Z' }];
		expect(sortMyBookings(one).map(b => b.id)).toEqual([9]);
	});

	it('không sửa mảng gốc, vì nó là dữ liệu của store', () => {
		const list = [
			{ id: 1, timing: 'ENDED', startAt: '2026-11-19T01:00:00.000Z' },
			{ id: 2, timing: 'UPCOMING', startAt: '2026-11-20T02:00:00.000Z' },
		];
		sortMyBookings(list);
		expect(list.map(b => b.id)).toEqual([1, 2]);
	});
});

// ─── Mã HTTP của lỗi ──────────────────────────────────────────────────────────

describe('officeErrorStatus', () => {
	it('đọc mã HTTP để biết bản ghi đã biến mất', () => {
		expect(officeErrorStatus(Object.assign(new Error('Not Found'), { status: 404 }))).toBe(404);
		expect(officeErrorStatus(Object.assign(new Error('Not Found'), { statusCode: 404 }))).toBe(404);
		expect(officeErrorStatus(Object.assign(new Error('Not Found'), { response: { status: 404 } }))).toBe(404);
	});

	it('[EDGE] lỗi không mang mã thì trả null', () => {
		expect(officeErrorStatus(new Error('Failed to fetch'))).toBeNull();
		expect(officeErrorStatus(null)).toBeNull();
	});
});

// ─── Tìm kiếm bỏ dấu ──────────────────────────────────────────────────────────

describe('vnSearchText', () => {
	it('bỏ dấu, bỏ dấu câu và không phân biệt hoa thường', () => {
		expect(vnSearchText('Bút bi (Note màu xanh)')).toBe('but bi note mau xanh');
		expect(vnSearchText('Đĩa CD-R')).toBe('dia cd r');
	});

	it('gõ không dấu vẫn tìm ra mặt hàng viết đủ dấu', () => {
		expect(vnSearchIncludes('Bút chì gỗ', 'but chi')).toBe(true);
		expect(vnSearchIncludes('Giấy in A4 IK Plus', 'giay in')).toBe(true);
		expect(vnSearchIncludes('Bút chì gỗ', 'bút chì')).toBe(true);
	});

	it('không khớp thì trả false, và từ khoá rỗng thì nhận mọi dòng', () => {
		expect(vnSearchIncludes('Bút chì gỗ', 'pin')).toBe(false);
		expect(vnSearchIncludes('Bút chì gỗ', '')).toBe(true);
		expect(vnSearchIncludes(null, 'pin')).toBe(false);
	});
});

// ─── Điều hướng ───────────────────────────────────────────────────────────────

describe('điều hướng của module OFFICE', () => {
	it('ba refType mới mở đúng trang, không rẽ theo vai trò', () => {
		for (const role of ['EMPLOYEE', 'HR'] as const) {
			expect(resolveNotificationRoute('office_supply_request', 55, role)).toBe('/office/supplies?request_id=55');
			expect(resolveNotificationRoute('office_room_booking', 40, role)).toBe('/office/rooms?booking_id=40');
			expect(resolveNotificationRoute('office_supply_period', 7, role)).toBe(
				'/management/office/supply-periods/7',
			);
		}
	});

	it('[EDGE] thông báo không mang refId thì về trang danh sách', () => {
		// Đợt UAT B: HCNS huỷ kỳ thì thông báo `OFFICE_SUPPLY_PERIOD_CHANGED` không có refId, vì
		// phiếu đã bị xoá cùng kỳ; chuông phải mở trang phiếu của phòng chứ không trắng trang.
		expect(resolveNotificationRoute('office_supply_request', null, 'EMPLOYEE')).toBe('/office/supplies');
		expect(resolveNotificationRoute('office_room_booking', null, 'EMPLOYEE')).toBe('/office/rooms');
		expect(resolveNotificationRoute('office_supply_period', null, 'HR')).toBe(
			'/management/office/supply-periods',
		);
	});

	it('mọi route của phân hệ thuộc module OFFICE, nên công ty chưa được cấp thì bị chặn', () => {
		expect(moduleOfPath('/office/supplies')).toBe('OFFICE');
		expect(moduleOfPath('/office/rooms')).toBe('OFFICE');
		expect(moduleOfPath('/management/office/supply-periods')).toBe('OFFICE');
		expect(moduleOfPath('/management/office/supply-periods/7')).toBe('OFFICE');
		expect(moduleOfPath('/management/office/reports')).toBe('OFFICE');
		expect(moduleOfPath('/management/office/settings')).toBe('OFFICE');
	});
});

// ─── Form danh mục của trang Văn phòng phẩm ───────────────────────────────────

import {
	SUPPLY_STATUS,
	buildSupplyCatalog,
	supplyLockLabel,
	supplyStatusLabel,
} from '../app/utils/office.utils';
import type { SupplyItem, SupplyLine } from '../app/types/office.types';

function item(id: number, groupName: string, name: string, quota: number | null = null): SupplyItem {
	return { id, groupId: groupName.length, groupName, hrOnly: false, name, unit: 'Chiếc', unitPrice: null, sortOrder: id, isActive: true, quota };
}

function line(id: number, itemId: number | null, name: string, groupName: string | null, myQty: number, requestedQty = myQty): SupplyLine {
	return {
		id,
		itemId,
		isCustom: itemId == null,
		name,
		unit: 'Chiếc',
		groupName,
		requestedQty,
		quota: null,
		overQuota: false,
		overQuotaReason: null,
		note: null,
		finalQty: null,
		finalNote: null,
		receivedQty: null,
		receivedNote: null,
		unitPrice: null,
		amount: null,
		previousQty: null,
		createdBy: { id: 1, fullName: 'A' },
		updatedBy: { id: 1, fullName: 'A' },
		updatedAt: '2026-11-20T02:00:00.000Z',
		shares: [],
		myQty,
	};
}

describe('buildSupplyCatalog', () => {
	const items = [item(1, 'Bút', 'Bút bi', 10), item(2, 'Bút', 'Bút chì gỗ'), item(3, 'Sổ & Giấy', 'Giấy A4')];

	it('hiện mọi mặt hàng theo nhóm, giữ thứ tự máy chủ, gắn dòng phiếu đúng mặt hàng', () => {
		const groups = buildSupplyCatalog(items, [line(7, 2, 'Bút chì gỗ', 'Bút', 0, 5)]);
		expect(groups.map(g => g.name)).toEqual(['Bút', 'Sổ & Giấy']);
		expect(groups[0]!.rows.map(r => r.name)).toEqual(['Bút bi', 'Bút chì gỗ']);
		expect(groups[0]!.rows[1]!.line?.requestedQty).toBe(5);
		expect(groups[0]!.rows[0]!.quota).toBe(10);
		expect(groups[0]!.rows[0]!.searchText).toBe('but bi');
	});

	it('[EDGE] dòng của mặt hàng danh mục không còn vẫn hiện, dòng ngoài danh mục luôn ở nhóm cuối', () => {
		const groups = buildSupplyCatalog(items, [line(8, null, 'Pin 3A', null, 2), line(9, 99, 'Nước rửa tay', 'Vệ sinh', 1)]);
		expect(groups.map(g => g.name)).toEqual(['Bút', 'Sổ & Giấy', 'Vệ sinh', CUSTOM_GROUP_NAME]);
		expect(groups.at(-1)!.isCustom).toBe(true);
		expect(groups.at(-1)!.rows[0]!.key).toBe('c8');
	});

	it('phiếu chỉ xem chỉ còn những dòng phòng đã đăng ký', () => {
		const groups = buildSupplyCatalog(items, [line(7, 3, 'Giấy A4', 'Sổ & Giấy', 1)], true);
		expect(groups.map(g => g.name)).toEqual(['Sổ & Giấy']);
		expect(groups[0]!.rows).toHaveLength(1);
	});
});

describe('supplyStatusLabel', () => {
	it('kỳ và phiếu cùng nhãn ở OPEN và LOCKED, các bước sau giữ chữ của máy chủ', () => {
		expect(supplyStatusLabel('OPEN')).toBe('Đang đăng ký');
		expect(supplyStatusLabel('LOCKED', 3)).toBe('Đã khoá');
		expect(supplyStatusLabel('CLOSED')).toBe('Đã đóng');
		expect(supplyStatusLabel('FINALIZED', 3)).toBe('Đã chốt, chờ cấp');
		expect(supplyStatusLabel('ISSUED', 3)).toBe('Đã cấp, chờ nhận');
		expect(supplyStatusLabel('RECEIVED', 3)).toBe('Đã nhận');
	});

	it('nhãn ngắn cho số đếm', () => {
		expect(SUPPLY_STATUS.FINALIZED.shortLabel).toBe('Đã chốt');
		expect(SUPPLY_STATUS.ISSUED.shortLabel).toBe('Đã cấp');
	});

	it('[EDGE] phiếu rỗng sau khi khoá ghi "Không đăng ký", phiếu rỗng còn mở thì không', () => {
		expect(supplyStatusLabel('LOCKED', 0)).toBe('Không đăng ký');
		expect(supplyStatusLabel('OPEN', 0)).toBe('Đang đăng ký');
	});
});

describe('supplyLockLabel', () => {
	it('đọc mốc khoá theo giờ Việt Nam', () => {
		expect(supplyLockLabel('2026-11-27T17:00:00.000Z')).toBe('00:00 ngày 28/11/2026');
	});
});

// ─── Kỳ văn phòng phẩm: mặc định khi mở kỳ, trùng kỳ, gợi ý, phân nhóm ─────────

import {
	addMonthsYm,
	daysBetweenYmd,
	defaultPeriodDeadline,
	defaultPeriodMonth,
	findPeriodFor,
	groupSupplyPeriods,
	latestPeriodOf,
	lockAtOfDeadline,
	nextPeriodSuggestions,
	periodProgress,
	supplyStatusMeta,
	vnMonthValue,
	weekdayOf,
} from '../app/utils/office.utils';

const P = (id: number, siteId: number, month: string, deadline: string, status = 'OPEN') => ({
	id,
	month,
	deadline,
	status,
	officeSite: { id: siteId },
});

describe('supplyStatusMeta', () => {
	it('[EDGE] trạng thái lạ từ máy chủ: hiện nguyên mã, màu xám, không ném lỗi', () => {
		const meta = supplyStatusMeta('ARCHIVED');
		expect(meta.label).toBe('ARCHIVED');
		expect(meta.class).toContain('bg-gray-100');
		expect(supplyStatusLabel('ARCHIVED', 2)).toBe('ARCHIVED');
	});
});

describe('tháng và hạn chót mặc định khi mở kỳ', () => {
	it('tháng hiện tại theo giờ Việt Nam', () => {
		expect(vnMonthValue(new Date('2026-11-30T18:00:00.000Z'))).toBe('2026-12');
	});

	it('cộng tháng qua năm', () => {
		expect(addMonthsYm('2026-12', 1)).toBe('2027-01');
		expect(addMonthsYm('2026-01', -1)).toBe('2025-12');
	});

	it('tháng mặc định là tháng sau kỳ gần nhất, không trước tháng hiện tại', () => {
		expect(defaultPeriodMonth(null, '2026-11')).toBe('2026-11');
		expect(defaultPeriodMonth({ month: '2026-11' }, '2026-11')).toBe('2026-12');
		expect(defaultPeriodMonth({ month: '2026-08' }, '2026-11')).toBe('2026-11');
	});

	it('kỳ gần nhất là kỳ có tháng muộn nhất của văn phòng', () => {
		const list = [P(1, 1, '2026-11', '2026-11-27'), P(2, 1, '2026-12', '2026-12-27'), P(3, 2, '2027-01', '2027-01-20')];
		expect(latestPeriodOf(list, 1)?.id).toBe(2);
		expect(latestPeriodOf(list, 9)).toBeNull();
	});

	it('hạn chót giữ ngày trong tháng của kỳ trước', () => {
		expect(defaultPeriodDeadline({ month: '2026-11', deadline: '2026-11-27' }, '2026-12', '2026-11-24')).toBe('2026-12-27');
	});

	it('hạn chót giữ cả khoảng cách tháng: kỳ tháng 12 hạn 27/11 thì kỳ tháng 1 hạn 27/12', () => {
		expect(defaultPeriodDeadline({ month: '2026-12', deadline: '2026-11-27' }, '2027-01', '2026-11-24')).toBe('2026-12-27');
	});

	it('[EDGE] kẹp về ngày cuối tháng khi tháng đích ngắn hơn, kể cả năm nhuận', () => {
		expect(defaultPeriodDeadline({ month: '2027-01', deadline: '2027-01-31' }, '2027-02', '2026-11-24')).toBe('2027-02-28');
		expect(defaultPeriodDeadline({ month: '2028-01', deadline: '2028-01-31' }, '2028-02', '2026-11-24')).toBe('2028-02-29');
		expect(defaultPeriodDeadline({ month: '2026-12', deadline: '2026-12-31' }, '2027-04', '2026-11-24')).toBe('2027-04-30');
	});

	it('[EDGE] chưa có kỳ trước hoặc ngày tính ra đã qua thì để trống', () => {
		expect(defaultPeriodDeadline(null, '2026-12', '2026-11-24')).toBe('');
		expect(defaultPeriodDeadline({ month: '2026-10', deadline: '2026-10-20' }, '2026-11', '2026-11-24')).toBe('');
	});
});

describe('thứ trong tuần, mốc khoá, số ngày', () => {
	it('thứ của một ngày và cuối tuần', () => {
		expect(weekdayOf('2026-12-27')).toEqual({ label: 'Chủ nhật', weekend: true });
		expect(weekdayOf('2026-12-26')).toEqual({ label: 'Thứ Bảy', weekend: true });
		expect(weekdayOf('2026-12-28')).toEqual({ label: 'Thứ Hai', weekend: false });
	});

	it('phiếu khoá lúc 00:00 giờ Việt Nam ngày sau hạn chót, kể cả cuối tháng, cuối năm', () => {
		expect(supplyLockLabel(lockAtOfDeadline('2026-12-27'))).toBe('00:00 ngày 28/12/2026');
		expect(supplyLockLabel(lockAtOfDeadline('2026-12-31'))).toBe('00:00 ngày 01/01/2027');
		expect(new Date(lockAtOfDeadline('2026-11-27')).toISOString()).toBe('2026-11-27T17:00:00.000Z');
	});

	it('số ngày theo lịch', () => {
		expect(daysBetweenYmd('2026-11-24', '2026-12-28')).toBe(34);
		expect(daysBetweenYmd('2026-11-24', '2026-11-24')).toBe(0);
	});
});

describe('trùng kỳ và gợi ý mở kỳ tiếp theo', () => {
	const sites = [{ id: 1 }, { id: 2 }, { id: 3 }];

	it('tìm kỳ đã có theo văn phòng và tháng', () => {
		const list = [P(1, 1, '2026-12', '2026-12-27')];
		expect(findPeriodFor(list, 1, '2026-12')?.id).toBe(1);
		expect(findPeriodFor(list, 2, '2026-12')).toBeNull();
	});

	it('chỉ gợi ý văn phòng có kỳ gần nhất đã khoá hoặc đóng mà chưa có kỳ tháng sau', () => {
		const list = [
			P(1, 1, '2026-11', '2026-11-27', 'LOCKED'),
			P(2, 2, '2026-11', '2026-11-27', 'OPEN'),
			P(3, 3, '2026-10', '2026-10-27', 'CLOSED'),
			P(4, 3, '2026-11', '2026-11-27', 'CLOSED'),
		];
		expect(nextPeriodSuggestions(sites, list, '2026-11').map(s => [s.site.id, s.month])).toEqual([
			[1, '2026-12'],
			[3, '2026-12'],
		]);
	});

	it('[EDGE] văn phòng chưa có kỳ nào không được gợi ý; kỳ gần nhất cũ thì gợi ý tháng hiện tại', () => {
		expect(nextPeriodSuggestions(sites, [P(1, 1, '2026-06', '2026-06-27', 'CLOSED')], '2026-11')).toEqual([
			{ site: { id: 1 }, month: '2026-11' },
		]);
	});
});

describe('phân nhóm và tiến độ kỳ', () => {
	it('đang diễn ra ở trên, đã đóng ở dưới, tháng mới trước', () => {
		const groups = groupSupplyPeriods([
			P(1, 1, '2026-10', '', 'CLOSED'),
			P(2, 1, '2026-11', '', 'LOCKED'),
			P(3, 1, '2026-12', '', 'OPEN'),
			P(4, 1, '2026-09', '', 'CLOSED'),
		]);
		expect(groups.active.map(p => p.id)).toEqual([3, 2]);
		expect(groups.closed.map(p => p.id)).toEqual([1, 4]);
	});

	it('[EDGE] kỳ không có phòng nào: 0%, không chia cho 0', () => {
		expect(periodProgress({ departmentsTotal: 0, departmentsWithLines: 0 })).toEqual({ done: 0, total: 0, percent: 0 });
		expect(periodProgress({})).toEqual({ done: 0, total: 0, percent: 0 });
		expect(periodProgress({ departmentsTotal: 9, departmentsWithLines: 1 })).toEqual({ done: 1, total: 9, percent: 11 });
	});
});

// ─── Chi tiết kỳ: giai đoạn, phòng đã đăng ký, việc tiếp theo, bảng tổng hợp ──

import {
	departmentRegistration,
	isDraftDirty,
	isPriceMissing,
	isRowUnpriced,
	periodNextStep,
	periodStageSteps,
	requestStageCounts,
} from '../app/utils/office.utils';
import { formatVnDateTime } from '../app/utils/date';

const dept = (departmentId: number, name: string, requests: Array<[number, number, string, number]>) => ({
	departmentId,
	name,
	requests: requests.map(([id, sequence, status, lineCount]) => ({ id, sequence, status, lineCount })),
});

describe('giai đoạn kỳ', () => {
	it('giờ Việt Nam cho mốc ISO có Z', () => {
		expect(formatVnDateTime('2026-11-24T04:33:41.218Z')).toBe('24/11/2026 11:33');
	});

	it('kỳ đang mở: bước 1 hiện tại, bước khoá ghi dự kiến theo hạn chót', () => {
		const steps = periodStageSteps({ status: 'OPEN', lockAt: '2026-11-27T17:00:00.000Z', lockedAt: null, closedAt: null });
		expect(steps.map(s => s.state)).toEqual(['current', 'todo', 'todo']);
		expect(steps.map(s => s.label)).toEqual(['Đang đăng ký', 'Đã khoá', 'Đã đóng']);
		expect(steps[1]!.at).toBe('Dự kiến 00:00 ngày 28/11/2026');
	});

	it('kỳ đã khoá và đã đóng ghi giờ thật', () => {
		const locked = periodStageSteps({ status: 'LOCKED', lockAt: 'x', lockedAt: '2026-11-24T04:33:00.000Z', closedAt: null });
		expect(locked.map(s => s.state)).toEqual(['done', 'current', 'todo']);
		expect(locked[1]!.at).toBe('Khoá lúc 24/11/2026 11:33');
		const closed = periodStageSteps({ status: 'CLOSED', lockAt: 'x', lockedAt: null, closedAt: '2026-12-01T02:00:00.000Z' });
		expect(closed.map(s => s.state)).toEqual(['done', 'done', 'current']);
		expect(closed[2]!.at).toBe('Đóng lúc 01/12/2026 09:00');
	});
});

describe('phòng đã đăng ký và tiến độ phiếu', () => {
	const departments = [
		dept(1, 'HCNS', [[1, 0, 'RECEIVED', 3], [5, 1, 'FINALIZED', 1]]),
		dept(2, 'Kế toán', [[2, 0, 'LOCKED', 0]]),
		dept(3, 'IT', [[3, 0, 'ISSUED', 2]]),
		dept(4, 'Kinh doanh', [[4, 0, 'LOCKED', 4]]),
	];

	it('đếm theo phòng, phòng có phiếu bổ sung vẫn là một phòng', () => {
		expect(departmentRegistration(departments)).toEqual({ done: 3, total: 4 });
	});

	it('đếm theo phiếu có dòng; bước sau tính cả bước trước', () => {
		expect(requestStageCounts(departments)).toEqual({ total: 4, finalized: 3, issued: 2, received: 1 });
	});

	it('[EDGE] chưa phòng nào tham gia', () => {
		expect(departmentRegistration([])).toEqual({ done: 0, total: 0 });
		expect(requestStageCounts([])).toEqual({ total: 0, finalized: 0, issued: 0, received: 0 });
	});
});

describe('việc tiếp theo của kỳ đã khoá', () => {
	it('chốt phiếu chưa chốt trước, rồi cấp, rồi đóng kỳ', () => {
		expect(periodNextStep('LOCKED', [dept(1, 'HCNS', [[1, 0, 'FINALIZED', 2]]), dept(2, 'IT', [[2, 0, 'LOCKED', 1]])])).toEqual({
			kind: 'finalize',
			requestId: 2,
			departmentName: 'IT',
			sequence: 0,
		});
		expect(periodNextStep('LOCKED', [dept(1, 'HCNS', [[1, 0, 'FINALIZED', 2]])])).toEqual({
			kind: 'issue',
			requestId: 1,
			departmentName: 'HCNS',
			sequence: 0,
		});
		expect(periodNextStep('LOCKED', [dept(1, 'HCNS', [[1, 0, 'RECEIVED', 2]]), dept(2, 'KT', [[2, 0, 'LOCKED', 0]])])).toEqual({
			kind: 'close',
		});
	});

	it('[EDGE] còn phiếu đã cấp chờ phòng nhận thì không có việc chính; kỳ chưa khoá cũng không', () => {
		expect(periodNextStep('LOCKED', [dept(1, 'HCNS', [[1, 0, 'ISSUED', 2]])])).toBeNull();
		expect(periodNextStep('OPEN', [dept(1, 'HCNS', [[1, 0, 'OPEN', 2]])])).toBeNull();
	});
});

describe('bảng tổng hợp: thiếu đơn giá, thay đổi chưa lưu', () => {
	it('thiếu đơn giá khi có số cần mua mà chưa có đơn giá; đơn giá 0 không phải thiếu', () => {
		expect(isRowUnpriced({ purchaseQty: 3, unitPrice: null })).toBe(true);
		expect(isRowUnpriced({ purchaseQty: 3, unitPrice: 0 })).toBe(false);
		expect(isRowUnpriced({ purchaseQty: 0, unitPrice: null })).toBe(false);
	});

	it('[EDGE] một tiêu chí thiếu giá cho cả danh mục: null, undefined là thiếu, 0 là có giá', () => {
		expect(isPriceMissing(null)).toBe(true);
		expect(isPriceMissing(undefined)).toBe(true);
		expect(isPriceMissing(0)).toBe(false);
		expect(isPriceMissing(12000)).toBe(false);
	});

	it('ô trống so với null là chưa đổi; 0 khác trống', () => {
		expect(isDraftDirty(undefined, null)).toBe(false);
		expect(isDraftDirty(5, 5)).toBe(false);
		expect(isDraftDirty(0, null)).toBe(true);
		expect(isDraftDirty(undefined, 1200)).toBe(true);
	});
});

// ─── Cài đặt hành chính: lọc danh mục văn phòng phẩm ──────────────────────────

import { filterCatalogSections } from '../app/utils/office.utils';

describe('filterCatalogSections', () => {
	const groups = [
		{ id: 1, name: 'Bút & gim', hrOnly: false, isActive: true },
		{ id: 2, name: 'Đồ uống', hrOnly: true, isActive: true },
		{ id: 3, name: 'Cũ', hrOnly: false, isActive: false },
		{ id: 4, name: 'Trống', hrOnly: false, isActive: true },
	];
	const items = [
		{ id: 1, groupId: 1, name: 'Bút bi (Note màu xanh)', unitPrice: null, isActive: true },
		{ id: 2, groupId: 1, name: 'Bút chì gỗ', unitPrice: 0, isActive: true },
		{ id: 3, groupId: 1, name: 'Bút mực cũ', unitPrice: null, isActive: false },
		{ id: 4, groupId: 2, name: 'Trà túi lọc', unitPrice: 45000, isActive: true },
		{ id: 5, groupId: 3, name: 'Giấy than', unitPrice: null, isActive: true },
	];
	const base = { search: '', onlyUnpriced: false, showInactive: false };

	it('mặc định ẩn nhóm, mặt hàng ngừng dùng; chip đếm theo nhóm; nhóm trống vẫn hiện', () => {
		const view = filterCatalogSections(groups, items, base);
		expect(view.chips.map(c => [c.group.id, c.count])).toEqual([
			[1, 2],
			[2, 1],
			[4, 0],
		]);
		expect(view.total).toBe(3);
		expect(view.sections.map(s => s.group.id)).toEqual([1, 2, 4]);
	});

	it('[EDGE] số thiếu giá khớp danh sách: mặt hàng còn dùng trong nhóm đã ngừng không bị đếm', () => {
		// "Giấy than" còn dùng, chưa có giá, nhưng nhóm "Cũ" đã ngừng nên ẩn cùng nhóm.
		expect(filterCatalogSections(groups, items, base).unpriced).toBe(1);
		expect(filterCatalogSections(groups, items, { ...base, showInactive: true }).unpriced).toBe(3);
	});

	it('tìm không dấu theo tên, nhóm không khớp thì ẩn', () => {
		const view = filterCatalogSections(groups, items, { ...base, search: 'but chi' });
		expect(view.sections.map(s => s.items.map(i => i.id))).toEqual([[2]]);
	});

	it('thiếu đơn giá: null là thiếu, 0 là có giá', () => {
		const view = filterCatalogSections(groups, items, { ...base, onlyUnpriced: true });
		expect(view.sections.flatMap(s => s.items.map(i => i.id))).toEqual([1]);
	});

	it('lọc một nhóm; bật xem ngừng dùng thì hiện cả nhóm và mặt hàng đã ngừng', () => {
		expect(filterCatalogSections(groups, items, { ...base, groupId: 2 }).sections.map(s => s.group.id)).toEqual([2]);
		const all = filterCatalogSections(groups, items, { ...base, showInactive: true });
		expect(all.total).toBe(5);
		expect(all.sections.map(s => s.group.id)).toEqual([1, 2, 3, 4]);
	});
});

// ─── Chi tiết lượt họp ───────────────────────────────────────────────────────

import { bookingDurationLabel } from '../app/utils/office.utils';
import { formatVnWeekdayDate } from '../app/utils/date';

describe('chi tiết lượt họp', () => {
	it('độ dài lượt: phút, giờ chẵn, giờ lẻ', () => {
		expect(bookingDurationLabel('2026-11-25T08:30:00.000Z', '2026-11-25T09:00:00.000Z')).toBe('30 phút');
		expect(bookingDurationLabel('2026-11-25T08:30:00.000Z', '2026-11-25T09:30:00.000Z')).toBe('1 giờ');
		expect(bookingDurationLabel('2026-11-25T08:30:00.000Z', '2026-11-25T10:00:00.000Z')).toBe('1 giờ 30 phút');
	});

	it('ngày kèm thứ theo lịch Việt Nam: 23:30 UTC đã là sáng hôm sau', () => {
		expect(formatVnWeekdayDate('2026-11-24T08:30:00.000Z')).toBe('Thứ Ba, 24/11/2026');
		expect(formatVnWeekdayDate('2026-11-24T23:30:00.000Z')).toBe('Thứ Tư, 25/11/2026');
	});
});
