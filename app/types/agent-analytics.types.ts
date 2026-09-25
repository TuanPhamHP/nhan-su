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
	requests: number;
	totalTokens: number;
	costUsd: number;
}

export interface AgentAnalyticsSummary {
	from: string;
	to: string;
	conversations: number;
	messages: number;
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

export interface AgentAnalyticsOverview {
	summary: AgentAnalyticsSummary;
	daily: AgentUsagePoint[];
	byModel: AgentUsagePoint[];
	byPurpose: AgentUsagePoint[];
	topics: AgentTopic[];
	topUsers: AgentTopUser[];
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
	fallback: 'Không xác định được',
};

/** Nhãn cho tier của router. */
export const TIER_LABELS: Record<string, string> = {
	RULE: 'Luật',
	EMBEDDING: 'Embedding',
	LLM: 'LLM',
	FALLBACK: 'Không rõ',
};

export const TIER_COLORS: Record<string, string> = {
	RULE: 'bg-emerald-500',
	EMBEDDING: 'bg-sky-500',
	LLM: 'bg-violet-500',
	FALLBACK: 'bg-amber-500',
};
