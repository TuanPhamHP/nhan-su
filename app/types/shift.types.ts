// workDays convention: 0=CN, 1=T2, 2=T3, 3=T4, 4=T5, 5=T6, 6=T7

// ─── WorkShift ──────────────────────────────────────────────────────────────

export interface WorkShiftResponse {
	id: number;
	name: string;
	checkInTime: string;            // "HH:mm" UTC
	checkOutTime: string;           // "HH:mm" UTC
	breakStartTime: string | null;  // "HH:mm" — null nếu ca không hỗ trợ half-day
	breakEndTime: string | null;    // "HH:mm" — null nếu ca không hỗ trợ half-day
	lateThresholdMin: number;
	earlyThresholdMin: number;
	workDays: number[];             // 0=CN, 1=T2, ..., 6=T7
	isOnline: boolean;              // true = cron tự ghi PRESENT, ẩn nút check-in
	requiresLocationCheck: boolean; // false = remote toàn thời gian — check-in thủ công, không validate GPS
	// Cửa sổ chấm công (HH:mm tuyệt đối; null = default ±60p quanh giờ vào/ra)
	checkInWindowStart: string | null;   // "HH:mm" — mở cửa sổ check-in
	checkInWindowEnd: string | null;     // "HH:mm" — đóng cửa sổ check-in (BE tự cộng approvedLate khi eval)
	checkOutWindowStart: string | null;  // "HH:mm" — mở cửa sổ check-out (BE tự trừ approvedEarly)
	checkOutWindowEnd: string | null;    // "HH:mm" — đóng cửa sổ check-out
	// Require flags
	requireCheckIn: boolean;             // false = ca chỉ check-out
	requireCheckOut: boolean;            // false = ca chỉ check-in
	isActive: boolean;
	createdAt: string;              // ISO 8601
}

export interface CreateWorkShiftDto {
	name: string;
	checkInTime: string;            // "HH:mm"
	checkOutTime: string;           // "HH:mm"
	breakStartTime?: string | null; // "HH:mm" — set cùng breakEndTime; null trên PATCH để clear
	breakEndTime?: string | null;   // "HH:mm" — set cùng breakStartTime; null trên PATCH để clear
	lateThresholdMin?: number;
	earlyThresholdMin?: number;
	workDays: number[];
	isOnline?: boolean;             // mặc định false
	requiresLocationCheck?: boolean; // mặc định true
	// "HH:mm" tuyệt đối — omit / null = default ±60p. Gửi null trên PATCH để clear về default.
	// BE validate cửa sổ nằm trong 240p quanh giờ vào/ra và windowStart ≤ shiftTime ≤ windowEnd (mod 1440 cho ca cross-midnight).
	checkInWindowStart?: string | null;
	checkInWindowEnd?: string | null;
	checkOutWindowStart?: string | null;
	checkOutWindowEnd?: string | null;
	requireCheckIn?: boolean;       // default true
	requireCheckOut?: boolean;      // default true
}

export type UpdateWorkShiftDto = Partial<CreateWorkShiftDto>;

// ─── ShiftSchedule ──────────────────────────────────────────────────────────

export interface WorkShiftSummary {
	id: number;
	name: string;
	checkInTime: string;
	checkOutTime: string;
	breakStartTime: string | null;
	breakEndTime: string | null;
	workDays: number[];
}

export interface ShiftScheduleResponse {
	id: number;
	date: string;               // "YYYY-MM-DD"
	employee: {
		id: number;
		fullName: string;
		employeeCode: string;
	};
	shift: WorkShiftSummary;
}

export interface AssignShiftDto {
	employeeId: number;
	shiftId: number;
	date: string;               // "YYYY-MM-DD"
}

export interface BulkAssignShiftDto {
	assignments: AssignShiftDto[];
}

export interface BulkRangeAssignShiftDto {
	fromDate: string;
	toDate: string;
	shiftId: number;
	employeeIds: number[];
}

export interface BulkRangeAssignResult {
	totalAssignments: number;
}

export interface SetDefaultShiftDto {
	shiftId: number;
}

export interface QueryShiftScheduleParams {
	employeeId?: number;
	departmentId?: number;
	startDate?: string;
	endDate?: string;
}

// ─── Calendar ───────────────────────────────────────────────────────────────

export interface QueryCalendarParams {
	startDate: string;          // "YYYY-MM-DD" — bắt buộc
	endDate: string;            // "YYYY-MM-DD" — bắt buộc, tối đa 31 ngày
	departmentId?: number;
	employeeId?: number;
}

export interface CalendarShift {
	id: number;
	name: string;
	checkInTime: string;
	checkOutTime: string;
	breakStartTime: string | null;
	breakEndTime: string | null;
}

export interface CalendarDayEmployee {
	employeeId: number;
	employeeCode: string;
	fullName: string;
	department: string | null;
	shift: CalendarShift | null; // null = không có ca (NO_SHIFT_TODAY)
	isDefault: boolean;          // true = dùng defaultShift, false = override theo ngày
	isOnline?: boolean;          // true = ca online T7 (không cần GPS check-in)
}

// ─── Online Saturday ────────────────────────────────────────────────────────

export interface BulkOnlineSaturdayDto {
	month?: number;      // 1-12, optional — bỏ qua để gán cả năm
	year: number;
	employeeIds: number[];
	shiftId: number;
}

export interface BulkOnlineSaturdayResult {
	assigned: number;
	saturdays: number;
	month: number | null; // null khi gán cả năm
	year: number;
}

// Response từ GET /shift-schedules/calendar — grouped by date
export interface CalendarDayResponse {
	date: string;               // "YYYY-MM-DD"
	employees: CalendarDayEmployee[];
}
