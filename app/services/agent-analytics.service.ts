import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedResponse } from '~/types/api.types';
import type {
	AgentAnalyticsOverview,
	AgentAnalyticsQuery,
	AgentConversationTranscript,
	AgentFeedbackAnalytics,
	AgentReviewConversation,
	AgentReviewConversationsQuery,
} from '~/types/agent-analytics.types';

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

		/**
		 * Bảng đánh giá chi tiết (chia theo chủ đề, theo tier, kèm góp ý chữ) —
		 * chỉ ADMIN / HR / DIRECTOR. `topLimit` giới hạn số góp ý trả về.
		 */
		async feedback(params?: AgentAnalyticsQuery): Promise<AgentFeedbackAnalytics> {
			const res = await authFetch<ApiResponse<AgentFeedbackAnalytics>>(
				'/v1/agent/analytics/feedback',
				{ params },
			);
			return res.data;
		},

		/** Danh sách hội thoại để xem lại — chỉ ADMIN, các role khác nhận 403. */
		async reviewConversations(
			params?: AgentReviewConversationsQuery,
		): Promise<PaginatedResponse<AgentReviewConversation>> {
			return authFetch<PaginatedResponse<AgentReviewConversation>>(
				'/v1/agent/analytics/conversations',
				{ params },
			);
		},

		/**
		 * Toàn bộ một hội thoại — chỉ ADMIN.
		 *
		 * MỖI LẦN GỌI BE ghi một dòng nhật ký `agent.conversation_view` mang tên người xem,
		 * nên chỉ gọi khi người dùng bấm mở. Tải trước hay tự tải lại sẽ làm sai dấu vết đó.
		 */
		async reviewConversationMessages(conversationId: number): Promise<AgentConversationTranscript> {
			const res = await authFetch<ApiResponse<AgentConversationTranscript>>(
				`/v1/agent/analytics/conversations/${conversationId}/messages`,
			);
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
