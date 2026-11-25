import type { Socket } from 'socket.io-client';
import { useSocket } from './useSocket';
import type { TaskChangedEvent, TaskCommentEvent } from '~/types/tasks.types';

/**
 * Kênh thời gian thực `/tasks` (`docs/realtime-websocket.md` mục 2). Sự kiện chỉ mang id, số hiệu,
 * phiên bản: trang nhận thì tự gọi lại API theo quyền của mình.
 *
 * Phòng riêng của người dùng có sẵn khi kết nối; phòng dự án phải `join` SAU khi máy chủ phát
 * `ready` (gửi trước bị từ chối), và phải vào lại sau mỗi lần kết nối lại.
 */
const NAMESPACE = '/tasks';
const activeProjects = new Map<number, number>();
const readySockets = new WeakSet<Socket>();
const boundSockets = new WeakSet<Socket>();

function ensureBound(s: Socket) {
	if (boundSockets.has(s)) return;
	boundSockets.add(s);
	s.on('ready', () => {
		readySockets.add(s);
		for (const projectId of activeProjects.keys()) s.emit('join', { projectId }, () => {});
	});
	s.on('disconnect', () => readySockets.delete(s));
}

export interface TaskRealtimeHandlers {
	onTaskChanged?: (event: TaskChangedEvent) => void;
	onComment?: (event: TaskCommentEvent) => void;
}

export function useTaskRealtime() {
	function getSocket(): Socket | null {
		try {
			const s = useSocket(NAMESPACE);
			ensureBound(s);
			if (!s.connected) s.connect();
			return s;
		} catch {
			// Chưa đăng nhập xong: trang vẫn chạy, chỉ không tự cập nhật.
			return null;
		}
	}

	/** Nghe sự kiện; trả hàm gỡ. `projectId` có thì vào thêm phòng dự án. */
	function subscribe(handlers: TaskRealtimeHandlers, projectId?: number | null): () => void {
		const s = getSocket();
		if (!s) return () => {};
		if (projectId) {
			activeProjects.set(projectId, (activeProjects.get(projectId) ?? 0) + 1);
			if (readySockets.has(s)) s.emit('join', { projectId }, () => {});
		}
		const changed = handlers.onTaskChanged ?? null;
		const comment = handlers.onComment ?? null;
		if (changed) s.on('task.changed', changed);
		if (comment) s.on('task.comment', comment);
		return () => {
			if (changed) s.off('task.changed', changed);
			if (comment) s.off('task.comment', comment);
			if (projectId) {
				const left = (activeProjects.get(projectId) ?? 1) - 1;
				if (left <= 0) {
					activeProjects.delete(projectId);
					if (readySockets.has(s)) s.emit('leave', { projectId }, () => {});
				} else {
					activeProjects.set(projectId, left);
				}
			}
		};
	}

	return { subscribe };
}
