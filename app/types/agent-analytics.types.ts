export interface AgentUsagePoint {
	/** Ngày (YYYY-MM-DD), hoặc tên model / mục đích tuỳ endpoint */
	bucket: string;
	promptTokens: number;
	completionTokens: number;
	cachedPromptTokens: number;
	costUsd: number;
	requests: number;
}

export interface AgentTopic {
	playbookId: string;
	runs: number;
	/** % trên tổng số lượt */
	share: number;
	/** % lượt thành công */
	successRate: number;
	fallback: number;
	toolError: number;
	modelError: number;
	byTier: Record<string, number>;
}

export interface AgentTopUser {
	employeeId: number;
	fullName: string;
	/**
	 * Mã nhân viên và phòng ban — chỉ có ở bản BE từ 06/10/2026 trở đi, nên để optional:
	 * trỏ vào server cũ thì bảng vẫn chạy, chỉ thiếu dòng phụ dưới tên.
	 */
	employeeCode?: string | null;
	department?: string | null;
	requests: number;
	totalTokens: number;
	costUsd: number;
}

export interface AgentAnalyticsSummary {
	from: string;
	to: string;
	conversations: number;
	messages: number;
	/** Riêng số câu trả lời của trợ lý — nền để tính tỷ lệ được chấm điểm. */
	answers: number;
	requests: number;
	activeUsers: number;
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
	cachedPromptTokens: number;
	/** % token nạp được từ cache của provider */
	cacheHitRate: number;
	costUsd: number;
	costPerRequestUsd: number;
}

/** Đánh giá người dùng chấm cho câu trả lời của trợ lý. */
export interface AgentFeedbackSummary {
	total: number;
	/** Đếm theo mức: BAD / AVERAGE / USEFUL / GREAT. */
	byRating: Record<string, number>;
	/** % lượt chấm USEFUL hoặc GREAT. */
	satisfactionRate: number;
	/** % lượt chấm BAD. */
	negativeRate: number;
	/** Điểm trung bình thang 1–4. `0` = chưa ai chấm, KHÔNG phải "toàn bộ đều tệ". */
	score: number;
	withComment: number;
	/** % câu trả lời được chấm. Thấp là bình thường — server chỉ hỏi thi thoảng. */
	responseRate: number;
}

export interface AgentFeedbackGroup {
	/** playbookId, hoặc tier router — tuỳ cách chia nhóm. */
	bucket: string;
	total: number;
	byRating: Record<string, number>;
	satisfactionRate: number;
	score: number;
}

/**
 * Một góp ý chữ. KHÔNG có nội dung câu hỏi / câu trả lời của lượt đó — backend cố ý
 * không trả, vì hội thoại chỉ chủ hội thoại được đọc.
 */
export interface AgentFeedbackComment {
	id: number;
	rating: string;
	ratingLabel: string;
	comment: string;
	playbookId: string | null;
	routerTier: string | null;
	employeeId: number;
	fullName: string;
	createdAt: string;
}

export interface AgentFeedbackAnalytics {
	from: string;
	to: string;
	/** Nhãn tiếng Việt của từng mức, do server cấp — FE KHÔNG giữ bản sao. */
	ratingLabels: Record<string, string>;
	summary: AgentFeedbackSummary;
	byPlaybook: AgentFeedbackGroup[];
	byTier: AgentFeedbackGroup[];
	comments: AgentFeedbackComment[];
}

export interface AgentAnalyticsOverview {
	summary: AgentAnalyticsSummary;
	daily: AgentUsagePoint[];
	byModel: AgentUsagePoint[];
	byPurpose: AgentUsagePoint[];
	topics: AgentTopic[];
	topUsers: AgentTopUser[];
	feedback: AgentFeedbackSummary;
}

export interface AgentAnalyticsQuery {
	from?: string;
	to?: string;
	employeeId?: number;
	topLimit?: number;
}

/** Nhãn tiếng Việt cho từng playbook. Thiếu thì hiện nguyên id. */
export const PLAYBOOK_LABELS: Record<string, string> = {
	'leave-balance': 'Quỹ phép cá nhân',
	'attendance-my-summary': 'Chuyên cần cá nhân',
	'attendance-explain': 'Giải thích chấm công',
	'hr-directory': 'Danh bạ nội bộ',
	'company-info': 'Thông tin công ty',
	'hr-org-overview': 'Tổng quan nhân sự',
	'leave-team-overview': 'Nghỉ phép phòng ban',
	'attendance-team-summary': 'Chuyên cần phòng ban',
	'leave-request': 'Xin nghỉ phép',
	'overtime-request': 'Xin tăng ca',
	'makeup-request': 'Xin bù công',
	'online-work-request': 'Đăng ký làm online',
	'violation-explain': 'Giải trình chuyên cần',
	'business-trip-request': 'Đăng ký đi công tác',
	'approval-queue': 'Duyệt đơn',
	capabilities: 'Hỏi trợ lý làm được gì',
	unsupported: 'Ngoài phạm vi chat',
	fallback: 'Không xác định được',
};

/** Nhãn cho tier của router. */
export const TIER_LABELS: Record<string, string> = {
	RULE: 'Luật',
	EMBEDDING: 'Embedding',
	LLM: 'LLM',
	FALLBACK: 'Không rõ',
};

/** Màu chip theo mức đánh giá — tệ thì đỏ, hay thì xanh. Nhãn chữ vẫn lấy từ API. */
export const RATING_COLORS: Record<string, string> = {
	BAD: 'bg-red-500',
	AVERAGE: 'bg-amber-500',
	USEFUL: 'bg-sky-500',
	GREAT: 'bg-emerald-500',
};

export const TIER_COLORS: Record<string, string> = {
	RULE: 'bg-emerald-500',
	EMBEDDING: 'bg-sky-500',
	LLM: 'bg-violet-500',
	FALLBACK: 'bg-amber-500',
};
