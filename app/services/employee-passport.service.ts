import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse } from '~/types/api.types';
import type {
	PassportResponse,
	CreatePassportPayload,
	UpdatePassportPayload,
	PassportPhotoSide,
} from '~/types/employee-passport.types';

export const useEmployeePassportService = () => {
	const authFetch = useAuthFetch();

	return {
		async findOne(employeeId: number): Promise<PassportResponse | null> {
			const res = await authFetch<ApiResponse<PassportResponse | null>>(
				`/v1/employees/${employeeId}/passport`,
			);
			return res.data;
		},

		async create(employeeId: number, payload: CreatePassportPayload): Promise<PassportResponse> {
			const res = await authFetch<ApiResponse<PassportResponse>>(
				`/v1/employees/${employeeId}/passport`,
				{ method: 'POST', body: payload },
			);
			return res.data;
		},

		async update(employeeId: number, payload: UpdatePassportPayload): Promise<PassportResponse> {
			const res = await authFetch<ApiResponse<PassportResponse>>(
				`/v1/employees/${employeeId}/passport`,
				{ method: 'PATCH', body: payload },
			);
			return res.data;
		},

		remove(employeeId: number): Promise<void> {
			return authFetch<void>(`/v1/employees/${employeeId}/passport`, { method: 'DELETE' });
		},

		async uploadPhoto(employeeId: number, side: PassportPhotoSide, file: File): Promise<PassportResponse> {
			const formData = new FormData();
			formData.append('file', file);
			const res = await authFetch<ApiResponse<PassportResponse>>(
				`/v1/employees/${employeeId}/passport/photos/${side}`,
				{ method: 'POST', body: formData },
			);
			return res.data;
		},

		async removePhoto(employeeId: number, side: PassportPhotoSide): Promise<PassportResponse> {
			const res = await authFetch<ApiResponse<PassportResponse>>(
				`/v1/employees/${employeeId}/passport/photos/${side}`,
				{ method: 'DELETE' },
			);
			return res.data;
		},
	};
};
