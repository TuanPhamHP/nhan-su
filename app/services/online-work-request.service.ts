import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedResponse } from '~/types/api.types';
import type {
	OnlineWorkRequestResponse,
	OnlineWorkMonthlyStats,
	CreateOnlineWorkRequestDto,
	RejectOnlineWorkDto,
	QueryOnlineWorkParams,
	QueryOnlineWorkReportParams,
} from '~/types/online-work-request.types';

export const useOnlineWorkRequestService = () => {
	const authFetch = useAuthFetch();

	return {
		async findAll(params?: QueryOnlineWorkParams): Promise<{ data: OnlineWorkRequestResponse[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
			const res = await authFetch<PaginatedResponse<OnlineWorkRequestResponse>>('/v1/online-work-requests', { params });
			return { data: res.data, meta: res.meta };
		},

		async findMine(params?: QueryOnlineWorkParams): Promise<{ data: OnlineWorkRequestResponse[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
			const res = await authFetch<PaginatedResponse<OnlineWorkRequestResponse>>('/v1/online-work-requests/me', { params });
			return { data: res.data, meta: res.meta };
		},

		async findPendingForMe(): Promise<OnlineWorkRequestResponse[]> {
			const res = await authFetch<ApiResponse<OnlineWorkRequestResponse[]>>('/v1/online-work-requests/pending-for-me');
			return res.data;
		},

		async findOne(id: number): Promise<OnlineWorkRequestResponse> {
			const res = await authFetch<ApiResponse<OnlineWorkRequestResponse>>(`/v1/online-work-requests/${id}`);
			return res.data;
		},

		async create(dto: CreateOnlineWorkRequestDto): Promise<OnlineWorkRequestResponse> {
			const res = await authFetch<ApiResponse<OnlineWorkRequestResponse>>('/v1/online-work-requests', {
				method: 'POST',
				body: dto,
			});
			return res.data;
		},

		async approve(id: number): Promise<OnlineWorkRequestResponse> {
			const res = await authFetch<ApiResponse<OnlineWorkRequestResponse>>(`/v1/online-work-requests/${id}/approve`, {
				method: 'PATCH',
			});
			return res.data;
		},

		async reject(id: number, dto: RejectOnlineWorkDto): Promise<OnlineWorkRequestResponse> {
			const res = await authFetch<ApiResponse<OnlineWorkRequestResponse>>(`/v1/online-work-requests/${id}/reject`, {
				method: 'PATCH',
				body: dto,
			});
			return res.data;
		},

		async cancel(id: number): Promise<OnlineWorkRequestResponse> {
			const res = await authFetch<ApiResponse<OnlineWorkRequestResponse>>(`/v1/online-work-requests/${id}/cancel`, {
				method: 'PATCH',
			});
			return res.data;
		},

		async fetchReport(params: QueryOnlineWorkReportParams): Promise<OnlineWorkMonthlyStats[]> {
			const res = await authFetch<ApiResponse<OnlineWorkMonthlyStats[]>>('/v1/online-work-requests/report', { params });
			return res.data;
		},

		async exportReport(params: QueryOnlineWorkReportParams): Promise<Blob> {
			return authFetch<Blob>('/v1/online-work-requests/report/export', { params, responseType: 'blob' });
		},
	};
};
