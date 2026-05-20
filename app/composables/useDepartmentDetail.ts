import { useDepartmentService, useEmployeeService } from '~/services';
import type { Department, UpdateDepartmentDto } from '~/types/department.types';
import type { EmployeeSummary } from '~/types/employee.types';

export function useDepartmentDetail(deptId: number) {
	const deptService = useDepartmentService();
	const empService = useEmployeeService();

	const department = ref<Department | null>(null);
	const loadingDept = ref(false);

	const members = ref<EmployeeSummary[]>([]);
	const loadingMembers = ref(false);

	async function loadDept() {
		loadingDept.value = true;
		try {
			department.value = await deptService.findOne(deptId);
		} finally {
			loadingDept.value = false;
		}
	}

	async function loadMembers() {
		loadingMembers.value = true;
		try {
			const res = await empService.findAll({ departmentId: deptId, pagination: false });
			members.value = res.data;
		} finally {
			loadingMembers.value = false;
		}
	}

	async function updateDept(dto: UpdateDepartmentDto): Promise<void> {
		const updated = await deptService.update(deptId, dto);
		department.value = updated;
	}

	async function assignMember(empId: number): Promise<void> {
		await empService.update(empId, { departmentId: deptId });
		await loadMembers();
		if (department.value) {
			department.value = { ...department.value, employeeCount: department.value.employeeCount + 1 };
		}
	}

	async function removeMember(empId: number): Promise<void> {
		await empService.update(empId, { departmentId: null });
		members.value = members.value.filter(m => m.id !== empId);
		if (department.value) {
			department.value = {
				...department.value,
				employeeCount: Math.max(0, department.value.employeeCount - 1),
			};
		}
	}

	async function deactivateMember(empId: number): Promise<void> {
		await empService.deactivate(empId);
		const idx = members.value.findIndex(m => m.id === empId);
		if (idx !== -1) members.value[idx] = { ...members.value[idx], status: 'INACTIVE' };
	}

	async function activateMember(empId: number): Promise<void> {
		await empService.activate(empId);
		const idx = members.value.findIndex(m => m.id === empId);
		if (idx !== -1) members.value[idx] = { ...members.value[idx], status: 'ACTIVE' };
	}

	async function changeManager(empId: number): Promise<void> {
		const updated = await deptService.changeManager(deptId, empId);
		department.value = updated;
	}

	return {
		department,
		loadingDept,
		members,
		loadingMembers,
		loadDept,
		loadMembers,
		updateDept,
		assignMember,
		removeMember,
		deactivateMember,
		activateMember,
		changeManager,
	};
}
