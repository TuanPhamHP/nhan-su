import type { AuthResponse, LoginDto, RefreshTokenDto, ChangePasswordDto, ProfileResponse, UpdateProfilePayload } from '~/types/auth.types';
import type { Employee } from '~/types/employee.types';
import type { ApiResponse } from '~/types/api.types';
import { useAuthFetch } from './http/auth.fetch';
import { usePublicFetch } from './http/public.fetch';

export const useAuthService = () => {
	const publicFetch = usePublicFetch();
	const authFetch = useAuthFetch();

	return {
		async login(payload: LoginDto): Promise<AuthResponse> {
			const res = await publicFetch<ApiResponse<AuthResponse>>('/v1/auth/login', {
				method: 'POST',
				body: payload,
			});
			return res.data;
		},

		async logout(): Promise<void> {
			await authFetch<unknown>('/v1/auth/logout', { method: 'POST' });
		},

		async refresh(payload: RefreshTokenDto): Promise<AuthResponse> {
			const res = await publicFetch<ApiResponse<AuthResponse>>('/v1/auth/refresh', {
				method: 'POST',
				body: payload,
			});
			return res.data;
		},

		async changePassword(payload: ChangePasswordDto): Promise<void> {
			await authFetch<unknown>('/v1/auth/change-password', {
				method: 'PATCH',
				body: payload,
			});
		},

		async me(): Promise<Employee> {
			const res = await authFetch<ApiResponse<Employee>>('/v1/employees/me');
			return res.data;
		},

		async myPermissions(): Promise<string[]> {
			const res = await authFetch<ApiResponse<{ permissions: string[] }>>('/v1/auth/me');
			return res.data.permissions ?? [];
		},

		async updateProfile(payload: UpdateProfilePayload): Promise<ProfileResponse> {
			const res = await authFetch<ApiResponse<ProfileResponse>>('/v1/auth/profile', {
				method: 'PATCH',
				body: payload,
			});
			return res.data;
		},

		async uploadAvatar(file: File): Promise<ProfileResponse> {
			const formData = new FormData();
			formData.append('file', file);
			const res = await authFetch<ApiResponse<ProfileResponse>>('/v1/auth/avatar', {
				method: 'POST',
				body: formData,
			});
			return res.data;
		},
	};
};
