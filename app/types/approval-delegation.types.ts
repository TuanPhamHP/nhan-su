/**
 * Uỷ quyền duyệt (`/v1/approval-delegations`, lô 4a).
 *
 * Uỷ quyền chỉ áp khi một bước TỚI LƯỢT trong khoảng ngày: lượt của người vắng chuyển sang
 * người được uỷ quyền và phiếu ghi "duyệt thay". Bước đã tới lượt trước khi lập uỷ quyền thì
 * giữ nguyên người cũ.
 */
import type { Person } from '~/types/general-request.types';

export interface ApprovalDelegation {
	id: number;
	delegator: Person;
	delegate: Person;
	/** `YYYY-MM-DD`, giờ Việt Nam. */
	startDate: string;
	/** Tính cả ngày này. */
	endDate: string;
	note: string | null;
	/** Tôi là người uỷ quyền, nên huỷ được. */
	isMine: boolean;
	createdAt: string;
}

export interface CreateDelegationDto {
	delegateId: number;
	startDate: string;
	endDate: string;
	note?: string;
}
