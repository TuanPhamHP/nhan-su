import { useAuthStore } from '~/stores/auth';
import { initSocketManager, resetSocketManager } from '~/composables/useSocket';
import { getCookie } from '~/utils/cookie';

// Xem @docs/realtime-websocket.md — Rule 1: Manager singleton được khởi tạo GLOBAL khi có auth,
// không phụ thuộc việc user đã mở feature realtime nào chưa.

export default defineNuxtPlugin(() => {
	const config = useRuntimeConfig();
	const authStore = useAuthStore();

	function resolveOrigin(): string {
		const url = config.public.baseApiUrl as string;
		try {
			return new URL(url).origin;
		} catch {
			return url.replace(/\/+$/, '');
		}
	}

	const getToken = () => getCookie('access_token');

	if (authStore.isAuthenticated) {
		initSocketManager(resolveOrigin(), getToken);
	}

	watch(
		() => authStore.token,
		token => {
			if (token) initSocketManager(resolveOrigin(), getToken);
			else resetSocketManager();
		},
	);
});
