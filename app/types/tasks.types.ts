/**
 * Module Công việc và KPI, lô 1 (`docs/backend/bridges/tasks.md`). Kiểu khớp `docs/openapi.json` của
 * nhánh BE `feat/tasks-lot1`.
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

export interface TaskListItem {
	id: number;
	code: string;
	title: string;
	status: TaskStatus;
	statusLabel: string;
	priority: TaskPriority;
	priorityLabel: string;
	points: number;
	source: TaskSource;
	sourceLabel: string;
	version: number;
	boardOrder: number;
	personalOrder: number | null;
	project: TaskProjectRef | null;
	parent: TaskParentRef | null;
	assigner: TaskPerson;
	assignee: TaskPerson;
	reviewer: TaskPerson;
	startDate: string | null;
	dueDate: string;
	originalDueDate: string;
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
	oldDueDate: string;
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
	/** Câu cảnh báo không chặn sau thao tác (VD báo xong khi còn việc con mở). */
	warning: string | null;
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
}

export interface CreateTaskBody {
	title: string;
	assigneeId: number;
	dueDate: string;
	points: number;
	reviewerId?: number;
	priority?: TaskPriority;
	startDate?: string;
	description?: string;
	projectId?: number;
	parentId?: number;
	watcherIds?: number[];
	checklist?: string[];
}

export interface UpdateTaskBody {
	version: number;
	title?: string;
	description?: string;
	priority?: TaskPriority;
	points?: number;
	startDate?: string;
	assigneeId?: number;
	reviewerId?: number;
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
}

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
}

/** Bản rút gọn trong `error.details.task` của 409 `TASK_VERSION_CONFLICT`, `TASK_STATUS_INVALID`. */
export interface TaskConflictSnapshot {
	id: number;
	code: string;
	version: number;
	status: TaskStatus;
	statusLabel: string;
	dueDate: string;
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
	kind: 'created' | 'updated' | 'status' | 'due' | 'moved' | 'checklist' | 'watchers' | 'attachment' | 'cancelled';
}

export interface TaskCommentEvent {
	taskId: number;
	code: string;
}
