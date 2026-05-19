import { useMakeupAttendanceService } from '~/services/makeup-attendance.service';
import type { MakeupRequestResponse, CreateMakeupRequestDto, QueryMakeupRequestParams } from '~/types/makeup-attendance.types';
import type { PaginatedMeta } from '~/types/api.types';

export function useMakeupAttendance() {
	const service = useMakeupAttendanceService();

	const requests = ref<MakeupRequestResponse[]>([]);
	const loading = ref(false);
	const meta = ref<PaginatedMeta | null>(null);

	async function fetchMyRequests(params?: QueryMakeupRequestParams) {
		loading.value = true;
		try {
			const result = await service.findMyRequests(params);
			requests.value = result.data;
			meta.value = result.meta;
		} finally {
			loading.value = false;
		}
	}

	async function fetchAllRequests(params?: QueryMakeupRequestParams) {
		loading.value = true;
		try {
			const result = await service.findAll(params);
			requests.value = result.data;
			meta.value = result.meta;
		} finally {
			loading.value = false;
		}
	}

	async function createRequest(params: { dto: CreateMakeupRequestDto; evidencePhoto?: File }): Promise<MakeupRequestResponse> {
		return service.create(params);
	}

	async function approveRequest(id: string, reviewNote?: string): Promise<MakeupRequestResponse> {
		return service.approve(id, reviewNote);
	}

	async function rejectRequest(id: string, reviewNote: string): Promise<MakeupRequestResponse> {
		return service.reject(id, reviewNote);
	}

	return {
		requests,
		loading,
		meta,
		fetchMyRequests,
		fetchAllRequests,
		createRequest,
		approveRequest,
		rejectRequest,
	};
}
