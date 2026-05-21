export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type HalfDayPeriod = 'MORNING' | 'AFTERNOON';
export type LeaveTypeCode = 'ANNUAL' | 'HALF_DAY' | 'LATE' | 'EARLY' | string;
export type LeaveCode = 'P' | 'KL' | 'P+KL';

export interface LeaveEmployeeRef {
	id: number;
	fullName: string;
	employeeCode: string;
	department: string | null;
}

export interface LeaveTypeRef {
	id: number;
	name: string;
	code: LeaveTypeCode;
}

export interface ApprovedByRef {
	id: number;
	fullName: string;
}

export interface TimelineActor {
	id: number;
	fullName: string;
	position: string | null;
}

export interface LeaveTimeline {
	submittedAt: string;
	submittedBy: TimelineActor;
	reviewedAt: string | null;
	reviewedBy: TimelineActor | null;
	action: 'APPROVED' | 'REJECTED' | 'CANCELLED' | null;
}

export interface AssignedApproverRef {
	id: number;
	fullName: string;
	email: string;
}

export interface LeaveRequest {
	id: number;
	employee: LeaveEmployeeRef;
	leaveType: LeaveTypeRef;
	startDate: string;
	endDate: string;
	totalDays: number;
	reason: string | null;
	status: LeaveStatus;
	halfDayPeriod: HalfDayPeriod | null;
	lateMinutes: number | null;
	earlyMinutes: number | null;
	approvedBy: ApprovedByRef | null;
	approvedAt: string | null;
	rejectNote: string | null;
	assignedApprover: AssignedApproverRef | null;
	createdAt: string;
	canBeRevoked: boolean;
	canBeRemoved: boolean;
	timeline: LeaveTimeline | null;
	leaveCode?: LeaveCode;
	paidDays?: number;
	unpaidDays?: number;
}

export interface LeavePreviewResponse {
	totalDays: number;
	paidDays: number;
	unpaidDays: number;
	leaveCode: LeaveCode;
	warningMessage: string | null;
	remainingAfter: number;
	currentBalance: number;
}

export interface LeaveType {
	id: number;
	name: string;
	code: LeaveTypeCode;
	daysPerYear: number | null;
	isPaid: boolean;
	isActive: boolean;
}

export interface LeaveBalanceTypeRef {
	id: number;
	name: string;
	code: string;
}

export interface LeaveBalanceEmployee {
	id: number;
	fullName: string;
	employeeCode: string;
	department: string | null;
}

export interface LeaveBalance {
	id: number;
	employee?: LeaveBalanceEmployee;
	leaveType: LeaveBalanceTypeRef;
	year: number;
	totalDays: number;
	usedDays: number;
	remainingDays: number;
}

export interface LeaveRequestSummary {
	pending: number;
	approvedThisMonth: number;
	rejected: number;
	cancelled: number;
}

export interface CreateLeaveTypeDto {
	name: string;
	code: string;
	daysPerYear: number | null;
	isPaid: boolean;
}

export interface UpdateLeaveTypeDto {
	name?: string;
	code?: string;
	daysPerYear?: number | null;
	isPaid?: boolean;
}

export interface CreateLeaveBalanceDto {
	employeeId: number;
	leaveTypeId: number;
	year: number;
	totalDays: number;
}

export interface UpdateLeaveBalanceDto {
	totalDays: number;
}

export interface CreateLeaveRequestDto {
	leaveTypeId: number;
	startDate: string;
	endDate: string;
	reason?: string;
	halfDayPeriod?: HalfDayPeriod;
	lateMinutes?: number;
	earlyMinutes?: number;
}

export interface QueryLeaveRequestParams {
	page?: number;
	limit?: number;
	employeeId?: number;
	departmentId?: number;
	status?: LeaveStatus;
	leaveTypeId?: number;
	startDate?: string;
	endDate?: string;
}

export interface QueryLeaveBalanceParams {
	year?: number;
	leaveTypeId?: number;
	employeeId?: number;
	page?: number;
	limit?: number;
}
