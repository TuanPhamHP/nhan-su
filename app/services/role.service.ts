import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedResponse, PaginatedMeta } from '~/types/api.types';
import type {
	RoleSummary,
	RoleDetail,
	RoleEmployee,
	RoleQueryParams,
	CreateRoleDto,
	UpdateRoleDto,
	AssignPermissionsDto,
	AssignEmployeesDto,
} from '~/types/role.types';

export const useRoleService = () => {
	const authFetch = useAuthFetch();

	return {
		async findAll(params?: RoleQueryParams): Promise<{ data: RoleSummary[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<RoleSummary>>('/v1/roles', { params });
			return { data: res.data, meta: res.meta };
		},

		async findOne(id: number): Promise<RoleDetail> {
			const res = await authFetch<ApiResponse<RoleDetail>>(`/v1/roles/${id}`);
			return res.data;
		},

		async create(payload: CreateRoleDto): Promise<RoleDetail> {
			const res = await authFetch<ApiResponse<RoleDetail>>('/v1/roles', {
				method: 'POST',
				body: payload,
			});
			return res.data;
		},

		async update(id: number, payload: UpdateRoleDto): Promise<RoleDetail> {
			const res = await authFetch<ApiResponse<RoleDetail>>(`/v1/roles/${id}`, {
				method: 'PATCH',
				body: payload,
			});
			return res.data;
		},

		delete(id: number): Promise<void> {
			return authFetch<void>(`/v1/roles/${id}`, { method: 'DELETE' });
		},

		async updatePermissions(id: number, dto: AssignPermissionsDto): Promise<RoleDetail> {
			const res = await authFetch<ApiResponse<RoleDetail>>(`/v1/roles/${id}/permissions`, {
				method: 'PUT',
				body: dto,
			});
			return res.data;
		},

		async getEmployees(id: number, params?: { page?: number; limit?: number }): Promise<{ data: RoleEmployee[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<RoleEmployee>>(`/v1/roles/${id}/employees`, { params });
			return { data: res.data, meta: res.meta };
		},

		addEmployees(id: number, dto: AssignEmployeesDto): Promise<void> {
			return authFetch<void>(`/v1/roles/${id}/employees`, {
				method: 'POST',
				body: dto,
			});
		},

		removeEmployee(roleId: number, employeeId: number): Promise<void> {
			return authFetch<void>(`/v1/roles/${roleId}/employees/${employeeId}`, { method: 'DELETE' });
		},
	};
};
