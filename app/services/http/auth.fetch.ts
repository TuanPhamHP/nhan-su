import { getCookie, setCookie, deleteCookie } from '~/utils/cookie';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

type FetchOpts = NonNullable<Parameters<typeof $fetch>[1]>;

// Callback registered by auth store to clear reactive state on forced logout
let _onForceLogout: (() => void) | null = null;
export function setOnForceLogout(cb: () => void): void {
	_onForceLogout = cb;
}

// Captured from first useAuthFetch() call (composable context)
let _baseApiUrl = '';
const NGROK_HEADERS = { 'ngrok-skip-browser-warning': '1' };

// Singleton refresh promise — prevents concurrent refresh calls
let _refreshPromise: Promise<string> | null = null;

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

async function _forceLogout(): Promise<void> {
	deleteCookie(ACCESS_TOKEN_KEY);
	deleteCookie(REFRESH_TOKEN_KEY);
	_onForceLogout?.();
	await navigateTo('/login');
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

		try {
			return await $fetch<T>(url, options);
		} catch (err: unknown) {
			const e = err as { response?: { status?: number }; data?: { error?: { message?: string } } };

			if (e?.response?.status === 401) {
				try {
					const newToken = await _getOrRefresh();
					return await $fetch<T>(url, {
						...options,
						headers: {
							...NGROK_HEADERS,
							...(options.headers as Record<string, string>),
							Authorization: `Bearer ${newToken}`,
						},
					});
				} catch {
					await _forceLogout();
					throw err;
				}
			}

			const message = e?.data?.error?.message;
			if (message) throw new Error(message);
			throw err;
		}
	};
};
