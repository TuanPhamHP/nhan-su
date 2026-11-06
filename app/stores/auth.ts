import { defineStore } from 'pinia';
import type { AuthResponse, AuthUser, CompanyOption, LoginDto, LoginResponse } from '~/types/auth.types';
import type { ModuleEntitlement } from '~/types/entitlement.types';
import { useAuthService } from '~/services';
import { setOnForceLogout, setOnModuleDenied } from '~/services/http/auth.fetch';
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
	/**
	 * Quyền dùng module của công ty hiện tại. Rỗng nghĩa là chưa nạp được (BE cũ, lỗi mạng): khi đó
	 * coi mọi module dùng được, API vẫn chặn ở phía sau. Đọc qua `useModuleAccess`.
	 */
	const modules = ref<ModuleEntitlement[]>([]);
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
		modules.value = [];
		resetCompanyScopedStores();
	}

	// Allow the auth fetch layer to clear reactive state on forced logout (expired refresh token,
	// công ty ngừng dịch vụ…)
	setOnForceLogout(notice => {
		clearSession();
		logoutNotice.value = notice ?? null;
	});

	// API trả `MODULE_*` nghĩa là quyền đang giữ đã cũ: tải lại ở nền để menu tự cập nhật.
	setOnModuleDenied(() => {
		void loadEntitlements();
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

	// Nhiều request cùng trả `MODULE_*` một lúc thì chỉ tải lại một lần.
	let entitlementsRequest: Promise<void> | null = null;

	/** Không bao giờ ném lỗi: lỗi hay 404 (BE cũ) thì để rỗng, không được khoá người dùng. */
	function loadEntitlements(): Promise<void> {
		if (!token.value) return Promise.resolve();
		if (entitlementsRequest) return entitlementsRequest;

		const requestedFor = token.value;
		entitlementsRequest = (async () => {
			let next: ModuleEntitlement[] = [];
			try {
				const { getEntitlements } = useAuthService();
				const res = await getEntitlements();
				next = res.modules ?? [];
			} catch {
				// Xem ghi chú ở `modules`.
			}
			// Trong lúc chờ đã đăng xuất hoặc đổi phiên thì kết quả này không còn là của phiên hiện tại.
			if (token.value === requestedFor) modules.value = next;
		})().finally(() => {
			entitlementsRequest = null;
		});
		return entitlementsRequest;
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
		modules.value = [];
		entitlementsRequest = null;

		await Promise.all([loadPermissions(), loadEntitlements()]);
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
		// Tải lại toàn trang ngay dưới đây: plugin auth gọi `fetchMe` và nạp quyền của công ty mới.
		modules.value = [];

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
			await Promise.all([loadPermissions(), loadEntitlements()]);
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
		modules,
		logoutNotice,
		isAuthenticated,
		login,
		selectCompany,
		switchCompany,
		fetchMe,
		loadPermissions,
		loadEntitlements,
		logout,
		initFromCookie,
	};
});
