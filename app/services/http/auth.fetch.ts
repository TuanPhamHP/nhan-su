import { getCookie, setCookie, deleteCookie } from '~/utils/cookie';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

type FetchOpts = NonNullable<Parameters<typeof $fetch>[1]>;
type ApiErrorBody = { error?: { message?: string; code?: string } };

/**
 * Công ty bị ngắt dịch vụ (403) hoặc đang bảo trì (503). BE trả hai mã này cho MỌI API cần
 * JWT, kể cả /refresh. Câu dưới đây chỉ dùng khi response không kèm message.
 */
const TENANT_SUSPENDED_MESSAGE = 'Công ty đã tạm ngừng sử dụng dịch vụ. Liên hệ quản trị viên của công ty.';
const TENANT_MAINTENANCE_MESSAGE = 'Hệ thống của công ty đang bảo trì, vui lòng thử lại sau.';

// Callback registered by auth store to clear reactive state on forced logout.
// `notice` là câu giải thích vì sao bị đăng xuất, trang đăng nhập hiện nó cho người dùng.
let _onForceLogout: ((notice?: string) => void) | null = null;
export function setOnForceLogout(cb: (notice?: string) => void): void {
	_onForceLogout = cb;
}

// Callback do auth store đăng ký để tải lại quyền dùng module.
let _onModuleDenied: (() => void) | null = null;
export function setOnModuleDenied(cb: () => void): void {
	_onModuleDenied = cb;
}

/**
 * API báo module không dùng được (`MODULE_*`) nghĩa là quyền FE đang giữ đã cũ. Đây là lỗi nghiệp
 * vụ, KHÔNG đăng xuất: chỉ tải lại quyền ở nền, lỗi vẫn ném lên cho trang hiện `message` của BE.
 * Export cho `chatStream`, chỗ dùng `fetch` gốc nên không đi qua `useAuthFetch`.
 */
export function notifyIfModuleDenied(code?: string): void {
	if (code?.startsWith('MODULE_')) _onModuleDenied?.();
}

// Captured from first useAuthFetch() call (composable context)
let _baseApiUrl = '';
const NGROK_HEADERS = { 'ngrok-skip-browser-warning': '1' };

// Singleton refresh promise — prevents concurrent refresh calls
let _refreshPromise: Promise<string> | null = null;

/**
 * Câu dự phòng khi response không mang `error.message` của BE.
 *
 * Trước đây những lúc này `_wrap` ném nguyên lỗi của `$fetch`, mà lỗi đó cũng là `Error` nên
 * câu dự phòng tiếng Việt ở từng trang không bao giờ chạy: người dùng đọc được
 * `[POST] "https://…/v1/…": <no response> Failed to fetch`. Giờ mọi lỗi ra khỏi file này đều
 * mang một câu tiếng Việt, không có URL, mã HTTP hay chữ tiếng Anh.
 *
 * Request đọc dữ liệu và request gửi dữ liệu nói khác nhau: chỉ request gửi mới cần trấn an
 * rằng thông tin người dùng vừa nhập vẫn còn trên màn hình.
 */
const NETWORK_SEND_MESSAGE =
	'Chưa gửi được vì mạng bị gián đoạn. Thông tin bạn nhập vẫn còn trên màn hình, bạn bấm gửi lại khi có mạng.';
const NETWORK_READ_MESSAGE =
	'Chưa tải được dữ liệu vì mạng bị gián đoạn. Bạn kiểm tra kết nối rồi tải lại trang.';
const TOO_LARGE_MESSAGE =
	'Tệp bạn chọn vượt dung lượng cho phép. Bạn giảm dung lượng ảnh hoặc gửi ít ảnh hơn rồi thử lại.';
const SERVER_SEND_MESSAGE =
	'Xin lỗi, hệ thống đang gặp sự cố nên chưa xử lý được. Thông tin bạn nhập vẫn còn, bạn thử lại sau ít phút.';
const SERVER_READ_MESSAGE =
	'Xin lỗi, hệ thống đang gặp sự cố nên chưa tải được dữ liệu. Bạn thử lại sau ít phút; nếu vẫn lỗi, hãy báo quản trị hệ thống.';
const UNKNOWN_SEND_MESSAGE =
	'Chưa thực hiện được thao tác này. Bạn thử lại sau ít phút; nếu vẫn lỗi, hãy báo quản trị hệ thống.';
