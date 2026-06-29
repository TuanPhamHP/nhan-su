import type { UserRole } from '~/types/auth.types';

function isManagement(role: UserRole): boolean {
	return role === 'ADMIN' || role === 'HR' || role === 'MANAGER' || role === 'CHIEF';
}

/**
 * Resolves the in-app navigation route for a notification based on refType, refId, and
 * the current user's role. Returns null if navigation is not applicable.
 *
 * Route table:
 * | refType              | Management (ADMIN/HR/MANAGER/CHIEF)      | EMPLOYEE                          |
 * |----------------------|------------------------------------------|-----------------------------------|
 * | violation_request    | /management/violations?open_id=:id       | /violations/my                    |
 * | leave_request        | /management/leave?open_id=:id            | /users/leave-requests?open_id=:id |
 * | overtime_request     | /management/overtime?open_id=:id         | /overtime/my?open_id=:id          |
 * | online_work_request  | /management/online-work?open_id=:id      | /online-work/my?open_id=:id       |
 * | attendance           | /management/attendance                   | /attendance/my                    |
 */
export function resolveNotificationRoute(refType: string | null, refId: number | null, role: UserRole): string | null {
	if (!refType) return null;

	const manage = isManagement(role);
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

		case 'general_request':
			return id ? `/general-requests/${id}` : '/general-requests';

		default:
			return null;
	}
}
