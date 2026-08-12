// Self-destruct service worker.
// Thay thế cho Workbox SW cũ do @vite-pwa/nuxt trước đây sinh ra.
// Trình duyệt định kỳ fetch /sw.js để check update; nội dung mới khác byte
// với bản cũ → trigger install → activate → clear cache + unregister + reload.
self.addEventListener('install', () => {
	self.skipWaiting();
});

self.addEventListener('activate', event => {
	event.waitUntil(
		(async () => {
			const cacheKeys = await caches.keys();
			await Promise.all(cacheKeys.map(key => caches.delete(key)));
			await self.registration.unregister();
			const clients = await self.clients.matchAll({ type: 'window' });
			for (const client of clients) {
				try {
					client.navigate(client.url);
				} catch {
					// noop
				}
			}
		})(),
	);
});
