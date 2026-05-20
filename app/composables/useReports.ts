import { useReportService } from '~/services/report.service';
import type {
	AttendanceReportResponse,
	LeaveReportResponse,
	SummaryStatsResponse,
	QueryAttendanceReportParams,
	QueryLeaveReportParams,
	QuerySummaryStatsParams,
} from '~/types/report.types';

export function useReports() {
	const service = useReportService();

	const attendanceReport = ref<AttendanceReportResponse[]>([]);
	const leaveReport = ref<LeaveReportResponse[]>([]);
	const summaryStats = ref<SummaryStatsResponse | null>(null);
	const loadingAttendance = ref(false);
	const loadingLeave = ref(false);
	const exportingAttendance = ref(false);
	const exportingLeave = ref(false);

	async function fetchAttendanceReport(params: QueryAttendanceReportParams) {
		loadingAttendance.value = true;
		try {
			attendanceReport.value = await service.fetchAttendanceReport(params);
		} finally {
			loadingAttendance.value = false;
		}
	}

	async function fetchLeaveReport(params: QueryLeaveReportParams) {
		loadingLeave.value = true;
		try {
			leaveReport.value = await service.fetchLeaveReport(params);
		} finally {
			loadingLeave.value = false;
		}
	}

	async function fetchSummaryStats(params: QuerySummaryStatsParams) {
		summaryStats.value = await service.fetchSummaryStats(params);
	}

	async function exportAttendanceExcel(params: QueryAttendanceReportParams) {
		exportingAttendance.value = true;
		try {
			const blob = await service.exportAttendanceExcel(params);
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `bang-cong-${params.month}-${params.year}.xlsx`;
			a.click();
			URL.revokeObjectURL(url);
		} finally {
			exportingAttendance.value = false;
		}
	}

	async function exportLeaveExcel(params: QueryLeaveReportParams) {
		exportingLeave.value = true;
		try {
			const blob = await service.exportLeaveExcel(params);
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `thong-ke-nghi-phep-${params.year}.xlsx`;
			a.click();
			URL.revokeObjectURL(url);
		} finally {
			exportingLeave.value = false;
		}
	}

	return {
		attendanceReport,
		leaveReport,
		summaryStats,
		loadingAttendance,
		loadingLeave,
		exportingAttendance,
		exportingLeave,
		fetchAttendanceReport,
		fetchLeaveReport,
		fetchSummaryStats,
		exportAttendanceExcel,
		exportLeaveExcel,
	};
}
