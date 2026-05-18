import { useCheckInLocationService } from '~/services/check-in-location.service';
import type { CheckInLocation, CreateCheckInLocationDto } from '~/types/check-in-location.types';
import type { EmployeeSummary } from '~/types/employee.types';

export function useCheckInLocation() {
	const service = useCheckInLocationService();

	const locations = ref<CheckInLocation[]>([]);
	const loading = ref(false);
	// Session-only employee list per location — no GET endpoint exists for this
	const locationEmployeesMap = ref<Record<number, EmployeeSummary[]>>({});

	async function fetchLocations() {
		loading.value = true;
		try {
			locations.value = await service.findAll();
		} finally {
			loading.value = false;
		}
	}

	async function createLocation(dto: CreateCheckInLocationDto): Promise<CheckInLocation> {
		const created = await service.create(dto);
		locations.value = [...locations.value, created];
		return created;
	}

	async function deactivateLocation(id: number): Promise<void> {
		await service.deactivate(id);
		const idx = locations.value.findIndex(l => l.id === id);
		if (idx !== -1) {
			locations.value[idx] = { ...locations.value[idx], isActive: false };
		}
	}

	async function assignEmployee(locationId: number, employee: EmployeeSummary): Promise<void> {
		await service.assignEmployee(locationId, employee.id);
		const existing = locationEmployeesMap.value[locationId] ?? [];
		locationEmployeesMap.value = {
			...locationEmployeesMap.value,
			[locationId]: [...existing, employee],
		};
	}

	async function removeEmployee(locationId: number, employeeId: number): Promise<void> {
		await service.removeEmployee(locationId, employeeId);
		const existing = locationEmployeesMap.value[locationId] ?? [];
		locationEmployeesMap.value = {
			...locationEmployeesMap.value,
			[locationId]: existing.filter(e => e.id !== employeeId),
		};
	}

	return {
		locations,
		loading,
		locationEmployeesMap,
		fetchLocations,
		createLocation,
		deactivateLocation,
		assignEmployee,
		removeEmployee,
	};
}
