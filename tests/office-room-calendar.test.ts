/**
 * ============================================================
 * Test suite: lịch phòng họp theo ngày và theo tuần
 * ============================================================
 *
 * Vì sao cần: lịch phòng họp có thêm chế độ tuần, nút lùi tới và vạch giờ hiện tại. Ba chỗ dễ
 * sai mà người dùng không nhận ra: tuần bắt đầu sai ngày thì bấm "tuần sau" cắt đôi tuần làm
 * việc; nhãn tuần vắt qua tháng ghi thiếu tháng thì "30 – 06/12" đọc như ngày 30 tháng 12; còn
 * vạch giờ hiện tại vẽ dính mép khi đã ngoài dải giờ thì người xem tưởng bây giờ là 7 giờ sáng.
 *
 * Ký hiệu: [EDGE] trường hợp biên
 * ============================================================
 */

import { describe, expect, it } from 'vitest';
import {
	addDaysYmd,
	addMonthsYmd,
	bookingHourRange,
	layoutDayEvents,
	monthGridDaysYmd,
	nowLinePercent,
	splitBookingsByDay,
	weekDaysYmd,
	weekRangeLabel,
} from '../app/utils/office.utils';

const DEFAULTS = { startHour: 7, endHour: 20 };

/** Một lượt họp tối giản, giờ Việt Nam. */
function booking(date: string, from: string, to: string, status = 'BOOKED') {
	return { status, startAt: `${date}T${from}:00+07:00`, endAt: `${date}T${to}:00+07:00` };
}

describe('weekDaysYmd', () => {
	it('trả bảy ngày từ thứ Hai tới Chủ nhật của tuần chứa ngày đang xem', () => {
		// 19/11/2026 là thứ Năm.
		expect(weekDaysYmd('2026-11-19')).toEqual([
			'2026-11-16',
			'2026-11-17',
			'2026-11-18',
			'2026-11-19',
			'2026-11-20',
			'2026-11-21',
			'2026-11-22',
		]);
	});

	it('[EDGE] Chủ nhật thuộc tuần bắt đầu từ thứ Hai trước đó, không mở tuần mới', () => {
		expect(weekDaysYmd('2026-11-22')[0]).toBe('2026-11-16');
	});

	it('[EDGE] tuần vắt qua năm', () => {
		expect(weekDaysYmd('2027-01-01')).toEqual([
			'2026-12-28',
			'2026-12-29',
			'2026-12-30',
			'2026-12-31',
			'2027-01-01',
			'2027-01-02',
			'2027-01-03',
		]);
	});
});

describe('addDaysYmd', () => {
	it('lùi tới theo ngày và theo tuần', () => {
		expect(addDaysYmd('2026-11-19', 1)).toBe('2026-11-20');
		expect(addDaysYmd('2026-11-19', -7)).toBe('2026-11-12');
	});

	it('[EDGE] qua cuối tháng và cuối năm', () => {
		expect(addDaysYmd('2026-11-30', 1)).toBe('2026-12-01');
		expect(addDaysYmd('2026-12-28', 7)).toBe('2027-01-04');
	});
});

describe('weekRangeLabel', () => {
	it('cùng tháng thì gọn một đầu', () => {
		expect(weekRangeLabel(weekDaysYmd('2026-11-19'))).toBe('16 – 22/11/2026');
	});

	it('[EDGE] vắt qua tháng thì ghi tháng ở cả hai đầu', () => {
		expect(weekRangeLabel(weekDaysYmd('2026-12-02'))).toBe('30/11 – 06/12/2026');
	});

	it('[EDGE] vắt qua năm thì ghi năm ở cả hai đầu', () => {
		expect(weekRangeLabel(weekDaysYmd('2027-01-01'))).toBe('28/12/2026 – 03/01/2027');
	});

	it('[EDGE] danh sách rỗng thì trả chuỗi rỗng', () => {
		expect(weekRangeLabel([])).toBe('');
	});
});

describe('bookingHourRange', () => {
	it('không có lượt nào thì giữ dải mặc định', () => {
		expect(bookingHourRange([], DEFAULTS)).toEqual({ start: 7, end: 20 });
	});

	it('nới dải giờ theo lượt sớm hơn và muộn hơn', () => {
		const list = [booking('2026-11-19', '06:30', '07:30'), booking('2026-11-20', '20:00', '21:15')];
		expect(bookingHourRange(list, DEFAULTS)).toEqual({ start: 6, end: 22 });
	});

	it('[EDGE] lượt đã huỷ không kéo dải giờ ra', () => {
		expect(bookingHourRange([booking('2026-11-19', '21:00', '22:00', 'CANCELLED')], DEFAULTS)).toEqual({
			start: 7,
			end: 20,
		});
	});

	it('[EDGE] lượt vắt qua nửa đêm thì chạy tới hết ngày', () => {
		const late = { status: 'BOOKED', startAt: '2026-11-19T23:00:00+07:00', endAt: '2026-11-20T01:00:00+07:00' };
		expect(bookingHourRange([late], DEFAULTS)).toEqual({ start: 7, end: 24 });
	});
});

