import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse } from '~/types/api.types';
import type { PermissionGroupDto } from '~/types/role.types';

export const usePermissionService = () => {
	const authFetch = useAuthFetch();

	return {
		async findAll(): Promise<PermissionGroupDto[]> {
			const res = await authFetch<ApiResponse<PermissionGroupDto[]>>('/v1/permissions');
			return res.data;
		},
	};
};
