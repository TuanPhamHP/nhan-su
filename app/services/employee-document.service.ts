import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse } from '~/types/api.types';
import type { DocumentType, EmployeeDocumentResponse } from '~/types/employee.types';

export const useEmployeeDocumentService = () => {
	const authFetch = useAuthFetch();

	return {
		async findAll(employeeId: number): Promise<EmployeeDocumentResponse[]> {
			const res = await authFetch<ApiResponse<EmployeeDocumentResponse[]>>(
				`/v1/employees/${employeeId}/documents`,
			);
			return res.data;
		},

		async upload(employeeId: number, file: File, type: DocumentType): Promise<EmployeeDocumentResponse> {
			const formData = new FormData();
			formData.append('file', file);
			formData.append('type', type);
			const res = await authFetch<ApiResponse<EmployeeDocumentResponse>>(
				`/v1/employees/${employeeId}/documents`,
				{ method: 'POST', body: formData },
			);
			return res.data;
		},

		remove(employeeId: number, documentId: number): Promise<void> {
			return authFetch<void>(`/v1/employees/${employeeId}/documents/${documentId}`, {
				method: 'DELETE',
			});
		},

		async getUrl(employeeId: number, documentId: number): Promise<string> {
			const res = await authFetch<ApiResponse<{ presignedUrl: string }>>(
				`/v1/employees/${employeeId}/documents/${documentId}/url`,
			);
			return res.data.presignedUrl;
		},
	};
};
