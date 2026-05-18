import { useRoleService } from '~/services/role.service';
import { usePermissionService } from '~/services/permission.service';
import type { RoleSummary, RoleDetail, RoleEmployee, RoleQueryParams, PermissionGroupDto } from '~/types/role.types';
import type { PaginatedMeta } from '~/types/api.types';

export function useRole() {
	const roleService = useRoleService();
	const permissionService = usePermissionService();

	const roles = ref<RoleSummary[]>([]);
	const roleMeta = ref<PaginatedMeta | null>(null);
	const currentRole = ref<RoleDetail | null>(null);
	const roleEmployees = ref<RoleEmployee[]>([]);
	const employeeMeta = ref<PaginatedMeta | null>(null);
	const permissionGroups = ref<PermissionGroupDto[]>([]);

	const loading = ref(false);
	const detailLoading = ref(false);
	const employeeLoading = ref(false);
	const permissionsLoading = ref(false);

	async function fetchRoles(params?: RoleQueryParams) {
		loading.value = true;
		try {
			const res = await roleService.findAll(params);
			roles.value = res.data;
			roleMeta.value = res.meta;
		} finally {
			loading.value = false;
		}
	}

	async function fetchRole(id: number) {
		detailLoading.value = true;
		try {
			currentRole.value = await roleService.findOne(id);
		} finally {
			detailLoading.value = false;
		}
	}

	async function fetchPermissionGroups() {
		permissionsLoading.value = true;
		try {
			permissionGroups.value = await permissionService.findAll();
		} finally {
			permissionsLoading.value = false;
		}
	}

	async function fetchRoleEmployees(roleId: number, params?: { page?: number; limit?: number }) {
		employeeLoading.value = true;
		try {
			const res = await roleService.getEmployees(roleId, params);
			roleEmployees.value = res.data;
			employeeMeta.value = res.meta;
		} finally {
			employeeLoading.value = false;
		}
	}

	async function createRole(payload: { name: string; description?: string; permissionIds?: number[] }) {
		const created = await roleService.create(payload);
		roles.value.push({
			id: created.id,
			name: created.name,
			type: created.type,
			permissionCount: created.permissionCount,
			employeeCount: created.employeeCount,
			updatedAt: created.updatedAt,
		});
		return created;
	}

	async function updateRole(id: number, payload: { name?: string; description?: string }) {
		const updated = await roleService.update(id, payload);
		const idx = roles.value.findIndex(r => r.id === id);
		const existingRole = idx !== -1 ? roles.value[idx] : undefined;
		if (existingRole) {
			roles.value[idx] = { ...existingRole, name: updated.name };
		}
		if (currentRole.value?.id === id) currentRole.value = updated;
		return updated;
	}

	async function deleteRole(id: number) {
		await roleService.delete(id);
		roles.value = roles.value.filter(r => r.id !== id);
		if (currentRole.value?.id === id) currentRole.value = null;
	}

	async function savePermissions(roleId: number, permissionIds: number[]) {
		const updated = await roleService.updatePermissions(roleId, { permissionIds });
		if (currentRole.value?.id === roleId) currentRole.value = updated;
		const idx = roles.value.findIndex(r => r.id === roleId);
		const existingRole = idx !== -1 ? roles.value[idx] : undefined;
		if (existingRole) {
			roles.value[idx] = { ...existingRole, permissionCount: updated.permissionCount };
		}
		return updated;
	}

	async function addEmployeesToRole(roleId: number, employeeIds: number[]) {
		await roleService.addEmployees(roleId, { employeeIds });
		await fetchRoleEmployees(roleId);
		const idx = roles.value.findIndex(r => r.id === roleId);
		const existingRole = idx !== -1 ? roles.value[idx] : undefined;
		if (existingRole) {
			roles.value[idx] = { ...existingRole, employeeCount: existingRole.employeeCount + employeeIds.length };
		}
		const cr = currentRole.value;
		if (cr && cr.id === roleId) {
			currentRole.value = { ...cr, employeeCount: cr.employeeCount + employeeIds.length };
		}
	}

	async function removeEmployeeFromRole(roleId: number, employeeId: number) {
		await roleService.removeEmployee(roleId, employeeId);
		roleEmployees.value = roleEmployees.value.filter(e => e.id !== employeeId);
		const idx = roles.value.findIndex(r => r.id === roleId);
		const existingRole = idx !== -1 ? roles.value[idx] : undefined;
		if (existingRole) {
			roles.value[idx] = { ...existingRole, employeeCount: Math.max(0, existingRole.employeeCount - 1) };
		}
		const cr = currentRole.value;
		if (cr && cr.id === roleId) {
			currentRole.value = { ...cr, employeeCount: Math.max(0, cr.employeeCount - 1) };
		}
	}

	return {
		roles,
		roleMeta,
		currentRole,
		roleEmployees,
		employeeMeta,
		permissionGroups,
		loading,
		detailLoading,
		employeeLoading,
		permissionsLoading,
		fetchRoles,
		fetchRole,
		fetchPermissionGroups,
		fetchRoleEmployees,
		createRole,
		updateRole,
		deleteRole,
		savePermissions,
		addEmployeesToRole,
		removeEmployeeFromRole,
	};
}
