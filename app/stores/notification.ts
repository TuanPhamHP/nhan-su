import { defineStore } from 'pinia';
import type { NotificationResponse, NotificationListMeta, UnreadCountResponse, QueryNotificationsParams, NotificationCategory } from '~/types/notification.types';
import { useNotificationService } from '~/services';
import { useDeviceTokenService } from '~/services';

const DEFAULT_UNREAD: UnreadCountResponse = { total: 0, event: 0, attendance: 0, leave: 0 };

export const useNotificationStore = defineStore('notification', () => {
	const fcmToken = ref<string | null>(null);
	const unreadCount = ref<UnreadCountResponse>({ ...DEFAULT_UNREAD });
	const notifications = ref<NotificationResponse[]>([]);
	const meta = ref<NotificationListMeta | null>(null);
	const loading = ref(false);

	function incrementUnread() {
		unreadCount.value.total += 1;
	}

	async function fetchUnreadCount() {
		const { getUnreadCount } = useNotificationService();
		unreadCount.value = await getUnreadCount();
	}

	async function fetchNotifications(params?: QueryNotificationsParams) {
		loading.value = true;
		try {
			const { findAll } = useNotificationService();
			const res = await findAll(params);
			notifications.value = res.data;
			meta.value = res.meta;
			// sync bell badge from list meta
			unreadCount.value.total = res.meta.unreadCount;
		} finally {
			loading.value = false;
		}
	}

	async function markRead(id: number) {
		const { markRead: markReadFn } = useNotificationService();
		await markReadFn(id);
		const notif = notifications.value.find(n => n.id === id);
		if (notif && !notif.isRead) {
			notif.isRead = true;
			unreadCount.value.total = Math.max(0, unreadCount.value.total - 1);
			if (notif.category === 'EVENT') unreadCount.value.event = Math.max(0, unreadCount.value.event - 1);
			else if (notif.category === 'ATTENDANCE') unreadCount.value.attendance = Math.max(0, unreadCount.value.attendance - 1);
			else if (notif.category === 'LEAVE') unreadCount.value.leave = Math.max(0, unreadCount.value.leave - 1);
		}
	}

	async function markAllRead(category?: NotificationCategory) {
		const { markAllRead: markAllReadFn } = useNotificationService();
		await markAllReadFn(category);
		notifications.value.forEach(n => {
			if (!n.isRead && (!category || n.category === category)) {
				n.isRead = true;
			}
		});
		if (!category) {
			unreadCount.value = { ...DEFAULT_UNREAD };
		} else {
			const key = category.toLowerCase() as 'event' | 'attendance' | 'leave';
			const prev = unreadCount.value[key];
			unreadCount.value[key] = 0;
			unreadCount.value.total = Math.max(0, unreadCount.value.total - prev);
		}
	}

	async function quickApprove(notification: NotificationResponse) {
		if (!notification.actionPayload) return;
		const { approveRequest } = useNotificationService();
		await approveRequest(notification.actionPayload.approveEndpoint);
		await markRead(notification.id);
	}

	async function quickReject(notification: NotificationResponse, rejectNote: string) {
		if (!notification.actionPayload) return;
		const { rejectRequest } = useNotificationService();
		await rejectRequest(notification.actionPayload.rejectEndpoint, rejectNote);
		await markRead(notification.id);
	}

	async function deleteAll(category?: NotificationCategory) {
		const { deleteAll: deleteAllFn } = useNotificationService();
		await deleteAllFn(category);
		if (!category) {
			notifications.value = [];
			meta.value = null;
			unreadCount.value = { ...DEFAULT_UNREAD };
		} else {
			const key = category.toLowerCase() as 'event' | 'attendance' | 'leave';
			const prev = unreadCount.value[key];
			notifications.value = notifications.value.filter(n => n.category !== category);
			unreadCount.value[key] = 0;
			unreadCount.value.total = Math.max(0, unreadCount.value.total - prev);
		}
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
			// ignore errors on logout
		} finally {
			fcmToken.value = null;
		}
	}

	function reset() {
		unreadCount.value = { ...DEFAULT_UNREAD };
		notifications.value = [];
		meta.value = null;
		fcmToken.value = null;
	}

	return {
		fcmToken,
		unreadCount,
		notifications,
		meta,
		loading,
		incrementUnread,
		fetchUnreadCount,
		fetchNotifications,
		markRead,
		markAllRead,
		quickApprove,
		quickReject,
		deleteAll,
		registerDevice,
		unregisterDevice,
		reset,
	};
});
