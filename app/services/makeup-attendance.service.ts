import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedResponse, PaginatedMeta } from '~/types/api.types';
import type {
	MakeupRequestResponse,
	CreateMakeupRequestDto,
	QueryMakeupRequestParams,
} from '~/types/makeup-attendance.types';

export const useMakeupAttendanceService = () => {
	const authFetch = useAuthFetch();

	return {
		async findMyRequests(params?: QueryMakeupRequestParams): Promise<{ data: MakeupRequestResponse[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<MakeupRequestResponse>>('/v1/makeup-attendance/me', { params });
			return { data: res.data, meta: res.meta };
		},

		async findAll(params?: QueryMakeupRequestParams): Promise<{ data: MakeupRequestResponse[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<MakeupRequestResponse>>('/v1/makeup-attendance', { params });
			return { data: res.data, meta: res.meta };
		},

		async create(params: { dto: CreateMakeupRequestDto; evidencePhoto?: File }): Promise<MakeupRequestResponse> {
			const formData = new FormData();
			formData.append('attendanceDate', params.dto.attendanceDate);
			if (params.dto.requestedCheckIn) formData.append('requestedCheckIn', params.dto.requestedCheckIn);
			if (params.dto.requestedCheckOut) formData.append('requestedCheckOut', params.dto.requestedCheckOut);
			formData.append('reason', params.dto.reason);
			if (params.evidencePhoto) formData.append('evidencePhoto', params.evidencePhoto);
			const res = await authFetch<ApiResponse<MakeupRequestResponse>>('/v1/makeup-attendance', {
				method: 'POST',
				body: formData,
			});
			return res.data;
		},

		async approve(id: string, reviewNote?: string): Promise<MakeupRequestResponse> {
			const res = await authFetch<ApiResponse<MakeupRequestResponse>>(`/v1/makeup-attendance/${id}/approve`, {
				method: 'PATCH',
				body: reviewNote ? { reviewNote } : {},
			});
			return res.data;
		},

		async reject(id: string, reviewNote: string): Promise<MakeupRequestResponse> {
			const res = await authFetch<ApiResponse<MakeupRequestResponse>>(`/v1/makeup-attendance/${id}/reject`, {
				method: 'PATCH',
				body: { reviewNote },
			});
			return res.data;
		},
	};
};
