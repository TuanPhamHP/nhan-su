/**
 * Phiếu đề xuất (lô 4a, trước đây gọi là "văn bản nội bộ" hay "đơn từ chung").
 *
 * Khớp `docs/backend/bridges/general-requests.md` mục 4 và `openapi.json` của nhánh BE
 * `feat/approval`. Hai điều đáng nhớ khi đọc file này:
 *
 * - Mọi nhãn tiếng Việt (`statusLabel`, `modeLabel`, `actionLabel`, `sourceLabel`) đều do máy
 *   chủ trả. Màn hình hiện thẳng nhãn đó, không tự dịch lại, để lúc nghiệp vụ đổi chữ thì chỉ
 *   sửa một chỗ. Các bảng nhãn ở cuối file chỉ dùng cho ô lọc và màn cấu hình luồng, nơi không
 *   có dữ liệu từ máy chủ để lấy nhãn.
 * - Nút trên màn lấy theo mười lăm cờ `can*` của phiếu, không tự tính lại từ quyền. Quyền
 *   `general-request:approve` thôi dùng từ lô 4a.
 */

export type GeneralRequestStatus = 'DRAFT' | 'PENDING' | 'RETURNED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

/** Một người đồng ý là đủ, hoặc mọi người phải đồng ý. */
export type ApprovalMode = 'ANY' | 'ALL';

export type ApprovalStepStatus =
	| 'WAITING'
	| 'PENDING'
	| 'APPROVED'
	| 'REJECTED'
	| 'RETURNED'
	| 'SKIPPED'
	| 'CANCELLED';

export type ApprovalAssignmentStatus =
	| 'PENDING'
	| 'APPROVED'
	| 'REJECTED'
	| 'RETURNED'
	| 'TRANSFERRED'
	| 'SUPERSEDED';

export type ApprovalActionType =
	| 'SUBMIT'
	| 'RESUBMIT'
	| 'APPROVE'
	| 'REJECT'
	| 'RETURN'
	| 'TRANSFER'
	| 'REASSIGN'
	| 'DELEGATE'
	| 'AUTO_APPROVE'
	| 'SKIP'
	| 'OVERRIDE'
	| 'CANCEL';

/** Người theo dõi do loại phiếu gắn sẵn, do người gửi thêm, hoặc được mời cho ý kiến. */
export type WatcherSource = 'DEFAULT' | 'ADDED' | 'CONSULT';

export type ApproverKind =
	| 'DIRECT_MANAGER'
	| 'MANAGER_LEVEL'
	| 'DEPARTMENT_HEAD'
	| 'EMPLOYEES'
	| 'ROLE'
	| 'SUBMITTER_PICK';

export type FlowRole = 'ADMIN' | 'HR' | 'DIRECTOR' | 'MANAGER' | 'CHIEF' | 'EMPLOYEE';

export type FlowConditionOp = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'in';

export interface Person {
	id: number;
	fullName: string;
}

// ─── Loại phiếu (mẫu) ─────────────────────────────────────────────────────────

export type FieldType = 'text' | 'textarea' | 'date' | 'number' | 'select' | 'checkbox';

export type FieldDataSource = 'custom' | 'departments' | 'employees' | 'positions';

export interface FieldDefinition {
	key: string;
	label: string;
	type: FieldType;
	required: boolean;
	placeholder?: string;
	defaultValue?: string;
	options?: string[];
	/** Chỉ với `type === 'select'`; `custom` hoặc vắng là tự nhập danh sách. */
	dataSource?: FieldDataSource;
}

export interface DocumentTemplateSummary {
	id: number;
	name: string;
	category: string;
}

export interface DocumentTemplateDetail {
	id: number;
	name: string;
	description: string | null;
	category: string;
	fields: FieldDefinition[];
	printTemplate: string;
	templateFileUrl: string | null;
	isActive: boolean;
	version: number;
	/** Tiền tố số hiệu, 1–10 chữ in hoa hoặc số: `TT` cho `TT-0012/2026`. */
	codePrefix: string;
	defaultWatcherIds: number[];
	createdById: number;
	createdAt: string;
}

