export interface PositionDepartment {
	id: number;
	name: string;
}

/** Nhóm vị trí việc làm của Mẫu 01/PLI, thêm ở lô 3a. */
export type JobGroup = 'MANAGER' | 'HIGH_SKILL' | 'MID_SKILL' | 'OTHER';

export const JOB_GROUP_LABELS: Record<JobGroup, string> = {
	MANAGER: 'Nhà quản lý',
	HIGH_SKILL: 'Chuyên môn kỹ thuật bậc cao',
	MID_SKILL: 'Chuyên môn kỹ thuật bậc trung',
	OTHER: 'Khác',
};

export interface PositionSummary {
	id: number;
	name: string;
	department: string;
	isActive: boolean;
	jobGroup: JobGroup | null;
	jobGroupLabel: string | null;
	employeeCount: number;
}

export interface Position {
	id: number;
	name: string;
	isActive: boolean;
	department: PositionDepartment;
	jobGroup: JobGroup | null;
	jobGroupLabel: string | null;
	employeeCount: number;
	createdAt: string;
	updatedAt: string;
}

export interface CreatePositionDto {
	name: string;
	departmentId: number;
	jobGroup?: JobGroup | null;
}

export interface UpdatePositionDto {
	name?: string;
	departmentId?: number;
	/** Gửi `null` là bỏ nhóm vị trí việc làm. */
	jobGroup?: JobGroup | null;
}

export interface QueryPositionParams {
	departmentId?: number;
	search?: string;
	isActive?: boolean;
	page?: number;
	limit?: number;
	pagination?: boolean;
}

/** @deprecated use QueryPositionParams */
export type PositionQueryParams = QueryPositionParams;
