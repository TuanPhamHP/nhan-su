import type { UserRole } from '~/types/auth.types';

export const useUiStore = defineStore('ui', () => {
	const previewRole = ref<UserRole | null>(null);

	function previewAs(role: UserRole | null) {
		previewRole.value = role;
	}

	return { previewRole, previewAs };
});
