import type { UserRole } from '~/types/auth.types';
import { isManagementRole } from '~/utils/role';

/**
 * Resolves the in-app navigation route for a notification based on refType, refId, and
 * an effective role. Returns null if navigation is not applicable.
 *
 * `role` should be the *effective* role that reflects the UI the user is currently in
 * (`uiStore.previewRole ?? user.role`), NOT the raw user.role — so that a management
 * user previewing the employee interface stays on employee pages when clicking a
 * notification.
 *
 * Route table:
 * | refType              | Management (mọi role !== EMPLOYEE)       | EMPLOYEE                          |
 * |----------------------|------------------------------------------|-----------------------------------|
 * | violation_request    | /management/violations?open_id=:id       | /violations/my                    |
 * | leave_request        | /management/leave?open_id=:id            | /users/leave-requests?open_id=:id |
 * | overtime_request     | /management/overtime?open_id=:id         | /overtime/my?open_id=:id          |
 * | online_work_request  | /management/online-work?open_id=:id      | /online-work/my?open_id=:id       |
 * | attendance           | /management/attendance                   | /attendance/my                    |
 * | makeup_attendance_request | /management/makeup-attendance?open_id=:id | /makeup-attendance/my?open_id=:id |
 * | business_trip        | /business-trips/:id (trang chi tiết dùng chung) | /business-trips/:id        |
 * | company_announcement | /management/announcements/:id (HR/ADMIN) | /announcements/:id (các role còn lại) |
 *
 * Module tài sản không rẽ theo vai trò — BE chọn sẵn refType cho từng người nhận:
 * | asset_holding   | /assets/my                            |
 * | asset_service   | /assets/my?tab=services&open_id=:id   |
 * | asset           | /management/assets/:id                |
 * | employee_assets | /management/employees/:id?tab=assets  |
 *
 * Module tuyển dụng cũng không rẽ theo vai trò — BE chọn sẵn refType `recruitment_my_*` cho
 * người nhận là thành viên hội đồng (xem `docs/backend/bridges/recruitment.md` mục Thông báo):
 * | recruitment_requisition   | /management/recruitment/requisitions/:id |
 * | recruitment_offer         | /management/recruitment/offers/:id       |
 * | recruitment_job           | /management/recruitment/jobs/:id         |
 * | recruitment_candidate     | /management/recruitment/candidates/:id   |
 * | recruitment_headcount     | /management/recruitment/headcount?year=:refId |
 * | recruitment_my_job        | /recruitment/jobs/:id                    |
 * | recruitment_my_application| /recruitment/applications/:id            |
 * | recruitment_my_interviews | /recruitment/my-interviews               |
 * | employee                  | /management/employees/:id                |
 */
export function resolveNotificationRoute(refType: string | null, refId: number | null, role: UserRole): string | null {
	if (!refType) return null;

	const manage = isManagementRole(role);
	const id = refId ?? null;

	switch (refType) {
		case 'violation_request':
			if (manage) return id ? `/management/violations?open_id=${id}` : '/management/violations';
			return '/violations/my';

		case 'leave_request':
			if (manage) return id ? `/management/leave?open_id=${id}` : '/management/leave';
			return id ? `/users/leave-requests?open_id=${id}` : '/users/leave-requests';

		case 'overtime_request':
			if (manage) return id ? `/management/overtime?open_id=${id}` : '/management/overtime';
			return id ? `/overtime/my?open_id=${id}` : '/overtime/my';

		case 'online_work_request':
			if (manage) return id ? `/management/online-work?open_id=${id}` : '/management/online-work';
			return id ? `/online-work/my?open_id=${id}` : '/online-work/my';

		case 'attendance':
		case 'attendance_record':
			return manage ? '/management/attendance' : '/attendance/my';

		case 'makeup_attendance_request':
			if (manage) return id ? `/management/makeup-attendance?open_id=${id}` : '/management/makeup-attendance';
			return id ? `/makeup-attendance/my?open_id=${id}` : '/makeup-attendance/my';

		case 'business_trip':
			// Chi tiết đơn công tác chỉ có MỘT trang dùng chung `/business-trips/:id`
			// (trang quản lý cũng `router.push` về đây), nên hai nhánh role chỉ khác nhau
			// ở trang danh sách khi notification không mang refId.
			if (id) return `/business-trips/${id}`;
			return manage ? '/management/business-trips' : '/business-trips';

		case 'general_request':
			return id ? `/general-requests/${id}` : '/general-requests';

		// Bốn refType của module tài sản. BE đã chọn sẵn refType theo từng người nhận
		// (`docs/backend/bridges/assets.md` mục 9) nên ở đây KHÔNG rẽ theo vai trò: người
		// phụ trách dịch vụ thường là EMPLOYEE, vào trang quản lý không được, và đó đúng
		// là lý do `asset_service` tồn tại.
		case 'asset_holding':
			return '/assets/my';

		case 'asset_service':
			return id ? `/assets/my?tab=services&open_id=${id}` : '/assets/my?tab=services';

		case 'asset':
			return id ? `/management/assets/${id}` : '/management/assets';

		case 'employee_assets':
			return id ? `/management/employees/${id}?tab=assets` : '/management/employees';

		// Tám refType của module tuyển dụng. Giống module tài sản, BE đã chọn refType theo
		// từng người nhận nên ở đây KHÔNG rẽ theo vai trò: thành viên hội đồng thường là
		// EMPLOYEE, không vào được `/management/**`, và đó đúng là lý do nhóm `recruitment_my_*`
		// tồn tại.
		case 'recruitment_requisition':
			return id ? `/management/recruitment/requisitions/${id}` : '/management/recruitment/requisitions';

		case 'recruitment_offer':
			return id ? `/management/recruitment/offers/${id}` : '/management/recruitment/offers';

		case 'recruitment_job':
			return id ? `/management/recruitment/jobs/${id}` : '/management/recruitment/jobs';

		case 'recruitment_candidate':
			return id ? `/management/recruitment/candidates/${id}` : '/management/recruitment/candidates';

		// `refId` của loại này là NĂM, không phải id bản ghi (bridge doc mục Thông báo).
		case 'recruitment_headcount':
			return id ? `/management/recruitment/headcount?year=${id}` : '/management/recruitment/headcount';

		case 'recruitment_my_job':
			return id ? `/recruitment/jobs/${id}` : '/recruitment/my-interviews';

		case 'recruitment_my_application':
			return id ? `/recruitment/applications/${id}` : '/recruitment/my-interviews';

		case 'recruitment_my_interviews':
			return '/recruitment/my-interviews';

		// N-08 "có nhân viên mới" gửi cho trưởng phòng và HR, nên luôn là trang quản lý.
		case 'employee':
			return id ? `/management/employees/${id}` : '/management/employees';

		case 'company_announcement': {
			// Chỉ HR/ADMIN có quyền vào trang quản lý; các role còn lại (MANAGER, CHIEF,
			// DIRECTOR, EMPLOYEE) đều là "reader" nên navigate về trang employee.
			const isHrAdmin = role === 'ADMIN' || role === 'HR';
			if (!id) return isHrAdmin ? '/management/announcements' : '/announcements';
			return isHrAdmin ? `/management/announcements/${id}` : `/announcements/${id}`;
		}

		default:
			return null;
	}
}
