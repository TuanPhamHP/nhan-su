import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { useAuthStore } from '~/stores/auth';
import { useNotificationStore } from '~/stores/notification';

export default defineNuxtPlugin(() => {
	// Service Worker chỉ hoạt động trên HTTPS hoặc localhost
	if (!('serviceWorker' in navigator) || !window.isSecureContext) return;

	const config = useRuntimeConfig();
	const authStore = useAuthStore();
	const notificationStore = useNotificationStore();
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
		onMessage(messaging, payload => {
			const data = payload.data as Record<string, string> | undefined;
			const title = data?.title ?? 'Thông báo mới';
			const body = data?.body ?? '';

			notificationStore.incrementUnread();
			// Sau khi nhận FCM signal → luôn fetch lại từ API để đảm bảo đúng
			notificationStore.fetchUnreadCount().catch(() => {});

			toast.info(`${title}${body ? ': ' + body : ''}`);
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
