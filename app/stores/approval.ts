import { defineStore } from 'pinia';
import type { ApprovalCountsResponseDto } from '~/types/approval.types';
import { useApprovalService } from '~/services/approval.service';

const EMPTY_COUNTS: ApprovalCountsResponseDto = {
	leaveRequests: 0,
	makeupAttendance: 0,
	violationRequests: 0,
	overtimeRequests: 0,
	businessTrips: 0,
	onlineWorkRequests: 0,
	total: 0,
};

export const useApprovalStore = defineStore('approval', () => {
	const counts = ref<ApprovalCountsResponseDto>({ ...EMPTY_COUNTS });
	const loading = ref(false);
	let inFlight: Promise<void> | null = null;

	async function fetchCounts() {
		if (inFlight) return inFlight;
		loading.value = true;
		const { getCounts } = useApprovalService();
		inFlight = getCounts()
			.then(res => {
				counts.value = res;
			})
			.catch(() => {
				// Silent: badge failing shouldn't disrupt UI
			})
			.finally(() => {
				loading.value = false;
				inFlight = null;
			});
		return inFlight;
	}

	function reset() {
		counts.value = { ...EMPTY_COUNTS };
	}

	return { counts, loading, fetchCounts, reset };
});
