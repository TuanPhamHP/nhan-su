import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, QueryParams, Payload } from './http/types';

interface User {
	id: number;
	name: string;
	email: string;
}
/**
 * Payloads
 */
export interface CreateUserPayload {
	name: string;
	email: string;
}

export interface UpdateUserPayload {
	name?: string;
	email?: string;
	status?: 'active' | 'inactive';
}

/**
 * Params
 */
export interface ListUserParams {
	page?: number;
	keyword?: string;
	status?: 'active' | 'inactive';
}

export const useUserService = () => {
	const authFetch = useAuthFetch();

	return {
		/**
		 * GET /users
		 * params có thể có hoặc không
		 */
		list(params?: QueryParams | ListUserParams) {
			return authFetch<ApiResponse<User[]>>('/example-url/api/users', {
				method: 'GET',
				params,
			});
		},

		/**
		 * GET /users/:id
		 */
		detail(id: number) {
			return authFetch<ApiResponse<User>>(`/example-url/api/users/${id}`, {
				method: 'GET',
			});
		},

		/**
		 * POST /users
		 * payload có thể có hoặc không
		 */
		create(payload?: Payload<CreateUserPayload>) {
			return authFetch<ApiResponse<User>>('/example-url/api/users', {
				method: 'POST',
				body: payload,
			});
		},

		/**
		 * PUT /users/:id
		 * payload partial + optional
		 */
		update(id: number, payload?: Payload<UpdateUserPayload>) {
			return authFetch<ApiResponse<User>>(`/example-url/api/users/${id}`, {
				method: 'PUT',
				body: payload,
			});
		},

		/**
		 * DELETE /users/:id
		 */
		remove(id: number) {
			return authFetch<ApiResponse<null>>(`/example-url/api/users/${id}`, {
				method: 'DELETE',
			});
		},
	};
};
