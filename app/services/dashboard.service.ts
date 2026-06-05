import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse } from '~/types/api.types';
import type { DashboardResponse, NewHireEmployee } from '~/types/dashboard.types';

export const useDashboardService = () => {
	const authFetch = useAuthFetch();

	return {
		async getDashboard(): Promise<DashboardResponse> {
			const res = await authFetch<ApiResponse<DashboardResponse>>('/v1/dashboard');
			return res.data;
		},

		async getNewHires(params: { from_date: string; to_date: string }): Promise<NewHireEmployee[]> {
			const res = await authFetch<ApiResponse<NewHireEmployee[]>>('/v1/dashboard/new-hires', { params });
			return res.data;
		},
	};
};
