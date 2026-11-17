/**
 * Ô nhập số kiểu Việt Nam.
 *
 * Phần dễ sai nhất là đọc chuỗi dán vào ô: `1.234` của người Việt là một nghìn hai trăm ba mươi
 * tư, còn `1234.59` chép từ Excel bản tiếng Anh lại là một nghìn hai trăm ba mươi tư phẩy năm
 * chín. Hai chuỗi chỉ khác nhau ở số chữ số sau dấu chấm.
 */
import { describe, it, expect } from 'vitest';

import {
	caretAfterDigits,
	digitsBefore,
	formatNumberTyping,
	formatNumberValue,
	parsePastedNumber,
} from '~/utils/number-input';

describe('formatNumberTyping', () => {
	it('nhóm nghìn ngay khi gõ', () => {
		expect(formatNumberTyping('80000', 0)).toEqual({ text: '80.000', value: 80000 });
		expect(formatNumberTyping('1234567', 2)).toEqual({ text: '1.234.567', value: 1234567 });
	});

	it('ô số nguyên bỏ hẳn dấu phẩy và dấu chấm', () => {
		expect(formatNumberTyping('12,5', 0)).toEqual({ text: '125', value: 125 });
		expect(formatNumberTyping('1.2', 0)).toEqual({ text: '12', value: 12 });
	});

	it('ô có số lẻ giữ dấu phẩy, bỏ dấu chấm nhóm do ô tự chèn', () => {
		expect(formatNumberTyping('1.234,59', 2)).toEqual({ text: '1.234,59', value: 1234.59 });
		expect(formatNumberTyping('1.234,5', 2)).toEqual({ text: '1.234,5', value: 1234.5 });
	});

	it('đang gõ dở dấu phẩy thì giữ nguyên để gõ tiếp phần lẻ', () => {
		expect(formatNumberTyping('1234,', 2)).toEqual({ text: '1.234,', value: 1234 });
		expect(formatNumberTyping(',', 2)).toEqual({ text: '0,', value: undefined });
		expect(formatNumberTyping(',5', 2)).toEqual({ text: '0,5', value: 0.5 });
	});

	it('cắt phần lẻ dài quá số chữ số cho phép', () => {
		expect(formatNumberTyping('1,2345', 2)).toEqual({ text: '1,23', value: 1.23 });
		expect(formatNumberTyping('1,23456', 4)).toEqual({ text: '1,2345', value: 1.2345 });
	});

	it('bỏ chữ cái, dấu trừ và khoảng trắng', () => {
		expect(formatNumberTyping('12a3', 0)).toEqual({ text: '123', value: 123 });
		expect(formatNumberTyping('-500', 0)).toEqual({ text: '500', value: 500 });
		expect(formatNumberTyping('1 000', 0)).toEqual({ text: '1.000', value: 1000 });
		expect(formatNumberTyping('abc', 0)).toEqual({ text: '', value: undefined });
	});

	it('ô trống là undefined, không phải 0', () => {
		expect(formatNumberTyping('', 2).value).toBeUndefined();
		expect(formatNumberTyping('0', 2)).toEqual({ text: '0', value: 0 });
	});

	it('không cho vượt Number.MAX_SAFE_INTEGER', () => {
		const tooBig = '99999999999999999999';
		const out = formatNumberTyping(tooBig, 0);
		expect(out.value!).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
		expect(Number.isSafeInteger(out.value!)).toBe(true);
	});
});

describe('parsePastedNumber', () => {
	it('có dấu phẩy thì dấu phẩy là phần thập phân, dấu chấm là dấu nhóm', () => {
		expect(parsePastedNumber('1.234.567,89', 2)).toEqual({ text: '1.234.567,89', value: 1234567.89 });
	});

	it('nhiều dấu chấm mà không có dấu phẩy thì đều là dấu nhóm', () => {
		expect(parsePastedNumber('1.234.567', 2)).toEqual({ text: '1.234.567', value: 1234567 });
	});

	it('một dấu chấm với đúng ba chữ số phía sau là dấu nhóm', () => {
		expect(parsePastedNumber('1.234', 2)).toEqual({ text: '1.234', value: 1234 });
	});

	it('một dấu chấm với số chữ số khác ba là dấu thập phân', () => {
		expect(parsePastedNumber('1234.59', 2)).toEqual({ text: '1.234,59', value: 1234.59 });
		expect(parsePastedNumber('1234.5', 2)).toEqual({ text: '1.234,5', value: 1234.5 });
	});

	it('ô số nguyên thì bỏ phần lẻ của chuỗi dán vào', () => {
		expect(parsePastedNumber('1234.59', 0)).toEqual({ text: '1.234', value: 1234 });
		expect(parsePastedNumber('1.234.567,89', 0)).toEqual({ text: '1.234.567', value: 1234567 });
	});

	it('chuỗi có chữ và ký hiệu tiền thì chỉ lấy phần số', () => {
		expect(parsePastedNumber('18.500.000 đ', 0)).toEqual({ text: '18.500.000', value: 18500000 });
		expect(parsePastedNumber('x', 0)).toEqual({ text: '', value: undefined });
	});
});

describe('formatNumberValue', () => {
	it('số lưu trong dữ liệu hiện đúng kiểu Việt Nam', () => {
		expect(formatNumberValue(18500000.5, 2)).toBe('18.500.000,5');
		expect(formatNumberValue(108000000, 0)).toBe('108.000.000');
		expect(formatNumberValue(undefined, 2)).toBe('');
		expect(formatNumberValue(null, 2)).toBe('');
	});
});

describe('vị trí con trỏ', () => {
	it('đếm chữ số trước con trỏ, bỏ qua dấu nhóm', () => {
		// Con trỏ sau "1.234" là sau bốn chữ số, dấu chấm nhóm không tính.
		expect(digitsBefore('1.234.567', 5)).toBe(4);
		expect(digitsBefore('1.234', 0)).toBe(0);
	});

	it('đặt lại con trỏ sau đúng số chữ số đó', () => {
		// Xoá chữ số thứ tư của "1.234.567" ra "1.234.67": con trỏ vẫn đứng sau ba chữ số đầu,
		// tức ngay sau chữ "3" ở vị trí 4.
		expect(caretAfterDigits('1.234.67', 3)).toBe(4);
		expect(caretAfterDigits('1.234', 0)).toBe(0);
		expect(caretAfterDigits('1.234', 99)).toBe(5);
	});

	it('dấu phẩy được tính như một bước của con trỏ để sửa phần lẻ không bị nhảy', () => {
		expect(digitsBefore('1.234,59', 7)).toBe(6);
		expect(caretAfterDigits('1.234,59', 6)).toBe(7);
	});
});
