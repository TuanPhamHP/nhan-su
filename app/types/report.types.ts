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
		workingDays: number;
		actualWorkDays: number;
		businessTripDays: number;
		annualLeaveDays: number;
		unpaidLeaveDays: number;
		welfareLeaveDays: number;
		publicHolidayDays: number;
		totalPayrollDays: number;
		totalActualDays: number;
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
