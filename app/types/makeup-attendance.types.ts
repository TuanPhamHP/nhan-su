export type MakeupRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface MakeupRequestEmployee {
	id: number;
	fullName: string;
	employeeCode: string;
}

export interface MakeupRequestReviewer {
	id: number;
	fullName: string;
}

export interface MakeupRequestResponse {
	id: string;
	attendanceDate: string; // "YYYY-MM-DD"
	requestedCheckIn: string | null; // ISO 8601
	requestedCheckOut: string | null; // ISO 8601
	reason: string;
	status: MakeupRequestStatus;
	reviewNote: string | null;
	evidencePhotoUrl: string | null;
	employee: MakeupRequestEmployee;
	reviewedBy: MakeupRequestReviewer | null;
	createdAt: string;
	updatedAt: string;
}

export interface CreateMakeupRequestDto {
	attendanceDate: string; // "YYYY-MM-DD"
	requestedCheckIn?: string; // ISO 8601
	requestedCheckOut?: string; // ISO 8601
	reason: string;
}

export interface ReviewMakeupRequestDto {
	reviewNote?: string;
}

export interface QueryMakeupRequestParams {
	page?: number;
	limit?: number;
	status?: MakeupRequestStatus;
	startDate?: string; // "YYYY-MM-DD"
	endDate?: string; // "YYYY-MM-DD"
	employeeId?: number;
	departmentId?: number;
}
