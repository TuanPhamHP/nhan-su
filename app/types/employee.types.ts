import type { UserRole } from './auth.types';

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
export type EmployeeGender = 'Nam' | 'Nữ' | 'Khác';

export interface DepartmentSummary {
	id: number;
	name: string;
}

export interface PositionSummary {
	id: number;
	name: string;
}

export interface EmployeeSummary {
	id: number;
	employeeCode: string;
	fullName: string;
	email: string;
	department: DepartmentSummary | null;
	status: EmployeeStatus;
	role: UserRole;
}

export interface Employee {
	id: number;
	employeeCode: string;
	fullName: string;
	email: string;
	phone: string | null;
	role: UserRole;
	status: EmployeeStatus;
	joinDate: string;
	dateOfBirth: string | null;
	gender: EmployeeGender | null;
	address: string | null;
	avatarUrl: string | null;
	department: DepartmentSummary | null;
	position: PositionSummary | null;
	createdAt: string;
}

export interface CreateEmployeeDto {
	fullName: string;
	email: string;
	password: string;
	joinDate: string;
	role: UserRole;
	departmentId?: number;
	positionId?: number;
	managerId?: number;
	phone?: string;
	dateOfBirth?: string;
	gender?: EmployeeGender;
	address?: string;
}

export interface UpdateEmployeeDto {
	fullName?: string;
	joinDate?: string;
	role?: UserRole;
	departmentId?: number | null;
	positionId?: number;
	managerId?: number;
	phone?: string;
	dateOfBirth?: string;
	gender?: EmployeeGender;
	address?: string;
}

export interface EmployeeQueryParams {
	departmentId?: number;
	status?: EmployeeStatus;
	role?: UserRole;
	search?: string;
	page?: number;
	limit?: number;
}
