import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedResponse, PaginatedMeta } from '~/types/api.types';
import type {
	Department,
	DepartmentSummary,
	DepartmentQueryParams,
	CreateDepartmentDto,
	UpdateDepartmentDto,
} from '~/types/department.types';

export const useDepartmentService = () => {
	const authFetch = useAuthFetch();

	return {
		async findAll(params?: DepartmentQueryParams): Promise<{ data: DepartmentSummary[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<DepartmentSummary>>('/v1/departments', { params });
			return { data: res.data, meta: res.meta };
		},

		async findOne(id: number): Promise<Department> {
			const res = await authFetch<ApiResponse<Department>>(`/v1/departments/${id}`);
			return res.data;
		},

		async create(payload: CreateDepartmentDto): Promise<Department> {
			const res = await authFetch<ApiResponse<Department>>('/v1/departments', {
				method: 'POST',
				body: payload,
			});
			return res.data;
		},

		async update(id: number, payload: UpdateDepartmentDto): Promise<Department> {
			const res = await authFetch<ApiResponse<Department>>(`/v1/departments/${id}`, {
				method: 'PATCH',
				body: payload,
			});
			return res.data;
		},

		async changeManager(id: number, employeeId: number): Promise<Department> {
			const res = await authFetch<ApiResponse<Department>>(`/v1/departments/${id}/manager`, {
				method: 'PATCH',
				body: { employeeId },
			});
			return res.data;
		},

		deactivate(id: number): Promise<void> {
			return authFetch<void>(`/v1/departments/${id}`, { method: 'DELETE' });
		},
	};
};