export interface CreateTemplateDto {
	name: string;
	category: string;
	description?: string;
	fields: FieldDefinition[];
	printTemplate: string;
	codePrefix?: string;
	defaultWatcherIds?: number[];
	isActive?: boolean;
}

export type UpdateTemplateDto = Partial<CreateTemplateDto>;

// ─── Luồng duyệt của loại phiếu ───────────────────────────────────────────────

export interface SubmitterPick {
	/** Vai trò được chọn; mảng rỗng là mọi người đang làm việc. */
	roles: FlowRole[];
	min: number;
	max: number;
	/** Mỗi người được chọn là một bước, duyệt lần lượt theo thứ tự chọn. */
	sequential?: boolean;
}

export interface FlowApprover {
	kind: ApproverKind;
	/** `MANAGER_LEVEL`: 1 là quản lý trực tiếp, 2 là cấp trên nữa. */
	level?: number;
	/** `EMPLOYEES`: người cố định. */
	employeeIds?: number[];
	/** `ROLE`: mọi người đang làm việc có vai trò này. */
	role?: FlowRole;
	/** `SUBMITTER_PICK`: người gửi chọn trong nhóm cho phép. */
	pick?: SubmitterPick;
}

export interface FlowCondition {
	/** Key trường của mẫu, hoặc `submitter.departmentId`, `submitter.role`. */
	field: string;
	op: FlowConditionOp;
	value: string | number | boolean | Array<string | number>;
}

export interface FlowConditionGroup {
	all?: FlowCondition[];
	any?: FlowCondition[];
}

export interface FlowStep {
	/** Máy chủ đánh lại từ 1 theo thứ tự mảng, nên không cần gửi khi lưu. */
	order?: number;
	name: string;
	approver: FlowApprover;
	mode: ApprovalMode;
	/** Hạn xử lý tính bằng giờ làm việc, 1–400; vắng là không có hạn. */
	slaHours?: number;
	condition?: FlowConditionGroup | null;
}

export interface FlowResponse {
	templateId: number;
	version: number;
	steps: FlowStep[];
}

export interface PutFlowDto {
	steps: FlowStep[];
	/**
	 * Phiên bản luồng mà màn hình đang mở (`version` của lần `GET` gần nhất).
	 *
	 * Khác phiên bản hiện tại thì máy chủ trả 409 `APPROVAL_FLOW_CHANGED` và không ghi gì, nhờ vậy
	 * hai người sửa cùng lúc thì người sau không ghi đè việc của người trước mà không ai biết.
	 */
	expectedVersion?: number;
}

// ─── Xem trước chuỗi người duyệt ──────────────────────────────────────────────

export interface PreviewPerson {
	id: number;
	fullName: string;
	role: FlowRole;
	roleLabel: string;
}

export interface PreviewCandidate extends PreviewPerson {
	departmentName: string | null;
}

export interface FlowPreviewStep {
	/** Thứ tự sau khi tách bước "người gửi chọn, lần lượt". */
	order: number;
	/** `order` của bước trong luồng; dùng làm `stepOrder` khi gửi người đã chọn. */
	flowStepOrder: number;
	name: string;
	mode: ApprovalMode;
	modeLabel: string;
	slaHours: number | null;
	/** Bước bị bỏ qua vì điều kiện không khớp; `basis` ghi lý do. */
	skipped: boolean;
	basis: string | null;
	approvers: PreviewPerson[];
	/** Bước "người gửi chọn" mà chưa chọn đủ người. */
	needsPick: boolean;
	pick: SubmitterPick | null;
	/** Người chọn được, đã trừ chính người gọi. */
	candidates: PreviewCandidate[];
}

export interface FlowPreviewResponse {
	templateId: number;
	flowVersion: number;
	steps: FlowPreviewStep[];
}

