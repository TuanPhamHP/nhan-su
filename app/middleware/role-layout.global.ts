import { isEmployeeRole, isManagementRole } from '~/utils/role';

export default defineNuxtRouteMiddleware(to => {
	const authStore = useAuthStore();
	const uiStore = useUiStore();

	if (!authStore.isAuthenticated || !authStore.user) return;

	// Trang nhận lời mời mở được cả khi đang đăng nhập (xem auth.global.ts), giữ layout `auth`.
	if (to.path === '/accept-invite') return;

	/**
	 * Trang tuyển dụng công khai và trang phản hồi offer là màn hình dành cho ỨNG VIÊN, không
	 * phải màn hình trong app. Người quản lý đang đăng nhập mở link vẫn phải thấy đúng trang đó,
	 * nên không gán layout: hai trang tự khai `layout: false`. Thiếu nhánh này thì `setPageLayout`
	 * bên dưới bọc sidebar quản trị quanh trang tuyển dụng.
	 */
	if (to.path === '/offer-response' || to.path === '/careers' || to.path.startsWith('/careers/')) return;

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
