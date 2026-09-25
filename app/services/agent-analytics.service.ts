import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse } from '~/types/api.types';
import type { AgentAnalyticsOverview, AgentAnalyticsQuery } from '~/types/agent-analytics.types';

export const useAgentAnalyticsService = () => {
	const authFetch = useAuthFetch();

	return {
		/** Toàn hệ thống — chỉ ADMIN / HR / DIRECTOR. */
		async overview(params?: AgentAnalyticsQuery): Promise<AgentAnalyticsOverview> {
			const res = await authFetch<ApiResponse<AgentAnalyticsOverview>>('/v1/agent/analytics/overview', {
				params,
			});
			return res.data;
		},

		/** Của chính người gọi. `employeeId` trong params bị backend bỏ qua. */
		async me(params?: AgentAnalyticsQuery): Promise<AgentAnalyticsOverview> {
			const res = await authFetch<ApiResponse<AgentAnalyticsOverview>>('/v1/agent/analytics/me', {
				params,
			});
			return res.data;
		},
	};
};
