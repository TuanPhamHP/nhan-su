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
