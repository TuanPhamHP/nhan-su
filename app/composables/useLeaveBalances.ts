import { useLeaveBalanceService } from '~/services/leave-balance.service';
import type { LeaveBalance, CreateLeaveBalanceDto, UpdateLeaveBalanceDto, QueryLeaveBalanceParams } from '~/types/leave.types';
import type { PaginatedMeta } from '~/types/api.types';

export function useLeaveBalances() {
	const service = useLeaveBalanceService();

	const balances = ref<LeaveBalance[]>([]);
	const loading = ref(false);
	const meta = ref<PaginatedMeta | null>(null);

	async function fetchBalances(params?: QueryLeaveBalanceParams) {
		loading.value = true;
		try {
			const result = await service.findAll(params);
			balances.value = result.data;
			meta.value = result.meta;
		} finally {
			loading.value = false;
		}
	}

	async function createBalance(dto: CreateLeaveBalanceDto): Promise<LeaveBalance> {
		const created = await service.create(dto);
		balances.value.unshift(created);
		return created;
	}

	async function updateBalance(id: number, dto: UpdateLeaveBalanceDto): Promise<LeaveBalance> {
		const updated = await service.update(id, dto);
		const idx = balances.value.findIndex(b => b.id === id);
		if (idx !== -1) balances.value.splice(idx, 1, updated);
		return updated;
	}

	async function bulkInit(year: number, leaveTypeId?: number): Promise<{ created: number; skipped: number }> {
		return service.bulkInit(year, leaveTypeId);
	}

	return {
		balances,
		loading,
		meta,
		fetchBalances,
		createBalance,
		updateBalance,
		bulkInit,
	};
}
