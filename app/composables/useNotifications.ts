import { storeToRefs } from 'pinia';
import { useNotificationStore } from '~/stores/notification';

export function useNotifications() {
	const store = useNotificationStore();
	const { unreadCount, notifications, loading } = storeToRefs(store);
	const { fetchUnreadCount, fetchNotifications, markRead, markAllRead } = store;

	return { unreadCount, notifications, loading, fetchUnreadCount, fetchNotifications, markRead, markAllRead };
}
