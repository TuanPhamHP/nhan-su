/**
 * Module Tuyển dụng (`RECRUIT`) — khớp với `docs/backend/bridges/recruitment.md`.
 *
 * Ba nhóm route, ba nhóm kiểu trong file này:
 * - `/v1/recruitment/**` trang quản lý (ADMIN, HR, DIRECTOR, MANAGER, CHIEF)
 * - `/v1/me/recruitment/**` hội đồng và người phỏng vấn (mọi vai trò, kể cả EMPLOYEE)
 * - `/v1/public/**` ứng viên, không đăng nhập
 *
 * Hai quy tắc đọc response của module này, sai là hiển thị sai nghiệp vụ:
 *
 * 1. **Trường tiền `null` nghĩa là "bạn không được xem", không phải 0.** Đi kèm cờ
 *    `canViewSalary`. Hiện "—", đừng hiện "0 ₫".
 * 2. **Trường blacklist `null` nghĩa là "bạn không được xem", không phải `false`.** Đi kèm
 *    cờ `canSeeBlacklist`. Đừng hiện nhãn kiểu "Không có trong danh sách đen".
 */

import type { UserRole } from '~/types/auth.types';

// ─── Enum ─────────────────────────────────────────────────────────────────────

export type RecruitmentEmploymentType =
	| 'FULL_TIME'
	| 'PROBATION'
	| 'APPRENTICE'
	| 'INTERN'
	| 'PART_TIME'
	| 'CONTRACTOR';

/** Loại hình của yêu cầu tuyển: như trên nhưng không có `PROBATION`. */
export type RequisitionEmploymentType = Exclude<RecruitmentEmploymentType, 'PROBATION'>;

export type RecruitmentProposalStatus = 'DRAFT' | 'PENDING' | 'REJECTED';
export type HeadcountRowStatus = 'CONFIRMED' | 'DRAFT' | 'PENDING' | 'REJECTED' | 'NONE';
export type RecruitmentHeadcountChangeType =
	| 'PROPOSED'
	| 'SUBMITTED'
	| 'CONFIRMED'
	| 'REJECTED'
	| 'EDITED'
	| 'WITHDRAWN';

export type RecruitmentRequisitionReason = 'REPLACEMENT' | 'ADDITIONAL' | 'NEW_POSITION';
export type RecruitmentRequisitionStatus =
	| 'DRAFT'
	| 'PENDING'
	| 'APPROVED'
	| 'REJECTED'
	| 'RECRUITING'
	| 'FILLED'
	| 'CANCELLED';

export type RecruitmentApprovalTarget = 'REQUISITION' | 'OFFER';
export type RecruitmentApprovalStepStatus = 'WAITING' | 'PENDING' | 'APPROVED' | 'REJECTED';
export type RecruitmentApprovalBasis =
	| 'DEPARTMENT_MANAGER'
	| 'DIRECTOR_FALLBACK'
	| 'HR'
	| 'OVER_BAND'
	| 'DIRECTOR';

export type RecruitmentStageKind = 'APPLIED' | 'SCREENING' | 'TEST' | 'INTERVIEW' | 'OFFER' | 'HIRED';
export type RecruitmentJobVisibility = 'PUBLIC' | 'INTERNAL';
export type RecruitmentJobStatus = 'DRAFT' | 'OPEN' | 'PAUSED' | 'CLOSED';

export type RecruitmentApplicationStatus = 'ACTIVE' | 'REJECTED' | 'WITHDRAWN' | 'HIRED';

export type RecruitmentOfferStatus =
	| 'DRAFT'
	| 'PENDING_APPROVAL'
	| 'APPROVED'
	| 'APPROVAL_REJECTED'
	| 'SENT'
	| 'ACCEPTED'
	| 'DECLINED'
	| 'EXPIRED'
	| 'NO_SHOW'
	| 'CANCELLED'
	| 'SUPERSEDED';

export type RecruitmentProbationGroup =
	| 'NONE'
	| 'ENTERPRISE_MANAGER'
	| 'COLLEGE_OR_ABOVE'
	| 'INTERMEDIATE'
	| 'OTHER';

export type RecruitmentTemplateKind = 'EMAIL' | 'OFFER_LETTER';
export type RecruitmentTemplatePurpose =
	| 'APPLICATION_RECEIVED'
	| 'INTERVIEW_INVITE'
	| 'INTERVIEW_RESCHEDULED'
	| 'INTERVIEW_CANCELLED'
	| 'REJECTION'
	| 'OFFER'
	| 'WELCOME'
	| 'STAGE_AUTO'
	| 'CUSTOM'
	| 'OFFER_LETTER'
	| 'SMTP_TEST';

export type RecruitmentReasonKind = 'REJECTION' | 'OFFER_DECLINE';
export type RecruitmentScorecardKind = 'INTERVIEW' | 'TEST';
export type RecruitmentScorecardStatus = 'PENDING' | 'SUBMITTED';
export type RecruitmentVerdict = 'PASS' | 'FAIL' | 'CONSIDER';

export type RecruitmentInterviewMode = 'ONSITE' | 'ONLINE' | 'PHONE';
export type RecruitmentInterviewStatus = 'SCHEDULED' | 'DONE' | 'NO_SHOW' | 'CANCELLED';

export type RecruitmentSmtpSecurity = 'TLS' | 'STARTTLS' | 'NONE';
export type RecruitmentSmtpTestStatus = 'UNTESTED' | 'SUCCESS' | 'FAILED';

export type OfferLinkState = 'ACTIVE' | 'RESPONDED' | 'EXPIRED' | 'SUPERSEDED' | 'CANCELLED' | 'UNAVAILABLE';

export type RecruitmentConsentKind = 'PROCESSING' | 'TALENT_POOL';
export type RecruitmentConsentBasis = 'CANDIDATE_APPLIED' | 'WRITTEN_CONSENT' | 'OTHER';
export type RecruitmentGender = 'Nam' | 'Nữ' | 'Khác';

export type RecruitmentCommentKind = 'COMMENT' | 'SUGGEST_MOVE' | 'SUGGEST_REJECT' | 'SUGGEST_OFFER';
export type RecruitmentEmailStatus = 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED' | 'SKIPPED';
export type RecruitmentEmailChannel = 'COMPANY_SMTP' | 'SYSTEM';
export type RecruitmentRejectEmailMode = 'NOW' | 'SCHEDULED' | 'NONE';

