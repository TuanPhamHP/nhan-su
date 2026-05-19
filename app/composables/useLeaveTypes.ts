import { useLeaveTypeService } from '~/services/leave-type.service';
import type { LeaveType, CreateLeaveTypeDto, UpdateLeaveTypeDto } from '~/types/leave.types';

export function useLeaveTypes() {
	const service = useLeaveTypeService();

	const leaveTypes = ref<LeaveType[]>([]);
	const loading = ref(false);

	async function fetchLeaveTypes() {
		loading.value = true;
		try {
			leaveTypes.value = await service.findAll();
		} finally {
			loading.value = false;
		}
	}

	async function createLeaveType(dto: CreateLeaveTypeDto): Promise<LeaveType> {
		const created = await service.create(dto);
		leaveTypes.value.push(created);
		return created;
	}

	async function updateLeaveType(id: number, dto: UpdateLeaveTypeDto): Promise<LeaveType> {
		const updated = await service.update(id, dto);
		const idx = leaveTypes.value.findIndex(t => t.id === id);
		if (idx !== -1) leaveTypes.value.splice(idx, 1, updated);
		return updated;
	}

	async function deactivateLeaveType(id: number): Promise<void> {
		await service.deactivate(id);
		const idx = leaveTypes.value.findIndex(t => t.id === id);
		if (idx !== -1) leaveTypes.value[idx].isActive = false;
	}

	return {
		leaveTypes,
		loading,
		fetchLeaveTypes,
		createLeaveType,
		updateLeaveType,
		deactivateLeaveType,
	};
}
