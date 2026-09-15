export interface ApprovalCountsResponseDto {
	leaveRequests: number;
	makeupAttendance: number;
	violationRequests: number;
	overtimeRequests: number;
	businessTrips: number;
	onlineWorkRequests: number;
	total: number;
}

export type ApprovalModuleKey =
	| 'leaveRequests'
	| 'makeupAttendance'
	| 'violationRequests'
	| 'overtimeRequests'
	| 'businessTrips'
	| 'onlineWorkRequests';

// ─── Bộ lọc hộp thư phê duyệt ─────────────────────────────────────────────────
// Mỗi tab chỉ bật những field mà endpoint tương ứng thực sự nhận (xem
// docs/backend/bridges/approval.md — query params giống endpoint /v1/{module}).
export type ApprovalFilterField = 'status' | 'department' | 'employee' | 'dateRange' | 'monthYear';

export interface ApprovalFilterState {
	status?: string;
	departmentId?: number;
	employeeId?: number;
	startDate?: string; // "YYYY-MM-DD"
	endDate?: string; // "YYYY-MM-DD"
	month?: number; // 1-12 — chỉ dùng cho violation-requests
	year?: number; // chỉ dùng cho violation-requests
	limit: number;
}
