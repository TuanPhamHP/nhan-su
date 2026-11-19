import { describe, expect, it } from 'vitest';
import { resolveNotificationRoute } from '~/utils/notification-route';
import type { NotificationResponse, NotificationType } from '~/types/notification.types';

/**
 * Hai loại thông báo khi người vận hành chuyển nhân viên giữa hai công ty
 * (`docs/backend/bridges/notifications.md`, dòng refType `employee`).
 *
 * Việc chuyển người chỉ làm ở control plane nên `nhan-su` không có màn hình nào để bấm thử
 * đường đi này, và hai loại trên cũng không nằm trong nhóm nào mà bài kiểm khác đã che. Bản ghi
 * dưới đây chép đúng hình dạng máy chủ sandbox trả về ngày 17/11/2026, nên nếu BE đổi `refType`
 * hay `targetUrl` thì bài kiểm này đỏ ngay chứ không chờ tới lúc người dùng bấm vào trang trắng.
 */
const noti = (type: NotificationType, refId: number, targetUrl: string): NotificationResponse => ({
	id: 1,
	// Máy chủ bỏ tiền tố emoji `📌` ngày 19/11/2026; bản ghi mẫu chép theo bản mới.
	title: 'Thông tin: Nhân viên chuyển tới',
	body: 'Người Một (BETA-0002) được chuyển tới từ một công ty khác trong hệ thống.',
	category: 'EVENT',
	type,
	refId,
	refType: 'employee',
	isRead: false,
	createdAt: '2026-11-17T02:00:00.000Z',
	targetUrl,
	actionType: 'NAVIGATE_ONLY',
	actionPayload: null,
});

const SANDBOX: NotificationResponse[] = [
	noti('EMPLOYEE_TRANSFERRED_IN', 3, '/management/employees/3'),
	noti('EMPLOYEE_TRANSFERRED_OUT', 2, '/management/employees/2'),
];

describe('Thông báo chuyển nhân viên giữa hai công ty', () => {
	it('bảng định tuyến của FE trùng với targetUrl máy chủ dựng', () => {
		// Hai đường đi cùng tồn tại: chuông bấm theo bảng `resolveNotificationRoute`, còn
		// `targetUrl` là đường dự phòng. Lệch nhau một chữ là hai cú bấm vào hai trang khác nhau.
		for (const n of SANDBOX) {
			expect(resolveNotificationRoute(n.refType, n.refId, 'HR', n.type)).toBe(n.targetUrl);
			expect(resolveNotificationRoute(n.refType, n.refId, 'ADMIN', n.type)).toBe(n.targetUrl);
		}
	});

	it('không rơi vào nhánh mặc định, tức là luôn có trang để mở', () => {
		for (const n of SANDBOX) {
			expect(resolveNotificationRoute(n.refType, n.refId, 'HR', n.type)).not.toBeNull();
		}
	});

	it('refId là hồ sơ ở chính công ty đang mở nên hai loại dùng chung một dạng đường dẫn', () => {
		// Thông báo cố ý không nêu tên công ty kia, và `refId` luôn là id hồ sơ ở công ty đang
		// mở: công ty nhận trỏ tới hồ sơ mới, công ty cũ trỏ tới hồ sơ cũ còn chờ cho nghỉ.
		expect(resolveNotificationRoute('employee', 4, 'HR', 'EMPLOYEE_TRANSFERRED_IN')).toBe('/management/employees/4');
		expect(resolveNotificationRoute('employee', 4, 'HR', 'EMPLOYEE_TRANSFERRED_OUT')).toBe('/management/employees/4');
	});

	it('thiếu refId thì về danh sách nhân viên, không phải null', () => {
		expect(resolveNotificationRoute('employee', null, 'ADMIN', 'EMPLOYEE_TRANSFERRED_IN')).toBe(
			'/management/employees',
		);
	});
});