export interface FlowPreviewDto {
	fieldValues?: Record<string, unknown>;
	pickedApprovers?: PickedApprovers[];
}

export interface PickedApprovers {
	/** `flowStepOrder` của bước "người gửi chọn". */
	stepOrder: number;
	employeeIds: number[];
}

// ─── Phiếu ────────────────────────────────────────────────────────────────────

export interface StepAssignment {
	id: number;
	employee: Person;
	/** Đang duyệt thay người này theo uỷ quyền. */
	onBehalfOf: Person | null;
	status: ApprovalAssignmentStatus;
	statusLabel: string;
	/** Khác `employee` khi quản trị viên duyệt thay. */
	decidedBy: Person | null;
	decidedAt: string | null;
	note: string | null;
}

export interface RequestStep {
	order: number;
	name: string;
	mode: ApprovalMode;
	modeLabel: string;
	status: ApprovalStepStatus;
	statusLabel: string;
	/** Vì sao bước có những người này, hoặc vì sao bị bỏ qua. */
	basis: string | null;
	slaHours: number | null;
	activatedAt: string | null;
	dueAt: string | null;
	overdue: boolean;
	completedAt: string | null;
	/** Gồm cả lượt đã chuyển đi và lượt bị thay, để hiện lịch sử của bước. */
	assignments: StepAssignment[];
}

export interface CurrentStep {
	order: number;
	name: string;
	dueAt: string | null;
	overdue: boolean;
	approvers: Person[];
}

/** Dạng người duyệt trước lô 4a; máy chủ vẫn dựng từ `steps` cho màn cũ. */
export interface ApproverStep {
	order: number;
	employeeId: number;
	fullName: string;
	status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WAITING' | 'RETURNED';
	approvedAt: string | null;
	note: string | null;
}

export interface RequestEmployee {
	id: number;
	fullName: string;
	employeeCode: string;
}

export interface RequestTemplateSummary {
	id: number;
	name: string;
	category: string;
	codePrefix: string;
}

export interface TimelineEntry {
	id: number;
	round: number;
	action: ApprovalActionType;
	actionLabel: string;
	/** Null khi hệ thống tự làm: tự duyệt bước trùng người, bỏ bước, chuyển khi người duyệt nghỉ. */
	actor: Person | null;
	onBehalfOf: Person | null;
	stepOrder: number | null;
	note: string | null;
	/** "Lê Văn Dũng → Lý Quốc Khánh" khi chuyển lượt. */
	detail: string | null;
	createdAt: string;
}

export interface RequestWatcher {
	employeeId: number;
	fullName: string;
	source: WatcherSource;
	sourceLabel: string;
}

export interface RequestAttachment {
	id: number;
	fileName: string;
	mimeType: string;
	size: number;
	uploadedBy: Person;
	createdAt: string;
}

export interface RequestComment {
	id: number;
	author: Person;
	body: string;
	mentionIds: number[];
	createdAt: string;
}

export interface AttachmentUrlResponse {
	url: string;
	expiresIn: number;
}

