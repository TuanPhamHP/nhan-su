export type RoleType = 'DEFAULT' | 'CUSTOM';

export interface PermissionDto {
	id: number;
	code: string;
	name: string;
}

export interface PermissionGroupDto {
	group: string;
	permissions: PermissionDto[];
}

export interface RoleSummary {
	id: number;
	name: string;
	type: RoleType;
	permissionCount: number;
	employeeCount: number;
	updatedAt: string;
}

export interface RoleDetail {
	id: number;
	name: string;
	description: string | null;
	type: RoleType;
	permissions: PermissionDto[];
	permissionCount: number;
	employeeCount: number;
	createdAt: string;
	updatedAt: string;
}

export interface RoleEmployee {
	id: number;
	employeeCode: string;
	fullName: string;
	email: string;
	department: string | null;
}

export interface CreateRoleDto {
	name: string;
	description?: string;
	permissionIds?: number[];
}

export interface UpdateRoleDto {
	name?: string;
	description?: string;
}

export interface AssignPermissionsDto {
	permissionIds: number[];
}

export interface AssignEmployeesDto {
	employeeIds: number[];
}

export interface RoleQueryParams {
	page?: number;
	limit?: number;
	search?: string;
	type?: RoleType;
}
