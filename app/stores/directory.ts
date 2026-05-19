import { defineStore } from 'pinia';
import type { EmployeeSummary } from '~/types/employee.types';
import type { DepartmentSummary } from '~/types/department.types';
import { useEmployeeService, useDepartmentService } from '~/services';

export const useDirectoryStore = defineStore('directory', () => {
	const employees = ref<EmployeeSummary[]>([]);
	const departments = ref<DepartmentSummary[]>([]);
	const loaded = ref(false);
	const loading = ref(false);

	async function load() {
		if (loaded.value || loading.value) return;
		loading.value = true;
		try {
			const employeeService = useEmployeeService();
			const departmentService = useDepartmentService();
			const [empResult, deptResult] = await Promise.all([
				employeeService.findAll({ limit: 100, page: 1 }),
				departmentService.findAll({ limit: 100, page: 1 }),
			]);
			employees.value = empResult.data;
			departments.value = deptResult.data;
			loaded.value = true;
		} finally {
			loading.value = false;
		}
	}

	function reset() {
		employees.value = [];
		departments.value = [];
		loaded.value = false;
	}

	return { employees, departments, loaded, loading, load, reset };
});
