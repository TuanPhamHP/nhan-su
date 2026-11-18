/**
 * Câu "Khoảng thời gian" trên form tạo đơn nghỉ.
 *
 * Điều đáng kiểm là form không còn tự đếm ngày: số ngày phép phải đúng bằng `totalDays` của
 * preview, kể cả khi người gửi có ca thứ Bảy, Chủ nhật, và khoảng không có ngày nào có ca thì
 * nói thẳng ra chứ không hiện số 0 trơ trọi.
 */
import { describe, expect, it } from 'vitest';
import { leaveDurationText } from '~/utils/leave.utils';

describe('leaveDurationText — phép năm', () => {
	it('lấy đúng số ngày của preview, không tự đếm', () => {
		expect(leaveDurationText({ code: 'ANNUAL', totalDays: 2 })).toBe('2 ngày nghỉ (tính theo ca)');
		expect(leaveDurationText({ code: 'ANNUAL', totalDays: 7 })).toBe('7 ngày nghỉ (tính theo ca)');
	});

	it('nghỉ thứ Bảy và Chủ nhật của người làm cả tuần vẫn là hai ngày', () => {
		expect(leaveDurationText({ code: 'ANNUAL', totalDays: 2 })).toBe('2 ngày nghỉ (tính theo ca)');
	});

	it('khoảng không có ngày nào có ca thì nói rõ vì sao bằng không', () => {
		expect(leaveDurationText({ code: 'ANNUAL', totalDays: 0 })).toBe(
			'0 ngày: khoảng này không có ngày nào bạn có ca',
		);
	});

	it('đang chờ máy chủ tính thì báo đang tính', () => {
		expect(leaveDurationText({ code: 'ANNUAL', previewLoading: true, totalDays: null })).toBe('Đang tính số ngày…');
		// Số cũ không được hiện lại trong lúc đang tính lại cho khoảng ngày mới.
		expect(leaveDurationText({ code: 'ANNUAL', previewLoading: true, totalDays: 3 })).toBe('Đang tính số ngày…');
	});

	it('chưa có preview hoặc preview lỗi thì không hiện gì', () => {
		expect(leaveDurationText({ code: 'ANNUAL', totalDays: null })).toBeNull();
		expect(leaveDurationText({ code: 'ANNUAL' })).toBeNull();
	});

	it('số lẻ của máy chủ giữ nguyên', () => {
		expect(leaveDurationText({ code: 'ANNUAL', totalDays: 1.5 })).toBe('1.5 ngày nghỉ (tính theo ca)');
	});
});

describe('leaveDurationText — các loại đơn khác không đổi', () => {
	it('nửa ngày luôn là 0.5 ngày', () => {
		expect(leaveDurationText({ code: 'HALF_DAY' })).toBe('0.5 ngày');
		expect(leaveDurationText({ code: 'HALF_DAY', previewLoading: true })).toBe('0.5 ngày');
	});

	it('đi muộn và về sớm tính bằng phút', () => {
		expect(leaveDurationText({ code: 'LATE', lateMinutes: 30 })).toBe('30 phút');
		expect(leaveDurationText({ code: 'EARLY', earlyMinutes: 45 })).toBe('45 phút');
	});

	it('chưa nhập số phút thì chưa hiện gì', () => {
		expect(leaveDurationText({ code: 'LATE' })).toBeNull();
		expect(leaveDurationText({ code: 'EARLY', earlyMinutes: 0 })).toBeNull();
	});

	it('chưa chọn loại phép thì không hiện gì', () => {
		expect(leaveDurationText({ code: null })).toBeNull();
		expect(leaveDurationText({ code: '', totalDays: 5 })).toBeNull();
	});

	it('loại phép lạ thì không đoán bừa', () => {
		expect(leaveDurationText({ code: 'UNPAID', totalDays: 4 })).toBeNull();
	});
});
