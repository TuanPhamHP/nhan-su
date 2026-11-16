import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse } from '~/types/api.types';
import type {
	CreateEmployeeDocumentTypeDto,
	EmployeeDocumentType,
	UpdateEmployeeDocumentTypeDto,
} from '~/types/hr-profile.types';

/**
 * Danh mục loại giấy tờ nhân viên (lô 3a).
 *
 * Ai đăng nhập cũng đọc được danh sách loại đang dùng, vì form tải tài liệu cần nó. Thêm, sửa
 * và tắt cần quyền `employee:document-type:manage`; loại không xoá được, chỉ tắt.
 */
export const useEmployeeDocumentTypeService = () => {
	const authFetch = useAuthFetch();

	return {
		/** `includeInactive` chỉ có tác dụng với người có quyền quản lý danh mục. */
		async findAll(includeInactive = false): Promise<EmployeeDocumentType[]> {
			const res = await authFetch<ApiResponse<EmployeeDocumentType[]>>('/v1/employee-document-types', {
				params: includeInactive ? { includeInactive: true } : undefined,
			});
			return res.data;
		},

		async create(payload: CreateEmployeeDocumentTypeDto): Promise<EmployeeDocumentType> {
			const res = await authFetch<ApiResponse<EmployeeDocumentType>>('/v1/employee-document-types', {
				method: 'POST',
				body: payload,
			});
			return res.data;
		},

		async update(id: number, payload: UpdateEmployeeDocumentTypeDto): Promise<EmployeeDocumentType> {
			const res = await authFetch<ApiResponse<EmployeeDocumentType>>(`/v1/employee-document-types/${id}`, {
				method: 'PATCH',
				body: payload,
			});
			return res.data;
		},
	};
};
