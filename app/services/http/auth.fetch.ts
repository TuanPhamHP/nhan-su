import { createFetch } from './fetch.factory';
import { getCookie } from '~/utils/cookie';

export const useAuthFetch = () => {
	const fetch = createFetch({
		onRequest({ options }) {
			const token = getCookie('access_token');
			if (token) {
				options.headers = {
					...options.headers,
					Authorization: `Bearer ${token}`,
				};
			}
		},
	});
	return fetch();
};
