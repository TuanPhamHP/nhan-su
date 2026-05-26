import type { ViolationDetailView } from './violation.types';

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE';
export type LockReason = 'AUTO_MIDNIGHT' | 'HR_LOCKED';
export type WorkType = 'ONLINE_APPROVED' | 'ONLINE_T7' | 'OFFLINE' | null;

export type AttendanceViolationRef = ViolationDetailView;

export interface AttendanceLocationDto {
	id: number;
	name: string;
}

export interface AttendanceShiftDto {
	id: number;
	name: string;
	checkInTime: string; // "HH:mm" UTC
	checkOutTime: string; // "HH:mm" UTC
}

export interface AttendanceEmployeeDto {
	id: number;
	fullName: string;
	employeeCode: string;
}

export interface AttendanceRecordDetail {
	id: number;
	date: string; // "YYYY-MM-DD"
	checkInAt: string | null; // ISO 8601
	checkOutAt: string | null; // ISO 8601
	lateMinutes: number;
	earlyMinutes: number;
	status: AttendanceStatus;
	isManual: boolean;
	distance: number | null;
	effectiveStart: string | null; // ISO 8601 epoch-based — dùng getUTCHours()
	effectiveEnd: string | null; // ISO 8601 epoch-based — dùng getUTCHours()
	isHalfDay: boolean;
	workType: WorkType;
	checkInPhotoUrl: string | null;
	checkOutPhotoUrl: string | null;
	isLocked: boolean;
	lockReason: LockReason | null;
	missingType: 'MISSING_CHECKOUT' | null;
	note: string | null;
	location: AttendanceLocationDto | null;
	shift: AttendanceShiftDto | null;
	employee: AttendanceEmployeeDto | null;
	violationRequests: AttendanceViolationRef[];
}

export interface CheckInDto {
	latitude: number;
	longitude: number;
}

export interface ManualEditAttendanceDto {
	checkInAt?: string; // ISO 8601
	checkOutAt?: string; // ISO 8601
	note?: string;
}

export interface QueryAttendanceParams {
	page?: number;
	limit?: number;
	date?: string; // "YYYY-MM-DD"
	startDate?: string; // "YYYY-MM-DD"
	endDate?: string; // "YYYY-MM-DD"
	employeeId?: number;
	departmentId?: number;
	status?: AttendanceStatus;
}
