import { useBusinessTripService } from '~/services/business-trip.service';
import { useApprovalService } from '~/services/approval.service';
import type {
	BusinessTripResponse,
	QueryBusinessTripsParams,
	UpdateRouteTransportDto,
} from '~/types/business-trip.types';
import type { PaginatedMeta } from '~/types/api.types';

export function useBusinessTrips() {
	const service = useBusinessTripService();
	const approvalService = useApprovalService();

	const myTrips = ref<BusinessTripResponse[]>([]);
	const myTripsMeta = ref<PaginatedMeta | null>(null);
	const myTripsLoading = ref(false);

	const pendingTrips = ref<BusinessTripResponse[]>([]);
	const pendingLoading = ref(false);

	async function fetchMyTrips(params?: QueryBusinessTripsParams) {
		myTripsLoading.value = true;
		try {
			const res = await service.findMe(params);
			myTrips.value = res.data;
			myTripsMeta.value = res.meta;
		} finally {
			myTripsLoading.value = false;
		}
	}

	async function fetchPendingForMe() {
		pendingLoading.value = true;
		try {
			const res = await approvalService.listBusinessTrips({ limit: 100 });
			pendingTrips.value = res.data.filter(t => t.status === 'PENDING');
		} finally {
			pendingLoading.value = false;
		}
	}

	async function approve(id: number): Promise<BusinessTripResponse> {
		return service.approve(id);
	}

	async function reject(id: number, note: string): Promise<BusinessTripResponse> {
		return service.reject(id, { note });
	}

	async function cancelTrip(id: number): Promise<BusinessTripResponse> {
		return service.cancel(id);
	}

	async function updateRouteTransport(routeId: number, dto: UpdateRouteTransportDto): Promise<BusinessTripResponse> {
		return service.updateRouteTransport(routeId, dto);
	}

	async function uploadTripTicket(routeId: number, file: File): Promise<string> {
		return service.uploadRouteTicket(routeId, file);
	}

	async function uploadTripAttachments(tripId: number, files: File[]): Promise<string[]> {
		return service.uploadTripAttachments(tripId, files);
	}

	return {
		myTrips,
		myTripsMeta,
		myTripsLoading,
		pendingTrips,
		pendingLoading,
		fetchMyTrips,
		fetchPendingForMe,
		approve,
		reject,
		cancelTrip,
		updateRouteTransport,
		uploadTripTicket,
		uploadTripAttachments,
	};
}
