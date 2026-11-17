export interface ApprovalCountsResponseDto {
	leaveRequests: number;
	makeupAttendance: number;
	violationRequests: number;
	overtimeRequests: number;
	businessTrips: number;
	onlineWorkRequests: number;
	/**
	 * Tài sản lô 2b: phiếu thanh lý chờ duyệt mà người xem duyệt được (`asset:disposal:approve`),
	 * đã cộng vào `total`. Về 0 khi module `ASSET` không dùng đầy đủ.
	 */
	assetDisposals: number;
	/**
	 * Lô 3a: yêu cầu thay đổi thông tin nhân sự của người khác đang chờ, khi người xem có
	 * `employee:profile-change:approve`. Không có quyền thì BE trả 0.
	 */
	profileChanges: number;
	total: number;
}

export type ApprovalModuleKey =
	| 'leaveRequests'
	| 'makeupAttendance'
	| 'violationRequests'
	| 'overtimeRequests'
	| 'businessTrips'
	| 'onlineWorkRequests'
	| 'assetDisposals'
	| 'profileChanges';

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
