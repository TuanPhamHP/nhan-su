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

export interface OvertimeLocationDto {
	id: number;
	name: string;
}

export interface AvailableLocationDto {
	id: number;
	name: string;
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

export interface OvertimeSegment {
	segmentDate: string; // "YYYY-MM-DD" — ngày local VN của segment
	hours: number; // số giờ OT thuộc segment này
	otRate: 150 | 200 | 300; // rate detect theo ngày: lễ (300) > CN (200) > T2–T7 (150)
	otRateLabel: string; // "150%" | "200%" | "300%"
}

export interface OvertimeRequestResponse {
	id: number;
	startTime: string; // ISO 8601 full datetime
	endTime: string; // ISO 8601 full datetime — có thể sang ngày sau
	totalHours: number; // raw hours (endTime - startTime); 0.5–12
	segments: OvertimeSegment[]; // 1–N segments; span 2 ngày VN → 2 segments với rate riêng
	totalPaidHours: number; // sum(hours × otRate/100) — tổng "giờ trả lương" đã nhân hệ số
	reason: string;
	status: OvertimeStatus;
	workMode: OvertimeWorkMode;
	location: OvertimeLocationDto | null;
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
	hoursDisplay: string; // VD: "3.0 giờ" — raw hours display
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
	startTime: string; // ISO 8601 full datetime — BẮT BUỘC gồm ngày
	endTime: string; // ISO 8601 full datetime; có thể qua ngày sau
	reason: string;
	workMode: OvertimeWorkMode;
	locationId?: number;
}

export interface PreviewOvertimeRequestDto {
	startTime: string;
	endTime: string;
	workMode: OvertimeWorkMode;
	locationId?: number;
}

export interface OvertimePreviewApprover {
	id: number;
	fullName: string;
}

export interface OvertimePreviewLocation {
	id: number;
	name: string;
}

export interface OvertimePreviewResponse {
	isValid: boolean;
	reason: string | null; // null khi isValid = true
	startTime: string;
	endTime: string;
	totalHours: number;
	segments: OvertimeSegment[]; // rỗng nếu totalHours ngoài [0.5, 12] hoặc endTime <= startTime
	totalPaidHours: number;
	workMode: OvertimeWorkMode;
	location: OvertimePreviewLocation | null;
	approver: OvertimePreviewApprover | null;
	approverFallbackToHR: boolean; // true → đơn sẽ gửi cho HR
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
	isValid: boolean; // true khi GPS nằm trong radius của ot.locationId
	locationName: string | null; // tên location đã khai; null nếu location không tồn tại / đã deactivate
	distanceMeters: number; // khoảng cách GPS tới ot.locationId; -1 khi location không tồn tại / deactivate
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
