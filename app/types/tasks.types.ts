/**
 * Module Công việc và KPI, lô 1 và lô 2 (`docs/backend/bridges/tasks.md`, lô 2 từ mục 12). Kiểu khớp
 * `docs/openapi.json` của BE develop (d3cc8fe).
 *
 * Giao diện KHÔNG tự tính ai được làm gì: mọi nút, cột mờ, ô sửa được đều đọc từ `allowedActions`,
 * `columnRules`, `permissions` máy chủ trả kèm mỗi việc (bridge mục 1.2).
 */

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type TaskSource = 'SELF' | 'ASSIGNED' | 'RECURRING';
export type TaskPoints = 1 | 2 | 3 | 5 | 8;
export type TaskAction = 'start' | 'back_to_todo' | 'submit' | 'accept' | 'return' | 'self_close' | 'reopen' | 'cancel';
export type TaskProjectRole = 'MANAGER' | 'MEMBER' | 'VIEWER';
export type TaskProjectStatus = 'ACTIVE' | 'CLOSED';

/** `view` của danh sách và bảng việc (bridge mục 3.1). */
export type TaskView = 'my' | 'assigned' | 'watching' | 'review' | 'department' | 'project';
export type TaskDueFilter = 'overdue' | 'today' | 'this_week' | 'next_week' | 'range';
export type TaskSort =
	| 'dueDate'
	| '-dueDate'
	| 'priority'
	| '-priority'
	| 'createdAt'
	| '-createdAt'
	| 'updatedAt'
	| '-updatedAt'
	| 'code'
	| 'board';

export interface TaskPerson {
	id: number;
	fullName: string;
	/** Đã ký sẵn 1 giờ, null khi không có ảnh. */
	avatarUrl: string | null;
}

export interface TaskProjectRef {
	id: number;
	code: string;
	name: string;
	status: TaskProjectStatus;
}

export interface TaskParentRef {
	id: number;
	code: string;
	/** Null khi người xem không xem được việc cha. */
	title: string | null;
}

export interface TaskColumnRule {
	allowed: boolean;
	action: TaskAction | null;
	needsReason: boolean;
	/** Câu lý do khi không thả được, hiện thẳng cho người dùng. */
	reason: string | null;
}

export interface TaskPermissions {
	edit: boolean;
	reassign: boolean;
	changeDue: boolean;
	cancel: boolean;
	manageChecklist: boolean;
	manageWatchers: boolean;
	addSubtask: boolean;
	comment: boolean;
}

export interface TaskGroupRef {
	id: number;
	name: string;
}

export type TaskSprintStatus = 'PLANNED' | 'ACTIVE' | 'CLOSED';

export interface TaskSprintRef {
	id: number;
	name: string;
	status: TaskSprintStatus;
	statusLabel: string;
}

/** Đếm phụ thuộc trên dòng việc (bridge mục 12.1). `late`: có việc phải chờ đang trễ, hiện dấu đỏ. */
export interface TaskDependencySummary {
	blockers: number;
	blocking: number;
	late: boolean;
}

