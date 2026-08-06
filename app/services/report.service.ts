import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedResponse, PaginatedMeta } from '~/types/api.types';
import type {
	AttendanceReportResponse,
	LeaveReportResponse,
	SummaryStatsResponse,
	QueryAttendanceReportParams,
	QueryAttendanceDetailParams,
	QueryLeaveReportParams,
	QuerySummaryStatsParams,
	QueryEmployeesMonthlyExportParams,
	EmployeeMonthlyReportResponse,
} from '~/types/report.types';

export const useReportService = () => {
	const authFetch = useAuthFetch();

	return {
		async fetchAttendanceReport(
			params: QueryAttendanceReportParams,
		): Promise<{ data: AttendanceReportResponse[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<AttendanceReportResponse>>('/v1/reports/attendance', { params });
			return { data: res.data, meta: res.meta };
		},

		async fetchLeaveReport(params: QueryLeaveReportParams): Promise<LeaveReportResponse[]> {
			const res = await authFetch<ApiResponse<LeaveReportResponse[]>>('/v1/reports/leave', { params });
			return res.data;
		},

		async fetchSummaryStats(params: QuerySummaryStatsParams): Promise<SummaryStatsResponse> {
			const res = await authFetch<ApiResponse<SummaryStatsResponse>>('/v1/reports/summary', { params });
			return res.data;
		},

		async exportAttendanceExcel(params: QueryAttendanceReportParams): Promise<Blob> {
			return authFetch<Blob>('/v1/reports/attendance/export', { params, responseType: 'blob' });
		},

		async exportAttendanceDetailExcel(params: QueryAttendanceDetailParams): Promise<Blob> {
			return authFetch<Blob>('/v1/reports/attendance/export-detail', { params, responseType: 'blob' });
		},

		async exportLeaveExcel(params: QueryLeaveReportParams): Promise<Blob> {
			return authFetch<Blob>('/v1/reports/leave/export', { params, responseType: 'blob' });
		},

		async exportEmployeesMonthlyExcel(params: QueryEmployeesMonthlyExportParams): Promise<Blob> {
			return authFetch<Blob>('/v1/reports/employees/monthly/export', { params, responseType: 'blob' });
		},

		async fetchEmployeeMonthlyReport(
			employeeId: number,
			month: number,
			year: number,
		): Promise<EmployeeMonthlyReportResponse> {
			const res = await authFetch<ApiResponse<EmployeeMonthlyReportResponse>>(
				`/v1/reports/employees/${employeeId}/monthly`,
				{ params: { month, year } },
			);
			return res.data;
		},
	};
};
