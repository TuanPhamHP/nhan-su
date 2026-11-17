import { useGeneralRequestService } from '~/services/general-request.service';
import type {
	GeneralRequestResponse,
	PendingRequest,
	QueryRequestParams,
} from '~/types/general-request.types';
import type { PaginatedMeta } from '~/types/api.types';

/**
 * Năm hộp phiếu của trang danh sách (lô 4a): phiếu của tôi, phiếu cần bổ sung, phiếu chờ tôi
 * duyệt, phiếu tôi theo dõi, và tra cứu theo phạm vi xem được.
 *
 * Mỗi hộp giữ dữ liệu riêng để đổi tab không phải tải lại từ đầu. Hộp "chờ tôi duyệt" không
 * phân trang vì máy chủ trả cả mảng, hạn gần nhất trước.
 */
export function useGeneralRequests() {
	const service = useGeneralRequestService();

	const myRequests = ref<GeneralRequestResponse[]>([]);
	const myMeta = ref<PaginatedMeta | null>(null);
	const myLoading = ref(false);

	const returnedRequests = ref<GeneralRequestResponse[]>([]);
	const returnedMeta = ref<PaginatedMeta | null>(null);
	const returnedLoading = ref(false);

	const pendingRequests = ref<PendingRequest[]>([]);
	const pendingLoading = ref(false);

	const watchingRequests = ref<GeneralRequestResponse[]>([]);
	const watchingMeta = ref<PaginatedMeta | null>(null);
	const watchingLoading = ref(false);

	const searchResults = ref<GeneralRequestResponse[]>([]);
	const searchMeta = ref<PaginatedMeta | null>(null);
	const searchLoading = ref(false);

	async function fetchMine(params?: QueryRequestParams) {
		myLoading.value = true;
		try {
			const res = await service.findMe(params);
			myRequests.value = res.data;
			myMeta.value = res.meta;
		} finally {
			myLoading.value = false;
		}
	}

	async function fetchReturned(params?: QueryRequestParams) {
		returnedLoading.value = true;
		try {
			const res = await service.findMe({ ...params, status: 'RETURNED' });
			returnedRequests.value = res.data;
			returnedMeta.value = res.meta;
		} finally {
			returnedLoading.value = false;
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

	async function fetchWatching(params?: QueryRequestParams) {
		watchingLoading.value = true;
		try {
			const res = await service.findWatching(params);
			watchingRequests.value = res.data;
			watchingMeta.value = res.meta;
		} finally {
			watchingLoading.value = false;
		}
	}

	async function fetchSearch(params?: QueryRequestParams) {
		searchLoading.value = true;
		try {
			const res = await service.findAll(params);
			searchResults.value = res.data;
			searchMeta.value = res.meta;
		} finally {
			searchLoading.value = false;
		}
	}

	return {
		myRequests,
		myMeta,
		myLoading,
		returnedRequests,
		returnedMeta,
		returnedLoading,
		pendingRequests,
		pendingLoading,
		watchingRequests,
		watchingMeta,
		watchingLoading,
		searchResults,
		searchMeta,
		searchLoading,
		fetchMine,
		fetchReturned,
		fetchPendingForMe,
		fetchWatching,
		fetchSearch,
	};
}
