// Chặn user truy cập trực tiếp qua URL các module quản lý mà họ không có quyền.
// Chạy sau `auth.global.ts` (alphabet order) — permissions đã được load trong
// auth plugin (await fetchMe → await loadPermissions) trước khi middleware chạy.
//
// Convention: mỗi entry map từ URL prefix → permission cần thiết.
// - Chuỗi = phải có đúng quyền đó; mảng = có ít nhất 1 quyền trong list.
// - Match theo longest-prefix wins → cho phép entry cụ thể (VD `/x/new`) override entry base (`/x`).

const ROUTE_PERMISSIONS: Array<{ prefix: string; permission: string | string[] }> = [
	// Đặt route CỤ THỂ (dài hơn) TRƯỚC route BASE để dễ đọc — logic match dùng longest-wins.
	{ prefix: '/management/departments/new', permission: 'department:create' },
	{ prefix: '/management/employees/new', permission: 'employee:create' },
	{ prefix: '/management/departments', permission: 'department:read' },
	{ prefix: '/management/employees', permission: 'employee:read' },
	{ prefix: '/management/approval', permission: ALL_APPROVE_PERMISSIONS },
	{ prefix: '/management/attendance', permission: 'attendance:read' },
	{ prefix: '/management/leave', permission: 'leave:read' },
	{ prefix: '/management/overtime', permission: 'overtime:read' },
	{ prefix: '/management/online-work', permission: 'online-work:read' },
	{ prefix: '/management/violations', permission: 'violation:read' },
	{ prefix: '/management/makeup-attendance', permission: 'makeup:read' },
	{ prefix: '/management/business-trips', permission: 'business-trip:read' },
	{ prefix: '/management/reports', permission: 'report:read' },
];

export default defineNuxtRouteMiddleware(to => {
	const authStore = useAuthStore();
	if (!authStore.isAuthenticated || !authStore.user) return;

	const { permissions, hasPermission } = usePermissions();

	// `loadPermissions()` fail silently → mảng rỗng. Không khoá cứng user ra khỏi
	// toàn bộ app vì một request lỗi: backend vẫn là source of truth (403 nếu thiếu quyền).
	if (permissions.value.length === 0) return;

	// Longest-prefix wins — tránh `/x/new` bị `/x` "nuốt" match trước.
	const matched = ROUTE_PERMISSIONS
		.filter(r => to.path === r.prefix || to.path.startsWith(r.prefix + '/'))
		.sort((a, b) => b.prefix.length - a.prefix.length)[0];

	if (!matched) return;
	if (hasPermission(matched.permission)) return;

	if (import.meta.client) {
		const toast = useToast();
		toast.error('Bạn không có quyền truy cập trang này');
	}
	return navigateTo('/management', { replace: true });
});