export interface TaskListItem {
	id: number;
	code: string;
	title: string;
	status: TaskStatus;
	statusLabel: string;
	priority: TaskPriority;
	priorityLabel: string;
	/** Null: chưa chấm điểm, tính là 0 khi cộng khối lượng. */
	points: number | null;
	source: TaskSource;
	sourceLabel: string;
	version: number;
	boardOrder: number;
	personalOrder: number | null;
	project: TaskProjectRef | null;
	parent: TaskParentRef | null;
	/** Lô 2: nhóm việc, đợt (null khi không có; dự án bật đợt mà `sprint` null là việc chờ xếp). */
	group: TaskGroupRef | null;
	sprint: TaskSprintRef | null;
	/** Khác null: việc sinh từ việc định kỳ. */
	recurrenceId: number | null;
	/** Số lần bị chuyển sang đợt sau khi đóng đợt. */
	sprintMoveCount: number;
	addedAfterSprintStart: boolean;
	dependencies: TaskDependencySummary;
	assigner: TaskPerson;
	assignee: TaskPerson;
	reviewer: TaskPerson;
	startDate: string | null;
	/** Null: việc không có hạn, không bao giờ quá hạn. */
	dueDate: string | null;
	originalDueDate: string | null;
	dueChangeCount: number;
	overdue: boolean;
	firstSubmittedAt: string | null;
	lastSubmittedAt: string | null;
	acceptedAt: string | null;
	qualityScore: number | null;
	returnCount: number;
	selfClosed: boolean;
	cancelledAt: string | null;
	cancelReason: string | null;
	subtasks: { total: number; done: number; points: number };
	checklist: { total: number; done: number };
	commentCount: number;
	attachmentCount: number;
	allowedActions: TaskAction[];
	/** Luật thả thẻ sang từng cột KHÁC cột hiện tại. */
	columnRules: Partial<Record<TaskStatus, TaskColumnRule>>;
	permissions: TaskPermissions;
	createdAt: string;
	updatedAt: string;
}

export interface TaskChecklistItem {
	id: number;
	content: string;
	isDone: boolean;
	doneAt: string | null;
	doneById: number | null;
	sortOrder: number;
}

export interface TaskAttachment {
	id: number;
	fileName: string;
	mimeType: string;
	size: number;
	commentId: number | null;
	uploadedBy: TaskPerson;
	createdAt: string;
}

export interface TaskDueChange {
	/** Null khi việc chưa có hạn trước lần đặt này. */
	oldDueDate: string | null;
	newDueDate: string;
	reason: string;
	changedBy: TaskPerson;
	createdAt: string;
}

export interface TaskDetail extends TaskListItem {
	description: string | null;
	watchers: TaskPerson[];
	checklistItems: TaskChecklistItem[];
	attachments: TaskAttachment[];
	dueChanges: TaskDueChange[];
	children: TaskListItem[];
	/** Việc này phải chờ (việc trước). */
	blockers: TaskDependency[];
	/** Việc đang chờ việc này (việc sau). */
	blocking: TaskDependency[];
	/** Câu cảnh báo không chặn sau thao tác (VD báo xong khi còn việc con mở). */
	warning: string | null;
}

/** Một đầu của phụ thuộc trong chi tiết việc. Không xem được thì `title` null, `visible` false. */
export interface TaskDependency {
	id: number;
	code: string;
	title: string | null;
	status: TaskStatus;
	statusLabel: string;
	startDate: string | null;
	dueDate: string | null;
	visible: boolean;
	late: boolean;
}

export interface TaskBoardColumn {
	status: TaskStatus;
	label: string;
	/** Tổng thật của cột; `tasks` tối đa 50 thẻ. */
	total: number;
	tasks: TaskListItem[];
}

export interface TaskBoard {
	columns: TaskBoardColumn[];
}

export interface TaskListQuery {
	view?: TaskView;
	projectId?: number;
	departmentId?: number;
	/** Danh sách id cách nhau dấu phẩy. */
	assigneeIds?: string;
	assignerIds?: string;
	/** Danh sách mã cách nhau dấu phẩy. */
	status?: string;
	priority?: string;
	due?: TaskDueFilter;
	dueFrom?: string;
	dueTo?: string;
	topLevel?: boolean;
	parentId?: number;
	q?: string;
	sort?: TaskSort;
	page?: number;
	limit?: number;
	includeCancelled?: boolean;
	groupId?: number;
	sprintId?: number;
	recurrenceId?: number;
	/** Việc chờ xếp của dự án bật đợt (dùng kèm `projectId`). */
	backlog?: boolean;
	/**
	 * Lọc điểm kiểu JQL: một hoặc nhiều điều kiện cách dấu phẩy, mỗi điều kiện là toán tử `=`, `!=`, `>`,
	 * `>=`, `<`, `<=` kèm số, ghép bằng VÀ. Việc chưa có điểm tính là 0. VD `>=3`, `>=2,<=5`, `=0`.
	 */
	points?: string;
}

