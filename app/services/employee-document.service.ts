import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse } from '~/types/api.types';
import type { EmployeeDocumentResponse, UploadDocumentPayload } from '~/types/employee-document.types';

export const useEmployeeDocumentService = () => {
	const authFetch = useAuthFetch();

	return {
		async findAll(employeeId: number): Promise<EmployeeDocumentResponse[]> {
			const res = await authFetch<ApiResponse<EmployeeDocumentResponse[]>>(
				`/v1/employees/${employeeId}/documents`,
			);
			return res.data;
		},

		/**
		 * Tải tài liệu lên.
		 *
		 * Lô 3a gửi `documentTypeId` lấy từ danh mục loại giấy tờ. Bỏ trống ngày hết hạn thì
		 * server tính theo thời hạn mặc định của loại, nên không cần FE tự cộng tháng.
		 */
		async upload(employeeId: number, payload: UploadDocumentPayload): Promise<EmployeeDocumentResponse> {
			const formData = new FormData();
			formData.append('file', payload.file);
			formData.append('documentTypeId', String(payload.documentTypeId));
			if (payload.issuedDate) formData.append('issuedDate', payload.issuedDate);
			if (payload.expiryDate) formData.append('expiryDate', payload.expiryDate);
			if (payload.note) formData.append('note', payload.note);
			if (payload.relativeId) formData.append('relativeId', String(payload.relativeId));
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
