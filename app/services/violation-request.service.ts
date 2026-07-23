import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedResponse, PaginatedMeta } from '~/types/api.types';
import type {
	ViolationRequest,
	MyViolationStatus,
	ViolationMonthlyStats,
	CreateViolationRequestDto,
	RejectViolationRequestDto,
	QueryViolationRequestParams,
	QueryViolationReportParams,
} from '~/types/violation.types';

export const useViolationRequestService = () => {
	const authFetch = useAuthFetch();

	return {
		async findMe(params?: QueryViolationRequestParams): Promise<{ data: ViolationRequest[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<ViolationRequest>>('/v1/violation-requests/me', { params });
			return { data: res.data, meta: res.meta };
		},

		async getMyStatus(month: number, year: number): Promise<MyViolationStatus> {
			const res = await authFetch<ApiResponse<MyViolationStatus>>('/v1/violation-requests/me/status', {
				params: { month, year },
			});
			return res.data;
		},

		async create(dto: CreateViolationRequestDto): Promise<ViolationRequest> {
			const form = new FormData();
			form.append('type', dto.type);
			form.append('violationDate', dto.violationDate);
			form.append('reason', dto.reason);
			if (dto.evidencePhoto) form.append('evidencePhoto', dto.evidencePhoto);

			const res = await authFetch<ApiResponse<ViolationRequest>>('/v1/violation-requests', {
				method: 'POST',
				body: form,
			});
			return res.data;
		},

		async findById(id: number): Promise<ViolationRequest> {
			const res = await authFetch<ApiResponse<ViolationRequest>>(`/v1/violation-requests/${id}`);
			return res.data;
		},

		async findAll(params?: QueryViolationRequestParams): Promise<{ data: ViolationRequest[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<ViolationRequest>>('/v1/violation-requests', { params });
			return { data: res.data, meta: res.meta };
		},

		async getReport(params: QueryViolationReportParams): Promise<ViolationMonthlyStats[]> {
			const res = await authFetch<ApiResponse<ViolationMonthlyStats[]>>('/v1/violation-requests/report', { params });
			return res.data;
		},

		async exportReport(params: QueryViolationReportParams): Promise<Blob> {
			return authFetch<Blob>('/v1/reports/violations/export', { params, responseType: 'blob' });
		},

		async approve(id: number): Promise<ViolationRequest> {
			const res = await authFetch<ApiResponse<ViolationRequest>>(`/v1/violation-requests/${id}/approve`, {
				method: 'PATCH',
			});
			return res.data;
		},

		async reject(id: number, dto: RejectViolationRequestDto): Promise<ViolationRequest> {
			const res = await authFetch<ApiResponse<ViolationRequest>>(`/v1/violation-requests/${id}/reject`, {
				method: 'PATCH',
				body: dto,
			});
			return res.data;
		},

		async cancel(id: number): Promise<ViolationRequest> {
			const res = await authFetch<ApiResponse<ViolationRequest>>(`/v1/violation-requests/${id}/cancel`, {
				method: 'PATCH',
			});
			return res.data;
		},
	};
};
