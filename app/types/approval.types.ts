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
	/**
	 * Lô 4a: phiếu đề xuất đang chờ chính người xem duyệt ở bước hiện tại, kể cả lượt nhận theo
	 * uỷ quyền. Không phụ thuộc quyền nào: mọi vai trò đều có thể được giao duyệt một bước.
	 */
	generalRequests: number;
	/**
	 * Công việc lô 1: việc Chờ nghiệm thu mà người xem là người nghiệm thu. KHÔNG cộng vào `total`
	 * (nghiệm thu làm ở trang Công việc); 0 khi module `TASKS` không dùng đầy đủ. BE cũ không có.
	 */
	taskReviews?: number;
	/**
	 * KPI (lô 3): phiếu Chờ cấp trên đánh giá mà người xem chấm. KHÔNG cộng vào `total` (đánh giá làm ở trang
	 * KPI); 0 khi module `TASKS` không dùng đầy đủ. BE cũ không có.
	 */
	kpiReviews?: number;
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
	| 'profileChanges'
	| 'generalRequests';

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
