import { useCheckInLocationService } from '~/services/check-in-location.service';
import type { CheckInLocation, CreateCheckInLocationDto, UpdateCheckInLocationDto } from '~/types/check-in-location.types';
import type { EmployeeSummary } from '~/types/employee.types';

export function useCheckInLocation() {
	const service = useCheckInLocationService();

	const locations = ref<CheckInLocation[]>([]);
	const loading = ref(false);
	const locationEmployees = ref<EmployeeSummary[]>([]);
	const employeesLoading = ref(false);

	async function fetchLocations() {
		loading.value = true;
		try {
			locations.value = await service.findAll();
		} finally {
			loading.value = false;
		}
	}

	async function fetchLocationEmployees(locationId: number) {
		employeesLoading.value = true;
		try {
			locationEmployees.value = await service.findEmployees(locationId);
		} finally {
			employeesLoading.value = false;
		}
	}

	async function createLocation(dto: CreateCheckInLocationDto): Promise<CheckInLocation> {
		const created = await service.create(dto);
		locations.value = [...locations.value, created];
		return created;
	}

	async function updateLocation(id: number, dto: UpdateCheckInLocationDto): Promise<CheckInLocation> {
		const updated = await service.update(id, dto);
		const idx = locations.value.findIndex(l => l.id === id);
		if (idx !== -1) locations.value.splice(idx, 1, updated);
		return updated;
	}

	async function deactivateLocation(id: number): Promise<void> {
		await service.deactivate(id);
		const idx = locations.value.findIndex(l => l.id === id);
		const loc = idx !== -1 ? locations.value[idx] : undefined;
		if (loc) {
			locations.value.splice(idx, 1, { ...loc, isActive: false });
		}
	}

	async function assignEmployee(locationId: number, employee: EmployeeSummary): Promise<void> {
		await service.assignEmployee(locationId, employee.id);
		locationEmployees.value = [...locationEmployees.value, employee];
	}

	async function removeEmployee(locationId: number, employeeId: number): Promise<void> {
		await service.removeEmployee(locationId, employeeId);
		locationEmployees.value = locationEmployees.value.filter(e => e.id !== employeeId);
	}

	async function bulkAssign(locationId: number, employees: EmployeeSummary[]): Promise<void> {
		const employeeIds = employees.map(e => e.id);
		await service.bulkAssignEmployees(locationId, employeeIds);
		const existingIds = new Set(locationEmployees.value.map(e => e.id));
		const newEmployees = employees.filter(e => !existingIds.has(e.id));
		locationEmployees.value = [...locationEmployees.value, ...newEmployees];
	}

	return {
		locations,
		loading,
		locationEmployees,
		employeesLoading,
		fetchLocations,
		fetchLocationEmployees,
		createLocation,
		updateLocation,
		deactivateLocation,
		assignEmployee,
		removeEmployee,
		bulkAssign,
	};
}
