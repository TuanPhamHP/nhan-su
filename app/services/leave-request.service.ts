import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedResponse, PaginatedMeta } from '~/types/api.types';
import type {
	LeaveRequest,
	LeaveRequestSummary,
	LeavePreviewResponse,
	QueryLeaveRequestParams,
	CreateLeaveRequestDto,
} from '~/types/leave.types';

export const useLeaveRequestService = () => {
	const authFetch = useAuthFetch();

	return {
		async findAll(params?: QueryLeaveRequestParams): Promise<{ data: LeaveRequest[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<LeaveRequest>>('/v1/leave-requests', { params });
			return { data: res.data, meta: res.meta };
		},

		async findMe(params?: QueryLeaveRequestParams): Promise<{ data: LeaveRequest[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<LeaveRequest>>('/v1/leave-requests/me', { params });
			return { data: res.data, meta: res.meta };
		},

		async preview(dto: CreateLeaveRequestDto): Promise<LeavePreviewResponse> {
			const res = await authFetch<ApiResponse<LeavePreviewResponse>>('/v1/leave-requests/preview', {
				method: 'POST',
				body: dto,
			});
			return res.data;
		},

		async create(dto: CreateLeaveRequestDto): Promise<LeaveRequest> {
			const res = await authFetch<ApiResponse<LeaveRequest>>('/v1/leave-requests', {
				method: 'POST',
				body: dto,
			});
			return res.data;
		},

		async getSummary(): Promise<LeaveRequestSummary> {
			const res = await authFetch<ApiResponse<LeaveRequestSummary>>('/v1/leave-requests/summary');
			return res.data;
		},

		async approve(id: number): Promise<LeaveRequest> {
			const res = await authFetch<ApiResponse<LeaveRequest>>(`/v1/leave-requests/${id}/approve`, {
				method: 'PATCH',
			});
			return res.data;
		},

		async reject(id: number, rejectNote: string): Promise<LeaveRequest> {
			const res = await authFetch<ApiResponse<LeaveRequest>>(`/v1/leave-requests/${id}/reject`, {
				method: 'PATCH',
				body: { rejectNote },
			});
			return res.data;
		},

		async cancel(id: number): Promise<LeaveRequest> {
			const res = await authFetch<ApiResponse<LeaveRequest>>(`/v1/leave-requests/${id}/cancel`, {
				method: 'PATCH',
			});
			return res.data;
		},

		async remove(id: number): Promise<void> {
			await authFetch(`/v1/leave-requests/${id}`, { method: 'DELETE' });
		},
	};
};
