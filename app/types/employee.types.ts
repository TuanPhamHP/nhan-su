import type { UserRole } from './auth.types';

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
export type EmployeeGender = 'Nam' | 'Nữ' | 'Khác';

export type EmploymentType =
	| 'FULL_TIME'
	| 'PROBATION'
	| 'APPRENTICE'
	| 'INTERN'
	| 'PART_TIME'
	| 'CONTRACTOR';

export interface DepartmentSummary {
	id: number;
	name: string;
}

export interface PositionSummary {
	id: number;
	name: string;
}

export interface DefaultShiftSummary {
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
	/** "YYYY-MM-DD" — chỉ khác null khi status = 'INACTIVE' (BE bổ sung 12/10/2026). */
	terminationDate: string | null;
	role: UserRole;
	employmentType: EmploymentType;
	position: {
		name: string;
		id: number;
	} | null;
	avatarUrl?: string | null;
}

export interface ManagerSummary {
	id: number;
	fullName: string;
	email: string;
}

export interface Employee {
	id: number;
	employeeCode: string;
	fullName: string;
	email: string;
	phone: string | null;
	role: UserRole;
	employmentType: EmploymentType;
	status: EmployeeStatus;
	joinDate: string;
	/** "YYYY-MM-DD" — chỉ khác null khi status = 'INACTIVE'. */
	terminationDate: string | null;
	dateOfBirth: string | null;
	gender: EmployeeGender | null;
	address: string | null;
	avatarUrl: string | null;
	department: DepartmentSummary | null;
	position: PositionSummary | null;
	manager: ManagerSummary | null;
	defaultShift: DefaultShiftSummary | null;
	createdAt: string;
}

export interface CreateEmployeeDto {
	fullName: string;
	email: string;
	password: string;
	joinDate: string;
	role: UserRole;
	employmentType?: EmploymentType;
	departmentId?: number;
	positionId?: number;
	managerId?: number;
	defaultShiftId?: number;
	phone?: string;
	dateOfBirth?: string;
	gender?: EmployeeGender;
	address?: string;
}

export interface UpdateEmployeeDto {
	fullName?: string;
	joinDate?: string;
	role?: UserRole;
	employmentType?: EmploymentType;
	departmentId?: number | null;
	positionId?: number;
	managerId?: number;
	phone?: string;
	dateOfBirth?: string;
	gender?: EmployeeGender;
	address?: string;
}

/** Body optional của DELETE /v1/employees/:id — bỏ trống thì BE lấy ngày hiện tại (giờ VN). */
export interface DeactivateEmployeeDto {
	terminationDate?: string; // "YYYY-MM-DD"
}

export interface EmployeeQueryParams {
	departmentId?: number;
	status?: EmployeeStatus;
	role?: UserRole;
	employmentType?: EmploymentType;
	search?: string;
	page?: number;
	limit?: number;
	pagination?: boolean;
}

export type DocumentType = 'ID_CARD' | 'CONTRACT' | 'OTHER';

export interface EmployeeDocumentResponse {
	id: number;
	type: DocumentType;
	typeLabel: string;
	fileName: string;
	fileUrl: string;
	fileType: string;
	uploadedAt: string;
}
