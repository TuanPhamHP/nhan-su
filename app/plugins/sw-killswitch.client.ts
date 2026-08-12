// Kill-switch cho SW cũ do @vite-pwa/nuxt sinh ra trước đây.
// PWA đã bị disable trong nuxt.config.ts, nhưng các tab đang mở ở client
// vẫn còn service worker cũ + workbox precache — plugin này dọn dẹp giúp.
// Giữ nguyên firebase-messaging-sw.js để FCM tiếp tục hoạt động.
export default defineNuxtPlugin(() => {
	if (!('serviceWorker' in navigator)) return;

	navigator.serviceWorker
		.getRegistrations()
		.then(regs => {
			for (const reg of regs) {
				if (reg.scope.includes('firebase-cloud-messaging-push-scope')) continue;
				reg.unregister().catch(() => {});
			}
		})
		.catch(() => {});

	if ('caches' in window) {
		caches
			.keys()
			.then(keys => {
				for (const key of keys) {
					if (key.startsWith('workbox-') || key.includes('precache') || key.includes('runtime')) {
						caches.delete(key).catch(() => {});
					}
				}
			})
			.catch(() => {});
	}
});
