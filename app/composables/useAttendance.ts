import { useAttendanceService } from '~/services/attendance.service';
import type { AttendanceRecordDetail, ManualEditAttendanceDto, QueryAttendanceParams } from '~/types/attendance.types';
import type { PaginatedMeta } from '~/types/api.types';

export function useAttendance() {
	const service = useAttendanceService();

	const records = ref<AttendanceRecordDetail[]>([]);
	const loading = ref(false);
	const meta = ref<PaginatedMeta | null>(null);

	async function fetchAll(params?: QueryAttendanceParams) {
		loading.value = true;
		try {
			const result = await service.findAll(params);
			records.value = result.data;
			meta.value = result.meta;
		} finally {
			loading.value = false;
		}
	}

	async function fetchMyHistory(params?: QueryAttendanceParams) {
		loading.value = true;
		try {
			const result = await service.findMyHistory(params);
			records.value = result.data;
			meta.value = result.meta;
		} finally {
			loading.value = false;
		}
	}

	async function checkIn(params: { latitude: number; longitude: number; photo: File }): Promise<AttendanceRecordDetail> {
		return service.checkIn(params);
	}

	async function checkOut(photo: File): Promise<AttendanceRecordDetail> {
		return service.checkOut(photo);
	}

	async function manualEdit(id: number, dto: ManualEditAttendanceDto): Promise<AttendanceRecordDetail> {
		const updated = await service.manualEdit(id, dto);
		const idx = records.value.findIndex(r => r.id === id);
		if (idx !== -1) records.value.splice(idx, 1, updated);
		return updated;
	}

	return {
		records,
		loading,
		meta,
		fetchAll,
		fetchMyHistory,
		checkIn,
		checkOut,
		manualEdit,
	};
}
