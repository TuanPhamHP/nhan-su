import { useEmployeeService } from '~/services/employee.service';
import type { Employee, EmployeeSummary, EmployeeQueryParams, CreateEmployeeDto, UpdateEmployeeDto } from '~/types/employee.types';
import type { PaginatedMeta } from '~/types/api.types';

export function useEmployee() {
	const service = useEmployeeService();

	const items = ref<EmployeeSummary[]>([]);
	const currentEmployee = ref<Employee | null>(null);
	const meta = ref<PaginatedMeta | null>(null);
	const loading = ref(false);
	const detailLoading = ref(false);

	async function fetchList(params?: EmployeeQueryParams) {
		loading.value = true;
		try {
			const res = await service.findAll(params);
			items.value = res.data;
			meta.value = res.meta;
		} finally {
			loading.value = false;
		}
	}

	async function fetchOne(id: number) {
		detailLoading.value = true;
		try {
			currentEmployee.value = await service.findOne(id);
		} finally {
			detailLoading.value = false;
		}
	}

	async function create(payload: CreateEmployeeDto): Promise<Employee> {
		return service.create(payload);
	}

	async function deactivate(id: number) {
		await service.deactivate(id);
		items.value = items.value.filter(emp => emp.id !== id);
		if (currentEmployee.value?.id === id) {
			currentEmployee.value = { ...currentEmployee.value, status: 'INACTIVE' };
		}
	}

	async function resetPassword(id: number): Promise<string> {
		return service.resetPassword(id);
	}

	async function update(id: number, payload: UpdateEmployeeDto): Promise<Employee> {
		const updated = await service.update(id, payload);
		if (currentEmployee.value?.id === id) {
			currentEmployee.value = updated;
		}
		const idx = items.value.findIndex(e => e.id === id);
		if (idx !== -1) {
			items.value[idx] = {
				...items.value[idx],
				fullName: updated.fullName,
				department: updated.department,
				status: updated.status,
			};
		}
		return updated;
	}

	return {
		items,
		currentEmployee,
		meta,
		loading,
		detailLoading,
		fetchList,
		fetchOne,
		create,
		deactivate,
		update,
		resetPassword,
	};
}
