import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse } from '~/types/api.types';
import type { ApprovalDelegation, CreateDelegationDto } from '~/types/approval-delegation.types';

/**
 * Uỷ quyền duyệt (`/v1/approval-delegations`, lô 4a).
 *
 * `findAll` trả cả uỷ quyền tôi giao và uỷ quyền người khác giao cho tôi, phân biệt bằng
 * `isMine`. Chỉ người uỷ quyền huỷ được uỷ quyền của mình.
 */
export const useApprovalDelegationService = () => {
	const authFetch = useAuthFetch();

	return {
		async findAll(): Promise<ApprovalDelegation[]> {
			const res = await authFetch<ApiResponse<ApprovalDelegation[]>>('/v1/approval-delegations');
			return res.data;
		},

		async create(dto: CreateDelegationDto): Promise<ApprovalDelegation> {
			const res = await authFetch<ApiResponse<ApprovalDelegation>>('/v1/approval-delegations', {
				method: 'POST',
				body: dto,
			});
			return res.data;
		},

		remove(id: number): Promise<void> {
			return authFetch<void>(`/v1/approval-delegations/${id}`, { method: 'DELETE' });
		},
	};
};
