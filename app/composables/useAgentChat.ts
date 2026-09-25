import { useAgentService } from '~/services/agent.service';
import {
	AGENT_TOOL_LABELS,
	type AgentChatMessage,
	type AgentConversation,
	type AgentMessageRole,
	type AgentPendingActionRow,
} from '~/types/agent.types';

/**
 * Quản lý một phiên chat với trợ lý AI.
 *
 * Mỗi lần gọi `useAgentChat()` tạo state riêng — dùng trong component chat, không
 * đưa vào Pinia vì phiên chat gắn với vòng đời màn hình, không phải state toàn cục.
 */
export function useAgentChat() {
	const service = useAgentService();

	const messages = ref<AgentChatMessage[]>([]);
	const conversations = ref<AgentConversation[]>([]);
	const loadingHistory = ref(false);
	const input = ref('');
	const sending = ref(false);
	const conversationId = ref<number | undefined>(undefined);
	const error = ref<string | null>(null);

	let controller: AbortController | null = null;

	const canSend = computed(() => input.value.trim().length > 0 && !sending.value);

	async function send(text?: string): Promise<void> {
		const question = (text ?? input.value).trim();
		if (!question || sending.value) return;

		error.value = null;
		input.value = '';
		sending.value = true;
		const isNewConversation = !conversationId.value;
		controller = new AbortController();

		messages.value.push({ id: `u-${Date.now()}`, role: 'user', text: question });

		const reply = reactive<AgentChatMessage>({
			id: `a-${Date.now()}`,
			role: 'assistant',
			text: '',
			streaming: true,
			status: 'Đang xử lý…',
		});
		messages.value.push(reply);

		try {
			for await (const ev of service.chatStream(question, conversationId.value, controller.signal)) {
				if (ev.type === 'status') {
					if (ev.conversationId) conversationId.value = ev.conversationId;
					if (ev.stage === 'tool') reply.status = AGENT_TOOL_LABELS[ev.tool] ?? 'Đang tra cứu dữ liệu…';
					else if (ev.stage === 'routing') reply.status = 'Đang xử lý…';
				} else if (ev.type === 'delta') {
					reply.status = undefined; // có chữ rồi thì bỏ dòng trạng thái
					reply.text += ev.text;
				} else if (ev.type === 'chart') {
					// Biểu đồ đến qua kênh riêng, KHÔNG nằm trong luồng chữ — nên cứ gom lại,
					// không đụng tới reply.text. Một lượt có thể gọi nhiều tool nên có nhiều biểu đồ.
					(reply.charts ??= []).push(ev.chart);
				} else if (ev.type === 'form') {
					reply.status = undefined;
					reply.pending = {
						pendingActionId: ev.pendingActionId,
						form: ev.form,
						state: 'idle',
					};
				} else if (ev.type === 'done') {
					conversationId.value = ev.result.conversationId;
					reply.toolsCalled = ev.result.toolsCalled;
					reply.usage = ev.result.usage;
					if (!reply.text) reply.text = ev.result.answer;
				} else if (ev.type === 'error') {
					reply.error = true;
					reply.text = ev.message;
				}
			}
		} catch (err) {
			// Người dùng bấm dừng thì không phải lỗi
			if ((err as Error)?.name !== 'AbortError') {
				const message = (err as Error)?.message ?? 'Không kết nối được tới trợ lý';
				reply.error = true;
				if (!reply.text) reply.text = message;
				error.value = message;
			}
		} finally {
			reply.streaming = false;
			reply.status = undefined;
			sending.value = false;
			controller = null;
			// Tiêu đề do model đặt chạy nền ở BE → chờ chút rồi nạp lại danh sách
			if (isNewConversation) setTimeout(() => void loadConversations(), 4000);
			else void loadConversations();
		}
	}

	function stop(): void {
		controller?.abort();
	}

	function reset(): void {
		stop();
		messages.value = [];
		conversationId.value = undefined;
		error.value = null;
	}

	async function loadConversations(): Promise<void> {
		try {
			conversations.value = await service.listConversations();
		} catch {
			// Danh sách hỏng không được làm chết khung chat — vẫn chat mới được
		}
	}

	/**
	 * Mở lại một hội thoại cũ: nạp tin nhắn đã lưu + form còn hiệu lực.
	 *
	 * Form đi qua SSE nên F5 hay chuyển hội thoại là mất, trong khi bản ghi vẫn PENDING
	 * tới 15 phút. Không nạp lại thì người dùng quay về thấy trống và dễ tưởng đơn đã gửi.
	 */
	async function openConversation(id: number): Promise<void> {
		if (sending.value) stop();
		loadingHistory.value = true;
		error.value = null;
		try {
			const [rows, pendings] = await Promise.all([
				service.conversationMessages(id),
				// Form hỏng không được chặn việc xem lại hội thoại
				service.pendingActions(id).catch(() => [] as AgentPendingActionRow[]),
			]);

			const list: AgentChatMessage[] = rows
				.filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'system')
				.map((m) => ({
					id: `h-${m.id}`,
					role: m.role as AgentMessageRole,
					text: m.text,
					// Biểu đồ đã lưu cùng tin nhắn nên mở lại hội thoại vẫn còn hình.
					...(m.charts?.length ? { charts: m.charts } : {}),
				}));

			// Gắn form vào câu trả lời cuối — đúng vị trí nó từng hiện lúc đang chat.
			for (const p of pendings) {
				const pending = { pendingActionId: p.id, form: p.form, state: 'idle' as const };
				const host = [...list].reverse().find((m) => m.role === 'assistant' && !m.pending);
				if (host) host.pending = pending;
				else list.push({ id: `p-${p.id}`, role: 'assistant', text: '', pending });
			}

			messages.value = list;
			conversationId.value = id;
		} catch (err) {
			error.value = (err as Error)?.message ?? 'Không tải được hội thoại';
		} finally {
			loadingHistory.value = false;
		}
	}

	/** Tìm form theo id — mỗi tin nhắn giữ tối đa một form. */
	function findPending(pendingActionId: number) {
		return messages.value.find((m) => m.pending?.pendingActionId === pendingActionId)?.pending;
	}

	/**
	 * Xác nhận và thực thi. Trả về `true` khi thành công.
	 *
	 * Phân biệt hai loại thất bại, vì backend chỉ cho bấm MỘT lần:
	 *
	 * - **Server đã trả lời** (có HTTP status — 400 nghiệp vụ, 409 hết hạn…): thao tác
	 *   coi như dùng xong. `AiAgentActionService` chiếm quyền TRƯỚC khi gọi commit và
	 *   giữ nguyên CONFIRMED kể cả khi commit lỗi — vì nó không biết Service đã ghi tới
	 *   đâu. Bấm lại chắc chắn nhận 409, nên KHÔNG mời người dùng bấm lại: khoá thẻ,
	 *   nói rõ lý do, để họ nhắn lại yêu cầu.
	 * - **Không có status** (mất mạng, request chưa tới nơi): bản ghi có thể vẫn PENDING
	 *   nên cho gửi lại. Nếu thực ra server đã nhận, lần bấm sau nhận 409 — vẫn an toàn.
	 */
	async function confirmPending(
		pendingActionId: number,
		payload: Record<string, unknown>,
	): Promise<boolean> {
		const pending = findPending(pendingActionId);
		if (!pending || pending.state !== 'idle') return false;
		pending.state = 'submitting';
		try {
			const res = await service.confirmAction(pendingActionId, payload);
			pending.state = 'done';
			pending.message = res.message;
			return true;
		} catch (err) {
			const e = err as Error & { status?: number };
			pending.message = e?.message ?? 'Không kết nối được. Bạn thử gửi lại nhé.';
			pending.state = typeof e?.status === 'number' ? 'failed' : 'idle';
			if (pending.state === 'idle') error.value = pending.message;
			return false;
		}
	}

	async function cancelPending(pendingActionId: number): Promise<void> {
		const pending = findPending(pendingActionId);
		if (!pending || pending.state !== 'idle') return;
		pending.state = 'cancelled';
		// Huỷ ở server là dọn dẹp, hỏng cũng không sao: form đã khoá ở client và bản ghi
		// sẽ tự hết hạn. Không bắt người dùng nhìn lỗi cho một việc họ đã quyết định bỏ.
		await service.cancelAction(pendingActionId).catch(() => undefined);
	}

	async function archiveConversation(id: number): Promise<void> {
		await service.archiveConversation(id);
		conversations.value = conversations.value.filter((c) => c.id !== id);
		if (conversationId.value === id) reset();
	}

	async function renameConversation(id: number, title: string): Promise<void> {
		await service.renameConversation(id, title);
		const row = conversations.value.find((c) => c.id === id);
		if (row) row.title = title;
	}

	onScopeDispose(() => controller?.abort());

	return {
		messages,
		conversations,
		input,
		sending,
		loadingHistory,
		canSend,
		conversationId,
		error,
		send,
		stop,
		reset,
		loadConversations,
		openConversation,
		archiveConversation,
		renameConversation,
		confirmPending,
		cancelPending,
	};
}
