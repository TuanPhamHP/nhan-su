import { useAuthFetch } from './http/auth.fetch';
import { usePublicFetch } from './http/public.fetch';

export interface LoginPayload {
	login: string;
	password: string;
}

export interface LoginResponse {
	access_token: string;
	expires_in: number;
}

interface User {
	id: number;
	name: string;
	email: string;
}

export const useAuthService = () => {
	const authFetch = useAuthFetch();
	const publicFetch = usePublicFetch();

	return {
		login(payload: LoginPayload) {
			return publicFetch<LoginResponse>('/api/user/login', {
				method: 'POST',
				body: payload,
			});
		},

		me() {
			return authFetch<User>('/api/user/me', {
				method: 'GET',
			});
		},
	};
};
