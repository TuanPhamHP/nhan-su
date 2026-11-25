/**
 * KPI, lô 3 của module Công việc và KPI (`docs/backend/bridges/kpi.md`, kiểu khớp `docs/openapi.json` của BE,
 * tiền tố `/v1/kpi`). KPI chỉ xem và xuất: không có trường nào về lương, thưởng.
 */

export type KpiDirection = 'HIGHER' | 'LOWER' | 'PASS_FAIL' | 'BANDS';
export type KpiSource = 'MANUAL' | 'AUTO';
export type KpiAutoKey =
	| 'TASK_ON_TIME_ORIGINAL'
	| 'TASK_ON_TIME_CURRENT'
	| 'TASK_POINTS_ACCEPTED'
	| 'TASK_QUALITY_AVG'
	| 'TASK_RETURN_RATE'
	| 'TASK_DONE_COUNT'
	| 'TASK_OVERDUE_OPEN'
	| 'ATTENDANCE';
export type KpiPeriodType = 'MONTH' | 'QUARTER' | 'YEAR';
export type KpiPeriodStatus = 'OPEN' | 'REVIEWING' | 'CLOSED';
export type KpiReviewStatus = 'OPEN' | 'MANAGER_REVIEW' | 'FEEDBACK' | 'PENDING_FINAL' | 'PUBLISHED';
export type KpiTemplateScope = 'POSITION' | 'DEPARTMENT' | 'GENERAL';
export type KpiMissingReason = 'KPI_TEMPLATE_MISSING' | 'KPI_REVIEWER_MISSING';
export type KpiEventType =
	| 'CREATED'
	| 'REVIEW_STARTED'
	| 'LINE_UPDATED'
	| 'SUBMITTED'
	| 'FEEDBACK'
	| 'FEEDBACK_EXPIRED'
	| 'FINALIZED'
	| 'PUBLISHED'
	| 'REOPENED'
	| 'REVIEWER_CHANGED'
	| 'EMPLOYEE_TERMINATED';

export interface KpiPerson {
	id: number;
	fullName: string;
	employeeCode: string;
	/** Đã ký sẵn. */
	avatarUrl: string | null;
}

export interface KpiName {
	id: number;
	fullName: string;
}

export interface KpiRef {
	id: number;
	name: string;
}

export interface KpiBand {
	/** `null` là mốc cuối (trên mọi mốc trước). */
	upTo: number | null;
	percent: number;
}

export interface KpiGrade {
	label: string;
	minScore: number;
}

// ─── Cài đặt ──────────────────────────────────────────────────────────────

export interface KpiIndicator {
	id: number;
	name: string;
	unit: string;
	direction: KpiDirection;
	directionLabel: string;
	source: KpiSource;
	sourceLabel: string;
	autoKey: KpiAutoKey | null;
	autoKeyLabel: string | null;
	capPercent: number | null;
	floorPercent: number | null;
	bands: KpiBand[] | null;
	manualScale: boolean;
	isActive: boolean;
}

export interface CreateKpiIndicatorBody {
	name: string;
	unit: string;
	direction: KpiDirection;
	manualScale?: boolean;
	capPercent?: number | null;
	floorPercent?: number | null;
	bands?: KpiBand[];
}

export type UpdateKpiIndicatorBody = Partial<CreateKpiIndicatorBody> & { isActive?: boolean };

export interface KpiTemplateItem {
	indicator: KpiIndicator;
	target: number;
	weight: number;
}

export interface KpiTemplate {
	id: number;
	name: string;
	department: KpiRef | null;
	position: KpiRef | null;
	scope: KpiTemplateScope;
	version: number;
	previousId: number | null;
	regulationNo: string | null;
	regulationDate: string | null;
	isActive: boolean;
	totalWeight: number;
	reviewCount: number;
	items: KpiTemplateItem[];
}

export interface KpiTemplateItemInput {
	indicatorId: number;
	target: number;
	weight: number;
}

export interface CreateKpiTemplateBody {
	name: string;
	departmentId?: number | null;
	positionId?: number | null;
	regulationNo?: string;
	regulationDate?: string;
	items: KpiTemplateItemInput[];
}

export type UpdateKpiTemplateBody = Partial<CreateKpiTemplateBody> & { isActive?: boolean };

export interface KpiGradeScale {
	id: number;
	effectiveFrom: string;
	/** Cao xuống thấp. */
	grades: KpiGrade[];
	createdAt: string;
}

export interface CreateKpiGradeScaleBody {
	effectiveFrom: string;
	grades: KpiGrade[];
}

// ─── Kỳ ───────────────────────────────────────────────────────────────────

export type KpiStatusCounts = Record<KpiReviewStatus, number>;

export interface KpiPeriodRef {
	id: number;
	name: string;
	type: KpiPeriodType;
	startDate: string;
	endDate: string;
	status: KpiPeriodStatus;
}

export interface KpiPeriod extends KpiPeriodRef {
	typeLabel: string;
	statusLabel: string;
	gradeScale: KpiGradeScale;
	feedbackDays: number;
	counts: KpiStatusCounts;
	total: number;
	createdAt: string;
}

