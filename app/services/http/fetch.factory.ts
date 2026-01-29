import type { FetchOptions } from 'ofetch';

export function createFetch(options: FetchOptions = {}) {
	return () =>
		$fetch.create({
			baseURL: useRuntimeConfig().public.baseApiUrl,
			...options,
		});
}
