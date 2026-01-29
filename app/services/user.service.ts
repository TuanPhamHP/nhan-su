import { useAuthFetch } from './http/auth.fetch';

export interface User {
	id: number;
	name: string;
	email: string;
}

export const useUserService = () => {
	const authFetch = useAuthFetch();

	return {
		me() {
			return authFetch('/users/me');
		},
	};
};
