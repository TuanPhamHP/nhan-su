import { useLeaveBalanceService } from '~/services/leave-balance.service';
import { useLogService } from '~/services/log.service';
import type {
	LeaveSplitRecalcResult,
	LeaveBalanceRecalcResult,
	RecalculateLeaveSplitPayload,
	RecalculateLeaveBalancePayload,
} from '~/types/leave-tools.types';

/** Action name của system-log — chỉ ghi khi THỰC SỰ áp dụng, dry-run không ghi. */
const LOG_ACTION_SPLIT = 'leave_request.recalculate_split';
const LOG_ACTION_BALANCE = 'leave_balance.recalculate';

export interface LeaveToolsFilter {
	year: number;
	month?: number;
	employeeIds?: number[];
}

/**
 * State machine cho wizard tính lại phép năm.
 *
 * Bất biến:
 * - Bước 1 luôn áp dụng trước bước 2 (hoặc bước 1 trả `changed: 0`).
 * - Payload lúc áp dụng phải giống hệt payload lúc xem trước — đổi filter thì
 *   mọi kết quả xem trước bị vô hiệu, bắt xem trước lại.
 */
export function useLeaveTools() {
	const service = useLeaveBalanceService();
	const logService = useLogService();

	const splitPreview = ref<LeaveSplitRecalcResult | null>(null);
	const splitApplied = ref<LeaveSplitRecalcResult | null>(null);
	const splitLoading = ref(false);

	const balancePreview = ref<LeaveBalanceRecalcResult | null>(null);
	const balanceApplied = ref<LeaveBalanceRecalcResult | null>(null);
	const balanceLoading = ref(false);

	/** Snapshot filter tại thời điểm xem trước — dùng để phát hiện filter đã đổi. */
	const previewedFilterKey = ref<string | null>(null);

	const lastSplitRunAt = ref<string | null>(null);
	const lastBalanceRunAt = ref<string | null>(null);

	function filterKey(filter: LeaveToolsFilter): string {
		return JSON.stringify({
			year: filter.year,
			month: filter.month ?? null,
			employeeIds: [...(filter.employeeIds ?? [])].sort((a, b) => a - b),
		});
	}

	function buildPayload(filter: LeaveToolsFilter, dryRun: boolean): RecalculateLeaveSplitPayload {
		const payload: RecalculateLeaveSplitPayload = { year: filter.year, dryRun };
		if (filter.month) payload.month = filter.month;
		if (filter.employeeIds?.length) payload.employeeIds = filter.employeeIds;
		return payload;
	}

	/** Bước 1 không cần áp dụng khi không có gì lệch. */
	const step1Settled = computed(
		() => !!splitApplied.value || (!!splitPreview.value && splitPreview.value.changed === 0),
	);

	function reset() {
		splitPreview.value = null;
		splitApplied.value = null;
		balancePreview.value = null;
		balanceApplied.value = null;
		previewedFilterKey.value = null;
	}

	/** Gọi khi user đổi filter — mọi kết quả đã xem trước không còn khớp payload. */
	function invalidateIfFilterChanged(filter: LeaveToolsFilter) {
		if (previewedFilterKey.value === null) return;
		if (previewedFilterKey.value !== filterKey(filter)) reset();
	}

	async function previewSplit(filter: LeaveToolsFilter): Promise<LeaveSplitRecalcResult> {
		splitLoading.value = true;
		try {
			const res = await service.recalculateRequests(buildPayload(filter, true));
			splitPreview.value = res;
			splitApplied.value = null;
			balancePreview.value = null;
			balanceApplied.value = null;
			previewedFilterKey.value = filterKey(filter);
			return res;
		} finally {
			splitLoading.value = false;
		}
	}

	async function applySplit(filter: LeaveToolsFilter): Promise<LeaveSplitRecalcResult> {
		splitLoading.value = true;
		try {
			const res = await service.recalculateRequests(buildPayload(filter, false));
			splitApplied.value = res;
			// Số dư phải xem trước lại sau khi paidDays vừa đổi.
			balancePreview.value = null;
			balanceApplied.value = null;
			await loadLastRuns();
			return res;
		} finally {
			splitLoading.value = false;
		}
	}

	async function previewBalance(filter: LeaveToolsFilter): Promise<LeaveBalanceRecalcResult> {
		balanceLoading.value = true;
		try {
			const payload: RecalculateLeaveBalancePayload = buildPayload(filter, true);
			const res = await service.recalculateBalances(payload);
			balancePreview.value = res;
			balanceApplied.value = null;
			return res;
		} finally {
			balanceLoading.value = false;
		}
	}

	async function applyBalance(filter: LeaveToolsFilter): Promise<LeaveBalanceRecalcResult> {
		balanceLoading.value = true;
		try {
			const payload: RecalculateLeaveBalancePayload = buildPayload(filter, false);
			const res = await service.recalculateBalances(payload);
			balanceApplied.value = res;
			await loadLastRuns();
			return res;
		} finally {
			balanceLoading.value = false;
		}
	}

	/** Lần chạy thật gần nhất của từng bước — giúp tránh chạy lại làm đổi số đã chốt. */
	async function loadLastRuns() {
		const [split, balance] = await Promise.all([
			logService.findAll({ action: LOG_ACTION_SPLIT, limit: 1 }).catch(() => null),
			logService.findAll({ action: LOG_ACTION_BALANCE, limit: 1 }).catch(() => null),
		]);
		lastSplitRunAt.value = split?.data[0]?.createdAt ?? null;
		lastBalanceRunAt.value = balance?.data[0]?.createdAt ?? null;
	}

	return {
		splitPreview,
		splitApplied,
		splitLoading,
		balancePreview,
		balanceApplied,
		balanceLoading,
		step1Settled,
		lastSplitRunAt,
		lastBalanceRunAt,
		reset,
		invalidateIfFilterChanged,
		previewSplit,
		applySplit,
		previewBalance,
		applyBalance,
		loadLastRuns,
	};
}