export interface CreateTaskBody {
	title: string;
	assigneeId: number;
	dueDate?: string;
	/** Bỏ trống là chưa chấm điểm. */
	points?: number;
	reviewerId?: number;
	priority?: TaskPriority;
	startDate?: string;
	description?: string;
	projectId?: number;
	parentId?: number;
	watcherIds?: number[];
	checklist?: string[];
	groupId?: number;
	sprintId?: number;
}

export interface UpdateTaskBody {
	version: number;
	title?: string;
	description?: string;
	priority?: TaskPriority;
	/** `null` bỏ điểm (chưa chấm điểm). */
	points?: number | null;
	startDate?: string;
	assigneeId?: number;
	reviewerId?: number;
	/** `null` bỏ nhóm. */
	groupId?: number | null;
	/** `null` đưa về việc chờ xếp. */
	sprintId?: number | null;
}

export interface TransitionTaskBody {
	action: TaskAction;
	version: number;
	reason?: string;
	qualityScore?: number;
}

export interface MoveTaskBody {
	status?: TaskStatus;
	beforeId?: number;
	afterId?: number;
	version: number;
	board?: 'my' | 'shared';
	reason?: string;
	qualityScore?: number;
}

export interface ChangeDueBody {
	dueDate: string;
	reason: string;
	version: number;
}

export interface TaskComment {
	id: number;
	taskId: number;
	author: TaskPerson;
	/** HTML từ Tiptap, null khi đã xoá. Hiển thị qua DOMPurify. */
	body: string | null;
	mentionIds: number[];
	editedAt: string | null;
	createdAt: string;
	deleted: boolean;
	attachments: TaskAttachment[];
	canEdit: boolean;
}

export type TaskEventType =
	| 'CREATED'
	| 'STATUS_CHANGED'
	| 'SUBMITTED'
	| 'ACCEPTED'
	| 'RETURNED'
	| 'REOPENED'
	| 'CANCELLED'
	| 'ASSIGNEE_CHANGED'
	| 'REVIEWER_CHANGED'
	| 'DUE_CHANGED'
	| 'FIELD_CHANGED'
	| 'SPRINT_CHANGED'
	| 'GROUP_CHANGED'
	| 'DEPENDENCY_ADDED'
	| 'DEPENDENCY_REMOVED'
	| 'ATTACHMENT_ADDED'
	| 'ATTACHMENT_REMOVED';

export interface TaskEvent {
	id: number;
	type: TaskEventType;
	typeLabel: string;
	actor: TaskPerson | null;
	fromStatus: TaskStatus | null;
	fromStatusLabel: string | null;
	toStatus: TaskStatus | null;
	toStatusLabel: string | null;
	payload: Record<string, unknown> | null;
	createdAt: string;
}

export interface TaskActivityItem {
	kind: 'comment' | 'event';
	at: string;
	comment?: TaskComment;
	event?: TaskEvent;
}

export type TaskActivityKind = 'all' | 'comments' | 'history';

export interface MentionCandidate {
	id: number;
	fullName: string;
	avatarUrl: string | null;
	departmentName: string | null;
	/** False: người này không xem được việc nên sẽ không nhận thông báo. */
	canView: boolean;
}

export interface TaskSignedUrl {
	url: string;
	expiresIn: number;
}

/** `GET /v1/tasks/scope`: phạm vi xem của người gọi. */
export interface TaskScope {
	/** ADMIN, Giám đốc: xem mọi việc, chọn được mọi phòng ở Việc của phòng. */
	seesAllTasks: boolean;
	/** Phòng người gọi đang làm trưởng phòng. */
	managedDepartments: Array<{ id: number; name: string }>;
}

// ─── Dự án ─────────────────────────────────────────────────────────────────────

