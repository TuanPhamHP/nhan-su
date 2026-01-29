import { createFetch } from './fetch.factory';

export const useApiKeyFetch = () => {
	return createFetch({
		onRequest({ options }) {
			const apiKey = useRuntimeConfig().public.apiKey;

			options.headers = {
				...options.headers,
				// @ts-ignore
				'x-api-key': apiKey,
			};
		},
	})();
};
