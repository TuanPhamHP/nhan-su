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
}

export interface QueryLeaveReportParams {
	year: number;
	month?: number;
	departmentId?: number;
	leaveTypeId?: number;
}

export interface QuerySummaryStatsParams {
	year: number;
	month: number;
}
