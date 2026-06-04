import { defineStore } from 'pinia';
import type { EmployeeSummary } from '~/types/employee.types';
import type { DepartmentSummary } from '~/types/department.types';
import type { PositionSummary } from '~/types/position.types';
import { useEmployeeService, useDepartmentService, usePositionService } from '~/services';

export const useDirectoryStore = defineStore('directory', () => {
	const employees = ref<EmployeeSummary[]>([]);
	const departments = ref<DepartmentSummary[]>([]);
	const positions = ref<PositionSummary[]>([]);
	const loaded = ref(false);
	const loading = ref(false);

	async function load() {
		if (loaded.value || loading.value) return;
		loading.value = true;
		try {
			const employeeService = useEmployeeService();
			const departmentService = useDepartmentService();
			const positionService = usePositionService();
			const [empResult, deptResult, posResult] = await Promise.all([
				employeeService.findAll({ status: 'ACTIVE', pagination: false }),
				departmentService.findAll({ pagination: false }),
				positionService.findAll({ pagination: false }),
			]);
			employees.value = empResult.data;
			departments.value = deptResult.data;
			positions.value = posResult.data;
			loaded.value = true;
		} finally {
			loading.value = false;
		}
	}

	function reset() {
		employees.value = [];
		departments.value = [];
		positions.value = [];
		loaded.value = false;
	}

	return { employees, departments, positions, loaded, loading, load, reset };
});
