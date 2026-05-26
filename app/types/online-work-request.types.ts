export type OnlineWorkStatus =
	| 'PENDING_L1'
	| 'PENDING_L2'
	| 'PENDING_L3'
	| 'COMPLETED'
	| 'REJECTED'
	| 'CANCELLED';

export type WorkType = 'ONLINE_APPROVED' | 'ONLINE_T7' | 'OFFLINE' | null;

export interface OnlineWorkApprover {
	id: number;
	fullName: string;
}

export interface OnlineWorkEmployee {
	id: number;
	fullName: string;
	employeeCode: string;
	department: string | null;
}

export interface OnlineWorkRequestResponse {
	id: number;
	startDate: string;
	endDate: string;
	totalDays: number;
	reason: string;
	status: OnlineWorkStatus;
	requiresMultiLevel: boolean;
	employee: OnlineWorkEmployee;
	approverL1: OnlineWorkApprover | null;
	approverL2: OnlineWorkApprover | null;
	approvedL1By: OnlineWorkApprover | null;
	approvedL1At: string | null;
	approvedL2By: OnlineWorkApprover | null;
	approvedL2At: string | null;
	approvedL3By: OnlineWorkApprover | null;
	approvedL3At: string | null;
	rejectedBy: OnlineWorkApprover | null;
	rejectedAt: string | null;
	rejectNote: string | null;
	rejectLevel: number | null;
	currentLevel: 1 | 2 | 3 | null;
	canBeApprovedBy: number[];
	canBeCancelled: boolean;
	statusLabel: string;
	createdAt: string;
}

export interface OnlineWorkMonthlyStats {
	employeeCode: string;
	fullName: string;
	departmentName: string;
	totalRequests: number;
	completedRequests: number;
	totalDaysApproved: number;
	pendingRequests: number;
	rejectedRequests: number;
}

export interface CreateOnlineWorkRequestDto {
	startDate: string;
	endDate: string;
	reason: string;
}

export interface RejectOnlineWorkDto {
	rejectNote: string;
}

export interface QueryOnlineWorkParams {
	status?: OnlineWorkStatus;
	departmentId?: number;
	employeeId?: number;
	startDate?: string;
	endDate?: string;
	page?: number;
	limit?: number;
}

export interface QueryOnlineWorkReportParams {
	month: number;
	year: number;
	departmentId?: number;
}
