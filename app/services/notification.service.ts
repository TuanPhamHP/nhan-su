import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedResponse, PaginatedMeta } from '~/types/api.types';
import type { NotificationRecord, UnreadCountResponse, NotificationQueryParams } from '~/types/notification.types';

export const useNotificationService = () => {
	const authFetch = useAuthFetch();

	return {
		async findAll(params?: NotificationQueryParams): Promise<{ data: NotificationRecord[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<NotificationRecord>>('/v1/notifications', { params });
			return { data: res.data, meta: res.meta };
		},

		async getUnreadCount(): Promise<number> {
			const res = await authFetch<ApiResponse<UnreadCountResponse>>('/v1/notifications/unread-count');
			return res.data.unreadCount;
		},

		async markRead(id: number): Promise<void> {
			await authFetch<unknown>(`/v1/notifications/${id}/read`, { method: 'PATCH' });
		},

		async markAllRead(): Promise<void> {
			await authFetch<unknown>('/v1/notifications/read-all', { method: 'PATCH' });
		},
	};
};
