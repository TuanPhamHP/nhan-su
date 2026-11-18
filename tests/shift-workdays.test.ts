/**
 * Câu "những ngày sẽ được gán" dưới hai hộp gán ca theo khoảng.
 *
 * Server chỉ gán những ngày nằm trong khuôn ca, nên câu này là chỗ duy nhất người dùng biết trước
 * điều đó. Thứ tự phải là thứ tự hiển thị T2→T7→CN, chứ không phải thứ tự số 0→6 của dữ liệu.
 */
import { describe, expect, it } from 'vitest';
import { formatWorkDays, shiftRangeHint, shiftRangeHintFor } from '~/utils/shift.utils';

/** Ba ca như sandbox đang khai: cả tuần, hành chính, và một ca lẻ ngày. */
const SHIFTS = [
	{ id: 1, workDays: [0, 1, 2, 3, 4, 5, 6] },
	{ id: 2, workDays: [1, 2, 3, 4, 5] },
	{ id: 3, workDays: [1, 2, 3, 4, 5, 6] },
	{ id: 4, workDays: [1, 3, 5] },
];

describe('formatWorkDays', () => {
	it('dải liền viết gọn bằng gạch nối', () => {
		expect(formatWorkDays([1, 2, 3, 4, 5])).toBe('T2–T6');
		expect(formatWorkDays([1, 2, 3, 4, 5, 6])).toBe('T2–T7');
	});

	it('đủ bảy ngày là một dải liền tới Chủ nhật', () => {
		expect(formatWorkDays([0, 1, 2, 3, 4, 5, 6])).toBe('T2–CN');
	});

	it('Chủ nhật đứng cuối, không nhảy lên đầu theo số 0', () => {
		expect(formatWorkDays([0, 5, 6])).toBe('T6–CN');
		expect(formatWorkDays([0, 1])).toBe('T2, CN');
	});

	it('không liền thì liệt kê từng ngày', () => {
		expect(formatWorkDays([1, 3, 5])).toBe('T2, T4, T6');
		expect(formatWorkDays([5, 1, 3])).toBe('T2, T4, T6');
	});

	it('một ngày thì chỉ ghi ngày đó', () => {
		expect(formatWorkDays([6])).toBe('T7');
		expect(formatWorkDays([0])).toBe('CN');
	});

	it('bỏ ngày trùng và mã ngày lạ', () => {
		expect(formatWorkDays([1, 1, 2])).toBe('T2–T3');
		expect(formatWorkDays([1, 9, 2])).toBe('T2–T3');
	});

	it('không có ngày nào thì trả về chuỗi rỗng', () => {
		expect(formatWorkDays([])).toBe('');
	});
});

describe('shiftRangeHint', () => {
	it('chưa chọn ca thì nhắc chọn ca', () => {
		expect(shiftRangeHint(undefined)).toBe('Chọn ca để xem những ngày sẽ được gán.');
		expect(shiftRangeHint(null)).toBe('Chọn ca để xem những ngày sẽ được gán.');
	});

	it('ca T2–CN nói đúng là gán cả bảy ngày', () => {
		expect(shiftRangeHint([0, 1, 2, 3, 4, 5, 6])).toBe('Gán vào T2–CN theo khuôn ca, ghi đè ca đã có.');
	});

	it('ca T2–T6 nói đúng năm ngày', () => {
		expect(shiftRangeHint([1, 2, 3, 4, 5])).toBe('Gán vào T2–T6 theo khuôn ca, ghi đè ca đã có.');
	});

	it('ca không liền thì liệt kê', () => {
		expect(shiftRangeHint([1, 3, 5])).toBe('Gán vào T2, T4, T6 theo khuôn ca, ghi đè ca đã có.');
	});

	it('ca không khai ngày nào thì nói rõ sẽ không gán được ngày nào', () => {
		expect(shiftRangeHint([])).toBe('Ca này chưa khai ngày làm việc nào nên sẽ không có ngày nào được gán.');
	});
});

describe('shiftRangeHintFor — đúng những gì hai hộp gán ca hiện', () => {
	it('F1 chưa chọn ca', () => {
		expect(shiftRangeHintFor(SHIFTS, undefined)).toBe('Chọn ca để xem những ngày sẽ được gán.');
	});

	it('F2 chọn ca khai T2–CN', () => {
		expect(shiftRangeHintFor(SHIFTS, 1)).toBe('Gán vào T2–CN theo khuôn ca, ghi đè ca đã có.');
	});

	it('F3 đổi sang ca T2–T6', () => {
		expect(shiftRangeHintFor(SHIFTS, 2)).toBe('Gán vào T2–T6 theo khuôn ca, ghi đè ca đã có.');
	});

	it('F4 ca T2–T7 của hộp một nhân viên', () => {
		expect(shiftRangeHintFor(SHIFTS, 3)).toBe('Gán vào T2–T7 theo khuôn ca, ghi đè ca đã có.');
	});

	it('ca lẻ ngày thì liệt kê', () => {
		expect(shiftRangeHintFor(SHIFTS, 4)).toBe('Gán vào T2, T4, T6 theo khuôn ca, ghi đè ca đã có.');
	});

	it('ca không còn trong danh sách thì mời chọn lại, không đoán ngày', () => {
		expect(shiftRangeHintFor(SHIFTS, 99)).toBe('Chọn ca để xem những ngày sẽ được gán.');
		expect(shiftRangeHintFor([], 1)).toBe('Chọn ca để xem những ngày sẽ được gán.');
	});
});
