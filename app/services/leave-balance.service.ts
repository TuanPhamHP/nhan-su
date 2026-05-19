import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedResponse, PaginatedMeta } from '~/types/api.types';
import type {
	LeaveBalance,
	CreateLeaveBalanceDto,
	UpdateLeaveBalanceDto,
	QueryLeaveBalanceParams,
} from '~/types/leave.types';

export const useLeaveBalanceService = () => {
	const authFetch = useAuthFetch();

	return {
		async findAll(params?: QueryLeaveBalanceParams): Promise<{ data: LeaveBalance[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<LeaveBalance>>('/v1/leave-balances', { params });
			return { data: res.data, meta: res.meta };
		},

		async findMe(): Promise<LeaveBalance[]> {
			const res = await authFetch<ApiResponse<LeaveBalance[]>>('/v1/leave-balances/me');
			return res.data;
		},

		async create(dto: CreateLeaveBalanceDto): Promise<LeaveBalance> {
			const res = await authFetch<ApiResponse<LeaveBalance>>('/v1/leave-balances', {
				method: 'POST',
				body: dto,
			});
			return res.data;
		},

		async update(id: number, dto: UpdateLeaveBalanceDto): Promise<LeaveBalance> {
			const res = await authFetch<ApiResponse<LeaveBalance>>(`/v1/leave-balances/${id}`, {
				method: 'PATCH',
				body: dto,
			});
			return res.data;
		},

		async bulkInit(leaveTypeId: number, year: number): Promise<{ created: number; skipped: number }> {
			const res = await authFetch<ApiResponse<{ created: number; skipped: number }>>('/v1/leave-balances/bulk-init', {
				method: 'POST',
				body: { leaveTypeId, year },
			});
			return res.data;
		},
	};
};