export interface TaskProject {
	id: number;
	code: string;
	name: string;
	description: string | null;
	department: { id: number; name: string } | null;
	status: TaskProjectStatus;
	statusLabel: string;
	createdBy: TaskPerson;
	closedAt: string | null;
	memberCount: number;
	openTaskCount: number;
	myRole: TaskProjectRole | null;
	myRoleLabel: string | null;
	canManage: boolean;
	createdAt: string;
	/** Lô 2: dự án bật đợt và việc chờ xếp. */
	useSprints: boolean;
	/** Dự án mẫu (D-Q4): không vào báo cáo, người tạo xoá được. */
	isSample: boolean;
	/** Giới hạn số thẻ mỗi cột, chỉ để cảnh báo. */
	wipLimits: TaskWipLimits | null;
}

export type TaskWipLimits = Partial<Record<'TODO' | 'IN_PROGRESS' | 'IN_REVIEW', number>>;

export interface TaskProjectMember {
	employee: TaskPerson;
	departmentName: string | null;
	role: TaskProjectRole;
	roleLabel: string;
	inactive: boolean;
	addedAt: string;
}

export interface TaskProjectDetail extends TaskProject {
	members: TaskProjectMember[];
	taskCounts: Record<TaskStatus, number>;
}

export interface CreateTaskProjectBody {
	code: string;
	name: string;
	description?: string;
	departmentId?: number;
	members?: Array<{ employeeId: number; role?: TaskProjectRole }>;
}

export interface UpdateTaskProjectBody {
	name?: string;
	description?: string;
	departmentId?: number | null;
	useSprints?: boolean;
	wipLimits?: TaskWipLimits | null;
}

// ─── Lô 2: nhóm việc, đợt ──────────────────────────────────────────────────────

export interface TaskGroup {
	id: number;
	projectId: number;
	name: string;
	sortOrder: number;
	archived: boolean;
	/** Chỉ đếm việc cấp trên chưa huỷ. */
	taskCount: number;
	doneCount: number;
	points: number;
}

export interface TaskSprint {
	id: number;
	projectId: number;
	name: string;
	goal: string | null;
	startDate: string;
	endDate: string;
	status: TaskSprintStatus;
	statusLabel: string;
	startedAt: string | null;
	closedAt: string | null;
	taskCounts: Record<TaskStatus, number>;
	points: Record<TaskStatus, number>;
	/** Không tính việc huỷ. */
	totalPoints: number;
}

export interface TaskSprintBody {
	name: string;
	goal?: string;
	startDate: string;
	endDate: string;
}

export type TaskSprintMoveTo = 'next' | 'new' | 'backlog';

export interface TaskSprintCloseResult {
	sprint: TaskSprint;
	movedTo: TaskSprint | null;
	moved: string[];
}

// ─── Lô 2: việc định kỳ ────────────────────────────────────────────────────────

export type TaskRecurrenceFrequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export interface TaskRecurrencePerson extends TaskPerson {
	inactive: boolean;
}

export interface TaskRecurrence {
	id: number;
	title: string;
	description: string | null;
	project: TaskProjectRef | null;
	assigner: TaskRecurrencePerson;
	assignee: TaskRecurrencePerson;
	reviewer: TaskRecurrencePerson;
	priority: TaskPriority;
	priorityLabel: string;
	points: number;
	watcherIds: number[];
	checklist: string[];
	frequency: TaskRecurrenceFrequency;
	frequencyLabel: string;
	interval: number;
	/** 1 thứ Hai … 7 Chủ nhật. */
	weekdays: number[];
	dayOfMonth: number | null;
	monthOfPeriod: number | null;
	leadDays: number;
	startDate: string;
	endDate: string | null;
	/** Hạn lần sinh kế. */
	nextDueDate: string | null;
	/** Ngày việc kế xuất hiện. */
	nextAppearDate: string | null;
	lastDueDate: string | null;
	isActive: boolean;
	/** Lý do hệ thống tự dừng; null khi người dùng dừng. */
	pausedReason: string | null;
	/** Tối đa 5 hạn sắp tới, rỗng khi đã dừng. */
	upcoming: string[];
	taskCount: number;
	canManage: boolean;
	createdAt: string;
}