const UNKNOWN_READ_MESSAGE =
	'Chưa tải được dữ liệu. Bạn tải lại trang; nếu vẫn lỗi, hãy báo quản trị hệ thống.';

/**
 * Thân lỗi của BE.
 *
 * Request tải file (`responseType: 'blob'`, như xuất Excel hay tải file mẫu) nhận cả lỗi dưới
 * dạng Blob, nên phải đọc lại thành chữ rồi `JSON.parse` mới lấy được `error.message`. Không
 * đọc được thì coi như BE không gửi câu nào.
 */
async function _readErrorBody(err: unknown): Promise<ApiErrorBody | undefined> {
	const data = (err as { data?: unknown } | null)?.data;
	if (typeof Blob !== 'undefined' && data instanceof Blob) {
		try {
			const parsed: unknown = JSON.parse(await data.text());
			return parsed && typeof parsed === 'object' ? (parsed as ApiErrorBody) : undefined;
		} catch {
			return undefined;
		}
	}
	return data && typeof data === 'object' ? (data as ApiErrorBody) : undefined;
}

function _errorInfo(
	err: unknown,
	body?: ApiErrorBody,
): { status?: number; code?: string; message?: string; data?: ApiErrorBody } {
	const e = err as { response?: { status?: number }; data?: ApiErrorBody } | null;
	const data = body ?? (e?.data && typeof e.data === 'object' && !(e.data instanceof Blob) ? e.data : undefined);
	return {
		status: e?.response?.status,
		code: data?.error?.code,
		message: data?.error?.message,
		data,
	};
}

/** Câu tiếng Việt cho lỗi không có `error.message`, theo tình huống và loại request. */
function _fallbackMessage(status: number | undefined, method: string): string {
	const sending = method !== 'GET' && method !== 'HEAD';
	if (status == null) return sending ? NETWORK_SEND_MESSAGE : NETWORK_READ_MESSAGE;
	if (status === 413) return TOO_LARGE_MESSAGE;
	if (status >= 500) return sending ? SERVER_SEND_MESSAGE : SERVER_READ_MESSAGE;
	return sending ? UNKNOWN_SEND_MESSAGE : UNKNOWN_READ_MESSAGE;
}

/**
 * Đổi lỗi $fetch thành Error mang câu tiếng Việt, giữ `data` + `status` để trang phân nhánh
 * theo mã. `status` để trống khi không có response (mất mạng), đúng như lỗi gốc của `$fetch`.
 */
async function _wrap(err: unknown, method: string): Promise<Error> {
	const body = await _readErrorBody(err);
	const { status, message, data } = _errorInfo(err, body);
	const wrapped = new Error(message || _fallbackMessage(status, method)) as Error & {
		data?: unknown;
		status?: number;
	};
	wrapped.data = data;
	wrapped.status = status;
	return wrapped;
}

async function _doRefresh(): Promise<string> {
	const refreshToken = getCookie(REFRESH_TOKEN_KEY);
	if (!refreshToken) throw new Error('No refresh token');

	const res = await $fetch<{ success: boolean; data: { accessToken: string; refreshToken: string } }>(
		'/v1/auth/refresh',
		{
			method: 'POST',
			baseURL: _baseApiUrl,
			body: { refreshToken },
			headers: NGROK_HEADERS,
		},
	);

	setCookie(ACCESS_TOKEN_KEY, res.data.accessToken, 60 * 60 * 24);
	setCookie(REFRESH_TOKEN_KEY, res.data.refreshToken, 60 * 60 * 24 * 7);
	return res.data.accessToken;
}

function _getOrRefresh(): Promise<string> {
	if (!_refreshPromise) {
		_refreshPromise = _doRefresh().finally(() => {
			_refreshPromise = null;
		});
	}
	return _refreshPromise;
}

// Nhiều request cùng gặp lỗi một lúc thì chỉ đăng xuất một lần.
let _forceLogoutPromise: Promise<void> | null = null;

function _forceLogout(notice?: string): Promise<void> {
	if (!_forceLogoutPromise) {
		_forceLogoutPromise = (async () => {
			deleteCookie(ACCESS_TOKEN_KEY);
			deleteCookie(REFRESH_TOKEN_KEY);
			_onForceLogout?.(notice);
			await navigateTo('/login');
		})().finally(() => {
			_forceLogoutPromise = null;
		});
	}
	return _forceLogoutPromise;
}

