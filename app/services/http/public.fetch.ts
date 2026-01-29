import { createFetch } from './fetch.factory';

export const usePublicFetch = () => {
	return createFetch({
		headers: {
			'Content-Type': 'application/json',
		},
	})();
};
