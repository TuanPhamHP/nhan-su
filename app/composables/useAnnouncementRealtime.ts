import { io, type Socket } from 'socket.io-client';
import type { AnnouncementComment, EmojiKey, ReactionSummary } from '~/types/announcement.types';
import { getCookie } from '~/utils/cookie';

export interface ReactionChangedEvent {
	announcementId: number;
	action: 'added' | 'changed' | 'removed';
	emoji: EmojiKey;
	actor: { id: number; fullName: string; avatarUrl: string | null };
	summary: ReactionSummary;
}

export interface CommentDeletedEvent {
	announcementId: number;
	commentId: number;
}

export interface RealtimeHandlers {
	onCommentAdded?: (comment: AnnouncementComment) => void;
	onCommentDeleted?: (payload: CommentDeletedEvent) => void;
	onReactionChanged?: (payload: ReactionChangedEvent) => void;
}

interface WsError {
	code: string;
	message: string;
}

// Singleton socket + shared registry of active rooms — sống suốt tab session.
let socket: Socket | null = null;
const activeRooms = new Set<number>();

function buildNamespaceUrl(baseApiUrl: string): string {
	// baseApiUrl có thể là "https://api.example.com" hoặc "https://api.example.com/api"
	// Socket.IO namespace là "/announcements" — nối vào origin, không nối vào path.
	try {
		const u = new URL(baseApiUrl);
		return `${u.origin}/announcements`;
	} catch {
		// Fallback nếu baseApiUrl không parse được như URL tuyệt đối
		return `${baseApiUrl.replace(/\/+$/, '')}/announcements`;
	}
}

export function useAnnouncementRealtime() {
	const config = useRuntimeConfig();

	function currentToken(): string | null {
		return getCookie('access_token');
	}

	function ensureConnected(): Socket {
		if (socket?.connected) return socket;
		if (socket) {
			// Có socket cũ nhưng chưa connect — cập nhật token mới nhất rồi thử connect lại.
			socket.auth = { token: currentToken() ?? '' };
			socket.connect();
			return socket;
		}

		const url = buildNamespaceUrl(config.public.baseApiUrl as string);
		socket = io(url, {
			auth: { token: currentToken() ?? '' },
			transports: ['websocket'],
			autoConnect: true,
			reconnection: true,
		});

		// Sau khi reconnect, tự động re-join mọi room đang active.
		socket.on('connect', () => {
			for (const id of activeRooms) {
				socket?.emit('join', { announcementId: id });
			}
		});

		socket.on('error', (err: WsError) => {
			if (err?.code === 'UNAUTHENTICATED') {
				// Refresh cookie có thể đã được update bởi auth.fetch — thử reconnect với token mới.
				const fresh = currentToken();
				if (fresh && socket) {
					socket.auth = { token: fresh };
					socket.disconnect().connect();
				}
			}
		});

		return socket;
	}

	function subscribe(announcementId: number, handlers: RealtimeHandlers): () => void {
		const s = ensureConnected();

		activeRooms.add(announcementId);
		s.emit('join', { announcementId });

		const onAdded = handlers.onCommentAdded;
		const onDeleted = handlers.onCommentDeleted;
		const onReaction = handlers.onReactionChanged;

		// Wrap handler để filter theo announcementId (server broadcast chỉ đúng room,
		// nhưng vì socket singleton nên vẫn cần guard nếu tương lai có sự cố cross-room).
		const wrappedAdded = onAdded
			? (c: AnnouncementComment) => {
					if (c.announcementId === announcementId) onAdded(c);
				}
			: null;
		const wrappedDeleted = onDeleted
			? (p: CommentDeletedEvent) => {
					if (p.announcementId === announcementId) onDeleted(p);
				}
			: null;
		const wrappedReaction = onReaction
			? (p: ReactionChangedEvent) => {
					if (p.announcementId === announcementId) onReaction(p);
				}
			: null;

		if (wrappedAdded) s.on('comment.added', wrappedAdded);
		if (wrappedDeleted) s.on('comment.deleted', wrappedDeleted);
		if (wrappedReaction) s.on('reaction.changed', wrappedReaction);

		return () => {
			if (wrappedAdded) s.off('comment.added', wrappedAdded);
			if (wrappedDeleted) s.off('comment.deleted', wrappedDeleted);
			if (wrappedReaction) s.off('reaction.changed', wrappedReaction);
			activeRooms.delete(announcementId);
			// leave room nếu socket còn connect — nếu đang offline thì bỏ qua, room sẽ không được re-join sau reconnect nữa
			if (s.connected) s.emit('leave', { announcementId });
		};
	}

	function disconnect() {
		socket?.disconnect();
		socket = null;
		activeRooms.clear();
	}

	return { subscribe, disconnect };
}
