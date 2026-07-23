export type ViolationRequestType = 'FORGOT_CHECKIN' | 'FORGOT_CHECKOUT' | 'LATE' | 'EARLY';
export type ViolationRequestStatus =
	| 'PENDING'
	| 'PENDING_L2'
	| 'APPROVED'
	| 'REJECTED'
	| 'CANCELLED';

export interface ViolationEmployeeRef {
	id: number;
	fullName: string;
	employeeCode: string;
	avatarUrl?: string | null;
}

export interface ViolationReviewerRef {
	id: number;
	fullName: string;
	avatarUrl: string | null;
}

export interface ViolationRequest {
	id: number;
	type: ViolationRequestType;
	typeLabel: string;
	violationDate: string;
	violationMonth: number;
	violationYear: number;
	deadline: string;
	deadlinePassed: boolean;
	slotCost: number;
	reason: string;
	evidencePhotoUrl: string | null;
	status: ViolationRequestStatus;
	assignedReviewer: ViolationReviewerRef | null;
	approverL2: ViolationReviewerRef | null;
	approvedL1At: string | null;
	isMultiLevel: boolean;
	currentApprovalLevel: 1 | 2;
	reviewNote: string | null;
	reviewedBy: ViolationReviewerRef | null;
	reviewedAt: string | null;
	isViolationFlagged: boolean;
	employee: ViolationEmployeeRef;
	createdAt: string;
}

export interface ViolationDetailView {
	id: number;
	type: ViolationRequestType;
	typeLabel: string;
	status: ViolationRequestStatus;
	violationDate: string;
	slotCost: number;
	reason: string;
	evidencePhotoUrl: string | null;
	assignedReviewer: ViolationReviewerRef | null;
	approverL2: ViolationReviewerRef | null;
	approvedL1At: string | null;
	isMultiLevel: boolean;
	currentApprovalLevel: 1 | 2;
	reviewedBy: ViolationReviewerRef | null;
	reviewedAt: string | null;
	reviewNote: string | null;
	deadline: string;
	deadlinePassed: boolean;
	createdAt: string;
}

export interface MyViolationStatus {
	approvedThisMonth: number;
	isNextMultiLevel: boolean;
}

export interface CreateViolationRequestDto {
	type: ViolationRequestType;
	violationDate: string;
	reason: string;
	evidencePhoto?: File;
}

export interface QueryViolationRequestParams {
	page?: number;
	limit?: number;
	month?: number;
	year?: number;
	status?: ViolationRequestStatus;
	type?: ViolationRequestType;
	departmentId?: number;
}

export interface QueryViolationReportParams {
	month: number;
	year: number;
	departmentId?: number;
}

export interface RejectViolationRequestDto {
	reviewNote: string;
}

export interface ViolationMonthlyStats {
	employeeId: number;
	employeeCode: string;
	fullName: string;
	departmentName: string | null;
	forgotCount: number;
	lateCount: number;
	earlyCount: number;
	totalCount: number;
	flaggedCount: number;
	remainingQuota: number;
}
