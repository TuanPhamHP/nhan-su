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
	/**
	 * Trưởng phòng. Bàn giao UAT 26/11/2026 ghi danh sách đã trả trường này nhưng API chưa trả (chỉ
	 * `GET /departments/:id` có), nên để tuỳ chọn: thiếu thì ô chọn người không ghi "Trưởng phòng".
	 */
	manager?: Pick<ManagerSummary, 'id' | 'fullName'> | null;
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
