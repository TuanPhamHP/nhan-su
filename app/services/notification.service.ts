import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse } from '~/types/api.types';
import type {
	NotificationResponse,
	UnreadCountResponse,
	NotificationListMeta,
	QueryNotificationsParams,
	NotificationCategory,
	TestNotificationDto,
	TestNotificationResult,
	TestFcmDto,
	FcmTestResult,
	TestEmailResult,
} from '~/types/notification.types';

interface NotificationListWrapper {
	success: boolean;
	data: NotificationResponse[];
	meta: NotificationListMeta;
}

export const useNotificationService = () => {
	const authFetch = useAuthFetch();

	return {
		async findAll(params?: QueryNotificationsParams): Promise<{ data: NotificationResponse[]; meta: NotificationListMeta }> {
			const res = await authFetch<NotificationListWrapper>('/v1/notifications', { params });
			return { data: res.data, meta: res.meta };
		},

		async getUnreadCount(): Promise<UnreadCountResponse> {
			const res = await authFetch<ApiResponse<UnreadCountResponse>>('/v1/notifications/unread-count');
			return res.data;
		},

		async markRead(id: number): Promise<void> {
			await authFetch<unknown>(`/v1/notifications/${id}/read`, { method: 'PATCH' });
		},

		async markAllRead(category?: NotificationCategory): Promise<void> {
			const params = category ? { category } : undefined;
			await authFetch<unknown>('/v1/notifications/read-all', { method: 'PATCH', params });
		},

		async deleteAll(category?: NotificationCategory): Promise<void> {
			const params = category ? { category } : undefined;
			await authFetch<unknown>('/v1/notifications', { method: 'DELETE', params });
		},

		async approveRequest(endpoint: string): Promise<void> {
			await authFetch<unknown>(endpoint, { method: 'PATCH' });
		},

		async rejectRequest(endpoint: string, rejectNote: string): Promise<void> {
			await authFetch<unknown>(endpoint, { method: 'PATCH', body: { rejectNote } });
		},

		async testUnified(payload: TestNotificationDto): Promise<TestNotificationResult> {
			const res = await authFetch<ApiResponse<TestNotificationResult>>('/v1/notifications/test', {
				method: 'POST',
				body: payload,
			});
			return res.data;
		},

		async testFcm(payload: TestFcmDto): Promise<FcmTestResult> {
			const res = await authFetch<ApiResponse<FcmTestResult>>('/v1/notifications/test-fcm', {
				method: 'POST',
				body: payload,
			});
			return res.data;
		},

		async testEmail(to: string): Promise<TestEmailResult> {
			const res = await authFetch<ApiResponse<TestEmailResult>>('/v1/notifications/test-email', {
				params: { to },
			});
			return res.data;
		},
	};
};
