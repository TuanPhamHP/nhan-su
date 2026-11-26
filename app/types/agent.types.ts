/** Sự kiện SSE do /v1/agent/chat/stream đẩy về. */
export type AgentStreamEvent =
	| { type: 'status'; stage: 'routing'; conversationId?: number }
	| { type: 'status'; stage: 'playbook'; playbookId: string | null; tier: string; conversationId?: number }
	| { type: 'status'; stage: 'tool'; tool: string; conversationId?: number }
	| { type: 'delta'; text: string; conversationId?: number }
	| { type: 'form'; pendingActionId: number; form: AgentForm; conversationId?: number }
	| { type: 'chart'; chart: AgentChart; tool: string; conversationId?: number }
	| { type: 'table'; table: AgentTable; tool: string; conversationId?: number }
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
	/**
	 * `L1_CREATE` tạo mới, `L2_DECIDE` duyệt đơn, `L2_CHANGE` sửa hay huỷ một bản ghi đang có (dời lượt họp,
	 * chuyển trạng thái việc, đổi hạn, phản hồi phiếu KPI). Mức lạ vẫn render như thường: server có thể thêm mức.
	 */
	confirmLevel: 'L1_CREATE' | 'L2_DECIDE' | 'L2_CHANGE' | string;
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
	/** ID tin nhắn trả lời — cần để gửi đánh giá. `null` khi BE không lưu được. */
	messageId: number | null;
	answer: string;
	playbookId: string | null;
	routerTier: 'RULE' | 'EMBEDDING' | 'LLM' | 'FALLBACK' | string;
	toolsCalled: string[];
	usage: AgentTokenUsage;
	/** Có mặt khi server muốn mời chấm điểm lượt này. `null` = đừng hiện gì. */
	feedbackPrompt: AgentFeedbackPrompt | null;
}

/** 4 mức, thứ tự từ tệ tới tốt. Nhãn tiếng Việt do server gửi kèm, FE không tự dịch. */
export type AgentFeedbackRating = 'BAD' | 'AVERAGE' | 'USEFUL' | 'GREAT';

export interface AgentFeedbackOption {
	value: AgentFeedbackRating;
	label: string;
}

/**
 * Lời mời chấm điểm, do SERVER quyết định khi nào xuất hiện.
 *
 * FE KHÔNG tự đặt nhịp hỏi: web và mobile phải hỏi cùng nhịp, nếu không số liệu hai
 * nền tảng không so được. Cứ thấy `feedbackPrompt` thì hiện, không thấy thì thôi.
 */
export interface AgentFeedbackPrompt {
	messageId: number;
	question: string;
	/** Render đúng thứ tự trong mảng — server đã sắp từ tệ tới tốt. */
	options: AgentFeedbackOption[];
	commentPlaceholder: string;
}

/** Điểm đã chấm. Chỉ bao giờ là điểm của CHÍNH người đang đăng nhập. */
export interface AgentFeedback {
	messageId: number;
	rating: AgentFeedbackRating;
	ratingLabel: string;
	comment: string | null;
	createdAt: string;
	updatedAt: string;
}

/** Trạng thái gửi đánh giá của một tin nhắn. `failed` = gửi lỗi, cho bấm lại. */
export type AgentFeedbackState = 'idle' | 'saving' | 'failed';

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

/** Một cột của bảng chi tiết do server dựng. */
export interface AgentTableColumn {
	/** Khoá để tra giá trị trong mỗi phần tử `AgentTable.rows`. */
	key: string;
	label: string;
	/** `number` canh phải. Mặc định `text`. */
	align?: 'text' | 'number';
}

/**
 * Bảng chi tiết do SERVER dựng, đính kèm câu trả lời.
 *
 * Cùng bất biến với `AgentChart`: tool tự dựng bảng từ đúng dữ liệu nó vừa đọc, model
 * KHÔNG viết ô nào. FE chỉ vẽ lại y nguyên — không đếm lại, không cộng, không sắp xếp
 * lại, không thêm dòng tổng. Bảng sai mà trông thật thì người đọc vẫn tin.
 */
export interface AgentTable {
	title: string;
	columns: AgentTableColumn[];
	/** Mọi giá trị là chuỗi ĐÃ FORMAT sẵn — không phải number, không phải null. Ô trống là `'—'`. */
	rows: Record<string, string>[];
	source?: string;
}

export interface AgentChatMessage {
	id: string;
	role: AgentMessageRole;
	text: string;
	/** ID tin nhắn ở BE. Có thì mới chấm điểm được — tin nhắn của chính người dùng không có. */
	messageId?: number;
	/** Server đang mời chấm lượt này. */
	feedbackPrompt?: AgentFeedbackPrompt | null;
	/** Điểm người dùng đã chấm cho lượt này (kể cả khi nạp lại hội thoại cũ). */
	feedback?: AgentFeedback | null;
	feedbackState?: AgentFeedbackState;
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
	/** Bảng chi tiết server gửi kèm. Một lượt có thể có nhiều bảng, và có cả bảng lẫn biểu đồ. */
	tables?: AgentTable[];
}

