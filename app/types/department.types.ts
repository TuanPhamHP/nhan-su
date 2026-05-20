export interface ManagerSummary {
	id: number;
	fullName: string;
	email: string;
}

export interface DepartmentSummary {
	id: number;
	name: string;
	isActive: boolean;
	employeeCount: number;
}

export interface Department {
	id: number;
	name: string;
	isActive: boolean;
	manager: ManagerSummary | null;
	employeeCount: number;
	createdAt: string;
	updatedAt: string;
}

export interface CreateDepartmentDto {
	name: string;
	managerId?: number;
}

export interface UpdateDepartmentDto {
	name?: string;
	managerId?: number;
}

export interface DepartmentQueryParams {
	search?: string;
	isActive?: boolean;
	page?: number;
	limit?: number;
	pagination?: boolean;
}
