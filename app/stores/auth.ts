import { defineStore } from 'pinia';
import type { AuthUser, LoginDto } from '~/types/auth.types';
import { useAuthService } from '~/services';
import { getCookie, setCookie, deleteCookie } from '~/utils/cookie';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export const useAuthStore = defineStore('auth', () => {
	const user = ref<AuthUser | null>(null);
	const token = ref<string | null>(null);
	const permissions = ref<string[]>([]);

	const isAuthenticated = computed(() => !!token.value);

	function initFromCookie() {
		token.value = getCookie(ACCESS_TOKEN_KEY);
	}

	async function loadPermissions() {
		if (!token.value) return;
		try {
			const { myPermissions } = useAuthService();
			permissions.value = await myPermissions();
		} catch {
			// fail silently — ADMIN bypass không phụ thuộc vào mảng này
		}
	}

	async function login(payload: LoginDto) {
		const { login: loginFn } = useAuthService();
		const res = await loginFn(payload);

		setCookie(ACCESS_TOKEN_KEY, res.accessToken, 60 * 60 * 24);
		setCookie(REFRESH_TOKEN_KEY, res.refreshToken, 60 * 60 * 24 * 7);
		token.value = res.accessToken;
		user.value = res.user;

		await loadPermissions();
		const { load: loadDirectory } = useDirectoryStore();
		loadDirectory();
	}

	async function fetchMe() {
		if (!token.value) return;
		try {
			const { me } = useAuthService();
			const emp = await me();
			user.value = {
				id: emp.id,
				fullName: emp.fullName,
				email: emp.email,
				employeeCode: emp.employeeCode,
				role: emp.role,
				avatarUrl: emp.avatarUrl,
			};
			await loadPermissions();
			const { load: loadDirectory } = useDirectoryStore();
			loadDirectory();
		} catch {
			await logout();
		}
	}

	async function logout() {
		try {
			const { logout: logoutFn } = useAuthService();
			await logoutFn();
		} catch {
			// Clear local state regardless of API result
		} finally {
			deleteCookie(ACCESS_TOKEN_KEY);
			deleteCookie(REFRESH_TOKEN_KEY);
			token.value = null;
			user.value = null;
			permissions.value = [];
		}
	}

	return { user, token, permissions, isAuthenticated, login, fetchMe, loadPermissions, logout, initFromCookie };
});
