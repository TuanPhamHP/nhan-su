import type { FetchOptions } from 'ofetch';

export function createFetch(options: FetchOptions = {}) {
	return () =>
		$fetch.create({
			baseURL: useRuntimeConfig().public.baseApiUrl,
			...options,
			headers: {
				'ngrok-skip-browser-warning': '1',
				...options.headers,
			},
			onResponseError({ response }) {
				const data = response._data as { error?: { message?: string; code?: string } } | undefined;
				const message = data?.error?.message;
				if (message) {
					// Giữ `data` + `status` giống auth.fetch.ts để trang gọi phân nhánh theo
					// `error.code` (VD AUTH_RESET_TOKEN_EXPIRED), không phải dò chuỗi message.
					const wrapped = new Error(message) as Error & { data?: unknown; status?: number };
					wrapped.data = data;
					wrapped.status = response.status;
					throw wrapped;
				}
			},
		});
}
