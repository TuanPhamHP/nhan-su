// firebase-messaging-sw.js
// FCM Service Worker — chỉ khởi tạo Firebase Messaging và xử lý click vào notification.
//
// Lưu ý: KHÔNG cài onBackgroundMessage handler. Server gửi cả `notification` field
// nên Firebase tự render notification ở background — gắn thêm onBackgroundMessage sẽ
// tạo ra noti trùng lặp. Xem docs/backend/bridges/fcm-notifications.md mục 3.
//
// SETUP: Firebase config bên dưới là client config (public), an toàn để commit.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const firebaseConfig = {
	apiKey: 'AIzaSyAUzbzRnn253hdZFtpiY_lNLsOyxUZ-JFE',
	authDomain: 'sth-hrm-dev.firebaseapp.com',
	projectId: 'sth-hrm-dev',
	storageBucket: 'sth-hrm-dev.firebasestorage.app',
	messagingSenderId: '992587795574',
	appId: '1:992587795574:web:1ee7c2ed84e75e0eaee357',
};

firebase.initializeApp(firebaseConfig);
firebase.messaging();

// Khi user click notification (background/killed) → focus tab hiện có hoặc mở /notifications.
// SW không biết role nên không tự navigate đến trang chi tiết — danh sách /notifications
// sẽ tự dùng resolveNotificationRoute() để đi đúng URL theo role khi user click item.
self.addEventListener('notificationclick', event => {
	event.notification.close();
	const targetUrl = '/notifications';

	event.waitUntil(
		clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
			for (const client of clientList) {
				if ('focus' in client) {
					client.postMessage({ type: 'fcm-notification-click', data: event.notification.data ?? {} });
					return client.focus();
				}
			}
			return clients.openWindow(targetUrl);
		}),
	);
});
