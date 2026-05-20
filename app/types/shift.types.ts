// workDays convention: 0=CN, 1=T2, 2=T3, 3=T4, 4=T5, 5=T6, 6=T7

// ─── WorkShift ──────────────────────────────────────────────────────────────

export interface WorkShiftResponse {
	id: number;
	name: string;
	checkInTime: string;        // "HH:mm" UTC
	checkOutTime: string;       // "HH:mm" UTC
	lateThresholdMin: number;
	earlyThresholdMin: number;
	workDays: number[];         // 0=CN, 1=T2, ..., 6=T7
	isActive: boolean;
	createdAt: string;          // ISO 8601
}

export interface CreateWorkShiftDto {
	name: string;
	checkInTime: string;        // "HH:mm"
	checkOutTime: string;       // "HH:mm"
	lateThresholdMin?: number;
	earlyThresholdMin?: number;
	workDays: number[];
}

export type UpdateWorkShiftDto = Partial<CreateWorkShiftDto>;

// ─── ShiftSchedule ──────────────────────────────────────────────────────────

export interface WorkShiftSummary {
	id: number;
	name: string;
	checkInTime: string;
	checkOutTime: string;
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
}

export interface CalendarDayEmployee {
	employeeId: number;
	employeeCode: string;
	fullName: string;
	department: string | null;
	shift: CalendarShift | null; // null = không có ca (NO_SHIFT_TODAY)
	isDefault: boolean;          // true = dùng defaultShift, false = override theo ngày
}

// Response từ GET /shift-schedules/calendar — grouped by date
export interface CalendarDayResponse {
	date: string;               // "YYYY-MM-DD"
	employees: CalendarDayEmployee[];
}
