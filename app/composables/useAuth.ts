import { storeToRefs } from 'pinia';
import { useAuthStore } from '~/stores/auth';

export function useAuth() {
	const store = useAuthStore();
	const { user, token, isAuthenticated, company, companies } = storeToRefs(store);
	const { login, selectCompany, switchCompany, logout, fetchMe } = store;

	return { user, token, isAuthenticated, company, companies, login, selectCompany, switchCompany, logout, fetchMe };
}
