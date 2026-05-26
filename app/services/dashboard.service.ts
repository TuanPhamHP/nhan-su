import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse } from '~/types/api.types';
import type { DashboardResponse } from '~/types/dashboard.types';

export const useDashboardService = () => {
	const authFetch = useAuthFetch();

	return {
		async getDashboard(): Promise<DashboardResponse> {
			const res = await authFetch<ApiResponse<DashboardResponse>>('/v1/dashboard');
			return res.data;
		},
	};
};
