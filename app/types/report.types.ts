export interface AttendanceReportResponse {
	employeeId: number;
	employeeCode: string;
	fullName: string;
	departmentName: string | null;
	positionName: string | null;
	totalWorkDays: number;
	presentDays: number;
	lateDays: number;
	absentDays: number;
	onLeaveDays: number;
	totalLateMinutes: number;
	totalEarlyMinutes: number;
	attendanceRate: number;
}

export interface LeaveReportResponse {
	employeeId: number;
	employeeCode: string;
	fullName: string;
	departmentName: string | null;
	leaveTypeName: string;
	leaveTypeCode: string;
	totalRequests: number;
	approvedRequests: number;
	totalDaysApproved: number;
	pendingRequests: number;
	remainingBalance: number | null;
}

export interface SummaryStatsResponse {
	totalEmployees: number;
	presentToday: number;
	lateToday: number;
	absentToday: number;
	pendingLeaveRequests: number;
	avgAttendanceRateThisMonth: number;
	topAbsentDepartment: string | null;
}

export interface QueryAttendanceReportParams {
	year: number;
	month: number;
	departmentId?: number;
	employeeId?: number;
	search?: string;
	page?: number;
	limit?: number;
}

export interface QueryLeaveReportParams {
	year: number;
	month?: number;
	departmentId?: number;
	leaveTypeId?: number;
	search?: string;
}

export interface QuerySummaryStatsParams {
	year: number;
	month: number;
}

export interface QueryAttendanceDetailParams {
	year: number;
	month: number;
	departmentId?: number;
	search?: string;
}

export interface QueryEmployeesMonthlyExportParams {
	month: number;
	year: number;
	departmentId?: number;
	search?: string;
}

export type ContractType = 'PROBATION' | 'FIXED_TERM' | 'INDEFINITE' | 'SEASONAL';

export type MonthlyReportSymbol =
	| 'X'
	| 'X/2'
	| 'X/2 (Q)'
	| 'CT'
	| 'CT/X'
	| 'OL'
	| 'P'
	| 'P/X'
	| 'P/2'
	| 'R'
	| 'L'
	| 'K'
	| '0';

export interface MonthlyReportDayDetail {
	date: string; // "YYYY-MM-DD" (VN)
	value: number; // 0 | 0.5 | 1
	symbol: MonthlyReportSymbol;
	reason: string; // BE format sẵn tiếng Việt — hiển thị nguyên văn
}

export interface EmployeeMonthlyReportBreakdown {
	workingDays: MonthlyReportDayDetail[];
	actualWorkDays: MonthlyReportDayDetail[];
	onlineDays: MonthlyReportDayDetail[];
	businessTripDays: MonthlyReportDayDetail[];
	annualLeaveDays: MonthlyReportDayDetail[];
	welfareLeaveDays: MonthlyReportDayDetail[];
	unpaidLeaveDays: MonthlyReportDayDetail[];
	publicHolidayDays: MonthlyReportDayDetail[];
}

export type EmployeeMonthlyReportBreakdownKey = keyof EmployeeMonthlyReportBreakdown;

export interface EmployeeMonthlyReportResponse {
	employee: {
		id: number;
		fullName: string;
		employeeCode: string;
		joinDate: string;
		position: string | null;
		department: string | null;
		contractType: ContractType | null;
	};
	period: {
		month: number;
		year: number;
	};
	attendance: {
		actualWorkDays: number;
		annualLeaveDays: number;
		businessTripDays: number;
		onlineDays: number;
		publicHolidayDays: number;

		totalActualDays: number;
		totalPayrollDays: number;
		mealAllowanceDays: number; // = actualWorkDays — Tổng công tính ăn ca
		unpaidLeaveDays: number;
		welfareLeaveDays: number;
		workingDays: number;
		breakdown: EmployeeMonthlyReportBreakdown;
	};
	overtime: {
		normalHours: number;
		sundayHours: number;
		holidayOnlineHours: number;
		holidayOfflineHours: number;
		totalHours: number;
	};
	violations: {
		lateCount: number;
		earlyCount: number;
		forgotCheckCount: number;
		totalCount: number;
	};
}
