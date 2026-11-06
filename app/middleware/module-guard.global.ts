// Chặn vào thẳng màn hình của module đã tắt. Chạy sau `auth.global.ts` (alphabet order); quyền đã
// được nạp trong auth plugin (await fetchMe). Chưa nạp được thì danh sách rỗng, `canUse` trả true nên
// không chặn: BE vẫn là nơi chặn thật. Chỉ chế độ xem (`READ_ONLY`) thì vẫn vào được.
import { isManagementRole } from '~/utils/role';

export default defineNuxtRouteMiddleware(to => {
	const authStore = useAuthStore();
	if (!authStore.isAuthenticated || !authStore.user) return;

	const { canUse, moduleEntitlement, moduleOfPath } = useModuleAccess();
	const code = moduleOfPath(to.path);
	if (!code || canUse(code)) return;

	useToast().warning(`${moduleEntitlement(code)?.label ?? 'Tính năng này'} chưa được mở cho công ty này`);

	const effectiveRole = useUiStore().previewRole ?? authStore.user.role;
	return navigateTo(isManagementRole(effectiveRole) ? '/management' : '/', { replace: true });
});
