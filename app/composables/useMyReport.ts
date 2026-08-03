// composables/useMyReport.ts
import { useAuthFetch } from '~/services/http/auth.fetch';
import type {
  EmployeeMonthlyReportResponse,
  QueryMonthlyReportParams,
} from '~/types/reports-me.types';

export function useMyReport() {
  const authFetch = useAuthFetch();

  const fetchMyMonthlyReport = (params: QueryMonthlyReportParams) =>
    authFetch<{ success: true; data: EmployeeMonthlyReportResponse }>(
      '/v1/reports/my/monthly',
      { params },
    ).then((r) => r.data);

  const fetchEmployeeMonthlyReport = (
    employeeId: number,
    params: QueryMonthlyReportParams,
  ) =>
    authFetch<{ success: true; data: EmployeeMonthlyReportResponse }>(
      `/v1/reports/employees/${employeeId}/monthly`,
      { params },
    ).then((r) => r.data);

  return { fetchMyMonthlyReport, fetchEmployeeMonthlyReport };
}