describe('nowLinePercent', () => {
	const range = { start: 7, end: 20 };

	it('đặt vạch theo phần trăm của dải giờ khi xem hôm nay', () => {
		// 13:30 giờ Việt Nam là 6,5 giờ sau 7 giờ, trên dải 13 giờ: đúng một nửa.
		const now = new Date('2026-11-19T13:30:00+07:00');
		expect(nowLinePercent('2026-11-19', range, now)).toBeCloseTo(50);
	});

	it('không vẽ vạch khi ngày đang xem không phải hôm nay', () => {
		const now = new Date('2026-11-19T13:30:00+07:00');
		expect(nowLinePercent('2026-11-20', range, now)).toBeNull();
	});

	it('[EDGE] ngoài dải giờ thì không vẽ, không dính vạch ở mép', () => {
		expect(nowLinePercent('2026-11-19', range, new Date('2026-11-19T06:10:00+07:00'))).toBeNull();
		expect(nowLinePercent('2026-11-19', range, new Date('2026-11-19T21:00:00+07:00'))).toBeNull();
	});

	it('[EDGE] hôm nay tính theo giờ Việt Nam, không theo giờ UTC', () => {
		// 00:30 ngày 20 giờ Việt Nam vẫn là 17:30 ngày 19 giờ UTC.
		const now = new Date('2026-11-20T00:30:00+07:00');
		expect(nowLinePercent('2026-11-20', { start: 0, end: 24 }, now)).toBeCloseTo((30 / (24 * 60)) * 100);
		expect(nowLinePercent('2026-11-19', { start: 0, end: 24 }, now)).toBeNull();
	});
});

describe('splitBookingsByDay', () => {
	const days = weekDaysYmd('2026-11-19');

	it('chia lượt của cả tuần vào đúng ngày bắt đầu, xếp theo giờ', () => {
		const late = { id: 2, ...booking('2026-11-17', '15:00', '16:00') };
		const early = { id: 1, ...booking('2026-11-17', '09:00', '10:00') };
		const sunday = { id: 3, ...booking('2026-11-22', '08:00', '09:00') };
		const result = splitBookingsByDay([late, sunday, early], days);
		expect(result).toHaveLength(7);
		expect(result[1]?.map(b => b.id)).toEqual([1, 2]);
		expect(result[6]?.map(b => b.id)).toEqual([3]);
		expect(result[0]).toEqual([]);
	});

	it('[EDGE] chia theo ngày giờ Việt Nam: họp 6 giờ sáng thứ Ba không rơi về thứ Hai theo UTC', () => {
		// 06:00 ngày 17 giờ Việt Nam là 23:00 ngày 16 giờ UTC.
		const dawn = { id: 1, status: 'BOOKED', startAt: '2026-11-16T23:00:00.000Z' };
		expect(splitBookingsByDay([dawn], days)[1]?.map(b => b.id)).toEqual([1]);
	});

	it('[EDGE] bỏ lượt đã huỷ và lượt bắt đầu từ trước tuần mà vắt sang', () => {
		const cancelled = { id: 1, ...booking('2026-11-18', '09:00', '10:00', 'CANCELLED') };
		// Chủ nhật tuần trước 23:00 tới 01:00 thứ Hai: máy chủ trả vì chạm khoảng, nhưng không thuộc ngày nào đang vẽ.
		const spill = { id: 2, status: 'BOOKED', startAt: '2026-11-15T23:00:00+07:00' };
		expect(splitBookingsByDay([cancelled, spill], days).flat()).toEqual([]);
	});
});

describe('monthGridDaysYmd và addMonthsYmd', () => {
	it('tháng 11/2026 vẽ từ thứ Hai 26/10 tới Chủ nhật 06/12, đủ sáu tuần', () => {
		const grid = monthGridDaysYmd('2026-11-24');
		expect(grid[0]).toBe('2026-10-26');
		expect(grid[grid.length - 1]).toBe('2026-12-06');
		expect(grid).toHaveLength(42);
	});

	it('[EDGE] tháng 2/2021 bắt đầu thứ Hai và có 28 ngày: đúng bốn tuần', () => {
		expect(monthGridDaysYmd('2021-02-10')).toHaveLength(28);
	});

	it('[EDGE] ngày 31 sang tháng sau ngắn hơn thì về ngày cuối tháng', () => {
		expect(addMonthsYmd('2026-01-31', 1)).toBe('2026-02-28');
		expect(addMonthsYmd('2026-12-15', 1)).toBe('2027-01-15');
	});
});

describe('layoutDayEvents', () => {
	const ev = (id: number, from: string, to: string, status = 'BOOKED') => ({
		id,
		...booking('2026-11-24', from, to, status),
	});
	const cols = (list: ReturnType<typeof ev>[]) =>
		layoutDayEvents(list).map(s => [s.booking.id, s.column, s.columns]);

	it('lượt không chồng giờ nhau chiếm trọn bề ngang', () => {
		expect(cols([ev(1, '09:00', '10:00'), ev(2, '10:00', '11:00')])).toEqual([
			[1, 0, 1],
			[2, 0, 1],
		]);
	});

	it('hai lượt chồng giờ đứng cạnh nhau, lượt buổi chiều một mình vẫn trọn bề ngang', () => {
		expect(cols([ev(1, '09:00', '10:30'), ev(2, '09:30', '10:00'), ev(3, '14:00', '15:00')])).toEqual([
			[1, 0, 2],
			[2, 1, 2],
			[3, 0, 1],
		]);
	});

	it('lượt thứ ba dùng lại cột đã trống thay vì mở cột mới', () => {
		expect(cols([ev(1, '09:00', '12:00'), ev(2, '09:00', '10:00'), ev(3, '10:00', '11:00')])).toEqual([
			[1, 0, 2],
			[2, 1, 2],
			[3, 1, 2],
		]);
	});

	it('[EDGE] bỏ lượt đã huỷ; lượt vắt qua nửa đêm kéo tới hết ngày', () => {
		const slots = layoutDayEvents([ev(1, '09:00', '10:00', 'CANCELLED'), ev(2, '22:00', '01:00')]);
		expect(slots.map(s => [s.booking.id, s.startMin, s.endMin])).toEqual([[2, 22 * 60, 24 * 60]]);
	});
});
