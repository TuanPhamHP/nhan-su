import type { UserRole } from '~/types/auth.types';

function isManagement(role: UserRole): boolean {
	return role === 'ADMIN' || role === 'HR' || role === 'MANAGER' || role === 'CHIEF';
}

/**
 * Resolves the in-app navigation route for a notification based on refType, refId, and
 * the current user's role. Returns null if navigation is not applicable.
 *
 * Route table:
 * | refType              | Management (ADMIN/HR/MANAGER/CHIEF) | EMPLOYEE                    |
 * |----------------------|-------------------------------------|-----------------------------|
 * | violation_request    | /violations?open_id=:id             | /violations?open_id=:id     |
 * | leave_request        | /leave?open_id=:id                  | /users/leave-requests       |
 * | overtime_request     | /overtime?open_id=:id               | /overtime/my?open_id=:id    |
 * | online_work_request  | /online-work?open_id=:id            | /online-work/my?open_id=:id |
 * | attendance           | /attendance                         | /attendance/my              |
 *
 * Note: /violations handles both management and employee views internally via canManage.
 */
export function resolveNotificationRoute(
	refType: string | null,
	refId: number | null,
	role: UserRole,
): string | null {
	if (!refType) return null;

	const manage = isManagement(role);
	const id = refId ?? null;

	switch (refType) {
		case 'violation_request':
			return id ? `/violations?open_id=${id}` : '/violations';

		case 'leave_request':
			if (manage) return id ? `/leave?open_id=${id}` : '/leave';
			return id ? `/users/leave-requests?open_id=${id}` : '/users/leave-requests';

		case 'overtime_request':
			if (manage) return id ? `/overtime?open_id=${id}` : '/overtime';
			return id ? `/overtime/my?open_id=${id}` : '/overtime/my';

		case 'online_work_request':
			if (manage) return id ? `/online-work?open_id=${id}` : '/online-work';
			return id ? `/online-work/my?open_id=${id}` : '/online-work/my';

		case 'attendance':
			return manage ? '/attendance' : '/attendance/my';

		default:
			return null;
	}
}
