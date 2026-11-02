import { defineStore } from 'pinia';
import type { AuthResponse, AuthUser, CompanyOption, LoginDto, LoginResponse } from '~/types/auth.types';
import { useAuthService } from '~/services';
import { setOnForceLogout } from '~/services/http/auth.fetch';
import { getCookie, setCookie, deleteCookie } from '~/utils/cookie';
import { useNotificationStore } from '~/stores/notification';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export const useAuthStore = defineStore('auth', () => {
	const user = ref<AuthUser | null>(null);
	const token = ref<string | null>(null);
	const permissions = ref<string[]>([]);
	/** Công ty của phiên đang mở. */
	const company = ref<CompanyOption | null>(null);
	/** Mọi công ty tài khoản vào được, dùng cho bộ chọn ở header và link `?t=`. */
	const companies = ref<CompanyOption[]>([]);
	/** Lý do bị đăng xuất ngoài ý muốn (VD công ty ngừng dịch vụ), trang đăng nhập hiện câu này. */
	const logoutNotice = ref<string | null>(null);

	/**
	 * Mọi store có dữ liệu theo công ty phải xoá khi đăng xuất hoặc đổi công ty, nếu không
	 * phiên sau sẽ thấy danh bạ, phòng ban, số đơn chờ duyệt… của phiên trước.
	 */
	function resetCompanyScopedStores() {
		useNotificationStore().reset();
		useDirectoryStore().reset();
		useMetaDataStore().reset();
		useApprovalStore().reset();
		useUiStore().previewAs(null);
	}

	function clearSession() {
		token.value = null;
		user.value = null;
		permissions.value = [];
		company.value = null;
		companies.value = [];
		resetCompanyScopedStores();
	}

	// Allow the auth fetch layer to clear reactive state on forced logout (expired refresh token,
	// công ty ngừng dịch vụ…)
	setOnForceLogout(notice => {
		clearSession();
		logoutNotice.value = notice ?? null;
	});

	const isAuthenticated = computed(() => !!token.value);

	function initFromCookie() {
		token.value = getCookie(ACCESS_TOKEN_KEY);
	}

	/** Nạp quyền, công ty hiện tại và danh sách công ty từ `/v1/auth/me`. */
	async function loadPermissions() {
		if (!token.value) return;
		try {
			const { authMe } = useAuthService();
			const me = await authMe();
			permissions.value = me.permissions ?? [];
			company.value = me.company ?? null;
			companies.value = me.companies ?? [];
		} catch {
			// fail silently — ADMIN bypass không phụ thuộc vào mảng này
		}
	}

	function storeTokens(res: AuthResponse) {
		setCookie(ACCESS_TOKEN_KEY, res.accessToken, 60 * 60 * 24);
		setCookie(REFRESH_TOKEN_KEY, res.refreshToken, 60 * 60 * 24 * 7);
	}

	/** Lưu phiên vừa vào được một công ty (login một công ty hoặc select-company). */
	async function startSession(res: AuthResponse) {
		// Dọn dữ liệu còn sót của phiên trước trong cùng tab trước khi nạp phiên mới.
		resetCompanyScopedStores();
		logoutNotice.value = null;

		storeTokens(res);
		token.value = res.accessToken;
		user.value = { ...res.user, department: null };
		company.value = res.company;
		companies.value = res.companies;

		await loadPermissions();
		const { load: loadDirectory } = useDirectoryStore();
		loadDirectory();
		const { load: loadMetadata } = useMetaDataStore();
		loadMetadata();
	}

	/**
	 * Đăng nhập bằng email. Tài khoản thuộc nhiều công ty thì BE chưa cấp token mà trả
	 * `selectionToken` + danh sách công ty: trả nguyên response đó cho trang đăng nhập hiện bước
	 * chọn công ty, KHÔNG lưu gì vào store hay cookie.
	 */
	async function login(payload: LoginDto): Promise<LoginResponse> {
		const { login: loginFn } = useAuthService();
		const res = await loginFn(payload);
		if (!res.requiresCompanySelection) await startSession(res);
		return res;
	}

	async function selectCompany(selectionToken: string, companyCode: string) {
		const { selectCompany: selectFn } = useAuthService();
		const res = await selectFn({ selectionToken, companyCode });
		await startSession(res);
	}

	/**
	 * Chuyển sang công ty khác của cùng tài khoản. Phiên ở công ty cũ bị BE hủy ngay, nên phải
	 * ghi đè cả hai cookie token. Mọi dữ liệu đang cache trong store, socket, trang đang mở…
	 * thuộc công ty cũ, nên sau khi xoá store thì tải lại toàn trang tới `redirectTo`.
	 */
	async function switchCompany(companyCode: string, redirectTo = '/') {
		// Gỡ FCM khỏi phiên cũ giống lúc đăng xuất (authFetch còn cần token cũ để gọi API).
		const notificationStore = useNotificationStore();
		await notificationStore.unregisterDevice();

		const { switchCompany: switchFn } = useAuthService();
		const res = await switchFn({ companyCode });

		storeTokens(res);
		resetCompanyScopedStores();
		token.value = res.accessToken;
		user.value = { ...res.user, department: null };
		company.value = res.company;
		companies.value = res.companies;
		permissions.value = [];

		if (import.meta.client) window.location.assign(redirectTo);
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
				department: emp.department ?? null,
			};
			await loadPermissions();
			const { load: loadDirectory } = useDirectoryStore();
			loadDirectory();
			const { load: loadMetadata } = useMetaDataStore();
			loadMetadata();
		} catch {
			await logout();
		}
	}

	async function logout() {
		// Unregister FCM device token TRƯỚC khi xoá cookie (authFetch cần cookie để gọi API)
		const notificationStore = useNotificationStore();
		await notificationStore.unregisterDevice();

		try {
			const { logout: logoutFn } = useAuthService();
			await logoutFn();
		} catch {
			// Clear local state regardless of API result
		} finally {
			deleteCookie(ACCESS_TOKEN_KEY);
			deleteCookie(REFRESH_TOKEN_KEY);
			clearSession();
		}
	}

	return {
		user,
		token,
		permissions,
		company,
		companies,
		logoutNotice,
		isAuthenticated,
		login,
		selectCompany,
		switchCompany,
		fetchMe,
		loadPermissions,
		logout,
		initFromCookie,
	};
});
