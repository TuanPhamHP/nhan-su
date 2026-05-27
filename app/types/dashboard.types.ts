export type ActivityType = 'leave' | 'overtime' | 'violation' | 'online_work' | 'makeup';

export interface ActivityItem {
	id: number;
	type: ActivityType;
	typeLabel: string;
	action: string;
	employeeName: string;
	employeeCode: string;
	status: string;
	statusLabel: string;
	createdAt: string;
	targetId: number;
}

export interface CompanyStats {
	totalEmployees: number;
	checkedInToday: number;
	checkedInRate: number;
	pendingLeave: number;
	pendingOT: number;
	pendingViolation: number;
	pendingOnlineWork: number;
	totalDepartments: number;
	lateToday: number;
	absentToday: number;
}

export interface CompanyDashboardResponse {
	stats: CompanyStats;
	recentActivity: ActivityItem[];
	generatedAt: string;
}

export interface DepartmentStats extends CompanyStats {
	departmentName: string;
	totalMembersInDept: number;
}

export interface DepartmentDashboardResponse {
	stats: DepartmentStats;
	recentActivity: ActivityItem[];
	generatedAt: string;
}

export interface LeaveBalance {
	totalDays: number;
	usedDays: number;
	remainingDays: number;
}

export interface MyStats {
	isCheckedInToday: boolean;
	checkedOutToday: boolean;
	leaveBalance: LeaveBalance | null;
	pendingLeaveRequests: number;
	lateCountThisMonth: number;
	absentCountThisMonth: number;
	pendingOT: number;
}

export interface MyDashboardResponse {
	stats: MyStats;
	recentActivity: ActivityItem[];
	generatedAt: string;
}

export type DashboardResponse = CompanyDashboardResponse | DepartmentDashboardResponse | MyDashboardResponse;
