import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedResponse, PaginatedMeta } from '~/types/api.types';
import type {
	LeaveBalance,
	CreateLeaveBalanceDto,
	UpdateLeaveBalanceDto,
	QueryLeaveBalanceParams,
	EmployeeBalanceGroup,
	QueryEmployeeBalanceParams,
} from '~/types/leave.types';
import type {
	RecalculateLeaveSplitPayload,
	LeaveSplitRecalcResult,
	RecalculateLeaveBalancePayload,
	LeaveBalanceRecalcResult,
} from '~/types/leave-tools.types';

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

		async findByEmployee(params: QueryEmployeeBalanceParams): Promise<{ data: EmployeeBalanceGroup[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<EmployeeBalanceGroup>>('/v1/leave-balances/by-employee', { params });
			return { data: res.data, meta: res.meta };
		},

		async bulkInit(year: number, leaveTypeId?: number): Promise<{ created: number; skipped: number }> {
			const body: { year: number; leaveTypeId?: number } = { year };
			if (leaveTypeId !== undefined) body.leaveTypeId = leaveTypeId;
			const res = await authFetch<ApiResponse<{ created: number; skipped: number }>>('/v1/leave-balances/bulk-init', {
				method: 'POST',
				body,
			});
			return res.data;
		},

		/**
		 * BƯỚC 1 — tính lại phần P/KL của đơn ANNUAL + HALF_DAY đã duyệt.
		 * Luôn chạy trước `recalculateBalances()`.
		 */
		async recalculateRequests(payload: RecalculateLeaveSplitPayload): Promise<LeaveSplitRecalcResult> {
			const res = await authFetch<ApiResponse<LeaveSplitRecalcResult>>('/v1/leave-balances/recalculate-requests', {
				method: 'POST',
				body: payload,
			});
			return res.data;
		},

		/** BƯỚC 2 — cộng lại `usedDays` từ toàn bộ đơn APPROVED của năm rồi ghi đè. */
		async recalculateBalances(payload: RecalculateLeaveBalancePayload): Promise<LeaveBalanceRecalcResult> {
			const res = await authFetch<ApiResponse<LeaveBalanceRecalcResult>>('/v1/leave-balances/recalculate', {
				method: 'POST',
				body: payload,
			});
			return res.data;
		},
	};
};
