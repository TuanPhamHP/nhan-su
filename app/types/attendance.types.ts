import type { ViolationDetailView } from './violation.types';

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE';
export type LockReason = 'AUTO_MIDNIGHT' | 'HR_LOCKED';
export type WorkType = 'ONLINE_APPROVED' | 'ONLINE_T7' | 'OFFLINE' | null;
/** Kết quả so khuôn mặt lúc chấm; null trên bản ghi là lúc đó công ty đang tắt nhận diện khuôn mặt. */
export type AttendanceFaceResult = 'MATCHED' | 'CONFIRMED_MISMATCH';

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
	breakStartTime: string | null; // "HH:mm" UTC — null nếu ca không có nghỉ trưa
	breakEndTime: string | null; // "HH:mm" UTC — null nếu ca không có nghỉ trưa
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
	checkInFaceResult: AttendanceFaceResult | null;
	checkInFaceResultLabel: string | null; // "Khớp" | "Không khớp, nhân viên vẫn xác nhận"
	checkInFaceScore: number | null; // độ giống 0..1; null khi không thấy mặt
	checkOutFaceResult: AttendanceFaceResult | null;
	checkOutFaceResultLabel: string | null;
	checkOutFaceScore: number | null;
	isLocked: boolean;
	lockReason: LockReason | null;
	missingType: 'MISSING_CHECKIN' | 'MISSING_CHECKOUT' | null;
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

export interface TimeWindowDto {
	from: string; // "HH:MM" — giờ Việt Nam
	to: string; // "HH:MM" — giờ Việt Nam
}

export interface CheckAttendanceResponseDto {
	id: number;
	name: string;
	latitude: number;
	longitude: number;
	radiusMeters: number;
	distance: number;
	isInRange: boolean;
	isAvailableShift: boolean;
	canCheckIn: boolean;
	canCheckOut: boolean;
	checkInWindow: TimeWindowDto | null;
	checkOutWindow: TimeWindowDto | null;
	faceRequired: boolean; // công ty đang bật chấm công bằng khuôn mặt
	faceRegistered: boolean; // faceRequired mà false → sang bước đăng ký trước khi chụp chấm công
	faceAttemptsLeft: number; // số lần còn được sai hôm nay (0..5)
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
	/** Chỉ GET /attendance: bản ghi có check-in HOẶC check-out mang kết quả này. */
	faceResult?: AttendanceFaceResult;
}

// ─── Chấm công bằng khuôn mặt (`/v1/attendance/face/*`) ─────────────────────

export interface FaceSettingsResponseDto {
	enabled: boolean;
	updatedAt: string | null; // ISO, null = chưa từng bật
}

export interface MyFaceStatusResponseDto {
	enabled: boolean; // công ty đang bật
	registered: boolean;
	registeredAt: string | null;
	photoUrl: string | null; // link đã ký 1 giờ, hiển thị thẳng
	attemptsLeft: number; // 0..5, số lần còn được sai hôm nay
}

export interface FaceStatusItemDto {
	employeeId: number;
	fullName: string;
	employeeCode: string;
	department: { id: number; name: string } | null;
	registeredAt: string | null; // null = chưa đăng ký
}

export interface EmployeeFaceResponseDto {
	employeeId: number;
	registered: boolean;
	registeredAt: string | null;
	consentAt: string | null; // lúc nhân viên đồng ý
	photoUrl: string | null; // link đã ký 1 giờ
}
