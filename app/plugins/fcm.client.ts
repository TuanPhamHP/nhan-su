import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { useAuthStore } from '~/stores/auth';
import { useNotificationStore } from '~/stores/notification';
import { useGeneralRequestStore } from '~/stores/generalRequest';
import type { FcmDataPayload } from '~/types/notification.types';

export default defineNuxtPlugin(() => {
	// Service Worker chỉ hoạt động trên HTTPS hoặc localhost
	if (!('serviceWorker' in navigator) || !window.isSecureContext) return;

	const config = useRuntimeConfig();
	const authStore = useAuthStore();
	const notificationStore = useNotificationStore();
	const generalRequestStore = useGeneralRequestStore();
	const toast = useToast();

	// Khởi tạo Firebase app một lần duy nhất
	const firebaseApp =
		getApps().length === 0
			? initializeApp({
					apiKey: config.public.firebaseApiKey,
					authDomain: config.public.firebaseAuthDomain,
					projectId: config.public.firebaseProjectId,
					storageBucket: config.public.firebaseStorageBucket,
					messagingSenderId: config.public.firebaseMessagingSenderId,
					appId: config.public.firebaseAppId,
				})
			: getApps()[0];

	const messaging = getMessaging(firebaseApp);

	async function initFcm() {
		if (!('Notification' in window)) return;

		const permission = await Notification.requestPermission();
		if (permission !== 'granted') return;

		try {
			const token = await getToken(messaging, {
				vapidKey: config.public.firebaseVapidKey,
			});

			if (token) {
				await notificationStore.registerDevice(token);
			}
		} catch (err) {
			console.warn('[FCM] Không thể lấy device token:', err);
			return;
		}

		// Lắng nghe tin nhắn khi app đang mở (foreground)
		// FCM data shape: { category, type, refType, id, notificationId, title, body }
		// Xem docs/backend/bridges/fcm-notifications.md mục 3.
		onMessage(messaging, payload => {
			const data = (payload.data ?? {}) as Partial<FcmDataPayload>;
			const type = data.type ?? '';
			const refType = data.refType ?? '';
			const refId = data.id && data.id !== '' ? Number(data.id) : undefined;
			const title = data.title ?? payload.notification?.title ?? 'Thông báo mới';
			const body = data.body ?? payload.notification?.body ?? '';

			// Sau khi nhận FCM signal → luôn fetch lại từ API để đảm bảo badge đúng
			notificationStore.incrementUnread();
			notificationStore.fetchUnreadCount().catch(() => {});

			// Toast variant theo type
			const message = `${title}${body ? ': ' + body : ''}`;
			if (type.endsWith('_APPROVED') || type === 'CHECK_IN' || type === 'CHECK_OUT') {
				toast.success(message);
			} else if (type.endsWith('_REJECTED') || type === 'LATE' || type === 'ABSENT') {
				toast.warning(message);
			} else {
				toast.info(message);
			}

			// Trigger re-fetch trên các page general-requests nếu liên quan
			if (refType === 'general_request') {
				generalRequestStore.triggerRefresh(refId);
			}
		});

		// Fetch unread count lần đầu ngay khi đã có token
		await notificationStore.fetchUnreadCount().catch(() => {});
	}

	// Nếu đã authenticated khi plugin load → init FCM ngay
	if (authStore.isAuthenticated) {
		initFcm();
	}

	// Watch để init FCM sau khi user login
	watch(
		() => authStore.isAuthenticated,
		isAuth => {
			if (isAuth) initFcm();
		},
	);

	// Re-fetch unread count mỗi khi tab được focus lại (bù cho FCM background)
	if (typeof document !== 'undefined') {
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible' && authStore.isAuthenticated) {
				notificationStore.fetchUnreadCount().catch(() => {});
			}
		});
	}
});
