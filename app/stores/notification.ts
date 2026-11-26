import { defineStore } from 'pinia';
import type { NotificationResponse, NotificationListMeta, UnreadCountResponse, QueryNotificationsParams, NotificationCategory } from '~/types/notification.types';
import { useNotificationService } from '~/services';
import { useDeviceTokenService } from '~/services';

const DEFAULT_UNREAD: UnreadCountResponse = { total: 0, event: 0, attendance: 0, leave: 0, task: 0 };

/** Ô đếm chưa đọc theo category; category không có ô riêng (REQUEST) thì chỉ trừ tổng. */
type UnreadKey = 'event' | 'attendance' | 'leave' | 'task';
const UNREAD_KEY: Partial<Record<NotificationCategory, UnreadKey>> = {
	EVENT: 'event',
	ATTENDANCE: 'attendance',
	LEAVE: 'leave',
	TASK: 'task',
};

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
			const key = UNREAD_KEY[notif.category];
			if (key) unreadCount.value[key] = Math.max(0, (unreadCount.value[key] ?? 0) - 1);
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
			const key = UNREAD_KEY[category];
			if (!key) return;
			const prev = unreadCount.value[key] ?? 0;
			unreadCount.value[key] = 0;
			unreadCount.value.total = Math.max(0, unreadCount.value.total - prev);
		}
	}

	/**
	 * Sau khi duyệt, từ chối ngay trong chuông: làm mới huy hiệu Duyệt đơn và Công việc (phiếu xin dời hạn tính ở
	 * `taskDueRequests`), cùng số chưa đọc, vì máy chủ tự đánh dấu đã đọc cả các tin cùng phiếu.
	 */
	function refreshAfterDecision() {
		useApprovalStore().fetchCounts();
		fetchUnreadCount().catch(() => undefined);
	}

	async function quickApprove(notification: NotificationResponse) {
		if (!notification.actionPayload) return;
		const service = useNotificationService();
		if (notification.actionPayload.refType === 'task_due_request') {
			await service.decideTaskDueRequest(notification.actionPayload.approveEndpoint);
		} else {
			await service.approveRequest(notification.actionPayload.approveEndpoint);
		}
		await markRead(notification.id);
		refreshAfterDecision();
	}

	async function quickReject(notification: NotificationResponse, rejectNote: string) {
		if (!notification.actionPayload) return;
		const service = useNotificationService();
		if (notification.actionPayload.refType === 'task_due_request') {
			await service.decideTaskDueRequest(notification.actionPayload.rejectEndpoint, rejectNote);
		} else {
			await service.rejectRequest(notification.actionPayload.rejectEndpoint, rejectNote);
		}
		await markRead(notification.id);
		refreshAfterDecision();
	}

	async function deleteAll(category?: NotificationCategory) {
		const { deleteAll: deleteAllFn } = useNotificationService();
		await deleteAllFn(category);
		if (!category) {
			notifications.value = [];
			meta.value = null;
			unreadCount.value = { ...DEFAULT_UNREAD };
		} else {
			notifications.value = notifications.value.filter(n => n.category !== category);
			const key = UNREAD_KEY[category];
			if (!key) return;
			const prev = unreadCount.value[key] ?? 0;
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
