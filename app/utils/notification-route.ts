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
 * | company_announcement | /management/announcements/:id (HR/ADMIN) | /announcements/:id (các role còn lại) |
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

		case 'general_request':
			return id ? `/general-requests/${id}` : '/general-requests';

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
