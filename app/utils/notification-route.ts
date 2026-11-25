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
 * | asset_holding     | /assets/my?asset_id=:id (refId là id tài sản; trang cuộn tới thẻ đó) |
 * | asset_service     | /assets/my?tab=services&open_id=:id            |
 * | asset             | /management/assets/:id                         |
 * | employee_assets   | /management/employees/:id?tab=assets           |
 * | asset_incident    | /management/assets/incidents?open_id=:id       |
 * | asset_my_incident | /assets/my?incident_id=:id (refId là id BÁO CÁO, không phải id tài sản) |
 * | asset_disposal    | /management/assets/disposals/:id (lô 2b, refId là id phiếu thanh lý) |
 *
 * Loại thông báo thêm sau bài nhập vai (14/11) đi theo các refType trên, không cần nhánh riêng:
 * `ASSET_LOST` (asset_holding cho người giữ, asset cho quản lý trực tiếp),
 * `ASSET_INCIDENT_HANDLED` (asset_my_incident), `ASSET_DISPUTE_RESOLVED` (asset_holding),
 * `ASSET_RENEWED` (asset_service), `ASSET_REPAIR_OPENED` (asset_holding).
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
 *
 * Lô 3a hồ sơ nhân sự cũng không rẽ theo vai trò, vì BE chọn refType theo người nhận:
 * | profile_change_request    | /management/approval?tab=profileChanges&id=:id |
 * | my_profile_change_request | /profile?tab=requests&id=:id                   |
 * | my_profile                | /profile (không có refId)                      |
 *
 * Lô 4a phê duyệt điện tử cũng không rẽ theo vai trò, vì phiếu đề xuất dùng một trang chung
 * cho cả người gửi và người duyệt:
 * | general_request           | /general-requests?id=:id                       |
 * | (APPROVER_REASSIGNED, không có refType) | /general-requests?tab=pending    |
 *
 * Lô 1 Hành chính văn phòng (module `OFFICE`) cũng không rẽ theo vai trò: phiếu văn phòng phẩm
 * và lượt đặt phòng là trang dùng chung của mọi nhân viên, còn `office_supply_period` chỉ gửi cho
 * người có `office:supply:manage` nên luôn mở trang quản lý:
 * | office_supply_request     | /office/supplies?request_id=:id                |
 * | office_supply_period      | /management/office/supply-periods/:id          |
 * | office_room_booking       | /office/rooms?booking_id=:id                   |
 *
 * Công việc lô 1 (module `TASKS`) không rẽ theo vai trò: mọi người nhận mở cùng trang chi tiết việc.
 * | task                      | /cong-viec/:refId (trang nhận cả id số lẫn số hiệu) |
 */
/**
 * Tab cần mở ở trang chi tiết tài sản theo loại thông báo, để người bấm thấy ngay việc cần làm
 * thay vì tab Thông tin: người nhận báo chưa đúng thì sang tab Người dùng (có nút Trả lời), việc
 * về phiếu sửa, bảo dưỡng thì sang tab Sửa chữa, bảo dưỡng.
 */
const ASSET_TYPE_TAB: Record<string, string> = {
	ASSET_ASSIGNMENT_DISPUTED: 'holders',
	ASSET_MAINTENANCE_DUE: 'maintenances',
	ASSET_REPAIR_DONE: 'maintenances',
};

