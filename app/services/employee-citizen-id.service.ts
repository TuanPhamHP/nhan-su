import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedResponse, PaginatedMeta } from '~/types/api.types';
import type {
	CitizenIdResponse,
	CreateCitizenIdPayload,
	UpdateCitizenIdPayload,
} from '~/types/employee-citizen-id.types';
import type { SystemLog } from '~/types/log.types';

export interface CitizenIdHistoryParams {
	page?: number;
	limit?: number;
}

export const useEmployeeCitizenIdService = () => {
	const authFetch = useAuthFetch();

	return {
		async findOne(employeeId: number): Promise<CitizenIdResponse | null> {
			const res = await authFetch<ApiResponse<CitizenIdResponse | null>>(
				`/v1/employees/${employeeId}/citizen-id`,
			);
			return res.data;
		},

		async create(employeeId: number, payload: CreateCitizenIdPayload): Promise<CitizenIdResponse> {
			const res = await authFetch<ApiResponse<CitizenIdResponse>>(
				`/v1/employees/${employeeId}/citizen-id`,
				{ method: 'POST', body: payload },
			);
			return res.data;
		},

		async update(employeeId: number, payload: UpdateCitizenIdPayload): Promise<CitizenIdResponse> {
			const res = await authFetch<ApiResponse<CitizenIdResponse>>(
				`/v1/employees/${employeeId}/citizen-id`,
				{ method: 'PATCH', body: payload },
			);
			return res.data;
		},

		remove(employeeId: number): Promise<void> {
			return authFetch<void>(`/v1/employees/${employeeId}/citizen-id`, { method: 'DELETE' });
		},

		async uploadPhotos(employeeId: number, front: File, back: File): Promise<CitizenIdResponse> {
			const formData = new FormData();
			formData.append('front', front);
			formData.append('back', back);
			const res = await authFetch<ApiResponse<CitizenIdResponse>>(
				`/v1/employees/${employeeId}/citizen-id/photos`,
				{ method: 'POST', body: formData },
			);
			return res.data;
		},

		async findHistory(
			employeeId: number,
			params: CitizenIdHistoryParams = {},
		): Promise<{ data: SystemLog[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<SystemLog>>(
				`/v1/employees/${employeeId}/citizen-id/history`,
				{ params },
			);
			return { data: res.data, meta: res.meta };
		},
	};
};
