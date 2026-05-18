import { storeToRefs } from 'pinia';
import { useAuthStore } from '~/stores/auth';

/**
 * isContainPermissions(codes):
 *   null          → true  (auto pass)
 *   []            → false (auto fail)
 *   string[]      → true nếu user có ÍT NHẤT 1 code trong mảng
 *
 * ADMIN luôn trả true bất kể codes là gì (trừ [] — auto fail vẫn ưu tiên).
 */
export function usePermissions() {
	const store = useAuthStore();
	const { user, permissions } = storeToRefs(store);

	function isContainPermissions(codes: string[] | null): boolean {
		if (codes === null) return true;
		if (codes.length === 0) return false;
		if (user.value?.role === 'ADMIN') return true;
		return codes.some(code => permissions.value.includes(code));
	}

	return { isContainPermissions };
}