export function resolveNotificationRoute(
	refType: string | null,
	refId: number | null,
	role: UserRole,
	/** Loại thông báo, chỉ dùng để chọn tab ở trang chi tiết tài sản. */
	type?: string | null,
): string | null {
	// Uỷ quyền duyệt (lô 4a) gửi thông báo không mang `refType` lẫn `refId`, vì việc cần làm là
	// cả hộp "Chờ tôi duyệt" chứ không phải một phiếu: người được uỷ quyền nhận luôn mọi lượt
	// của người vắng trong khoảng ngày. Phải xét trước nhánh `!refType` phía dưới.
	if (type === 'APPROVER_REASSIGNED' && !refType) return '/general-requests?tab=pending';

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

		// Chín loại thông báo `GENERAL_REQUEST_*` của lô 4a đều về đây và cũng không rẽ theo vai
		// trò: phiếu đề xuất là trang dùng chung, nhân viên gửi phiếu cũng mở đúng trang này.
		// Mở bằng `?id=` để trang danh sách chọn sẵn tab theo phiếu rồi mới mở chi tiết, giống
		// `targetUrl` máy chủ dựng; vào thẳng `/general-requests/:id` thì bấm quay lại là mất tab.
		case 'general_request':
			return id ? `/general-requests?id=${id}` : '/general-requests';

		// Năm refType của module tài sản. BE đã chọn sẵn refType theo từng người nhận
		// (`docs/backend/bridges/assets.md` mục 9) nên ở đây KHÔNG rẽ theo vai trò: người
		// phụ trách dịch vụ thường là EMPLOYEE, vào trang quản lý không được, và đó đúng
		// là lý do `asset_service` tồn tại.
		// refId là id tài sản: trang "Tài sản của tôi" cuộn tới đúng thẻ thay vì để người dùng tự tìm.
		case 'asset_holding':
			return id ? `/assets/my?asset_id=${id}` : '/assets/my';

		// Kết quả xử lý báo hỏng, báo mất của chính mình (N-14): refId là id báo cáo.
		case 'asset_my_incident':
			return id ? `/assets/my?incident_id=${id}` : '/assets/my';

		case 'asset_service':
			return id ? `/assets/my?tab=services&open_id=${id}` : '/assets/my?tab=services';

		case 'asset': {
			if (!id) return '/management/assets';
			const tab = type ? ASSET_TYPE_TAB[type] : undefined;
			return tab ? `/management/assets/${id}?tab=${tab}` : `/management/assets/${id}`;
		}

		case 'employee_assets':
			return id ? `/management/employees/${id}?tab=assets` : '/management/employees';

		// N-06: người nhận là người quản lý tài sản và quản lý trực tiếp của người báo, đều
		// là vai trò quản lý, nên luôn về trang Báo hỏng, báo mất.
		case 'asset_incident':
			return id
				? `/management/assets/incidents?open_id=${id}`
				: '/management/assets/incidents';

		// N-10 (lô 2b): người duyệt nhận "phiếu chờ duyệt", người lập nhận kết quả; cả hai đều là
		// vai trò quản lý và đều mở trang phiếu, vì duyệt phải xem danh sách tài sản và đúng vòng gửi.
		case 'asset_disposal':
			return id ? `/management/assets/disposals/${id}` : '/management/assets/disposals';

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

		// Lô 3a hồ sơ nhân sự. BE chọn refType theo từng người nhận nên ở đây không rẽ theo vai
		// trò: người gửi yêu cầu thường là EMPLOYEE và chỉ vào được trang cá nhân, còn người
		// duyệt phải so ba cột giá trị nên luôn mở trang Phê duyệt.
		case 'profile_change_request':
			return id
				? `/management/approval?tab=profileChanges&id=${id}`
				: '/management/approval?tab=profileChanges';

		case 'my_profile_change_request':
			return id ? `/profile?tab=requests&id=${id}` : '/profile?tab=requests';

		// N-03 không mang refId: người nhận chỉ cần mở hồ sơ của mình để xem chỗ vừa bị sửa.
		case 'my_profile':
			return '/profile';

		// Ba refType của lô 1 Hành chính văn phòng. Giống module Tài sản, BE đã chọn refType theo
		// từng người nhận nên ở đây KHÔNG rẽ theo vai trò: năm loại thông báo văn phòng phẩm gửi
		// cho nhân viên, trưởng phòng và đầu mối của phòng, mà cả ba đều mở đúng phiếu của phòng
		// mình ở trang dùng chung.
		// Không có refId là chuyện bình thường ở đây: HCNS huỷ kỳ thì phiếu bị xoá cùng kỳ, nên
		// `OFFICE_SUPPLY_PERIOD_CHANGED` của lần đó mở trang phiếu chung thay vì một phiếu cụ thể.
		case 'office_supply_request':
			return id ? `/office/supplies?request_id=${id}` : '/office/supplies';

		// Chỉ gửi cho người có `office:supply:manage`: việc định kỳ khoá kỳ đã qua hạn chót, và
		// `OFFICE_SUPPLY_RECEIVED` khi một phòng nhận thiếu hoặc kỳ đã nhận xong (UAT đợt B).
		case 'office_supply_period':
			return id ? `/management/office/supply-periods/${id}` : '/management/office/supply-periods';

		case 'office_room_booking':
			return id ? `/office/rooms?booking_id=${id}` : '/office/rooms';

		// Mười một loại `TASK_*`. `refId` là id việc; trang `/cong-viec/[code]` nhận cả id số, mở xong thì
		// tự đổi đường dẫn sang số hiệu. `targetUrl` máy chủ dựng sẵn cũng trỏ đúng trang này.
		case 'task':
			return id ? `/cong-viec/${id}` : '/cong-viec';

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