export interface KpiMissing {
	employee: KpiPerson;
	department: KpiRef | null;
	reason: KpiMissingReason;
	reasonLabel: string;
}

export interface KpiTerminatedWarning {
	reviewId: number;
	status: KpiReviewStatus;
	statusLabel: string;
	employee: KpiPerson;
	terminationDate: string | null;
}

export interface KpiPeriodDetail extends KpiPeriod {
	missing: KpiMissing[];
	terminatedWarnings: KpiTerminatedWarning[];
}

export interface OpenKpiPeriodBody {
	type: 'MONTH' | 'QUARTER';
	startDate: string;
	gradeScaleId?: number;
	feedbackDays?: number;
}

export interface KpiRecomputeResult {
	computed: number;
	failed: number;
}

export interface KpiPublishAllResult {
	published: number;
	skippedOwn: number;
}

// ─── Phiếu ────────────────────────────────────────────────────────────────

export interface KpiReviewListItem {
	id: number;
	period: KpiPeriodRef;
	employee: KpiPerson;
	/** Phòng lúc mở kỳ. */
	department: KpiRef | null;
	reviewer: KpiPerson;
	template: KpiRef;
	templateVersion: number;
	status: KpiReviewStatus;
	statusLabel: string;
	/** Tạm tính khi chưa gửi đánh giá. */
	totalScore: number | null;
	grade: string | null;
	computedAt: string | null;
	reviewedAt: string | null;
	feedbackDueAt: string | null;
	finalizedAt: string | null;
	publishedAt: string | null;
	employeeInactive: boolean;
}

export interface KpiReviewLine {
	id: number;
	indicatorId: number;
	name: string;
	unit: string;
	direction: KpiDirection;
	directionLabel: string;
	source: KpiSource;
	autoKey: KpiAutoKey | null;
	manualScale: boolean;
	capPercent: number | null;
	floorPercent: number | null;
	bands: KpiBand[] | null;
	target: number;
	effectiveTarget: number;
	weight: number;
	effectiveWeight: number;
	autoValue: number | null;
	value: number | null;
	adjusted: boolean;
	adjustReason: string | null;
	adjustedBy: KpiName | null;
	applicable: boolean;
	completionPct: number | null;
	score: number | null;
	reviewerNote: string | null;
	hasEvidence: boolean;
}

export interface KpiReviewEvent {
	id: number;
	type: KpiEventType;
	/** `null` là hệ thống. */
	actor: KpiName | null;
	payload?: Record<string, unknown> | null;
	createdAt: string;
}

export interface KpiReviewPermissions {
	canScore: boolean;
	canSubmit: boolean;
	canFeedback: boolean;
	canFinalize: boolean;
	canPublish: boolean;
	canReopen: boolean;
	canChangeReviewer: boolean;
}

export interface KpiReviewDetail extends KpiReviewListItem {
	workDaysRatio: number | null;
	scoreComplete: boolean;
	grades: KpiGrade[];
	reviewerComment: string | null;
	employeeFeedback: string | null;
	feedbackAgreed: boolean | null;
	feedbackAt: string | null;
	finalizedBy: KpiName | null;
	reopenCount: number;
	lines: KpiReviewLine[];
	events: KpiReviewEvent[];
	permissions: KpiReviewPermissions;
}

export interface KpiReviewQuery {
	mine?: boolean;
	toReview?: boolean;
	periodId?: number;
	status?: KpiReviewStatus;
	departmentId?: number;
	q?: string;
	page?: number;
	limit?: number;
}

export interface UpdateKpiLineBody {
	value?: number | null;
	reason?: string;
	note?: string | null;
	resetToAuto?: boolean;
}

export interface KpiEvidenceTask {
	id: number;
	code: string;
	/** `null` khi người xem không xem được việc này. */
	title: string | null;
	canView: boolean;
	matched: boolean;
	status: string;
	points: number;
	qualityScore: number | null;
	returnCount: number;
	originalDueDate: string;
	dueDate: string;
	firstSubmittedAt: string | null;
	acceptedAt: string | null;
}

export interface KpiEvidence {
	kind: 'tasks' | 'attendance' | 'none';
	total?: number;
	matched?: number;
	items?: KpiEvidenceTask[];
	lateCount?: number;
	lateDays?: string[];
	absentDays?: string[];
	workingDays?: number;
}

// ─── Kết quả ──────────────────────────────────────────────────────────────

export interface KpiDistribution {
	department: KpiRef | null;
	total: number;
	/** Số phiếu đã có xếp loại. */
	graded: number;
	/** Số người theo từng xếp loại, khoá là nhãn (`A`, `B`…). */
	byGrade: Record<string, number>;
}

export interface KpiResults {
	period: KpiPeriod;
	rows: KpiReviewListItem[];
	distribution: KpiDistribution[];
	overall: KpiDistribution;
}

export interface KpiYearRow {
	employee: KpiPerson;
	department: KpiRef | null;
	/** Số kỳ đã công bố được tính trung bình. */
	periods: number;
	averageScore: number | null;
	grade: string | null;
}

export interface KpiYearResults {
	year: number;
	gradeScale: KpiGradeScale | null;
	rows: KpiYearRow[];
}
