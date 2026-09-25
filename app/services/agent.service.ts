import { getCookie } from '~/utils/cookie';
import type {
	AgentStreamEvent,
	AgentConversation,
	AgentConversationMessage,
	AgentConfirmResult,
	AgentPendingActionRow,
} from '~/types/agent.types';
import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedResponse } from '~/types/api.types';

const ACCESS_TOKEN_KEY = 'access_token';
/** Giống auth.fetch.ts — bỏ header này thì ngrok chặn bằng trang cảnh báo HTML. */
const NGROK_HEADERS = { 'ngrok-skip-browser-warning': '1' };

/**
 * Service cho trợ lý AI.
 *
 * KHÔNG dùng được `$fetch` cho endpoint stream: ofetch đọc trọn body rồi mới trả về,
 * nên toàn bộ lợi ích của streaming mất sạch. Phải dùng `fetch` gốc + đọc ReadableStream.
 * `EventSource` cũng không dùng được vì nó chỉ GET và không gắn được header Authorization.
 */
export const useAgentService = () => {
	const baseApiUrl = useRuntimeConfig().public.baseApiUrl as string;
	const authFetch = useAuthFetch();

	return {
		async listConversations(limit = 30): Promise<AgentConversation[]> {
			const res = await authFetch<PaginatedResponse<AgentConversation>>(
				'/v1/agent/conversations',
				{ params: { page: 1, limit } },
			);
			return res.data;
		},

		async conversationMessages(id: number): Promise<AgentConversationMessage[]> {
			const res = await authFetch<ApiResponse<AgentConversationMessage[]>>(
				`/v1/agent/conversations/${id}/messages`,
			);
			return res.data;
		},

		async renameConversation(id: number, title: string): Promise<void> {
			await authFetch(`/v1/agent/conversations/${id}`, { method: 'PATCH', body: { title } });
		},

		/** Lưu trữ (soft delete) — backend KHÔNG xoá dữ liệu. */
		async archiveConversation(id: number): Promise<void> {
			await authFetch(`/v1/agent/conversations/${id}`, { method: 'DELETE' });
		},

		/** Form còn hiệu lực của hội thoại — SSE không sống qua F5, bản ghi thì còn. */
		async pendingActions(conversationId: number): Promise<AgentPendingActionRow[]> {
			const res = await authFetch<ApiResponse<AgentPendingActionRow[]>>(
				`/v1/agent/conversations/${conversationId}/pending-actions`,
			);
			return res.data;
		},

		/**
		 * Xác nhận và THỰC THI thao tác. Đây là lời gọi duy nhất từ FE gây ghi dữ liệu
		 * qua trợ lý — không có đường nào khác, kể cả khi model muốn.
		 */
		async confirmAction(id: number, payload: Record<string, unknown>): Promise<AgentConfirmResult> {
			const res = await authFetch<ApiResponse<AgentConfirmResult>>(
				`/v1/agent/actions/${id}/confirm`,
				{ method: 'POST', body: { payload } },
			);
			return res.data;
		},

		async cancelAction(id: number): Promise<void> {
			await authFetch(`/v1/agent/actions/${id}/cancel`, { method: 'POST' });
		},

		/**
		 * Gửi câu hỏi, nhận về async iterator các sự kiện SSE.
		 * Truyền `signal` để huỷ giữa chừng khi người dùng bấm dừng hoặc rời trang.
		 */
		async *chatStream(
			message: string,
			conversationId?: number,
			signal?: AbortSignal,
		): AsyncGenerator<AgentStreamEvent, void, undefined> {
			const token = getCookie(ACCESS_TOKEN_KEY);
			const res = await fetch(`${baseApiUrl}/v1/agent/chat/stream`, {
				method: 'POST',
				signal,
				headers: {
					'Content-Type': 'application/json',
					Accept: 'text/event-stream',
					...NGROK_HEADERS,
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				body: JSON.stringify({ message, conversationId }),
			});

			if (!res.ok || !res.body) {
				let detail = '';
				try {
					const body = (await res.json()) as { error?: { message?: string } };
					detail = body?.error?.message ?? '';
				} catch {
					/* body không phải JSON */
				}
				throw new Error(detail || `Trợ lý không phản hồi (HTTP ${res.status})`);
			}

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';

			try {
				for (;;) {
					const { done, value } = await reader.read();
					if (done) break;
					buffer += decoder.decode(value, { stream: true });

					// SSE ngăn cách các frame bằng một dòng trống
					const frames = buffer.split(/\r?\n\r?\n/);
					buffer = frames.pop() ?? '';

					for (const frame of frames) {
						const parsed = parseFrame(frame);
						if (parsed) yield parsed;
					}
				}
			} finally {
				reader.cancel().catch(() => undefined);
			}
		},
	};
};

function parseFrame(frame: string): AgentStreamEvent | null {
	let event = '';
	const dataLines: string[] = [];
	for (const line of frame.split(/\r?\n/)) {
		if (line.startsWith('event:')) event = line.slice(6).trim();
		else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
	}
	if (!dataLines.length) return null;
	try {
		const data = JSON.parse(dataLines.join('\n')) as Record<string, unknown>;
		if (event === 'done') return { type: 'done', result: data as never };
		if (event === 'error') return { type: 'error', message: String(data.message ?? 'Lỗi không xác định') };
		return data as unknown as AgentStreamEvent;
	} catch {
		return null;
	}
}
