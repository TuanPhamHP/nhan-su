import { useReportService } from '~/services/report.service';
import type {
	AttendanceReportResponse,
	LeaveReportResponse,
	SummaryStatsResponse,
	QueryAttendanceReportParams,
	QueryAttendanceDetailParams,
	QueryLeaveReportParams,
	QuerySummaryStatsParams,
	QueryEmployeesMonthlyExportParams,
} from '~/types/report.types';
import type { PaginatedMeta } from '~/types/api.types';

export function useReports() {
	const service = useReportService();

	const attendanceReport = ref<AttendanceReportResponse[]>([]);
	const attendanceMeta = ref<PaginatedMeta | null>(null);
	const leaveReport = ref<LeaveReportResponse[]>([]);
	const summaryStats = ref<SummaryStatsResponse | null>(null);
	const loadingAttendance = ref(false);
	const loadingLeave = ref(false);
	const exportingAttendance = ref(false);
	const exportingAttendanceDetail = ref(false);
	const exportingEmployeesMonthly = ref(false);
	const exportingLeave = ref(false);

	async function fetchAttendanceReport(params: QueryAttendanceReportParams) {
		loadingAttendance.value = true;
		try {
			const res = await service.fetchAttendanceReport(params);
			attendanceReport.value = res.data;
			attendanceMeta.value = res.meta;
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

	async function exportAttendanceDetailExcel(params: QueryAttendanceDetailParams) {
		exportingAttendanceDetail.value = true;
		try {
			const blob = await service.exportAttendanceDetailExcel(params);
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `bang-cong-chi-tiet-${params.month}-${params.year}.xlsx`;
			a.click();
			URL.revokeObjectURL(url);
		} finally {
			exportingAttendanceDetail.value = false;
		}
	}

	async function exportEmployeesMonthlyExcel(params: QueryEmployeesMonthlyExportParams) {
		exportingEmployeesMonthly.value = true;
		try {
			const blob = await service.exportEmployeesMonthlyExcel(params);
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `bang-cong-thang-${params.month}-${params.year}.xlsx`;
			a.click();
			URL.revokeObjectURL(url);
		} finally {
			exportingEmployeesMonthly.value = false;
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
		attendanceMeta,
		leaveReport,
		summaryStats,
		loadingAttendance,
		loadingLeave,
		exportingAttendance,
		exportingAttendanceDetail,
		exportingEmployeesMonthly,
		exportingLeave,
		fetchAttendanceReport,
		fetchLeaveReport,
		fetchSummaryStats,
		exportAttendanceExcel,
		exportAttendanceDetailExcel,
		exportEmployeesMonthlyExcel,
		exportLeaveExcel,
	};
}
