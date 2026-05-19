import { useWorkShiftService } from '~/services/work-shift.service';
import type { WorkShiftResponse, CreateWorkShiftDto, UpdateWorkShiftDto } from '~/types/shift.types';

export function useWorkShifts() {
	const service = useWorkShiftService();

	const shifts = ref<WorkShiftResponse[]>([]);
	const loading = ref(false);

	async function fetchWorkShifts() {
		loading.value = true;
		try {
			shifts.value = await service.findAll();
		} finally {
			loading.value = false;
		}
	}

	async function createWorkShift(dto: CreateWorkShiftDto): Promise<WorkShiftResponse> {
		const created = await service.create(dto);
		shifts.value = [...shifts.value, created];
		return created;
	}

	async function updateWorkShift(id: number, dto: UpdateWorkShiftDto): Promise<WorkShiftResponse> {
		const updated = await service.update(id, dto);
		const idx = shifts.value.findIndex(s => s.id === id);
		if (idx !== -1) shifts.value.splice(idx, 1, updated);
		return updated;
	}

	async function deleteWorkShift(id: number): Promise<void> {
		await service.deactivate(id);
		shifts.value = shifts.value.filter(s => s.id !== id);
	}

	return { shifts, loading, fetchWorkShifts, createWorkShift, updateWorkShift, deleteWorkShift };
}
