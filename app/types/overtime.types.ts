export type OvertimeStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'AUTO_CANCELLED';

export type OvertimeWorkMode = 'ONLINE' | 'OFFLINE';

export type OtLocationCheckType = 'START' | 'END';

export interface OvertimeApproverDto {
	id: number;
	fullName: string;
}

export interface OvertimeEmployeeDto {
	id: number;
	fullName: string;
	employeeCode: string;
	department: string | null;
}

export interface OtLocationCheckStatus {
	checkedAt: string | null;
	isValid: boolean | null;
}

export interface OtLocationStatus {
	start: OtLocationCheckStatus;
	end: OtLocationCheckStatus;
	isResolved: boolean;
}

export interface OvertimeRequestResponse {
	id: number;
	overtimeDate: string;
	startTime: string;
	endTime: string;
	totalHours: number;
	reason: string;
	status: OvertimeStatus;
	workMode: OvertimeWorkMode;
	otRate: 150 | 200 | 300;
	otRateLabel: string;
	finalWorkMode: OvertimeWorkMode | null;
	resolvedAt: string | null;
	locationStatus: OtLocationStatus;
	reviewNote: string | null;
	assignedApprover: OvertimeApproverDto | null;
	reviewedBy: OvertimeApproverDto | null;
	reviewedAt: string | null;
	autoExpireAt: string;
	deadlineAt: string;
	isExpired: boolean;
	employee: OvertimeEmployeeDto;
	createdAt: string;
	canBeCancelled: boolean;
	hoursDisplay: string;
}

export interface OvertimeMonthlyStatsResponse {
	employeeId: number;
	employeeCode: string;
	fullName: string;
	departmentName: string | null;
	totalRequests: number;
	approvedRequests: number;
	totalApprovedHours: number;
	pendingRequests: number;
	rejectedRequests: number;
}

export interface OvertimeMyStats {
	month: number;
	year: number;
	totalHours: number;
	countByStatus: Record<string, number>;
}

export interface CreateOvertimeRequestDto {
	overtimeDate: string;
	startTime: string;
	endTime: string;
	reason: string;
	workMode: OvertimeWorkMode;
}

export interface RejectOvertimeDto {
	reviewNote: string;
}

export interface CheckOtLocationDto {
	latitude: number;
	longitude: number;
	checkType: OtLocationCheckType;
}

export interface CheckOtLocationResponse {
	isValid: boolean;
	locationName: string | null;
	distanceMeters: number | null;
	checkType: OtLocationCheckType;
}

export interface QueryOvertimeParams {
	page?: number;
	limit?: number;
	status?: OvertimeStatus;
	startDate?: string;
	endDate?: string;
	month?: number;
	year?: number;
	departmentId?: number;
	employeeId?: number;
}

export interface QueryOvertimeReportParams {
	month: number;
	year: number;
	departmentId?: number;
}