export interface TaskRecurrenceBody {
	title: string;
	description?: string;
	projectId?: number;
	assigneeId: number;
	reviewerId?: number;
	priority?: TaskPriority;
	points: number;
	watcherIds?: number[];
	checklist?: string[];
	frequency: TaskRecurrenceFrequency;
	interval?: number;
	weekdays?: number[];
	dayOfMonth?: number;
	monthOfPeriod?: number;
	leadDays?: number;
	startDate: string;
	endDate?: string | null;
}

// ─── Lô 2: biểu đồ tiến độ, lịch ──────────────────────────────────────────────

export interface TaskTimelineLink {
	blockerId: number;
	blockedId: number;
	late: boolean;
}

export interface TaskTimeline {
	from: string;
	to: string;
	tasks: TaskListItem[];
	links: TaskTimelineLink[];
	/** Còn quá 500 việc: gợi ý lọc hẹp hơn. */
	truncated: boolean;
}

export interface TaskCalendar {
	from: string;
	to: string;
	tasks: TaskListItem[];
	truncated: boolean;
}

// ─── Lô 2: báo cáo ─────────────────────────────────────────────────────────────

export type TaskProgressMetric =
	| 'assigned'
	| 'cancelled'
	| 'done'
	| 'onTimeOriginal'
	| 'onTimeCurrent'
	| 'overdueOpen'
	| 'returned'
	| 'points'
	| 'quality';

export interface TaskReportPerson extends TaskPerson {
	employeeCode: string | null;
	departmentName: string | null;
	inactive: boolean;
}

export interface TaskProgressCounts {
	assigned: number;
	cancelled: number;
	done: number;
	onTimeOriginal: number;
	onTimeCurrent: number;
	overdueOpen: number;
	returned: number;
	points: number;
	quality: number | null;
	qualityCount: number;
	onTimeOriginalPct: number | null;
	onTimeCurrentPct: number | null;
	donePct: number | null;
}

export interface TaskProgressReport {
	from: string;
	to: string;
	scope: { departmentNames: string[]; projectId: number | null; projectName: string | null };
	rows: Array<{ person: TaskReportPerson; counts: TaskProgressCounts }>;
	total: TaskProgressCounts;
}

export interface TaskReportQuery {
	from?: string;
	to?: string;
	departmentId?: number;
	projectId?: number;
	groupId?: number;
	assigneeIds?: string;
}

export interface TaskOverdueItem extends TaskListItem {
	daysOverdue: number;
}

export interface TaskProjectOverview {
	project: TaskProject;
	statusCounts: Record<TaskStatus, number>;
	overdue: number;
	groups: TaskGroup[];
	byAssignee: Array<{ person: TaskReportPerson; open: number; overdue: number }>;
	activeSprint: TaskSprint | null;
}

/** Bản rút gọn trong `error.details.task` của 409 `TASK_VERSION_CONFLICT`, `TASK_STATUS_INVALID`. */
export interface TaskConflictSnapshot {
	id: number;
	code: string;
	version: number;
	status: TaskStatus;
	statusLabel: string;
	dueDate: string | null;
	assigneeId: number;
	reviewerId: number;
	boardOrder: number;
	updatedAt: string;
}

/** Sự kiện kênh `/tasks` (`docs/realtime-websocket.md` mục 2.3). */
export interface TaskChangedEvent {
	id: number;
	code: string;
	version: number;
	kind:
		| 'created'
		| 'updated'
		| 'status'
		| 'due'
		| 'moved'
		| 'checklist'
		| 'watchers'
		| 'attachment'
		| 'cancelled'
		| 'dependency'
		| 'sprint';
}

export interface TaskCommentEvent {
	taskId: number;
	code: string;
}
