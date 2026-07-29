import type { Socket } from 'socket.io-client';
import { useSocket } from './useSocket';
import type { AnnouncementComment, EmojiKey, ReactionSummary } from '~/types/announcement.types';

// Xem @docs/realtime-websocket.md — Rule 1: composable chỉ join/leave room + bind event,
// KHÔNG sở hữu connection (Manager singleton do plugins/socket.client.ts quản lý).

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

const NAMESPACE = '/announcements';

// Rooms user đang xem — cần re-join sau mỗi lần socket reconnect.
const activeRooms = new Set<number>();

// Bind `connect` handler tối đa 1 lần / instance socket.
// WeakSet cho phép socket cũ được GC khi Manager reset (login/logout).
const connectHandlerBoundSockets = new WeakSet<Socket>();

function ensureRejoinHandler(s: Socket) {
	if (connectHandlerBoundSockets.has(s)) return;
	connectHandlerBoundSockets.add(s);
	s.on('connect', () => {
		for (const id of activeRooms) s.emit('join', { announcementId: id });
	});
}

export function useAnnouncementRealtime() {
	function subscribe(announcementId: number, handlers: RealtimeHandlers): () => void {
		const s = useSocket(NAMESPACE);
		ensureRejoinHandler(s);

		activeRooms.add(announcementId);
		// Socket.IO buffer emit khi chưa connect và flush khi ready — an toàn gọi ngay.
		s.emit('join', { announcementId });

		const onAdded = handlers.onCommentAdded;
		const onDeleted = handlers.onCommentDeleted;
		const onReaction = handlers.onReactionChanged;

		// Wrap để filter theo announcementId — phòng cross-room leak nếu server broadcast sai.
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
			if (s.connected) s.emit('leave', { announcementId });
		};
	}

	return { subscribe };
}
