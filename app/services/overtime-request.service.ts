import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedResponse } from '~/types/api.types';
import type {
	OvertimeRequestResponse,
	OvertimeMonthlyStatsResponse,
	OvertimeMyStats,
	CreateOvertimeRequestDto,
	RejectOvertimeDto,
	QueryOvertimeParams,
	QueryOvertimeReportParams,
	CheckOtLocationDto,
	CheckOtLocationResponse,
} from '~/types/overtime.types';

export const useOvertimeRequestService = () => {
	const authFetch = useAuthFetch();

	return {
		async findAll(params?: QueryOvertimeParams): Promise<{ data: OvertimeRequestResponse[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
			const res = await authFetch<PaginatedResponse<OvertimeRequestResponse>>('/v1/overtime-requests', { params });
			return { data: res.data, meta: res.meta };
		},

		async findOne(id: number): Promise<OvertimeRequestResponse> {
			const res = await authFetch<ApiResponse<OvertimeRequestResponse>>(`/v1/overtime-requests/${id}`);
			return res.data;
		},

		async findMine(params?: QueryOvertimeParams): Promise<{ data: OvertimeRequestResponse[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
			const res = await authFetch<PaginatedResponse<OvertimeRequestResponse>>('/v1/overtime-requests/me', { params });
			return { data: res.data, meta: res.meta };
		},

		async getMyStats(month: number, year: number): Promise<OvertimeMyStats> {
			const res = await authFetch<ApiResponse<OvertimeMyStats>>('/v1/overtime-requests/me/stats', {
				params: { month, year },
			});
			return res.data;
		},

		async create(dto: CreateOvertimeRequestDto): Promise<OvertimeRequestResponse> {
			const res = await authFetch<ApiResponse<OvertimeRequestResponse>>('/v1/overtime-requests', {
				method: 'POST',
				body: dto,
			});
			return res.data;
		},

		async approve(id: number): Promise<OvertimeRequestResponse> {
			const res = await authFetch<ApiResponse<OvertimeRequestResponse>>(`/v1/overtime-requests/${id}/approve`, {
				method: 'PATCH',
			});
			return res.data;
		},

		async reject(id: number, dto: RejectOvertimeDto): Promise<OvertimeRequestResponse> {
			const res = await authFetch<ApiResponse<OvertimeRequestResponse>>(`/v1/overtime-requests/${id}/reject`, {
				method: 'PATCH',
				body: dto,
			});
			return res.data;
		},

		async cancel(id: number): Promise<OvertimeRequestResponse> {
			const res = await authFetch<ApiResponse<OvertimeRequestResponse>>(`/v1/overtime-requests/${id}/cancel`, {
				method: 'PATCH',
			});
			return res.data;
		},

		async fetchReport(params: QueryOvertimeReportParams): Promise<OvertimeMonthlyStatsResponse[]> {
			const res = await authFetch<ApiResponse<OvertimeMonthlyStatsResponse[]>>('/v1/overtime-requests/report', { params });
			return res.data;
		},

		async exportReport(params: QueryOvertimeReportParams): Promise<Blob> {
			return authFetch<Blob>('/v1/overtime-requests/report/export', { params, responseType: 'blob' });
		},

		async checkLocation(id: number, dto: CheckOtLocationDto): Promise<CheckOtLocationResponse> {
			const res = await authFetch<ApiResponse<CheckOtLocationResponse>>(`/v1/overtime-requests/${id}/check-location`, {
				method: 'POST',
				body: dto,
			});
			return res.data;
		},
	};
};
