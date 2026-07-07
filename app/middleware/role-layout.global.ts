import { isEmployeeRole, isManagementRole } from '~/utils/role';

export default defineNuxtRouteMiddleware(to => {
	const authStore = useAuthStore();
	const uiStore = useUiStore();

	if (!authStore.isAuthenticated || !authStore.user) return;

	const role = authStore.user.role;
	const isManagementPath = to.path === '/management' || to.path.startsWith('/management/');

	if (isManagementPath) {
		// Block employees from /management/** entirely
		if (isEmployeeRole(role)) return navigateTo('/', { replace: true });
		setPageLayout('default');
		return;
	}

	// For root-level paths: use effectiveRole (supports "view as" preview)
	const effectiveRole = uiStore.previewRole ?? role;

	// Management users (not in employee preview) visiting "/" go straight to /management
	if (to.path === '/' && isManagementRole(effectiveRole)) {
		return navigateTo('/management', { replace: true });
	}

	setPageLayout(isManagementRole(effectiveRole) ? 'default' : 'employee');
});
