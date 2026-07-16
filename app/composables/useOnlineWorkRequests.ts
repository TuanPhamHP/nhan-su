import { useOnlineWorkRequestService } from '~/services/online-work-request.service';
import { useApprovalService } from '~/services/approval.service';
import type {
	OnlineWorkRequestResponse,
	OnlineWorkMonthlyStats,
	QueryOnlineWorkParams,
	QueryOnlineWorkReportParams,
} from '~/types/online-work-request.types';
import type { PaginatedMeta } from '~/types/api.types';

export function useOnlineWorkRequests() {
	const service = useOnlineWorkRequestService();
	const approvalService = useApprovalService();

	const requests = ref<OnlineWorkRequestResponse[]>([]);
	const requestsMeta = ref<PaginatedMeta | null>(null);
	const loading = ref(false);

	const pending = ref<OnlineWorkRequestResponse[]>([]);
	const pendingLoading = ref(false);

	const reportData = ref<OnlineWorkMonthlyStats[]>([]);
	const reportLoading = ref(false);

	async function fetchAll(params?: QueryOnlineWorkParams) {
		loading.value = true;
		try {
			const res = await service.findAll(params);
			requests.value = res.data;
			requestsMeta.value = res.meta;
		} finally {
			loading.value = false;
		}
	}

	async function fetchPendingForMe() {
		pendingLoading.value = true;
		try {
			const res = await approvalService.listOnlineWorkRequests({ limit: 100 });
			pending.value = res.data.filter(r => r.status.startsWith('PENDING'));
		} finally {
			pendingLoading.value = false;
		}
	}

	async function approve(id: number): Promise<OnlineWorkRequestResponse> {
		return service.approve(id);
	}

	async function reject(id: number, rejectNote: string): Promise<OnlineWorkRequestResponse> {
		return service.reject(id, { rejectNote });
	}

	async function fetchReport(params: QueryOnlineWorkReportParams) {
		reportLoading.value = true;
		try {
			reportData.value = await service.fetchReport(params);
		} finally {
			reportLoading.value = false;
		}
	}

	async function exportReport(params: QueryOnlineWorkReportParams): Promise<Blob> {
		return service.exportReport(params);
	}

	return {
		requests,
		requestsMeta,
		loading,
		pending,
		pendingLoading,
		reportData,
		reportLoading,
		fetchAll,
		fetchPendingForMe,
		approve,
		reject,
		fetchReport,
		exportReport,
	};
}