/** Phần tử danh sách phiếu. Giữ tên cũ vì nhiều màn đang dùng. */
export interface GeneralRequestResponse {
	id: number;
	/** "TT-0012/2026"; null khi chưa gửi. */
	code: string | null;
	title: string;
	status: GeneralRequestStatus;
	statusLabel: string;
	/** Vòng duyệt hiện tại; tăng khi nộp lại phiếu bị trả. */
	round: number;
	template: RequestTemplateSummary;
	fieldValues: Record<string, unknown>;
	/** Chỉ có giá trị ở response của `/print`. */
	printTemplate: string | null;
	currentStep: CurrentStep | null;
	/** Các bước của vòng hiện tại. */
	steps: RequestStep[];
	/** Dạng cũ, giữ cho màn chưa cập nhật. */
	approvers: ApproverStep[];
	currentApproverIndex: number;
	currentApprover: ApproverStep | null;
	printCount: number;
	printedAt: string | null;
	submittedAt: string | null;
	returnedAt: string | null;
	completedAt: string | null;
	cancelledAt: string | null;
	employee: RequestEmployee;
	canEdit: boolean;
	canSubmit: boolean;
	canDelete: boolean;
	canPrint: boolean;
	canCancel: boolean;
	canApprove: boolean;
	canReject: boolean;
	canReturn: boolean;
	canTransfer: boolean;
	canOverride: boolean;
	canReassign: boolean;
	canComment: boolean;
	canAttach: boolean;
	canAddWatcher: boolean;
	canConsult: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface GeneralRequestDetail extends GeneralRequestResponse {
	/** Nhật ký của mọi vòng, chỉ thêm. Lọc theo `round` để tách vòng. */
	timeline: TimelineEntry[];
	watchers: RequestWatcher[];
	attachments: RequestAttachment[];
	commentCount: number;
}

export interface PendingRequest extends GeneralRequestResponse {
	/** Hạn xử lý bước của tôi. */
	dueAt: string | null;
	overdue: boolean;
	/** Tôi đang duyệt thay người này theo uỷ quyền. */
	onBehalfOf: Person | null;
}

export interface SuggestedApprover {
	employeeId: number;
	fullName: string;
	role: string;
	level: number;
	isSuggested: true;
}

// ─── Body các thao tác ────────────────────────────────────────────────────────

export interface CreateRequestDto {
	templateId: number;
	title: string;
	fieldValues: Record<string, unknown>;
}

export interface SaveDraftDto {
	fieldValues: Record<string, unknown>;
	title?: string;
}

export interface SubmitRequestDto {
	pickedApprovers?: PickedApprovers[];
	watcherIds?: number[];
}

export interface ApproveRequestDto {
	note?: string;
	stepOrder?: number;
}

export interface RejectRequestDto {
	note: string;
	stepOrder?: number;
}

export interface ReturnRequestDto {
	note: string;
	stepOrder?: number;
}

export interface TransferRequestDto {
	toEmployeeId: number;
	note?: string;
}

export type OverrideDecision = 'APPROVE' | 'REJECT' | 'RETURN';

export interface OverrideRequestDto {
	decision: OverrideDecision;
	/** Lý do duyệt thay, bắt buộc, ít nhất 5 ký tự. */
	note: string;
	stepOrder?: number;
}

export interface ReassignRequestDto {
	fromEmployeeId: number;
	toEmployeeId: number;
	note: string;
}

export interface CreateCommentDto {
	body: string;
	mentionIds?: number[];
}

export interface AddWatchersDto {
	employeeIds: number[];
	/** true là mời cho ý kiến: người được mời bình luận được, không duyệt. */
	consult?: boolean;
}

export interface QueryRequestParams {
	page?: number;
	limit?: number;
	status?: GeneralRequestStatus;
	templateId?: number;
	/** Người gửi; chỉ `GET /`. */
	employeeId?: number;
	/** Người từng hoặc đang duyệt; chỉ `GET /`. */
	approverId?: number;
	/** Ngày gửi `YYYY-MM-DD`, tính cả hai đầu. */
	from?: string;
	to?: string;
	/** Số hiệu, khớp một phần. */
	code?: string;
	/** Tiêu đề hoặc số hiệu. */
	q?: string;
}

export interface QueryTemplateParams {
	category?: string;
	isActive?: boolean;
}

// ─── Nhãn tiếng Việt cho ô lọc và màn cấu hình luồng ──────────────────────────

/** Dùng cho ô lọc trạng thái. Trong danh sách phiếu thì hiện `statusLabel` của máy chủ. */
export const REQUEST_STATUS_LABELS: Record<GeneralRequestStatus, string> = {
	DRAFT: 'Nháp',
	PENDING: 'Chờ duyệt',
	RETURNED: 'Cần bổ sung',
	APPROVED: 'Đã duyệt',
	REJECTED: 'Bị từ chối',
	CANCELLED: 'Đã thu hồi',
};

export const REQUEST_STATUS_CLASS: Record<GeneralRequestStatus, string> = {
	DRAFT: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
	PENDING: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
	RETURNED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
	APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
	REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
	CANCELLED: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};

export const STEP_STATUS_CLASS: Record<ApprovalStepStatus, string> = {
	WAITING: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300',
	PENDING: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
	APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
	REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
	RETURNED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
	SKIPPED: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
	CANCELLED: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};

/** Màn cấu hình luồng tự dựng danh sách này, vì luồng chưa lưu thì không có nhãn từ máy chủ. */
export const APPROVER_KIND_LABELS: Record<ApproverKind, string> = {
	DIRECT_MANAGER: 'Quản lý trực tiếp',
	MANAGER_LEVEL: 'Quản lý cấp trên theo bậc',
	DEPARTMENT_HEAD: 'Trưởng phòng của người gửi',
	EMPLOYEES: 'Người cụ thể',
	ROLE: 'Theo vai trò',
	SUBMITTER_PICK: 'Người gửi chọn',
};

export const APPROVER_KIND_HINTS: Record<ApproverKind, string> = {
	DIRECT_MANAGER: 'Lượt duyệt về người quản lý trực tiếp của người gửi.',
	MANAGER_LEVEL: 'Đi ngược chuỗi quản lý đúng số bậc đã khai, một là quản lý trực tiếp.',
	DEPARTMENT_HEAD: 'Lượt duyệt về trưởng phòng của phòng người gửi đang thuộc.',
	EMPLOYEES: 'Lượt duyệt về đúng những người được chọn ở đây.',
	ROLE: 'Mọi người đang làm việc có vai trò này đều nhận được lượt duyệt.',
	SUBMITTER_PICK: 'Người gửi tự chọn người duyệt trong nhóm vai trò cho phép.',
};

export const FLOW_ROLE_LABELS: Record<FlowRole, string> = {
	ADMIN: 'Quản trị viên',
	HR: 'Nhân sự',
	DIRECTOR: 'Giám đốc',
	MANAGER: 'Trưởng phòng',
	CHIEF: 'Trưởng bộ phận',
	EMPLOYEE: 'Nhân viên',
};

export const APPROVAL_MODE_LABELS: Record<ApprovalMode, string> = {
	ANY: 'Một người đồng ý là đủ',
	ALL: 'Tất cả phải đồng ý',
};

export const CONDITION_OP_LABELS: Record<FlowConditionOp, string> = {
	'=': 'bằng',
	'!=': 'khác',
	'>': 'lớn hơn',
	'>=': 'lớn hơn hoặc bằng',
	'<': 'nhỏ hơn',
	'<=': 'nhỏ hơn hoặc bằng',
	in: 'nằm trong danh sách',
};

/**
 * Nhóm loại phiếu. `category` là chuỗi tự do của máy chủ nên bảng này chỉ là nhãn tiếng Việt
 * cho những nhóm đang dùng; nhóm lạ thì màn hiện nguyên mã, và thêm nhóm mới thì thêm một dòng.
 */
export const REQUEST_CATEGORY_LABELS: Record<string, string> = {
	PROPOSAL: 'Tờ trình',
	PURCHASE: 'Mua sắm',
	REWARD: 'Khen thưởng',
	BUSINESS_TRIP: 'Công tác',
	OTHER: 'Khác',
};

export const REQUEST_CATEGORY_CLASS: Record<string, string> = {
	PROPOSAL: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
	PURCHASE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
	REWARD: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
	BUSINESS_TRIP: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
	OTHER: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

/** Thứ tự nhóm khi liệt kê loại phiếu; nhóm "Khác" luôn xuống cuối. */
export const REQUEST_CATEGORY_ORDER: string[] = ['PROPOSAL', 'PURCHASE', 'REWARD', 'BUSINESS_TRIP', 'OTHER'];
