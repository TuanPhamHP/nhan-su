import { Manager, type Socket } from 'socket.io-client';

// Xem @docs/realtime-websocket.md — Rule 1: 1 Manager module-scope, feature dùng `useSocket(namespace)`.

type TokenGetter = () => string | null;

let manager: Manager | null = null;
let tokenGetter: TokenGetter | null = null;
let currentOrigin: string | null = null;
const namespaceSockets = new Map<string, Socket>();

function normalizeNamespace(ns: string): string {
	return ns.startsWith('/') ? ns : `/${ns}`;
}

export function initSocketManager(origin: string, getToken: TokenGetter): Manager {
	// Cùng origin → cập nhật getToken (auth callback đọc lại lần connect kế) và tái sử dụng manager.
	if (manager && currentOrigin === origin) {
		tokenGetter = getToken;
		return manager;
	}
	if (manager) resetSocketManager();

	currentOrigin = origin;
	tokenGetter = getToken;
	manager = new Manager(origin, {
		autoConnect: true,
		transports: ['websocket'],
		reconnection: true,
	});
	return manager;
}

export function resetSocketManager(): void {
	for (const s of namespaceSockets.values()) {
		s.removeAllListeners();
		s.disconnect();
	}
	namespaceSockets.clear();
	// Manager không expose close() public trong type — dùng cast để tránh leak connection.
	(manager as unknown as { _close?: () => void } | null)?._close?.();
	manager = null;
	tokenGetter = null;
	currentOrigin = null;
}

export function useSocket(namespace: string): Socket {
	const ns = normalizeNamespace(namespace);
	const cached = namespaceSockets.get(ns);
	if (cached) return cached;

	if (!manager || !tokenGetter) {
		throw new Error(
			`[useSocket] Socket Manager chưa sẵn sàng. Đảm bảo user đã đăng nhập trước khi gọi useSocket('${ns}').`,
		);
	}

	// auth dạng callback → mỗi lần (re)connect socket sẽ đọc lại token mới nhất từ cookie
	// (auth.fetch có thể vừa refresh access_token mà không đụng tới authStore.token).
	const getToken = tokenGetter;
	const socket = manager.socket(ns, {
		auth: (cb: (data: Record<string, unknown>) => void) => cb({ token: getToken() ?? '' }),
	});
	namespaceSockets.set(ns, socket);
	return socket;
}
