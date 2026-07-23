import { useViolationRequestService } from '~/services/violation-request.service';
import type {
	ViolationRequest,
	MyViolationStatus,
	CreateViolationRequestDto,
	RejectViolationRequestDto,
	QueryViolationRequestParams,
} from '~/types/violation.types';
import type { PaginatedMeta } from '~/types/api.types';

export function useViolationRequests() {
	const service = useViolationRequestService();

	const myRequests = ref<ViolationRequest[]>([]);
	const allRequests = ref<ViolationRequest[]>([]);
	const monthlyStatus = ref<MyViolationStatus | null>(null);
	const loading = ref(false);
	const myMeta = ref<PaginatedMeta | null>(null);
	const allMeta = ref<PaginatedMeta | null>(null);

	async function fetchMyRequests(params?: QueryViolationRequestParams) {
		loading.value = true;
		try {
			const result = await service.findMe(params);
			myRequests.value = result.data;
			myMeta.value = result.meta;
		} finally {
			loading.value = false;
		}
	}

	async function fetchMyStatus(month: number, year: number) {
		try {
			monthlyStatus.value = await service.getMyStatus(month, year);
		} catch {
			// non-critical
		}
	}

	async function fetchAllRequests(params?: QueryViolationRequestParams) {
		loading.value = true;
		try {
			const result = await service.findAll(params);
			allRequests.value = result.data;
			allMeta.value = result.meta;
		} finally {
			loading.value = false;
		}
	}

	async function submitRequest(dto: CreateViolationRequestDto): Promise<ViolationRequest> {
		return service.create(dto);
	}

	async function approveRequest(id: number): Promise<ViolationRequest> {
		const updated = await service.approve(id);
		_replaceInAll(updated);
		return updated;
	}

	async function rejectRequest(id: number, dto: RejectViolationRequestDto): Promise<ViolationRequest> {
		const updated = await service.reject(id, dto);
		_replaceInAll(updated);
		return updated;
	}

	async function cancelRequest(id: number): Promise<ViolationRequest> {
		const updated = await service.cancel(id);
		_replaceInMy(updated);
		return updated;
	}

	function _replaceInMy(updated: ViolationRequest) {
		const idx = myRequests.value.findIndex(r => r.id === updated.id);
		if (idx !== -1) myRequests.value.splice(idx, 1, updated);
	}

	function _replaceInAll(updated: ViolationRequest) {
		const idx = allRequests.value.findIndex(r => r.id === updated.id);
		if (idx !== -1) allRequests.value.splice(idx, 1, updated);
	}

	return {
		myRequests,
		allRequests,
		monthlyStatus,
		loading,
		myMeta,
		allMeta,
		fetchMyRequests,
		fetchMyStatus,
		fetchAllRequests,
		submitRequest,
		approveRequest,
		rejectRequest,
		cancelRequest,
	};
}
