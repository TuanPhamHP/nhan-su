export type ViolationRequestType = 'FORGOT_CHECKIN' | 'LATE' | 'EARLY';
export type ViolationRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface ViolationEmployeeRef {
	id: number;
	fullName: string;
	employeeCode: string;
}

export interface ViolationReviewedByRef {
	id: number;
	fullName: string;
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
	requestedCheckIn: string | null;
	requestedCheckOut: string | null;
	reason: string;
	evidencePhotoUrl: string | null;
	status: ViolationRequestStatus;
	assignedReviewer: ViolationReviewedByRef | null;
	reviewNote: string | null;
	reviewedBy: ViolationReviewedByRef | null;
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
	reason: string;
	evidencePhotoUrl: string | null;
	requestedCheckIn: string | null;
	requestedCheckOut: string | null;
	assignedReviewer: ViolationReviewedByRef | null;
	reviewedBy: ViolationReviewedByRef | null;
	reviewedAt: string | null;
	reviewNote: string | null;
	deadline: string;
	deadlinePassed: boolean;
	createdAt: string;
}

export interface ViolationCounter {
	usedCount: number;
	remaining: number;
	isBlocked: boolean;
	blockedMessage: string | null;
}

export interface CreateViolationRequestDto {
	type: ViolationRequestType;
	violationDate: string;
	reason: string;
	requestedCheckIn?: string;
	requestedCheckOut?: string;
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
