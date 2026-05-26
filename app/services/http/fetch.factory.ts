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
				const data = response._data as { error?: { message?: string } } | undefined;
				const message = data?.error?.message;
				if (message) throw new Error(message);
			},
		});
}
