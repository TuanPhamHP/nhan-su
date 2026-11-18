import { describe, expect, it } from 'vitest';
import {
	DEFAULT_FAVICON,
	PRODUCT_NAME,
	companyInitial,
	documentTitle,
	faviconHref,
	navLabelFor,
	pageTitle,
} from '~/utils/company-branding';
import type { AppTile } from '~/types/entitlement.types';

/** Tên phân hệ do máy chủ trả; từ 17/11/2026 nhãn cấp phân hệ không còn nằm trong cấu hình web. */
const TILES: AppTile[] = [
	{
		code: 'rec',
		label: 'Tuyển dụng',
		description: 'Định biên, yêu cầu tuyển, tin tuyển dụng, kho ứng viên, phỏng vấn, offer.',
		group: 'TALENT',
		color: '#f59e0b',
		icon: 'M0 0',
		module: 'RECRUIT',
		locked: false,
		lockReason: null,
	},
];

/**
 * Nhận diện theo công ty — tiêu đề tab và favicon.
 *
 * Phần dựng ảnh nằm trong component nên không kiểm được ở đây; cái kiểm được là luật ghép chuỗi
 * và luật chọn favicon, đúng hai chỗ dễ sai mà nhìn mắt thường khó thấy.
 */
describe('tên trang', () => {
	it('dùng title trang khai nếu có', () => {
		expect(pageTitle('/management/leave', 'Nghỉ phép')).toBe('Nghỉ phép');
	});

	it('bỏ khoảng trắng hai đầu của title trang', () => {
		expect(pageTitle('/management/leave', '  Nghỉ phép  ')).toBe('Nghỉ phép');
	});

	it('trang chưa khai title thì lấy nhãn mục menu', () => {
		expect(pageTitle('/management/employees', undefined)).toBe('Nhân viên');
		expect(pageTitle('/management/assets/vendors', '')).toBe('Nhà cung cấp');
	});

	it('trang con chưa có mục menu riêng thì lấy nhãn mục cha', () => {
		expect(pageTitle('/management/employees/new', undefined)).toBe('Nhân viên');
	});

	it('mục menu khớp theo tiền tố dài nhất, không để mục ngắn cướp', () => {
		// `/management/reports` của phân hệ Phân tích cũng là tiền tố của chuỗi này nếu so lỏng.
		expect(navLabelFor('/management/assets/reports')).toBe('Báo cáo tài sản');
	});

	it('không mục nào khớp thì lùi về tên sản phẩm, không bao giờ rỗng', () => {
		expect(navLabelFor('/khong-co-trang-nay')).toBeNull();
		expect(pageTitle('/khong-co-trang-nay', undefined)).toBe(PRODUCT_NAME);
	});

	it('không mục nào khớp mà trang thuộc một phân hệ thì lấy tên phân hệ máy chủ trả', () => {
		// `/recruitment/applications/3` nằm trong phân hệ Tuyển dụng nhưng không có mục menu riêng.
		expect(navLabelFor('/recruitment/applications/3', TILES)).toBe('Tuyển dụng');
	});

	it('mục menu vẫn thắng tên phân hệ, vì nó nói đúng trang hơn', () => {
		expect(navLabelFor('/management/recruitment/jobs', TILES)).toBe('Tin tuyển dụng');
	});

	it('chưa nạp được danh mục thì chỉ mất lớp dự phòng cấp phân hệ, mục menu vẫn có tên', () => {
		expect(navLabelFor('/recruitment/applications/3')).toBeNull();
		expect(navLabelFor('/management/recruitment/jobs')).toBe('Tin tuyển dụng');
	});
});

describe('tiêu đề tab', () => {
	it('đã vào một công ty thì ghép tên công ty vào trước', () => {
		expect(documentTitle('/management/leave', 'Công ty A', 'Nghỉ phép')).toBe('Công ty A - Nghỉ phép');
	});

	it('chưa đăng nhập thì thay tên công ty bằng tên sản phẩm', () => {
		expect(documentTitle('/login', null, 'Đăng nhập')).toBe('Hệ thống nhân sự - Đăng nhập');
		expect(documentTitle('/login', '   ', 'Đăng nhập')).toBe('Hệ thống nhân sự - Đăng nhập');
	});

	it('trang của người ngoài công ty chỉ còn tên trang', () => {
		// Nhân viên công ty A mở link tin tuyển dụng của công ty B vẫn đang đăng nhập ở A: gắn
		// "Công ty A" lên tab là nói sai công ty cho ứng viên đọc.
		expect(documentTitle('/careers/ctyb', 'Công ty A', 'Tuyển dụng — Công ty B')).toBe('Tuyển dụng — Công ty B');
		expect(documentTitle('/careers/ctyb/lap-trinh-vien', 'Công ty A', 'Lập trình viên')).toBe('Lập trình viên');
		expect(documentTitle('/offer-response', 'Công ty A', 'Thư mời nhận việc')).toBe('Thư mời nhận việc');
	});

	it('tên công ty có ký tự %s cũng không làm xáo trộn chuỗi', () => {
		expect(documentTitle('/management/leave', 'Công ty %s', 'Nghỉ phép')).toBe('Công ty %s - Nghỉ phép');
	});

	it('đường dẫn trùng tiền tố nhưng khác đoạn thì không tính là trang người ngoài', () => {
		expect(documentTitle('/careers-internal', 'Công ty A', 'Nội bộ')).toBe('Công ty A - Nội bộ');
		// Màn hình tuyển dụng trong app (phỏng vấn của tôi) vẫn mang tên công ty.
		expect(documentTitle('/recruitment/my-interviews', 'Công ty A', 'Phỏng vấn của tôi')).toBe(
			'Công ty A - Phỏng vấn của tôi',
		);
	});
});

describe('favicon', () => {
	it('công ty có favicon thì dùng nguyên URL, giữ cả tham số phiên bản', () => {
		const url = 'http://api.local/v1/public/companies/ctya/favicon?v=3';
		expect(faviconHref('/management/leave', url)).toBe(url);
	});

	it('công ty chưa có favicon thì dùng của app', () => {
		expect(faviconHref('/management/leave', null)).toBe(DEFAULT_FAVICON);
		expect(faviconHref('/management/leave', '  ')).toBe(DEFAULT_FAVICON);
	});

	it('trang của người ngoài công ty không mang favicon của phiên đang mở', () => {
		expect(faviconHref('/careers/ctyb', 'http://api.local/v1/public/companies/ctya/favicon?v=3')).toBe(
			DEFAULT_FAVICON,
		);
	});
});

describe('chữ cái dự phòng', () => {
	it('lấy chữ đầu của từ cuối, không phải của "Công ty"', () => {
		expect(companyInitial('Công ty cổ phần Sông Hồng')).toBe('H');
		expect(companyInitial('Bến Thành')).toBe('T');
	});

	it('tên rỗng thì ra dấu hỏi chứ không ra chuỗi rỗng', () => {
		expect(companyInitial('   ')).toBe('?');
	});
});
