import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedResponse, PaginatedMeta } from '~/types/api.types';
import type {
	Employee,
	EmployeeSummary,
	EmployeeQueryParams,
	CreateEmployeeDto,
	UpdateEmployeeDto,
	DeactivateEmployeeDto,
} from '~/types/employee.types';
import type { ImportEmployeesResponse } from '~/types/employee-import.types';

export const useEmployeeService = () => {
	const authFetch = useAuthFetch();

	return {
		async findAll(params?: EmployeeQueryParams): Promise<{ data: EmployeeSummary[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<EmployeeSummary>>('/v1/employees', { params });
			return { data: res.data, meta: res.meta };
		},

		async findOne(id: number): Promise<Employee> {
			const res = await authFetch<ApiResponse<Employee>>(`/v1/employees/${id}`);
			return res.data;
		},

		async create(payload: CreateEmployeeDto): Promise<Employee> {
			const res = await authFetch<ApiResponse<Employee>>('/v1/employees', {
				method: 'POST',
				body: payload,
			});
			return res.data;
		},

		async update(id: number, payload: UpdateEmployeeDto): Promise<Employee> {
			const res = await authFetch<ApiResponse<Employee>>(`/v1/employees/${id}`, {
				method: 'PATCH',
				body: payload,
			});
			return res.data;
		},

		/**
		 * Vô hiệu hóa nhân viên. `terminationDate` ("YYYY-MM-DD") quyết định tháng cuối cùng
		 * nhân sự còn xuất được bảng công. Bỏ trống → BE tự lấy ngày hiện tại (giờ VN),
		 * nên khi không có ngày thì gửi body rỗng thay vì `terminationDate: ''`.
		 */
		deactivate(id: number, terminationDate?: string): Promise<void> {
			const body: DeactivateEmployeeDto = terminationDate ? { terminationDate } : {};
			return authFetch<void>(`/v1/employees/${id}`, { method: 'DELETE', body });
		},

		activate(id: number): Promise<void> {
			return authFetch<void>(`/v1/employees/${id}`, {
				method: 'PATCH',
				body: { status: 'ACTIVE' },
			});
		},

		async resetPassword(id: number): Promise<string> {
			const res = await authFetch<ApiResponse<{ message: string }>>(`/v1/employees/${id}/reset-password`, {
				method: 'POST',
			});
			return res.data.message;
		},

		async importFromExcel(file: File): Promise<ImportEmployeesResponse> {
			const formData = new FormData();
			formData.append('file', file);
			const res = await authFetch<ApiResponse<ImportEmployeesResponse>>('/v1/employees/import', {
				method: 'POST',
				body: formData,
			});
			return res.data;
		},
	};
};
