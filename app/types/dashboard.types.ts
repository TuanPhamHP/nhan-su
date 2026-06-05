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
	workingOnlineToday: number;
}

export interface HRAnalyticsData {
	statusBreakdown: { status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE'; count: number }[];
	byDepartment: { departmentId: number; departmentName: string; count: number }[];
	genderBreakdown: { gender: string; count: number }[];
	ageGroups: { range: string; count: number }[];
	averageAge: number | null;
	ageDataCoverage: number;
	contractBreakdown: { contractType: 'PROBATION' | 'FIXED_TERM' | 'INDEFINITE' | 'SEASONAL'; count: number }[];
	newHiresLast30Days: number;
	expiringContractsNext30Days: number;
}

export interface CompanyDashboardResponse {
	stats: CompanyStats;
	recentActivity: ActivityItem[];
	hrAnalytics: HRAnalyticsData;
	generatedAt: string;
}

export interface DepartmentStats extends CompanyStats {
	departmentName: string;
	totalMembersInDept: number;
}

export interface DepartmentDashboardResponse {
	stats: DepartmentStats;
	recentActivity: ActivityItem[];
	hrAnalytics: HRAnalyticsData;
	generatedAt: string;
}

export interface LeaveBalance {
	totalDays: number;
	usedDays: number;
	remainingDays: number;
}

export interface MyStats {
	isCheckedInToday: boolean;
	isCheckedOutToday: boolean;
	isLateToday?: boolean;
	isEarlyLeaveToday?: boolean;
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

export interface NewHireEmployee {
	id: number;
	employeeCode: string;
	fullName: string;
	departmentName: string;
	positionName: string;
	joinDate: string;
	avatarUrl: string | null;
}
