import { defineStore } from 'pinia';
import { useAuthService, type LoginPayload } from '~/services';

interface User {
	id: number;
	name: string;
	email: string;
}

const COOKIE_KEY = 'access_token';
const COOKIE_OPTIONS = { maxAge: 60 * 60 * 24 * 7, sameSite: 'lax' as const };

export const useAuthStore = defineStore('auth', () => {
	const user = ref<User | null>(null);
	// Dùng ref thuần thay vì useCookie để tránh circular dependency với Pinia
	const token = ref<string | null>(null);

	const isAuthenticated = computed(() => !!token.value);

	// Được gọi từ Nuxt plugin sau khi Pinia đã sẵn sàng
	function _initFromCookie() {
		const cookie = useCookie<string | null>(COOKIE_KEY);
		token.value = cookie.value ?? null;
	}

	async function login(payload: LoginPayload) {
		const { login: loginFn } = useAuthService();
		const res = await loginFn(payload);
		useCookie<string>(COOKIE_KEY, COOKIE_OPTIONS).value = res.access_token;
		token.value = res.access_token;
		await fetchMe();
	}

	async function fetchMe() {
		if (!token.value) return;
		try {
			const { me } = useAuthService();
			const res = await me();
			user.value = res;
		} catch {
			logout();
		}
	}

	function logout() {
		useCookie<string | null>(COOKIE_KEY).value = null;
		token.value = null;
		user.value = null;
	}

	return { user, token, isAuthenticated, login, fetchMe, logout, _initFromCookie };
});
