import { useDashboardService } from '~/services/dashboard.service';
import type {
	DashboardResponse,
	CompanyDashboardResponse,
	DepartmentDashboardResponse,
	MyDashboardResponse,
} from '~/types/dashboard.types';

export function isCompanyDashboard(data: DashboardResponse): data is CompanyDashboardResponse {
	return 'totalEmployees' in data.stats && !('departmentName' in data.stats);
}

export function isDepartmentDashboard(data: DashboardResponse): data is DepartmentDashboardResponse {
	return 'departmentName' in data.stats;
}

export function isMyDashboard(data: DashboardResponse): data is MyDashboardResponse {
	return 'isCheckedInToday' in data.stats;
}

export function useDashboard() {
	const service = useDashboardService();

	const dashboard = ref<DashboardResponse | null>(null);
	const loading = ref(false);
	const error = ref<string | null>(null);

	async function fetchDashboard() {
		loading.value = true;
		error.value = null;
		try {
			dashboard.value = await service.getDashboard();
		} catch (e) {
			error.value = e instanceof Error ? e.message : 'Không thể tải dữ liệu dashboard';
		} finally {
			loading.value = false;
		}
	}

	return { dashboard, loading, error, fetchDashboard };
}
