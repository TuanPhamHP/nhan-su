import { useOvertimeRequestService } from '~/services/overtime-request.service';
import type {
	OvertimeRequestResponse,
	OvertimeMonthlyStatsResponse,
	OvertimeMyStats,
	QueryOvertimeParams,
	QueryOvertimeReportParams,
} from '~/types/overtime.types';
import type { PaginatedMeta } from '~/types/api.types';

export function useOvertimeRequests() {
	const service = useOvertimeRequestService();

	const requests = ref<OvertimeRequestResponse[]>([]);
	const requestsMeta = ref<PaginatedMeta | null>(null);
	const loading = ref(false);

	const reportData = ref<OvertimeMonthlyStatsResponse[]>([]);
	const reportLoading = ref(false);

	const myStats = ref<OvertimeMyStats | null>(null);

	async function fetchAll(params?: QueryOvertimeParams) {
		loading.value = true;
		try {
			const res = await service.findAll(params);
			requests.value = res.data;
			requestsMeta.value = res.meta;
		} finally {
			loading.value = false;
		}
	}

	async function fetchOne(id: number): Promise<OvertimeRequestResponse> {
		return service.findOne(id);
	}

	async function approve(id: number): Promise<OvertimeRequestResponse> {
		return service.approve(id);
	}

	async function reject(id: number, reviewNote: string): Promise<OvertimeRequestResponse> {
		return service.reject(id, { reviewNote });
	}

	async function fetchReport(params: QueryOvertimeReportParams) {
		reportLoading.value = true;
		try {
			reportData.value = await service.fetchReport(params);
		} finally {
			reportLoading.value = false;
		}
	}

	async function exportReport(params: QueryOvertimeReportParams): Promise<Blob> {
		return service.exportReport(params);
	}

	async function fetchMyStats(month: number, year: number) {
		myStats.value = await service.getMyStats(month, year);
	}

	return {
		requests,
		requestsMeta,
		loading,
		reportData,
		reportLoading,
		myStats,
		fetchAll,
		fetchOne,
		approve,
		reject,
		fetchReport,
		exportReport,
		fetchMyStats,
	};
}
