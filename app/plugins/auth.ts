import { useAuthStore } from '~/stores/auth';

export default defineNuxtPlugin(async () => {
	const authStore = useAuthStore();
	authStore.initFromCookie();
	if (authStore.isAuthenticated) {
		await authStore.fetchMe();
	}
});
