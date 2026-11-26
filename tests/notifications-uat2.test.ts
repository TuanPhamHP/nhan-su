/**
 * Thông báo Công việc sau thử nghiệm người dùng (phần 2, 27/11/2026): biểu tượng các loại mới, phiếu xin dời hạn
 * duyệt ngay trong chuông, tin gom quá hạn của trưởng phòng mở Việc của phòng, và đuôi truy vết của trợ lý AI không
 * lọt ra thân thông báo.
 */
import { describe, expect, it } from 'vitest';
import { isTaskDueRequestAction, notificationBodyText, notificationIcon } from '~/utils/notification-display';
import { resolveNotificationRoute } from '~/utils/notification-route';

describe('Thông báo phiếu xin dời hạn', () => {
	const payload = {
		label: 'Xin dời hạn việc HQ-5 của Đỗ Minh Đức',
		refId: 5,
		refType: 'task_due_request',
		approveEndpoint: '/v1/tasks/5/due-requests/5/approve',
		rejectEndpoint: '/v1/tasks/5/due-requests/5/reject',
	};

	it('TASK_DUE_REQUESTED có actionPayload refType task_due_request thì duyệt nhanh được', () => {
		expect(isTaskDueRequestAction({ actionType: 'APPROVE_REJECT', actionPayload: payload })).toBe(true);
	});

	it('[EDGE] phiếu đề xuất hay tin chỉ xem thì không đi đường xin dời hạn', () => {
		expect(isTaskDueRequestAction({ actionType: 'APPROVE_REJECT', actionPayload: { ...payload, refType: 'general_request' } })).toBe(false);
		expect(isTaskDueRequestAction({ actionType: 'NAVIGATE_ONLY', actionPayload: null })).toBe(false);
	});
});

describe('Biểu tượng theo loại', () => {
	it('các loại Công việc mới có biểu tượng và tên riêng', () => {
		expect(notificationIcon({ type: 'TASK_DUE_REQUESTED', category: 'TASK' }).label).toBe('Xin dời hạn');
		expect(notificationIcon({ type: 'TASK_WITHDRAWN', category: 'TASK' }).label).toBe('Rút lại báo xong');
		expect(notificationIcon({ type: 'TASK_UNASSIGNED', category: 'TASK' }).label).toBe('Đổi người làm');
		expect(notificationIcon({ type: 'TASK_WATCHED_UPDATED', category: 'TASK' }).label).toBe('Việc bạn theo dõi');
		expect(notificationIcon({ type: 'TASK_DUE_REQUEST_DECIDED', category: 'TASK' }).label).toBe('Kết quả xin dời hạn');
		expect(notificationIcon({ type: 'KPI_REVIEW_PENDING_FINAL', category: 'TASK' }).label).toBe('Phiếu KPI chờ chốt');
	});

	it('loại khác vẫn theo category như trước', () => {
		expect(notificationIcon({ type: 'TASK_ASSIGNED', category: 'TASK' }).label).toBe('Công việc');
		expect(notificationIcon({ type: 'KPI_PUBLISHED', category: 'TASK' }).label).toBe('KPI');
		expect(notificationIcon({ type: 'LEAVE_CREATED', category: 'LEAVE' }).label).toBe('Xin nghỉ');
		expect(notificationIcon({ type: 'TEST', category: 'EVENT' }).label).toBe('Thông báo');
	});
});

describe('Tin gom quá hạn của trưởng phòng', () => {
	it('refType task_department mở Việc của phòng đúng phòng, lọc quá hạn', () => {
		expect(resolveNotificationRoute('task_department', 1, 'MANAGER', 'TASK_OVERDUE')).toBe('/cong-viec/phong?departmentId=1&due=overdue');
		expect(resolveNotificationRoute('task_department', 1, 'EMPLOYEE', 'TASK_OVERDUE')).toBe('/cong-viec/phong?departmentId=1&due=overdue');
	});

	it('[EDGE] thiếu refId vẫn mở trang lọc quá hạn', () => {
		expect(resolveNotificationRoute('task_department', null, 'MANAGER', 'TASK_OVERDUE')).toBe('/cong-viec/phong?due=overdue');
	});
});

describe('Đuôi truy vết của trợ lý AI trong thân thông báo', () => {
	it('thay đuôi bằng chữ ngắn, giữ câu phía sau (thân thật từ sandbox)', () => {
		const body =
			'Đỗ Minh Đức xin dời hạn việc "Liên hệ hãng tàu lấy lệnh giao hàng" từ 25/11/2026 sang 28/11/2026. Lý do: Hãng tàu chưa trả lệnh giao hàng\n\n⟦Trợ lý AI⟧ Soạn qua Trợ lý AI · Đỗ Minh Đức xác nhận lúc 27/11/2026 00:42. Bạn duyệt thì hạn đổi ngay, từ chối thì hạn giữ nguyên.';
		const text = notificationBodyText(body);
		expect(text).not.toContain('⟦');
		expect(text).toBe(
			'Đỗ Minh Đức xin dời hạn việc "Liên hệ hãng tàu lấy lệnh giao hàng" từ 25/11/2026 sang 28/11/2026. Lý do: Hãng tàu chưa trả lệnh giao hàng (soạn qua Trợ lý AI). Bạn duyệt thì hạn đổi ngay, từ chối thì hạn giữ nguyên.',
		);
	});

	it('[EDGE] thân không có đuôi thì giữ nguyên; thân rỗng thành chuỗi rỗng', () => {
		expect(notificationBodyText('Việc HQ-1 cần bạn nghiệm thu.')).toBe('Việc HQ-1 cần bạn nghiệm thu.');
		expect(notificationBodyText(null)).toBe('');
	});
});
