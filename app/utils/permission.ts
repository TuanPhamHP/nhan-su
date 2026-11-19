import type { UserRole } from '~/types/auth.types';

/**
 * Permission code duyệt đơn theo từng module.
 *
 * Source of truth: `docs/modules/auth/permission-master-list.md`.
 * Backend gate endpoint approve/reject bằng đúng các code này —
 * FE dùng để show/hide button "Duyệt / Từ chối", không implement lại logic approval.
 */
export const APPROVE_PERMISSIONS = {
	leave: 'leave:approve',
	overtime: 'overtime:approve',
	violation: 'violation:approve',
	makeup: 'makeup:approve',
	onlineWork: 'online-work:approve',
	businessTrip: 'business-trip:approve',
	/** Tài sản lô 2b: duyệt, từ chối phiếu thanh lý (tab "Thanh lý tài sản" của hộp thư duyệt). */
	assetDisposal: 'asset:disposal:approve',
	/** Hồ sơ nhân sự lô 3a: duyệt, từ chối yêu cầu thay đổi thông tin của nhân viên. */
	profileChange: 'employee:profile-change:approve',
} as const;

/**
 * Quyền của phiếu đề xuất (lô 4a).
 *
 * `general-request:approve` đã thôi dùng: từ lô 4a chỉ người đang giữ lượt ở bước hiện tại mới
 * duyệt được, và màn hình hiện nút theo mười lăm cờ `can*` của phiếu chứ không tự suy từ quyền.
 * Ba quyền còn lại gác những việc nằm ngoài một phiếu cụ thể, nên FE vẫn dùng để ẩn menu và
 * ẩn nút: cấu hình loại phiếu, tra cứu toàn công ty, đổi người duyệt.
 */
export const REQUEST_PERMISSIONS = {
	/** Tạo, sửa loại phiếu và lưu luồng duyệt. */
	typeManage: 'request-type:manage',
	/** Tra cứu phiếu của mọi người, không chỉ phiếu liên quan tới mình. */
	readAll: 'request:read:all',
	/** Đổi người duyệt của phiếu đang chờ (nhân sự). */
	reassign: 'request:reassign',
} as const;

/**
 * Quyền của module Hành chính văn phòng, lô 1 (`docs/backend/bridges/office.md` mục 1).
 *
 * `/office/supplies` và `/office/rooms` KHÔNG có trong bảng này vì chúng không cần quyền nào:
 * mọi nhân viên của công ty có module đều đăng ký văn phòng phẩm cho phòng mình và đặt phòng họp.
 * Bốn quyền dưới đây chỉ gác khu quản trị.
 */
export const OFFICE_PERMISSIONS = {
	/** Cài đặt: văn phòng, danh mục văn phòng phẩm, định mức, phòng họp. */
	manage: 'office:manage',
	/** Mở kỳ, chốt, cấp, phiếu bổ sung, dự trù, đơn giá, ghi đã giao. */
	supplyManage: 'office:supply:manage',
	/** Xem bảng tổng hợp kỳ và báo cáo chi phí; trưởng phòng chỉ thấy phòng mình do máy chủ lọc. */
	supplyReport: 'office:supply:report',
	/** Dời, huỷ lượt đặt phòng của người khác và thấy tiêu đề lượt riêng tư. */
	bookingManage: 'office:booking:manage',
} as const;

/**
 * Vai trò có phạm vi tài sản toàn công ty khi có `asset:read` (khớp `FULL_SCOPE_ROLES` ở BE,
 * `asset-scope.util.ts`). Trưởng phòng chỉ xem tài sản của phòng mình nên không có ở đây.
 */
export const ASSET_FULL_SCOPE_ROLES: UserRole[] = ['ADMIN', 'HR', 'DIRECTOR', 'CHIEF'];

/** Dùng cho menu "Duyệt đơn" — hiện khi user duyệt được ít nhất 1 loại đơn. */
export const ALL_APPROVE_PERMISSIONS: string[] = Object.values(APPROVE_PERMISSIONS);