// ─── Tham chiếu dùng lại ──────────────────────────────────────────────────────

export interface RecruitmentRef {
	id: number;
	name: string;
}

export interface RecruitmentPerson {
	id: number;
	fullName: string;
}

export interface RecruitmentEmployeeRef extends RecruitmentPerson {
	employeeCode: string;
}

/** Một bước duyệt của yêu cầu tuyển dụng. `approver: null` là bước giao theo vai trò. */
export interface RecruitApprovalStep {
	id: number;
	round: number;
	level: number;
	basis: RecruitmentApprovalBasis;
	basisLabel: string;
	approver: RecruitmentPerson | null;
	approverRole: UserRole | null;
	approverRoleLabel: string | null;
	status: RecruitmentApprovalStepStatus;
	statusLabel: string;
	decidedBy: RecruitmentPerson | null;
	decidedAt: string | null;
	note: string | null;
}

// ─── Cài đặt chung ────────────────────────────────────────────────────────────

export interface RecruitmentSettings {
	replyToEmail: string | null;
	retentionDaysNoConsent: number;
	retentionMonthsConsent: number;
	consentTermsVersion: number;
	consentTermsText: string;
	careersIntro: string | null;
	updatedById: number | null;
	updatedAt: string;
}

export interface UpdateRecruitmentSettingsBody {
	replyToEmail?: string | null;
	retentionDaysNoConsent?: number;
	retentionMonthsConsent?: number;
	consentTermsText?: string;
	careersIntro?: string | null;
}

// ─── Mẫu email, mẫu thư mời ───────────────────────────────────────────────────

