// firebase-messaging-sw.js
// Xử lý push notification khi app đang đóng hoặc chạy nền.
//
// SETUP: Điền Firebase config bên dưới (Firebase Console → Project Settings → General → Your apps).
// Đây là client config (public), không phải Admin SDK key — an toàn để commit.

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

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
	const data = payload.data || {};
	const title = data.title || 'Thông báo';
	const body = data.body || '';

	self.registration.showNotification(title, {
		body,
		icon: '/favicon.ico',
		badge: '/favicon.ico',
		data: { notificationId: data.notificationId, type: data.type },
	});
});

// Khi user click vào notification → focus tab hoặc mở app
self.addEventListener('notificationclick', event => {
	event.notification.close();
	event.waitUntil(
		clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
			if (clientList.length > 0) {
				return clientList[0].focus();
			}
			return clients.openWindow('/');
		}),
	);
});
