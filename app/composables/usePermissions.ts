import { storeToRefs } from 'pinia';
import { useAuthStore } from '~/stores/auth';

/**
 * Kiểm tra user hiện tại có quyền theo `<module>:<action>` không.
 *
 * hasPermission(input):
 *   null       → true  (bỏ qua kiểm tra, auto pass)
 *   string     → true nếu user có đúng quyền này
 *   string[]   → true nếu user có ít nhất 1 quyền trong mảng, false nếu không có quyền nào
 *
 * Nguồn `permissions` = `authStore.permissions`, populate qua `/v1/auth/me`.
 */
export function usePermissions() {
	const store = useAuthStore();
	const { permissions } = storeToRefs(store);

	function hasPermission(input: string | string[] | null): boolean {
		if (input === null) return true;
		if (typeof input === 'string') return permissions.value.includes(input);
		return input.some(code => permissions.value.includes(code));
	}

	return { permissions, hasPermission };
}