// Bảo trì thường làm nhiều request lỗi cùng lúc, nên chỉ báo một lần trong 10 giây.
let _lastMaintenanceNoticeAt = 0;

function _notifyMaintenance(message?: string): void {
	const now = Date.now();
	if (now - _lastMaintenanceNoticeAt < 10_000) return;
	_lastMaintenanceNoticeAt = now;
	useToast().warning(message || TENANT_MAINTENANCE_MESSAGE);
}

export const useAuthFetch = () => {
	_baseApiUrl = useRuntimeConfig().public.baseApiUrl as string;

	return async <T>(url: string, opts: FetchOpts = {}): Promise<T> => {
		const token = getCookie(ACCESS_TOKEN_KEY);
		const options: FetchOpts = {
			baseURL: _baseApiUrl,
			...opts,
			headers: {
				...NGROK_HEADERS,
				...(opts.headers as Record<string, string>),
				...(token ? { Authorization: `Bearer ${token}` } : {}),
			},
		};

		const method = String(opts.method ?? 'GET').toUpperCase();

		try {
			return await $fetch<T>(url, options);
		} catch (err: unknown) {
			const { status, code, message } = _errorInfo(err, await _readErrorBody(err));

			notifyIfModuleDenied(code);

			// Công ty ngừng dịch vụ: phiên này không dùng tiếp được nữa.
			if (code === 'TENANT_SUSPENDED') {
				await _forceLogout(message || TENANT_SUSPENDED_MESSAGE);
				throw await _wrap(err, method);
			}

			/**
			 * 401 ở đây mang HAI nghĩa khác hẳn nhau:
			 *
			 * - Token hết hạn → refresh rồi gửi lại (luồng bên dưới).
			 * - Endpoint từ chối MẬT KHẨU người dùng vừa nhập (VD `POST /v1/social-insurance/me`
			 *   bắt xác thực lại mật khẩu). Refresh không cứu được gì: gửi lại vẫn sai mật
			 *   khẩu, lần hai rơi vào `catch` → `_forceLogout()` đá người dùng về /login chỉ
			 *   vì gõ nhầm mật khẩu. Tệ hơn: mỗi lần gõ nhầm tốn HAI lần sai trong bộ đếm
			 *   khoá tài khoản của BE (khoá ở lần thứ 5, không có đường mở khoá).
			 */
			const isCredentialRejection = code === 'AUTH_INVALID_CREDENTIALS';

			if (status === 401 && !isCredentialRejection) {
				let newToken: string;
				try {
					newToken = await _getOrRefresh();
				} catch (refreshErr) {
					const refresh = _errorInfo(refreshErr);
					// Bảo trì là tạm thời: giữ nguyên phiên, chỉ báo cho người dùng biết.
					if (refresh.code === 'TENANT_MAINTENANCE') {
						_notifyMaintenance(refresh.message);
						throw await _wrap(refreshErr, method);
					}
					await _forceLogout(
						refresh.code === 'TENANT_SUSPENDED' ? refresh.message || TENANT_SUSPENDED_MESSAGE : undefined,
					);
					// Không ném nguyên lỗi $fetch: `message` của nó chứa cả URL, trang sẽ toast ra cho người dùng.
					throw await _wrap(err, method);
				}

				try {
					return await $fetch<T>(url, {
						...options,
						headers: {
							...NGROK_HEADERS,
							...(options.headers as Record<string, string>),
							Authorization: `Bearer ${newToken}`,
						},
					});
				} catch (retryErr) {
					// Đã có token mới mà vẫn 401 thì phiên thật sự không còn. Lỗi khác (400, 404…)
					// là lỗi nghiệp vụ của chính request, trả về cho trang xử lý như thường.
					const retry = _errorInfo(retryErr, await _readErrorBody(retryErr));
					notifyIfModuleDenied(retry.code);
					if (retry.code === 'TENANT_SUSPENDED') {
						await _forceLogout(retry.message || TENANT_SUSPENDED_MESSAGE);
					} else if (retry.status === 401 && retry.code !== 'AUTH_INVALID_CREDENTIALS') {
						await _forceLogout();
					}
					throw await _wrap(retryErr, method);
				}
			}

			throw await _wrap(err, method);
		}
	};
};
