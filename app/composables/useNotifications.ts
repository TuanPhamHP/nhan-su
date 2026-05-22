import { storeToRefs } from 'pinia';
import { useNotificationStore } from '~/stores/notification';

export function useNotifications() {
	const store = useNotificationStore();
	const { unreadCount, notifications, meta, loading } = storeToRefs(store);
	const { fetchUnreadCount, fetchNotifications, markRead, markAllRead, deleteAll } = store;

	return { unreadCount, notifications, meta, loading, fetchUnreadCount, fetchNotifications, markRead, markAllRead, deleteAll };
}
