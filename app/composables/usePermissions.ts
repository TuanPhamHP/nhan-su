import { storeToRefs } from 'pinia';
import { useAuthStore } from '~/stores/auth';

/**
 * Kiểm tra quyền của user hiện tại theo `<module>:<action>`.
 *
 * hasPermission(input):
 *   null       → true  (bỏ qua kiểm tra, auto pass)
 *   string     → true nếu user có đúng quyền này
 *   string[]   → true nếu user có ít nhất 1 quyền trong mảng, false nếu không có quyền nào
 *   ADMIN      → luôn true (bypass giống `permissions.guard.ts` bên backend)
 *
 * Nguồn `permissions` = `authStore.permissions`, populate qua `/v1/auth/me`.
 */
export function usePermissions() {
	const store = useAuthStore();
	const { user, permissions } = storeToRefs(store);

	const isAdmin = computed(() => user.value?.role === 'ADMIN');

	function hasPermission(input: string | string[] | null): boolean {
		if (input === null) return true;
		if (isAdmin.value) return true;
		if (typeof input === 'string') return permissions.value.includes(input);
		return input.some(code => permissions.value.includes(code));
	}

	/**
	 * Gate button "Duyệt / Từ chối" — mirror logic authorization của backend:
	 *   1. ADMIN                                  → OK (super-approver)
	 *   2. là approver được assign trong workflow → OK
	 *   3. có permission `<module>:approve`       → OK (override, duyệt được mọi đơn)
	 *   4. còn lại                                → ẩn button
	 *
	 * @param assignedApproverId id approver được assign (hoặc mảng id cho đơn nhiều cấp).
	 *                           `null` khi đơn không có approver cụ thể → chỉ check permission.
	 * @param permissionCode     code trong `APPROVE_PERMISSIONS`.
	 */
	function canApprove(
		assignedApproverId: number | number[] | null | undefined,
		permissionCode: string,
	): boolean {
		if (!user.value) return false;
		if (isAdmin.value) return true;
		if (Array.isArray(assignedApproverId)) {
			if (assignedApproverId.includes(user.value.id)) return true;
		} else if (assignedApproverId != null && assignedApproverId === user.value.id) {
			return true;
		}
		return hasPermission(permissionCode);
	}

	/** True khi user duyệt được ít nhất 1 loại đơn — dùng cho menu "Duyệt đơn". */
	const canApproveAny = computed(() => hasPermission(ALL_APPROVE_PERMISSIONS));

	return { permissions, isAdmin, hasPermission, canApprove, canApproveAny };
}
