export interface PositionDepartment {
	id: number;
	name: string;
}

export interface PositionSummary {
	id: number;
	name: string;
	department: string;
	isActive: boolean;
	employeeCount: number;
}

export interface Position {
	id: number;
	name: string;
	isActive: boolean;
	department: PositionDepartment;
	employeeCount: number;
	createdAt: string;
	updatedAt: string;
}

export interface CreatePositionDto {
	name: string;
	departmentId: number;
}

export interface UpdatePositionDto {
	name?: string;
	departmentId?: number;
}

export interface PositionQueryParams {
	departmentId?: number;
	search?: string;
	isActive?: boolean;
	page?: number;
	limit?: number;
}
