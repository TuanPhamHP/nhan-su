import type { UserRole } from '~/types/auth.types';

const MANAGEMENT_ROLES: UserRole[] = ['ADMIN', 'HR', 'MANAGER', 'CHIEF'];

export default defineNuxtRouteMiddleware(to => {
	const authStore = useAuthStore();
	const uiStore = useUiStore();

	if (!authStore.isAuthenticated || !authStore.user) return;

	const role = authStore.user.role;
	const isManagementPath = to.path === '/management' || to.path.startsWith('/management/');

	if (isManagementPath) {
		// Block employees from /management/** entirely
		if (role === 'EMPLOYEE') return navigateTo('/');
		setPageLayout('default');
		return;
	}

	// For root-level paths: use effectiveRole (supports "view as" preview)
	const effectiveRole = uiStore.previewRole ?? role;
	setPageLayout(MANAGEMENT_ROLES.includes(effectiveRole) ? 'default' : 'employee');
});
