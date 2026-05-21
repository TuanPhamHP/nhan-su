import { defineStore } from 'pinia';
import type { NotificationRecord, NotificationQueryParams } from '~/types/notification.types';
import { useNotificationService } from '~/services';
import { useDeviceTokenService } from '~/services';

export const useNotificationStore = defineStore('notification', () => {
	const fcmToken = ref<string | null>(null);
	const unreadCount = ref(0);
	const notifications = ref<NotificationRecord[]>([]);
	const loading = ref(false);

	function incrementUnread() {
		unreadCount.value += 1;
	}

	async function fetchUnreadCount() {
		const { getUnreadCount } = useNotificationService();
		unreadCount.value = await getUnreadCount();
	}

	async function fetchNotifications(params?: NotificationQueryParams) {
		loading.value = true;
		try {
			const { findAll } = useNotificationService();
			const { data } = await findAll(params);
			notifications.value = data;
		} finally {
			loading.value = false;
		}
	}

	async function markRead(id: number) {
		const { markRead: markReadFn } = useNotificationService();
		await markReadFn(id);
		const notif = notifications.value.find(n => n.id === id);
		if (notif && !notif.readAt) {
			notif.readAt = new Date().toISOString();
			unreadCount.value = Math.max(0, unreadCount.value - 1);
		}
	}

	async function markAllRead() {
		const { markAllRead: markAllReadFn } = useNotificationService();
		await markAllReadFn();
		notifications.value.forEach(n => {
			if (!n.readAt) n.readAt = new Date().toISOString();
		});
		unreadCount.value = 0;
	}

	async function registerDevice(token: string) {
		fcmToken.value = token;
		const { register } = useDeviceTokenService();
		await register({ token, platform: 'WEB' });
	}

	async function unregisterDevice() {
		if (!fcmToken.value) return;
		try {
			const { unregister } = useDeviceTokenService();
			await unregister(fcmToken.value);
		} catch {
			// Bỏ qua lỗi khi unregister — đảm bảo logout vẫn hoàn tất
		} finally {
			fcmToken.value = null;
		}
	}

	function reset() {
		unreadCount.value = 0;
		notifications.value = [];
		fcmToken.value = null;
	}

	return {
		fcmToken,
		unreadCount,
		notifications,
		loading,
		incrementUnread,
		fetchUnreadCount,
		fetchNotifications,
		markRead,
		markAllRead,
		registerDevice,
		unregisterDevice,
		reset,
	};
});