/** Nhãn tiếng Việt cho tên tool — hiện lúc agent đang tra cứu. */
export const AGENT_TOOL_LABELS: Record<string, string> = {
	leave_getMyBalance: 'Đang tra cứu quỹ phép…',
	attendance_getMyStats: 'Đang tra cứu bảng công…',
	// Tool ghi: nó KHÔNG gửi đơn, chỉ dựng form. Nhãn phải nói đúng thế, kẻo người
	// dùng tưởng đơn đã đi rồi và bỏ qua bước xác nhận.
	leave_createRequest: 'Đang chuẩn bị đơn nghỉ phép…',

	// Hành chính văn phòng (module OFFICE).
	office_findFreeRooms: 'Đang tìm phòng họp trống…',
	office_myBookings: 'Đang tra lịch họp của bạn…',
	office_mySupplyRequest: 'Đang tra phiếu văn phòng phẩm…',
	office_periodProgress: 'Đang tra tiến độ kỳ văn phòng phẩm…',
	office_supplyCosts: 'Đang tính chi phí văn phòng phẩm…',
	office_bookRoom: 'Đang chuẩn bị đặt phòng họp…',
	office_changeBooking: 'Đang chuẩn bị dời lượt họp…',
	office_cancelBooking: 'Đang chuẩn bị huỷ lượt họp…',
	office_setSupplyLine: 'Đang chuẩn bị phiếu văn phòng phẩm…',

	// Công việc và KPI (module TASKS).
	task_myAgenda: 'Đang tra việc của bạn…',
	task_search: 'Đang tìm việc…',
	task_getDetail: 'Đang xem chi tiết việc…',
	task_departmentOverview: 'Đang tra việc của phòng…',
	task_projectOverview: 'Đang tra dự án…',
	task_progressReport: 'Đang lập báo cáo tiến độ…',
	kpi_myReviews: 'Đang tra phiếu KPI của bạn…',
	kpi_getReview: 'Đang xem phiếu KPI…',
	kpi_toReview: 'Đang tra phiếu chờ bạn chấm…',
	kpi_periodResults: 'Đang tra kết quả KPI…',
	task_create: 'Đang chuẩn bị giao việc…',
	task_transition: 'Đang chuẩn bị chuyển trạng thái việc…',
	task_changeDue: 'Đang chuẩn bị đổi hạn việc…',
	kpi_giveFeedback: 'Đang chuẩn bị phản hồi phiếu KPI…',
};

/**
 * Chữ trên thẻ nhỏ dưới câu trả lời (lượt này đã tra gì): lấy từ nhãn đang chạy, bỏ "Đang " và dấu "…".
 * Tool chưa có nhãn thì gộp thành "Tra cứu dữ liệu": người dùng KHÔNG bao giờ thấy tên tool thô (`task_myAgenda`).
 */
export function agentToolChipLabel(tool: string): string {
	const label = AGENT_TOOL_LABELS[tool];
	if (!label) return 'Tra cứu dữ liệu';
	const text = label.replace(/^Đang\s+/, '').replace(/…$/, '');
	return text.charAt(0).toUpperCase() + text.slice(1);
}

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
	/**
	 * Chỉ có ở lượt trả lời hỏng giữa chừng: đúng câu báo lỗi người dùng đã thấy qua `event: error`.
	 *
	 * Hỏng trước khi sinh chữ nào thì `text` cũng bằng câu này; hỏng sau khi đã stream vài chữ thì
	 * `text` là phần chữ dở. Tin nhắn cũ và mọi lượt trả lời trọn vẹn đều không có trường này.
	 */
	error?: string;
	/** Có khi lượt đó server dựng biểu đồ. Tin nhắn cũ không có trường này. */
	charts?: AgentChart[];
	/** Có khi lượt đó server dựng bảng. Tin nhắn cũ không có trường này. */
	tables?: AgentTable[];
	/** Điểm chính người gọi đã chấm cho câu trả lời này. Vắng = chưa chấm. */
	feedback?: AgentFeedback | null;
	createdAt: string;
}

/** Gợi ý câu hỏi hiện ở màn hình trống của khung chat. */
export interface AgentSuggestion {
	/** Tên icon theo @nuxt/icon, VD: `heroicons:sun`. */
	icon: string;
	label: string;
}

/** Gợi ý dùng chung cho trang Trợ lý và cửa sổ chat nhanh, để hai nơi không lệch nhau. */
export const AGENT_SUGGESTIONS: AgentSuggestion[] = [
	{ icon: 'heroicons:sun', label: 'Tôi còn mấy ngày phép?' },
	{ icon: 'heroicons:clock', label: 'Tháng này tôi đi muộn mấy lần?' },
	{ icon: 'heroicons:table-cells', label: 'Cho xem bảng công tháng trước' },
];

/** Gợi ý của phân hệ Công việc và KPI: chỉ hiện khi công ty dùng phân hệ đó. */
export const AGENT_TASKS_SUGGESTION: AgentSuggestion = {
	icon: 'heroicons:check-circle',
	label: 'Hôm nay tôi có việc gì?',
};

/**
 * Gợi ý cho màn chat trống theo phân hệ công ty đang dùng.
 *
 * Gợi ý của phân hệ bán riêng KHÔNG đặt cố định vào `AGENT_SUGGESTIONS`: công ty chưa dùng thì
 * bấm vào chỉ nhận câu "công ty chưa dùng", giống như một nút hỏng.
 */
export function agentSuggestions(modules: { tasks: boolean }): AgentSuggestion[] {
	return modules.tasks ? [...AGENT_SUGGESTIONS, AGENT_TASKS_SUGGESTION] : AGENT_SUGGESTIONS;
}
