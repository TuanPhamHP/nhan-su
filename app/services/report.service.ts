import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse } from '~/types/api.types';
import type {
	AttendanceReportResponse,
	LeaveReportResponse,
	SummaryStatsResponse,
	QueryAttendanceReportParams,
	QueryLeaveReportParams,
	QuerySummaryStatsParams,
} from '~/types/report.types';

export const useReportService = () => {
	const authFetch = useAuthFetch();

	return {
		async fetchAttendanceReport(params: QueryAttendanceReportParams): Promise<AttendanceReportResponse[]> {
			const res = await authFetch<ApiResponse<AttendanceReportResponse[]>>('/v1/reports/attendance', { params });
			return res.data;
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

		async exportLeaveExcel(params: QueryLeaveReportParams): Promise<Blob> {
			return authFetch<Blob>('/v1/reports/leave/export', { params, responseType: 'blob' });
		},
	};
};
