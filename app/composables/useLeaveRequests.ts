import { useLeaveRequestService } from '~/services/leave-request.service';
import type { LeaveRequest, LeaveRequestSummary, QueryLeaveRequestParams, CreateLeaveRequestDto } from '~/types/leave.types';
import type { PaginatedMeta } from '~/types/api.types';

export function useLeaveRequests() {
	const service = useLeaveRequestService();

	const requests = ref<LeaveRequest[]>([]);
	const loading = ref(false);
	const meta = ref<PaginatedMeta | null>(null);
	const summary = ref<LeaveRequestSummary | null>(null);

	async function fetchAll(params?: QueryLeaveRequestParams) {
		loading.value = true;
		try {
			const result = await service.findAll(params);
			requests.value = result.data;
			meta.value = result.meta;
		} finally {
			loading.value = false;
		}
	}

	async function fetchMyRequests(params?: QueryLeaveRequestParams) {
		loading.value = true;
		try {
			const result = await service.findMe(params);
			requests.value = result.data;
			meta.value = result.meta;
		} finally {
			loading.value = false;
		}
	}

	async function fetchSummary() {
		try {
			summary.value = await service.getSummary();
		} catch {
			// non-critical
		}
	}

	async function submitRequest(dto: CreateLeaveRequestDto): Promise<LeaveRequest> {
		return service.create(dto);
	}

	async function approveRequest(id: number): Promise<LeaveRequest> {
		const updated = await service.approve(id);
		_replaceInList(updated);
		return updated;
	}

	async function rejectRequest(id: number, rejectNote: string): Promise<LeaveRequest> {
		const updated = await service.reject(id, rejectNote);
		_replaceInList(updated);
		return updated;
	}

	async function cancelRequest(id: number): Promise<LeaveRequest> {
		const updated = await service.cancel(id);
		_replaceInList(updated);
		return updated;
	}

	async function removeRequest(id: number): Promise<void> {
		await service.remove(id);
		requests.value = requests.value.filter(r => r.id !== id);
	}

	function _replaceInList(updated: LeaveRequest) {
		const idx = requests.value.findIndex(r => r.id === updated.id);
		if (idx !== -1) requests.value.splice(idx, 1, updated);
	}

	return {
		requests,
		loading,
		meta,
		summary,
		fetchAll,
		fetchMyRequests,
		fetchSummary,
		submitRequest,
		approveRequest,
		rejectRequest,
		cancelRequest,
		removeRequest,
	};
}
