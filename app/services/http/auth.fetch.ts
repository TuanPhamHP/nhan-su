import { createFetch } from './fetch.factory';

export const useAuthFetch = () => {
	const fetch = createFetch({
		onRequest({ options }) {
			const token = useCookie<string>('access_token').value;

			if (token) {
				options.headers = {
					...options.headers,
					// @ts-ignore
					Authorization: `Bearer ${token}`,
				};
			}
		},
	});

	return fetch();
};
