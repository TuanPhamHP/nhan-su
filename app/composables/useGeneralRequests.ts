import { useGeneralRequestService } from '~/services/general-request.service';
import type {
	GeneralRequestResponse,
	QueryRequestParams,
} from '~/types/general-request.types';
import type { PaginatedMeta } from '~/types/api.types';

export function useGeneralRequests() {
	const service = useGeneralRequestService();

	const myRequests = ref<GeneralRequestResponse[]>([]);
	const myRequestsMeta = ref<PaginatedMeta | null>(null);
	const myLoading = ref(false);

	const pendingRequests = ref<GeneralRequestResponse[]>([]);
	const pendingLoading = ref(false);

	async function fetchMyRequests(params?: QueryRequestParams) {
		myLoading.value = true;
		try {
			const res = await service.findMe(params);
			myRequests.value = res.data;
			myRequestsMeta.value = res.meta;
		} finally {
			myLoading.value = false;
		}
	}

	async function fetchPendingForMe() {
		pendingLoading.value = true;
		try {
			pendingRequests.value = await service.findPendingForMe();
		} finally {
			pendingLoading.value = false;
		}
	}

	async function approve(id: number, note?: string): Promise<GeneralRequestResponse> {
		return service.approve(id, note ? { note } : undefined);
	}

	async function reject(id: number, note: string): Promise<GeneralRequestResponse> {
		return service.reject(id, { note });
	}

	return {
		myRequests,
		myRequestsMeta,
		myLoading,
		pendingRequests,
		pendingLoading,
		fetchMyRequests,
		fetchPendingForMe,
		approve,
		reject,
	};
}