export interface RecruitmentTemplate {
	id: number;
	kind: RecruitmentTemplateKind;
	kindLabel: string;
	purpose: RecruitmentTemplatePurpose;
	purposeLabel: string;
	name: string;
	/** Mẫu thư mời (`OFFER_LETTER`) không có tiêu đề. */
	subject: string | null;
	/** HTML với mẫu email, chữ thường với thư mời; biến dạng `{ten_bien}`. */
	body: string;
	isDefault: boolean;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface CreateRecruitmentTemplateBody {
	kind: RecruitmentTemplateKind;
	purpose: RecruitmentTemplatePurpose;
	name: string;
	subject?: string;
	body: string;
	isDefault?: boolean;
	isActive?: boolean;
}

export type UpdateRecruitmentTemplateBody = Partial<
	Omit<CreateRecruitmentTemplateBody, 'kind' | 'purpose'>
>;

/** Khoá là `RecruitmentTemplatePurpose`, giá trị là tên biến không có ngoặc. */
export type RecruitmentTemplateVariables = Partial<Record<RecruitmentTemplatePurpose, string[]>>;

// ─── Nguồn, lý do, tag ────────────────────────────────────────────────────────

export interface RecruitmentSource {
	id: number;
	name: string;
	/** `'CAREERS_PAGE'`: mục hệ thống, không đổi tên hay tắt được. */
	systemCode: string | null;
	isActive: boolean;
	order: number;
}

export interface RecruitmentReason {
	id: number;
	kind: RecruitmentReasonKind;
	kindLabel: string;
	name: string;
	/** `'OFFER_DECLINED'`, `'DUPLICATE'`, `'SPAM'`: mục hệ thống. */
	systemCode: string | null;
	isActive: boolean;
	order: number;
}

export interface RecruitmentTag {
	id: number;
	name: string;
	isActive: boolean;
}

export interface SaveRecruitmentSourceBody {
	name?: string;
	order?: number;
	isActive?: boolean;
}

export interface SaveRecruitmentReasonBody {
	kind?: RecruitmentReasonKind;
	name?: string;
	order?: number;
	isActive?: boolean;
}

export interface SaveRecruitmentTagBody {
	name?: string;
	isActive?: boolean;
}

// ─── Quy trình mẫu ────────────────────────────────────────────────────────────

export interface PipelineTemplateStage {
	id: number;
	name: string;
	kind: RecruitmentStageKind;
	kindLabel: string;
	order: number;
	scorecardTemplateId: number | null;
	autoEmailTemplateId: number | null;
}

export interface PipelineTemplate {
	id: number;
	name: string;
	isDefault: boolean;
	isActive: boolean;
	stages: PipelineTemplateStage[];
	createdAt: string;
	updatedAt: string;
}

/** `id` chỉ có tác dụng ở `PUT /jobs/:id/stages`; quy trình mẫu bỏ qua. */
export interface StageInput {
	id?: number;
	name: string;
	kind: RecruitmentStageKind;
	scorecardTemplateId?: number;
	autoEmailTemplateId?: number;
}

export interface SavePipelineTemplateBody {
	name: string;
	isDefault?: boolean;
	isActive?: boolean;
	stages: StageInput[];
}

// ─── Mẫu đánh giá ─────────────────────────────────────────────────────────────

export interface ScorecardCriterion {
	id: number;
	name: string;
	description: string | null;
	/** Trọng số 1–10 với mẫu phỏng vấn; mẫu thi luôn 1. */
	weight: number;
	/** Chỉ mẫu thi. */
	maxScore: number | null;
	passScore: number | null;
	order: number;
}

export interface ScorecardTemplate {
	id: number;
	name: string;
	kind: RecruitmentScorecardKind;
	kindLabel: string;
	isActive: boolean;
	criteria: ScorecardCriterion[];
	createdAt: string;
	updatedAt: string;
}

export interface CriterionInput {
	id?: number;
	name: string;
	description?: string;
	weight?: number;
	maxScore?: number;
	passScore?: number;
}

export interface SaveScorecardTemplateBody {
	name: string;
	kind: RecruitmentScorecardKind;
	isActive?: boolean;
	criteria: CriterionInput[];
}

// ─── SMTP công ty (chỉ vai trò ADMIN) ─────────────────────────────────────────

export interface RecruitmentSmtp {
	configured: boolean;
	/** `false`: máy chủ thiếu khoá mã hoá, lưu và gửi thử sẽ 503 — khoá form. */
	secretKeyConfigured: boolean;
	host: string | null;
	port: number | null;
	security: RecruitmentSmtpSecurity | null;
	securityLabel: string | null;
	username: string | null;
	/** Response không bao giờ có mật khẩu, chỉ có cờ này. */
	hasPassword: boolean;
	fromName: string | null;
	fromEmail: string | null;
	replyTo: string | null;
	testStatus: RecruitmentSmtpTestStatus | null;
	testStatusLabel: string | null;
	testedAt: string | null;
	testError: string | null;
	updatedById: number | null;
	updatedAt: string | null;
}

export interface SaveSmtpBody {
	host: string;
	port: number;
	security: RecruitmentSmtpSecurity;
	username: string;
	/** Bỏ trống khi sửa thì giữ mật khẩu cũ. */
	password?: string;
	fromName: string;
	fromEmail: string;
	replyTo?: string;
}

// ─── Định biên ────────────────────────────────────────────────────────────────

export interface HeadcountRow {
	id: number;
	year: number;
	department: RecruitmentRef;
	position: RecruitmentRef;
	/** `null` = chưa từng chốt; còn trống tính là 0. */
	confirmedQuantity: number | null;
	confirmedAt: string | null;
	confirmedById: number | null;
	current: number;
	recruiting: number;
	/**
	 * Số yêu cầu tuyển CHƯA KẾT THÚC của (năm, vị trí): tính cả nháp, bị từ chối, chờ duyệt, đã
	 * duyệt và đang tuyển, nhưng không tính Đã huỷ, Đã đủ và đã xoá. Hai trạng thái kết thúc đó
	 * không bị ảnh hưởng khi xoá định biên, và người đã tuyển qua yêu cầu Đã đủ thì nằm trong
	 * `current` rồi.
	 *
	 * Khác `recruiting`: `recruiting` chỉ đếm phần còn thiếu của yêu cầu đã gửi, nên một dòng có
	 * `recruiting = 0` vẫn có thể đang vướng yêu cầu nháp. Đây là con số quyết định dòng đã chốt
	 * có "đang dùng" hay không, tức có bắt nhập lý do khi xoá hay không.
	 */
	requisitionCount: number;
	/** = chốt − đang có − đang tuyển; có thể âm. */
	available: number;
	overCommitted: boolean;
	proposedQuantity: number | null;
	proposalStatus: RecruitmentProposalStatus | null;
	proposalStatusLabel: string | null;
	proposalNote: string | null;
	proposedById: number | null;
	proposedAt: string | null;
	rejectReason: string | null;
	note: string | null;
	status: HeadcountRowStatus;
	statusLabel: string;
	createdAt: string;
	updatedAt: string;
}

export interface HeadcountChange {
	id: number;
	planId: number;
	type: RecruitmentHeadcountChangeType;
	typeLabel: string;
	fromQuantity: number | null;
	toQuantity: number | null;
	note: string | null;
	/** `null` = hệ thống. */
	actor: RecruitmentPerson | null;
	createdAt: string;
}

export interface CreateHeadcountPlanBody {
	year: number;
	positionId: number;
	quantity: number;
	note?: string;
}

export interface SaveHeadcountQuantityBody {
	quantity: number;
	note?: string;
}

// ─── Yêu cầu tuyển dụng ───────────────────────────────────────────────────────

export interface RequisitionJobBrief {
	id: number;
	code: string;
	title: string;
	status: RecruitmentJobStatus;
	statusLabel: string;
}

export interface Requisition {
	id: number;
	code: string;
	/** Năm định biên áp dụng: năm của `neededBy`, trống thì năm tạo. */
	year: number;
	department: RecruitmentRef;
	position: RecruitmentRef;
	quantity: number;
	reason: RecruitmentRequisitionReason;
	reasonLabel: string;
	replacedEmployee: RecruitmentEmployeeRef | null;
	employmentType: RequisitionEmploymentType;
	employmentTypeLabel: string;
	/** `null` khi `canViewSalary = false` HOẶC khi chưa nhập khung. */
	salaryMin: number | null;
	salaryMax: number | null;
	neededBy: string | null;
	jobDescription: string | null;
	requirements: string | null
	hasJdFile: boolean;
	jdFileName: string | null;
	note: string | null;
	status: RecruitmentRequisitionStatus;
	statusLabel: string;
	/** Lần gửi duyệt hiện tại; 0 = chưa gửi. */
	round: number;
	submittedAt: string | null;
	approvedAt: string | null;
	rejectReason: string | null;
	cancelledAt: string | null;
	cancelReason: string | null;
	createdBy: RecruitmentPerson;
	createdAt: string;
	updatedAt: string;
	jobs: RequisitionJobBrief[];
	approvalSteps: RecruitApprovalStep[];
	hiredCount: number;
	/** Còn trống hiện tại, không tính chính yêu cầu này; danh sách trả `null`. */
	available: number | null;
	canViewSalary: boolean;
	canApprove: boolean;
}

export interface Availability {
	/** `null` = chưa chốt định biên, chưa gửi được yêu cầu. */
	confirmed: number | null;
	current: number;
	recruiting: number;
	available: number;
}

export interface CreateRequisitionBody {
	positionId: number;
	quantity: number;
	reason: RecruitmentRequisitionReason;
	replacedEmployeeId?: number;
	employmentType: RequisitionEmploymentType;
	salaryMin?: number;
	salaryMax?: number;
	neededBy?: string;
	jobDescription?: string;
	requirements?: string;
	note?: string;
}

export type UpdateRequisitionBody = Partial<CreateRequisitionBody>;

export interface RequisitionQueryParams {
	status?: RecruitmentRequisitionStatus;
	departmentId?: number;
	positionId?: number;
	year?: number;
	search?: string;
	page?: number;
	limit?: number;
}

// ─── Hộp việc chờ duyệt ───────────────────────────────────────────────────────

export interface RecruitInboxItem {
	type: RecruitmentApprovalTarget;
	typeLabel: string;
	stepId: number;
	level: number;
	basis: RecruitmentApprovalBasis;
	basisLabel: string;
	waitingSince: string;
	requisition: {
		id: number;
		code: string;
		department: RecruitmentRef;
		position: RecruitmentRef;
		quantity: number;
		reason: RecruitmentRequisitionReason;
		reasonLabel: string;
		status: RecruitmentRequisitionStatus;
		statusLabel: string;
		createdBy: RecruitmentPerson;
		submittedAt: string | null;
		/**
		 * Còn trống lúc này, chưa trừ chính yêu cầu này, nên có thể âm. Nhỏ hơn `quantity` thì
		 * bấm Duyệt sẽ nhận 409 `RECRUIT_HEADCOUNT_EXCEEDED` và bước vẫn đứng nguyên chờ, vì vậy
		 * hộp duyệt cảnh báo trước thay vì để người duyệt bấm vào một nút chắc chắn lỗi.
		 */
		headcountAvailable: number;
	} | null;
	offer: {
		id: number;
		code: string;
		version: number;
		candidateName: string;
		positionName: string;
		overBand: boolean;
		/** Hộp này chỉ trả cho người đang đến lượt duyệt nên luôn có số. */
		baseSalary: number;
		status: RecruitmentOfferStatus;
		statusLabel: string;
	} | null;
}

export interface RecruitInboxCounts {
	requisitions: number;
	offers: number;
	headcount: number;
}

export interface RecruitInbox {
	items: RecruitInboxItem[];
	headcountPending: { year: number; count: number }[];
	counts: RecruitInboxCounts;
}

// ─── Tin tuyển dụng ───────────────────────────────────────────────────────────

export interface RecruitmentJobStage {
	id: number;
	name: string;
	kind: RecruitmentStageKind;
	kindLabel: string;
	order: number;
	scorecardTemplate: RecruitmentRef | null;
	autoEmailTemplate: RecruitmentRef | null;
	activeCount: number;
}

export interface RecruitmentTeamMember {
	id: number;
	employee: RecruitmentPerson;
	role: UserRole;
	roleLabel: string;
	/** Xem lương mong muốn và offer của tin này. */
	canViewOffer: boolean;
	/** Nhận thông báo hồ sơ mới (N-03). */
	notifyNewApplications: boolean;
	addedById: number | null;
	createdAt: string;
}

export interface RecruitmentJob {
	id: number;
	code: string;
	title: string;
	locations: string[];
	/** Lương hiển thị cho ứng viên, khác hẳn khung lương nội bộ. */
	salaryText: string | null;
	description: string;
	requirements: string | null;
	benefits: string | null;
	deadline: string | null;
	visibility: RecruitmentJobVisibility;
	visibilityLabel: string;
	status: RecruitmentJobStatus;
	statusLabel: string;
	budget: number | null;
	actualCost: number | null;
	slug: string;
	/** `/careers/<mã công ty>/<slug>`, ghép với domain FE. */
	publicPath: string;
	openedAt: string | null;
	closedAt: string | null;
	closedReason: 'MANUAL' | 'DEADLINE' | null;
	requisition: {
		id: number;
		code: string;
		status: RecruitmentRequisitionStatus;
		statusLabel: string;
		quantity: number;
		employmentType: RequisitionEmploymentType;
		employmentTypeLabel: string;
		salaryMin: number | null;
		salaryMax: number | null;
		department: RecruitmentRef;
		position: RecruitmentRef;
	};
	owner: RecruitmentPerson;
	stages: RecruitmentJobStage[];
	activeApplicationCount: number;
	team: RecruitmentTeamMember[];
	canViewSalary: boolean;
	createdById: number;
	createdAt: string;
	updatedAt: string;
}

export interface CreateJobBody {
	requisitionId: number;
	pipelineTemplateId?: number;
	title?: string;
	locations?: string[];
	salaryText?: string;
	description?: string;
	requirements?: string;
	benefits?: string;
	deadline?: string;
	visibility?: RecruitmentJobVisibility;
	ownerId?: number;
	budget?: number;
	actualCost?: number;
	slug?: string;
}

export type UpdateJobBody = Partial<Omit<CreateJobBody, 'requisitionId' | 'pipelineTemplateId'>>;

export interface JobQueryParams {
	status?: RecruitmentJobStatus;
	requisitionId?: number;
	departmentId?: number;
	search?: string;
	page?: number;
	limit?: number;
}

export interface SaveJobTeamBody {
	members: { employeeId: number; canViewOffer?: boolean; notifyNewApplications?: boolean }[];
}

// ─── Ứng viên ─────────────────────────────────────────────────────────────────

/** Một lần ứng tuyển vào một tin, dạng gọn. */
export interface RecruitmentApplicationBrief {
	id: number;
	candidateId: number;
	jobId: number;
	job: { id: number; code: string; title: string; status: RecruitmentJobStatus; statusLabel: string };
	stage: { id: number; name: string; kind: RecruitmentStageKind; kindLabel: string; order: number };
	status: RecruitmentApplicationStatus;
	statusLabel: string;
	source: RecruitmentRef | null;
	rejectReason: RecruitmentRef | null;
	closedNote: string | null;
	cvFileId: number | null;
	appliedAt: string;
	stageEnteredAt: string;
	closedAt: string | null;
	hiredAt: string | null;
}

/** Không có URL: mở file qua `GET /v1/recruitment/candidate-files/:id/url`. */
export interface RecruitmentCandidateFile {
	id: number;
	candidateId: number;
	kind: 'CV' | 'OTHER';
	kindLabel: string;
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	createdAt: string;
}

export interface RecruitmentConsent {
	id: number;
	kind: RecruitmentConsentKind;
	kindLabel: string;
	method: 'FORM' | 'HR_RECORDED';
	methodLabel: string;
	basis: RecruitmentConsentBasis | null;
	basisLabel: string | null;
	basisNote: string | null;
	termsVersion: number | null;
	givenAt: string;
	expiresAt: string | null;
	withdrawnAt: string | null;
}

/** Phần thông tin của một ứng viên, dùng ở chi tiết ứng viên và chi tiết hồ sơ. */
export interface RecruitmentCandidateProfile {
	id: number;
	fullName: string;
	email: string | null;
	phone: string | null;
	dateOfBirth: string | null;
	gender: RecruitmentGender | null;
	address: string | null;
	educationLevel: string | null;
	school: string | null;
	yearsOfExperience: number | null;
	currentTitle: string | null;
	currentCompany: string | null;
	linkedinUrl: string | null;
	portfolioUrl: string | null;
	/** `null` khi `canViewSalary = false`. */
	expectedSalary: number | null;
	sourceId: number | null;
	/** Tạo từ "Tải nhiều CV", chờ HR điền. */
	isDraft: boolean;
	inTalentPool: boolean;
	/** `null` khi người gọi không thấy blacklist — KHÔNG phải `false`. */
	isBlacklisted: boolean | null;
	blacklistReason: string | null;
	blacklistedAt: string | null;
	/** Đã thu gọn dữ liệu (BR-16). */
	minimizedAt: string | null;
	/** Đã ẩn danh (BR-06): khoá mọi nút ghi. */
	anonymizedAt: string | null;
	employeeId: number | null;
	createdAt: string;
	updatedAt: string;
}

export interface RecruitmentCandidateListItem {
	id: number;
	fullName: string;
	email: string | null;
	phone: string | null;
	currentTitle: string | null;
	currentCompany: string | null;
	yearsOfExperience: number | null;
	source: RecruitmentRef | null;
	tags: RecruitmentRef[];
	isDraft: boolean;
	inTalentPool: boolean;
	isBlacklisted: boolean | null;
	minimizedAt: string | null;
	createdAt: string;
	/** Chỉ hồ sơ trong phạm vi người gọi. */
	applications: RecruitmentApplicationBrief[];
}

export interface RecruitmentCandidateDetail extends RecruitmentCandidateProfile {
	source: RecruitmentRef | null;
	tags: RecruitmentRef[];
	files: RecruitmentCandidateFile[];
	consents: RecruitmentConsent[];
	applications: RecruitmentApplicationBrief[];
	/** Chỉ người có `recruitment:manage` nhận danh sách này; người khác luôn mảng rỗng. */
	duplicates: { id: number; fullName: string; isBlacklisted: boolean | null }[];
	duplicateBlacklisted: boolean | null;
	canViewSalary: boolean;
	canSeeBlacklist: boolean;
}

export interface RecruitmentDuplicateMatch {
	id: number;
	fullName: string;
	email: string | null;
	phone: string | null;
	matchedBy: ('EMAIL' | 'PHONE')[];
	isBlacklisted: boolean | null;
}

export interface CandidateQueryParams {
	search?: string;
	jobId?: number;
	stageKind?: RecruitmentStageKind;
	appliedFrom?: string;
	appliedTo?: string;
	sourceId?: number;
	tagId?: number;
	talentPool?: boolean;
	/** Chỉ người thấy blacklist gửi được; người khác nhận 403. */
	isBlacklisted?: boolean;
	page?: number;
	limit?: number;
}

/** Form thêm ứng viên — gửi bằng `multipart/form-data`. */
export interface CreateCandidateBody {
	fullName: string;
	email?: string;
	phone?: string;
	consentBasis: RecruitmentConsentBasis;
	consentNote?: string;
	talentPoolConsent?: boolean;
	jobId?: number;
	sourceId?: number;
	tagIds?: number[];
	dateOfBirth?: string;
	gender?: RecruitmentGender;
	address?: string;
	educationLevel?: string;
	school?: string;
	yearsOfExperience?: number;
	currentTitle?: string;
	currentCompany?: string;
	linkedinUrl?: string;
	portfolioUrl?: string;
	expectedSalary?: number;
	cv?: File;
}

/** `PATCH` nhận JSON và không có các trường chỉ dùng lúc tạo. */
export type UpdateCandidateBody = Partial<
	Omit<CreateCandidateBody, 'consentBasis' | 'consentNote' | 'talentPoolConsent' | 'jobId' | 'tagIds' | 'cv'>
>;

export interface RecruitmentTimelineEvent {
	id: number;
	applicationId: number | null;
	type: string;
	typeLabel: string;
	/** `null` = ứng viên hoặc hệ thống. */
	actor: RecruitmentPerson | null;
	payload: Record<string, unknown> | null;
	/** `true` chỉ có ở sự kiện blacklist. */
	hrOnly: boolean;
	createdAt: string;
}

export interface RecruitmentComment {
	id: number;
	candidateId: number;
	applicationId: number | null;
	author: RecruitmentPerson;
	kind: RecruitmentCommentKind;
	kindLabel: string;
	body: string;
	mentionIds: number[];
	suggestion: { toStageId?: number; reasonId?: number } | null;
	createdAt: string;
	updatedAt: string;
}

export interface CreateCommentBody {
	body: string;
	applicationId?: number;
	kind?: RecruitmentCommentKind;
	suggestion?: { toStageId?: number; reasonId?: number };
	mentionIds?: number[];
}

export interface RecruitmentEmailLog {
	id: number;
	candidateId: number | null;
	applicationId: number | null;
	offerId: number | null;
	interviewId: number | null;
	templateId: number | null;
	purpose: RecruitmentTemplatePurpose;
	purposeLabel: string;
	/** Chốt lúc gửi (BR-17); `null` khi chưa gửi. */
	channel: RecruitmentEmailChannel | null;
	channelLabel: string | null;
	status: RecruitmentEmailStatus;
	statusLabel: string;
	toEmail: string | null;
	subject: string | null;
	body: string | null;
	attachments: string[];
	/** Có giá trị = email hẹn giờ. */
	scheduledAt: string | null;
	sentAt: string | null;
	attempts: number;
	error: string | null;
	/** `null` = hệ thống gửi. */
	sentBy: RecruitmentPerson | null;
	createdAt: string;
}

export interface SendCandidateEmailBody {
	templateId?: number;
	subject?: string;
	body?: string;
	applicationId?: number;
	/** ISO; trống là gửi ngay. */
	sendAt?: string;
}

export interface RecruitmentImportResult {
	created: number;
	/** `row` là số dòng trong file Excel. */
	errors: { row: number; message: string }[];
}

export interface RecruitmentBulkCvResult {
	fileName: string;
	ok: boolean;
	candidateId: number | null;
	message: string | null;
}

export interface RecordConsentBody {
	kind: RecruitmentConsentKind;
	basis: RecruitmentConsentBasis;
	note?: string;
}

export interface AddToJobBody {
	jobId: number;
	sourceId?: number;
	cvFileId?: number;
}

// ─── Hồ sơ ứng tuyển ──────────────────────────────────────────────────────────

/** Thẻ kanban. */
export interface RecruitmentApplicationCard extends RecruitmentApplicationBrief {
	candidate: {
		id: number;
		fullName: string;
		email: string | null;
		phone: string | null;
		isBlacklisted: boolean | null;
		isAnonymized: boolean;
		expectedSalary: number | null;
	};
	/** Trung bình phiếu phỏng vấn đã nộp, mọi vòng (BR-07); `null` khi chưa có hoặc bị ẩn. */
	score: number | null;
	verdicts: Record<RecruitmentVerdict, number>;
	canViewSalary: boolean;
}

/** Trả về sau mỗi thao tác chuyển vòng, loại, rút, mở lại, thêm vào tin. */
export interface RecruitmentApplicationDetail extends RecruitmentApplicationBrief {
	cvFile: RecruitmentCandidateFile | null;
	candidate: RecruitmentCandidateProfile;
	canViewSalary: boolean;
	canSeeBlacklist: boolean;
}

/** Chi tiết hồ sơ khi mở trang hồ sơ. */
export interface RecruitmentApplicationView extends RecruitmentApplicationDetail {
	files: RecruitmentCandidateFile[];
}

export interface RecruitmentBulkResult {
	id: number;
	ok: boolean;
	code: string | null;
	message: string | null;
}

export interface RejectApplicationEmail {
	mode: RecruitmentRejectEmailMode;
	sendAt?: string;
	templateId?: number;
}

export interface RejectApplicationBody {
	reasonId: number;
	note?: string;
	/** Bỏ cả khối này thì BE coi như `{ mode: 'SCHEDULED' }`. */
	email?: RejectApplicationEmail;
}

export interface ApplicationQueryParams {
	status?: RecruitmentApplicationStatus;
	stageId?: number;
}

// ─── Phỏng vấn và đánh giá ────────────────────────────────────────────────────

export interface RecruitmentInterview {
	id: number;
	application: {
		id: number;
		jobId: number;
		status: RecruitmentApplicationStatus;
		statusLabel: string;
	};
	candidate: RecruitmentPerson;
	job: { id: number; title: string };
	stage: { id: number; name: string; kind: string; kindLabel: string };
	startAt: string;
	endAt: string;
	mode: RecruitmentInterviewMode;
	modeLabel: string;
	location: string | null;
	meetingUrl: string | null;
	note: string | null;
	status: RecruitmentInterviewStatus;
	statusLabel: string;
	interviewers: RecruitmentPerson[];
	createdById: number;
	createdAt: string;
	updatedAt: string;
}

export interface InterviewQueryParams {
	from: string;
	to: string;
	jobId?: number;
	interviewerId?: number;
}

export interface SaveInterviewBody {
	startAt?: string;
	endAt?: string;
	mode?: RecruitmentInterviewMode;
	location?: string;
	meetingUrl?: string;
	interviewerIds?: number[];
	note?: string;
	scorecardTemplateId?: number;
	notifyCandidate?: boolean;
}

export interface CreateInterviewBody extends SaveInterviewBody {
	startAt: string;
	endAt: string;
	mode: RecruitmentInterviewMode;
	interviewerIds: number[];
}

export interface RecruitmentScorecard {
	id: number;
	applicationId: number;
	stage: { id: number; name: string; kind: string; kindLabel: string };
	/** `null` = phiếu HR yêu cầu ngoài buổi phỏng vấn. */
	interview: { id: number; startAt: string; endAt: string } | null;
	template: { id: number; name: string; kind: RecruitmentScorecardKind; kindLabel: string };
	evaluator: RecruitmentPerson;
	kind: RecruitmentScorecardKind;
	kindLabel: string;
	status: RecruitmentScorecardStatus;
	statusLabel: string;
	verdict: RecruitmentVerdict | null;
	verdictLabel: string | null;
	comment: string | null;
	totalScore: number | null;
	criteria: {
		id: number;
		name: string;
		description: string | null;
		weight: number;
		maxScore: number | null;
		passScore: number | null;
		order: number;
		isActive: boolean;
		score: number | null;
	}[];
	requestedById: number | null;
	submittedAt: string | null;
	/** `submittedAt` + 24 giờ (BR-08). */
	editableUntil: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface RecruitmentStageScorecards {
	stageId: number;
	stageName: string;
	/** Chỉ phiếu người gọi được thấy (BR-08). */
	scorecards: RecruitmentScorecard[];
	hiddenCount: number;
	/** `null` khi chưa được xem phiếu người khác. */
	score: number | null;
	verdicts: Record<RecruitmentVerdict, number> | null;
}

export interface SaveScorecardBody {
	scores?: { criterionId: number; score: number }[];
	verdict?: RecruitmentVerdict | null;
	comment?: string;
}

export interface RequestScorecardBody {
	applicationId: number;
	stageId: number;
	evaluatorId: number;
}

export interface TestResultEntry {
	applicationId: number;
	scores: { criterionId: number; score: number }[];
	verdict?: 'PASS' | 'FAIL';
}

export interface SaveTestResultsBody {
	templateId: number;
	stageId: number;
	entries: TestResultEntry[];
}

export interface RecruitmentTestResult {
	applicationId: number;
	ok: boolean;
	scorecardId: number | null;
	code: string | null;
	message: string | null;
}

// ─── Offer ────────────────────────────────────────────────────────────────────

export interface RecruitmentOfferApprovalStep {
	id: number;
	round: number;
	level: number;
	approver: RecruitmentPerson | null;
	approverRole: 'DIRECTOR' | 'HR' | null;
	approverRoleLabel: string | null;
	/** Tên người, hoặc tên vai trò. */
	approverLabel: string;
	basis: 'DEPARTMENT_MANAGER' | 'DIRECTOR_FALLBACK' | 'OVER_BAND';
	basisLabel: string;
	status: RecruitmentApprovalStepStatus;
	statusLabel: string;
	decidedBy: RecruitmentPerson | null;
	decidedAt: string | null;
	note: string | null;
}

export interface RecruitmentOffer {
	id: number;
	/** Giữ nguyên qua các phiên bản. */
	code: string;
	version: number;
	status: RecruitmentOfferStatus;
	statusLabel: string;
	application: { id: number; status: string; statusLabel: string; appliedAt: string };
	candidate: { id: number; fullName: string; email: string | null; phone: string | null };
	job: { id: number; code: string; title: string };
	requisition: { id: number; code: string };
	department: RecruitmentRef;
	position: RecruitmentRef;
	level: string | null;
	employmentType: RequisitionEmploymentType;
	employmentTypeLabel: string;
	baseSalary: number | null;
	probationGroup: RecruitmentProbationGroup;
	probationGroupLabel: string;
	probationDays: number | null;
	probationSalary: number | null;
	startDate: string;
	/** BE tính theo BR-03. */
	probationEndDate: string | null;
	allowances: string | null;
	responseDeadline: string;
	/** Vượt khung lương (BR-10), chốt lúc gửi duyệt. */
	overBand: boolean;
	round: number;
	approvedAt: string | null;
	sentAt: string | null;
	hasSentPdf: boolean;
	responseState: OfferLinkState;
	respondedAt: string | null;
	respondedVia: 'LINK' | 'HR' | null;
	respondedViaLabel: string | null;
	declineReason: RecruitmentRef | null;
	responseNote: string | null;
	noShowAt: string | null;
	cancelledAt: string | null;
	/** Lý do huỷ, hoặc lý do không nhận việc. */
	cancelReason: string | null;
	employee: { id: number; fullName: string; employeeCode: string } | null;
	createdBy: RecruitmentPerson;
	createdAt: string;
	updatedAt: string;
	approvalSteps: RecruitmentOfferApprovalStep[];
	/** Không bao giờ có số tiền. */
	versions: {
		id: number;
		version: number;
		status: RecruitmentOfferStatus;
		statusLabel: string;
		sentAt: string | null;
	}[];
	canViewSalary: boolean;
	canApprove: boolean;
}

export interface CreateOfferBody {
	baseSalary: number;
	startDate: string;
	probationGroup?: RecruitmentProbationGroup;
	probationDays?: number;
	probationSalary?: number;
	responseDeadline?: string;
	employmentType?: RequisitionEmploymentType;
	level?: string;
	allowances?: string;
}

export type UpdateOfferBody = Partial<CreateOfferBody>;

export interface OfferQueryParams {
	status?: RecruitmentOfferStatus;
	jobId?: number;
	page?: number;
	limit?: number;
}

export interface SendOfferBody {
	responseDeadline?: string;
	templateId?: number;
}

export interface RecordOfferResponseBody {
	decision: 'ACCEPT' | 'DECLINE';
	reasonId?: number;
	note?: string;
}

/**
 * Một phần tử của `error.errors[]` khi tạo hoặc sửa offer.
 *
 * Đây là chỗ DUY NHẤT của module trả nhiều lỗi validate cùng lúc, và `min`, `max` sống
 * được vì chúng nằm trong từng phần tử — bộ lọc lỗi của API chỉ giữ `code`, `message`,
 * `errors` ở mức ngoài.
 */
export interface OfferTermError {
	code: string;
	message: string;
	min?: number;
	max?: number;
}

// ─── Tổng quan và báo cáo ─────────────────────────────────────────────────────

export interface RecruitmentDashboard {
	openJobs: {
		id: number;
		code: string;
		title: string;
		deadline: string | null;
		quantity: number;
		byStageKind: { kind: string; kindLabel: string; count: number }[];
	}[];
	interviewsToday: number;
	/** Tuần tính từ thứ Hai. */
	interviewsThisWeek: number;
	overdueScorecards: number;
	offersPendingApproval: number;
	offersAwaitingResponse: number;
	headcount: {
		confirmed: number;
		current: number;
		recruiting: number;
		available: number;
		/** SỐ DÒNG định biên đang âm, không phải số người. */
		overCommitted: number;
	};
}

export interface RecruitmentFunnel {
	total: number;
	stages: { key: string; label: string; reached: number; conversionRate: number | null }[];
	rejectionReasons: { reasonId: number; name: string; count: number }[];
}

export interface RecruitmentSourceRow {
	/** `null` = hồ sơ chưa rõ nguồn. */
	sourceId: number | null;
	sourceName: string;
	applications: number;
	passedScreening: number;
	hired: number;
	hireRate: number | null;
}

export interface RecruitmentTimeToHire {
	acceptedOffers: number;
	declinedOffers: number;
	expiredOffers: number;
	offerAcceptanceRate: number | null;
	timeToFill: { average: number | null; median: number | null };
	timeToHire: { average: number | null; median: number | null };
}

export interface RecruitmentCostRow {
	jobId: number;
	code: string;
	title: string;
	departmentName: string;
	status: RecruitmentJobStatus;
	statusLabel: string;
	budget: number | null;
	actualCost: number | null;
	hires: number;
	/** `actualCost ÷ hires`; `null` khi chưa tuyển ai hoặc chưa nhập chi phí. */
	costPerHire: number | null;
}

export interface ReportRangeQuery {
	from?: string;
	to?: string;
}

export interface FunnelQuery extends ReportRangeQuery {
	jobId?: number;
}

export interface SourceReportQuery extends ReportRangeQuery {
	departmentId?: number;
	sourceId?: number;
}

export interface TimeToHireQuery extends ReportRangeQuery {
	departmentId?: number;
	positionId?: number;
}

// ─── Hội đồng tuyển dụng (`/v1/me/recruitment`) ───────────────────────────────

/** Tin mình ngồi hội đồng, trừ tin Nháp. */
export interface MyRecruitmentJob {
	id: number;
	code: string;
	title: string;
	status: RecruitmentJobStatus;
	statusLabel: string;
	department: RecruitmentRef;
	position: RecruitmentRef;
	canViewOffer: boolean;
	activeApplicationCount: number;
	stages: RecruitmentJobStage[];
}

// ─── Nhãn cho ô chọn ──────────────────────────────────────────────────────────
//
// Mọi enum trong response ĐÃ có `*Label` tiếng Việt đi kèm; các bảng dưới đây chỉ dùng để
// dựng ô lọc và ô chọn, nơi chưa có bản ghi nào để lấy nhãn.
//
// ⚠ Chữ ở đây phải trùng ĐÚNG TỪNG CHỮ với `RECRUITMENT_*_LABELS` của backend
// (`src/common/constants/vi-labels.ts`). Lệch một chữ là ô lọc và bảng gọi cùng một trạng
// thái bằng hai tên khác nhau, người dùng tưởng đó là hai thứ.

export const REQUISITION_STATUS_LABELS: Record<RecruitmentRequisitionStatus, string> = {
	DRAFT: 'Nháp',
	PENDING: 'Chờ duyệt',
	APPROVED: 'Đã duyệt',
	REJECTED: 'Từ chối',
	RECRUITING: 'Đang tuyển',
	FILLED: 'Đã đủ',
	CANCELLED: 'Huỷ',
};

export const REQUISITION_REASON_LABELS: Record<RecruitmentRequisitionReason, string> = {
	REPLACEMENT: 'Thay thế',
	ADDITIONAL: 'Bổ sung',
	NEW_POSITION: 'Mở mới',
};

export const REQUISITION_EMPLOYMENT_TYPE_LABELS: Record<RequisitionEmploymentType, string> = {
	FULL_TIME: 'Nhân viên chính thức',
	APPRENTICE: 'Học việc',
	INTERN: 'Thực tập sinh',
	PART_TIME: 'Bán thời gian',
	CONTRACTOR: 'Cộng tác viên',
};

export const JOB_STATUS_LABELS: Record<RecruitmentJobStatus, string> = {
	DRAFT: 'Nháp',
	OPEN: 'Đang mở',
	PAUSED: 'Tạm dừng',
	CLOSED: 'Đã đóng',
};

export const JOB_VISIBILITY_LABELS: Record<RecruitmentJobVisibility, string> = {
	PUBLIC: 'Công khai',
	INTERNAL: 'Nội bộ',
};

export const STAGE_KIND_LABELS: Record<RecruitmentStageKind, string> = {
	APPLIED: 'Ứng tuyển',
	SCREENING: 'Sơ loại',
	TEST: 'Thi tuyển',
	INTERVIEW: 'Phỏng vấn',
	OFFER: 'Offer',
	HIRED: 'Đã tuyển',
};

export const APPLICATION_STATUS_LABELS: Record<RecruitmentApplicationStatus, string> = {
	ACTIVE: 'Đang xét',
	REJECTED: 'Đã loại',
	WITHDRAWN: 'Rút hồ sơ',
	HIRED: 'Đã tuyển',
};

export const OFFER_STATUS_LABELS: Record<RecruitmentOfferStatus, string> = {
	DRAFT: 'Nháp',
	PENDING_APPROVAL: 'Chờ duyệt',
	APPROVED: 'Đã duyệt',
	APPROVAL_REJECTED: 'Từ chối duyệt',
	SENT: 'Đã gửi',
	ACCEPTED: 'Đồng ý',
	DECLINED: 'Ứng viên từ chối',
	EXPIRED: 'Hết hạn',
	NO_SHOW: 'Không nhận việc',
	CANCELLED: 'Huỷ',
	SUPERSEDED: 'Đã có phiên bản mới',
};

/** Trần số ngày thử việc theo nhóm (BR-03) — hiện ngay trên ô nhập, trước khi BE báo lỗi. */
export const PROBATION_GROUP_LABELS: Record<RecruitmentProbationGroup, string> = {
	NONE: 'Không thử việc',
	ENTERPRISE_MANAGER: 'Người quản lý doanh nghiệp (tối đa 180 ngày)',
	COLLEGE_OR_ABOVE: 'Cần trình độ cao đẳng trở lên (tối đa 60 ngày)',
	INTERMEDIATE: 'Trung cấp, công nhân kỹ thuật, nhân viên nghiệp vụ (tối đa 30 ngày)',
	OTHER: 'Công việc khác (tối đa 6 ngày làm việc)',
};

export const PROBATION_GROUP_MAX_DAYS: Record<RecruitmentProbationGroup, number | null> = {
	NONE: null,
	ENTERPRISE_MANAGER: 180,
	COLLEGE_OR_ABOVE: 60,
	INTERMEDIATE: 30,
	OTHER: 6,
};

export const INTERVIEW_MODE_LABELS: Record<RecruitmentInterviewMode, string> = {
	ONSITE: 'Trực tiếp',
	ONLINE: 'Online',
	PHONE: 'Điện thoại',
};

export const INTERVIEW_STATUS_LABELS: Record<RecruitmentInterviewStatus, string> = {
	SCHEDULED: 'Đã lên lịch',
	DONE: 'Đã diễn ra',
	NO_SHOW: 'Ứng viên vắng',
	CANCELLED: 'Huỷ',
};

export const VERDICT_LABELS: Record<RecruitmentVerdict, string> = {
	PASS: 'Đạt',
	FAIL: 'Không đạt',
	CONSIDER: 'Cân nhắc',
};

export const CONSENT_BASIS_LABELS: Record<RecruitmentConsentBasis, string> = {
	CANDIDATE_APPLIED: 'Ứng viên gửi CV ứng tuyển',
	WRITTEN_CONSENT: 'Ứng viên đồng ý bằng văn bản hoặc email',
	OTHER: 'Khác',
};

export const CONSENT_KIND_LABELS: Record<RecruitmentConsentKind, string> = {
	PROCESSING: 'Xử lý dữ liệu cho tuyển dụng',
	TALENT_POOL: 'Lưu vào kho tiềm năng',
};

export const TEMPLATE_KIND_LABELS: Record<RecruitmentTemplateKind, string> = {
	EMAIL: 'Mẫu email',
	OFFER_LETTER: 'Mẫu thư mời nhận việc',
};

export const TEMPLATE_PURPOSE_LABELS: Record<RecruitmentTemplatePurpose, string> = {
	APPLICATION_RECEIVED: 'Xác nhận ứng tuyển',
	INTERVIEW_INVITE: 'Mời phỏng vấn',
	INTERVIEW_RESCHEDULED: 'Đổi lịch phỏng vấn',
	INTERVIEW_CANCELLED: 'Huỷ lịch phỏng vấn',
	REJECTION: 'Thông báo không trúng tuyển',
	OFFER: 'Gửi offer',
	WELCOME: 'Chào mừng nhận việc',
	STAGE_AUTO: 'Tự gửi khi vào vòng',
	CUSTOM: 'Soạn tay',
	OFFER_LETTER: 'Thư mời nhận việc',
	SMTP_TEST: 'Gửi thử SMTP',
};

export const REASON_KIND_LABELS: Record<RecruitmentReasonKind, string> = {
	REJECTION: 'Lý do loại',
	OFFER_DECLINE: 'Lý do từ chối offer',
};

export const SCORECARD_KIND_LABELS: Record<RecruitmentScorecardKind, string> = {
	INTERVIEW: 'Phỏng vấn',
	TEST: 'Thi tuyển',
};

export const SMTP_SECURITY_LABELS: Record<RecruitmentSmtpSecurity, string> = {
	TLS: 'TLS (SSL)',
	STARTTLS: 'STARTTLS',
	NONE: 'Không mã hoá',
};

export const GENDER_OPTIONS: RecruitmentGender[] = ['Nam', 'Nữ', 'Khác'];

/**
 * Mã mục đích không tạo mẫu được: nội dung email gửi thử SMTP cố định trong BE, gửi lên
 * `SMTP_TEST` thì nhận 400.
 */
export const TEMPLATE_PURPOSES_CREATABLE: RecruitmentTemplatePurpose[] = [
	'APPLICATION_RECEIVED',
	'INTERVIEW_INVITE',
	'INTERVIEW_RESCHEDULED',
	'INTERVIEW_CANCELLED',
	'REJECTION',
	'OFFER',
	'WELCOME',
	'STAGE_AUTO',
	'CUSTOM',
	'OFFER_LETTER',
];
