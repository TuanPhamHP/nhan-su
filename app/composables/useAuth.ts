import { storeToRefs } from 'pinia';
import { useAuthStore } from '~/stores/auth';

export function useAuth() {
	const store = useAuthStore();
	const { user, token, isAuthenticated } = storeToRefs(store);
	const { login, logout, fetchMe } = store;

	return { user, token, isAuthenticated, login, logout, fetchMe };
}
