/** Sự kiện SSE do /v1/agent/chat/stream đẩy về. */
export type AgentStreamEvent =
	| { type: 'status'; stage: 'routing'; conversationId?: number }
	| { type: 'status'; stage: 'playbook'; playbookId: string | null; tier: string; conversationId?: number }
	| { type: 'status'; stage: 'tool'; tool: string; conversationId?: number }
	| { type: 'delta'; text: string; conversationId?: number }
	| { type: 'form'; pendingActionId: number; form: AgentForm; conversationId?: number }
	| { type: 'chart'; chart: AgentChart; tool: string; conversationId?: number }
	| { type: 'done'; result: AgentChatResult }
	| { type: 'error'; message: string };

export type AgentFormFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'readonly';

/**
 * Một ô trong form xác nhận.
 *
 * `source` là NGUỒN giá trị, KHÔNG phải quyền sửa — quyền sửa nằm ở `type`, chỉ
 * `readonly` là khoá. Field `system` vẫn sửa được (VD "Loại phép" server điền mặc định
 * khi model không nói tới). Chỉ `source: 'llm'` mới được đánh dấu "máy đoán".
 */
export interface AgentFormField {
	name: string;
	label: string;
	type: AgentFormFieldType;
	required: boolean;
	value: string | number | null;
	source: 'llm' | 'system';
	options?: { value: string | number; label: string }[];
	helpText?: string;
	/** Ràng buộc server sẽ kiểm — client phải chặn trước, xem AgentActionForm. */
	minLength?: number;
	/** Bắt buộc chỉ khi ô `field` mang một trong các giá trị `equals` (VD: ghi chú khi Từ chối). */
	requiredWhen?: AgentFieldCondition;
	/** Chỉ HIỆN ô khi ô `field` mang một trong `equals` (VD: số phút khi chọn Về sớm). */
	visibleWhen?: AgentFieldCondition;
}

export interface AgentFieldCondition {
	field: string;
	/** So sánh dưới dạng chuỗi — giá trị lấy từ DOM luôn là chuỗi. */
	equals: string[];
}

export interface AgentFormPanel {
	label: string;
	value: string;
}

export interface AgentForm {
	title: string;
	confirmLevel: 'L1_CREATE' | 'L2_DECIDE' | string;
	fields: AgentFormField[];
	/** Dữ liệu gốc do SERVER render — không lấy từ lời văn của model. */
	context: AgentFormPanel[];
	warnings: string[];
	submitLabel: string;
	successMessage?: string;
}

/** Trạng thái form trong khung chat. Một form chỉ đi một chiều, không quay lại `idle`. */
export type AgentFormState = 'idle' | 'submitting' | 'done' | 'cancelled' | 'failed';

export interface AgentPendingAction {
	pendingActionId: number;
	form: AgentForm;
	state: AgentFormState;
	/** Câu báo sau khi commit, hoặc lý do thất bại. */
	message?: string;
}

export interface AgentConfirmResult {
	pendingActionId: number;
	toolName: string;
	result: unknown;
	message: string;
}

/** Bản ghi form còn hiệu lực, lấy lại khi mở lại hội thoại (SSE không sống qua F5). */
export interface AgentPendingActionRow {
	id: number;
	toolName: string;
	form: AgentForm;
	expiresAt: string;
}

export interface AgentTokenUsage {
	promptTokens: number;
	completionTokens: number;
	cachedPromptTokens: number;
	costUsd: number | null;
}

export interface AgentChatResult {
	conversationId: number;
	answer: string;
	playbookId: string | null;
	routerTier: 'RULE' | 'EMBEDDING' | 'LLM' | 'FALLBACK' | string;
	toolsCalled: string[];
	usage: AgentTokenUsage;
}

/** `system` = dấu vết một thao tác đã thực thi, hiện dạng dải mảnh giữa khung chat. */
export type AgentMessageRole = 'user' | 'assistant' | 'system';

/** Một chuỗi số trong biểu đồ; `data` khớp 1-1 theo chỉ số với `AgentChart.labels`. */
export interface AgentChartSeries {
	name: string;
	data: number[];
}

/**
 * Biểu đồ do SERVER dựng, đính kèm câu trả lời.
 *
 * Số liệu KHÔNG do model sinh ra — tool tự dựng từ đúng dữ liệu nó vừa đọc. FE chỉ vẽ
 * lại y nguyên, không tính toán, không làm tròn, không suy ra số nào thêm.
 */
export interface AgentChart {
	type: 'bar' | 'line' | 'donut';
	title: string;
	labels: string[];
	series: AgentChartSeries[];
	unit?: string;
	source?: string;
}

export interface AgentChatMessage {
	id: string;
	role: AgentMessageRole;
	text: string;
	/** Đang nhận stream — UI hiện con trỏ nhấp nháy. */
	streaming?: boolean;
	error?: boolean;
	/** Trạng thái hiện tại để hiện "đang tra cứu…". Xoá khi có delta đầu tiên. */
	status?: string;
	toolsCalled?: string[];
	usage?: AgentTokenUsage;
	/** Form xác nhận đính kèm câu trả lời này. */
	pending?: AgentPendingAction;
	/** Biểu đồ server gửi kèm. Nhiều tool trong một lượt thì có nhiều biểu đồ. */
	charts?: AgentChart[];
}

/** Nhãn tiếng Việt cho tên tool — hiện lúc agent đang tra cứu. */
export const AGENT_TOOL_LABELS: Record<string, string> = {
	leave_getMyBalance: 'Đang tra cứu quỹ phép…',
	attendance_getMyStats: 'Đang tra cứu bảng công…',
	// Tool ghi: nó KHÔNG gửi đơn, chỉ dựng form. Nhãn phải nói đúng thế, kẻo người
	// dùng tưởng đơn đã đi rồi và bỏ qua bước xác nhận.
	leave_createRequest: 'Đang chuẩn bị đơn nghỉ phép…',
};

export interface AgentConversation {
	id: number;
	title: string | null;
	lastMessageAt: string | null;
	createdAt: string;
	messageCount: number;
}

export interface AgentConversationMessage {
	id: number;
	role: 'user' | 'assistant' | 'system' | string;
	text: string;
	/** Có khi lượt đó server dựng biểu đồ. Tin nhắn cũ không có trường này. */
	charts?: AgentChart[];
	createdAt: string;
}

/** Gợi ý câu hỏi hiện ở màn hình trống của khung chat. */
export interface AgentSuggestion {
	/** Tên icon theo @nuxt/icon, VD: `heroicons:sun`. */
	icon: string;
	label: string;
}
