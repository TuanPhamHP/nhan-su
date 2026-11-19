/**
 * ============================================================
 * Test suite: so khớp chữ bỏ dấu tiếng Việt (`app/utils/text-search.ts`)
 * ============================================================
 *
 * Vì sao cần: ô tìm trong bộ lọc loại tài sản và phòng ban dựa hết vào mấy hàm này. Người dùng
 * gõ "ghe" mà không ra "Ghế", hoặc gõ "da nang" mà không ra "Đà Nẵng", thì họ kết luận là ô tìm
 * hỏng chứ không nghĩ ra là phải gõ đủ dấu. Chữ đ là chỗ dễ quên nhất vì Unicode không tách nó
 * thành d cộng dấu, nên NFD một mình không xử lý được.
 *
 * Ký hiệu: [EDGE] trường hợp biên
 * ============================================================
 */

import { describe, expect, it } from 'vitest';
import { matchesSearch, removeDiacritics, searchKey } from '~/utils/text-search';

describe('removeDiacritics', () => {
	it('bỏ dấu mà giữ nguyên hoa thường', () => {
		expect(removeDiacritics('Đà Nẵng')).toBe('Da Nang');
		expect(removeDiacritics('Ghế làm việc')).toBe('Ghe lam viec');
		expect(removeDiacritics('Thu chi hộ')).toBe('Thu chi ho');
	});

	it('đổi cả đ thường và Đ hoa', () => {
		expect(removeDiacritics('đồng đội')).toBe('dong doi');
		expect(removeDiacritics('ĐIỆN TỬ')).toBe('DIEN TU');
	});

	it('[EDGE] chữ đã viết dạng tách sẵn (NFD) cũng ra cùng kết quả', () => {
		expect(removeDiacritics('Ghế'.normalize('NFD'))).toBe('Ghe');
	});

	it('[EDGE] chuỗi rỗng và chuỗi không dấu giữ nguyên', () => {
		expect(removeDiacritics('')).toBe('');
		expect(removeDiacritics('Laptop Dell 14')).toBe('Laptop Dell 14');
	});
});

describe('searchKey', () => {
	it('bỏ dấu, bỏ hoa thường và cắt khoảng trắng hai đầu', () => {
		expect(searchKey('  Máy Tính  ')).toBe('may tinh');
	});
});

describe('matchesSearch', () => {
	it('gõ không dấu vẫn ra nhãn có dấu', () => {
		expect(matchesSearch('Nội thất văn phòng → Ghế', 'ghe')).toBe(true);
		expect(matchesSearch('Phòng Thu chi hộ', 'thu chi')).toBe(true);
	});

	it('gõ đủ dấu cũng khớp', () => {
		expect(matchesSearch('Máy tính → Laptop', 'Máy tính')).toBe(true);
	});

	it('không khớp thì trả về false', () => {
		expect(matchesSearch('Nội thất văn phòng → Ghế', 'zzz')).toBe(false);
	});

	it('khớp ở giữa nhãn, không chỉ ở đầu', () => {
		expect(matchesSearch('Nội thất văn phòng → Ghế làm việc', 'lam viec')).toBe(true);
	});

	it('[EDGE] từ khoá rỗng hoặc chỉ có khoảng trắng thì coi như khớp mọi nhãn', () => {
		expect(matchesSearch('Bất kỳ', '')).toBe(true);
		expect(matchesSearch('Bất kỳ', '   ')).toBe(true);
	});

	it('[EDGE] gõ chữ d tìm được nhãn có chữ đ', () => {
		expect(matchesSearch('Đồ dùng văn phòng', 'do dung')).toBe(true);
	});
});
