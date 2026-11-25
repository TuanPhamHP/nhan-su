import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedMeta } from '~/types/api.types';
import type {
	ChangeDueBody,
	CreateTaskBody,
	CreateTaskProjectBody,
	MentionCandidate,
	MoveTaskBody,
	TaskActivityItem,
	TaskActivityKind,
	TaskAttachment,
	TaskBoard,
	TaskCalendar,
	TaskChecklistItem,
	TaskComment,
	TaskDetail,
	TaskGroup,
	TaskListItem,
	TaskListQuery,
	TaskOverdueItem,
	TaskProgressMetric,
	TaskProgressReport,
	TaskProject,
	TaskProjectDetail,
	TaskProjectMember,
	TaskProjectOverview,
	TaskProjectRole,
	TaskProjectStatus,
	TaskRecurrence,
	TaskRecurrenceBody,
	TaskReportQuery,
	TaskScope,
	TaskSignedUrl,
	TaskSprint,
	TaskSprintBody,
	TaskSprintCloseResult,
	TaskSprintMoveTo,
	TaskTimeline,
	TransitionTaskBody,
	UpdateTaskBody,
	UpdateTaskProjectBody,
} from '~/types/tasks.types';

interface ListResponse<T> {
	success: boolean;
	data: T[];
	meta: PaginatedMeta;
}

/** Bỏ ô trống để query không mang `?status=&q=`: máy chủ coi chuỗi rỗng là một giá trị lọc. */
function cleanQuery(query: object): Record<string, string | number | boolean> {
	const out: Record<string, string | number | boolean> = {};
	for (const [key, value] of Object.entries(query)) {
		if (value === undefined || value === null || value === '') continue;
		out[key] = value as string | number | boolean;
	}
	return out;
}

/**
 * Module Công việc và KPI, lô 1 (`docs/backend/bridges/tasks.md`).
 *
 * Mọi thao tác ghi lên chính việc (`update`, `transition`, `changeDue`, `move` trên bảng chung)
 * gửi `version` đang hiện; người khác vừa đổi trước thì máy chủ trả 409 `TASK_VERSION_CONFLICT`
 * kèm bản mới ở `error.details.task`, nơi gọi đọc bằng `taskErrorInfo` trong `utils/tasks.utils.ts`.
 */
export const useTasksService = () => {
	const authFetch = useAuthFetch();

	return {
		// ─── Việc ───────────────────────────────────────────────────────────────

		async list(query: TaskListQuery): Promise<{ data: TaskListItem[]; meta: PaginatedMeta }> {
			const res = await authFetch<ListResponse<TaskListItem>>('/v1/tasks', { params: cleanQuery(query) });
			return { data: res.data, meta: res.meta };
		},

		/** Phạm vi xem: có xem mọi việc không, làm trưởng phòng những phòng nào. */
		async scope(): Promise<TaskScope> {
			const res = await authFetch<ApiResponse<TaskScope>>('/v1/tasks/scope');
			return res.data;
		},

		async board(query: TaskListQuery): Promise<TaskBoard> {
			const res = await authFetch<ApiResponse<TaskBoard>>('/v1/tasks/board', { params: cleanQuery(query) });
			return res.data;
		},

		/** `idOrCode`: số hiệu (`HQ-12`, không phân biệt hoa thường) hoặc id số. */
		async get(idOrCode: string | number): Promise<TaskDetail> {
			const res = await authFetch<ApiResponse<TaskDetail>>(`/v1/tasks/${encodeURIComponent(String(idOrCode))}`);
			return res.data;
		},

		async create(body: CreateTaskBody): Promise<TaskDetail> {
			const res = await authFetch<ApiResponse<TaskDetail>>('/v1/tasks', { method: 'POST', body });
			return res.data;
		},

		async update(id: number, body: UpdateTaskBody): Promise<TaskDetail> {
			const res = await authFetch<ApiResponse<TaskDetail>>(`/v1/tasks/${id}`, { method: 'PATCH', body });
			return res.data;
		},

		async transition(id: number, body: TransitionTaskBody): Promise<TaskDetail> {
			const res = await authFetch<ApiResponse<TaskDetail>>(`/v1/tasks/${id}/transition`, { method: 'POST', body });
			return res.data;
		},

		async changeDue(id: number, body: ChangeDueBody): Promise<TaskDetail> {
			const res = await authFetch<ApiResponse<TaskDetail>>(`/v1/tasks/${id}/due-date`, { method: 'POST', body });
			return res.data;
		},

		async move(id: number, body: MoveTaskBody): Promise<TaskDetail> {
			const res = await authFetch<ApiResponse<TaskDetail>>(`/v1/tasks/${id}/move`, { method: 'POST', body });
			return res.data;
		},

		async activity(
			id: number,
			params: { kind?: TaskActivityKind; page?: number; limit?: number },
		): Promise<{ data: TaskActivityItem[]; meta: PaginatedMeta }> {
			const res = await authFetch<ListResponse<TaskActivityItem>>(`/v1/tasks/${id}/activity`, {
				params: cleanQuery(params),
			});
			return { data: res.data, meta: res.meta };
		},

		// ─── Danh sách kiểm tra, người theo dõi ────────────────────────────────

		async addChecklistItem(id: number, content: string): Promise<TaskChecklistItem> {
			const res = await authFetch<ApiResponse<TaskChecklistItem>>(`/v1/tasks/${id}/checklist`, {
				method: 'POST',
				body: { content },
			});
			return res.data;
		},

		async updateChecklistItem(
			id: number,
			itemId: number,
			body: { content?: string; isDone?: boolean; sortOrder?: number },
		): Promise<TaskChecklistItem> {
			const res = await authFetch<ApiResponse<TaskChecklistItem>>(`/v1/tasks/${id}/checklist/${itemId}`, {
				method: 'PATCH',
				body,
			});
			return res.data;
		},

		async removeChecklistItem(id: number, itemId: number): Promise<void> {
			await authFetch<void>(`/v1/tasks/${id}/checklist/${itemId}`, { method: 'DELETE' });
		},

		async addWatchers(id: number, employeeIds: number[]): Promise<TaskDetail> {
			const res = await authFetch<ApiResponse<TaskDetail>>(`/v1/tasks/${id}/watchers`, {
				method: 'POST',
				body: { employeeIds },
			});
			return res.data;
		},

		async removeWatcher(id: number, employeeId: number): Promise<void> {
			await authFetch<void>(`/v1/tasks/${id}/watchers/${employeeId}`, { method: 'DELETE' });
		},

		// ─── Bình luận, nhắc tên, file ──────────────────────────────────────────

		async addComment(
			id: number,
			body: { body: string; mentionIds?: number[]; attachmentIds?: number[] },
		): Promise<TaskComment> {
			const res = await authFetch<ApiResponse<TaskComment>>(`/v1/tasks/${id}/comments`, { method: 'POST', body });
			return res.data;
		},

		async updateComment(
			id: number,
			commentId: number,
			body: { body: string; mentionIds?: number[] },
		): Promise<TaskComment> {
			const res = await authFetch<ApiResponse<TaskComment>>(`/v1/tasks/${id}/comments/${commentId}`, {
				method: 'PATCH',
				body,
			});
			return res.data;
		},

		async removeComment(id: number, commentId: number): Promise<void> {
			await authFetch<void>(`/v1/tasks/${id}/comments/${commentId}`, { method: 'DELETE' });
		},

		async mentionable(id: number, q?: string): Promise<MentionCandidate[]> {
			const res = await authFetch<ApiResponse<MentionCandidate[]>>(`/v1/tasks/${id}/mentionable`, {
				params: cleanQuery({ q }),
			});
			return res.data;
		},

		async uploadAttachment(id: number, file: File): Promise<TaskAttachment> {
			const form = new FormData();
			form.append('file', file);
			const res = await authFetch<ApiResponse<TaskAttachment>>(`/v1/tasks/${id}/attachments`, {
				method: 'POST',
				body: form,
			});
			return res.data;
		},

		async attachmentUrl(id: number, attachmentId: number): Promise<TaskSignedUrl> {
			const res = await authFetch<ApiResponse<TaskSignedUrl>>(`/v1/tasks/${id}/attachments/${attachmentId}/url`);
			return res.data;
		},

		async removeAttachment(id: number, attachmentId: number): Promise<void> {
			await authFetch<void>(`/v1/tasks/${id}/attachments/${attachmentId}`, { method: 'DELETE' });
		},

		// ─── Dự án ──────────────────────────────────────────────────────────────

		async listProjects(query: {
			status?: TaskProjectStatus;
			q?: string;
			page?: number;
			limit?: number;
		}): Promise<{ data: TaskProject[]; meta: PaginatedMeta }> {
			const res = await authFetch<ListResponse<TaskProject>>('/v1/task-projects', { params: cleanQuery(query) });
			return { data: res.data, meta: res.meta };
		},

		/** Nhận id số hoặc mã dự án (`HQ`, không phân biệt hoa thường); route con vẫn chỉ nhận id. */
		async getProject(idOrCode: number | string): Promise<TaskProjectDetail> {
			const res = await authFetch<ApiResponse<TaskProjectDetail>>(
				`/v1/task-projects/${encodeURIComponent(String(idOrCode))}`,
			);
			return res.data;
		},

		async createProject(body: CreateTaskProjectBody): Promise<TaskProjectDetail> {
			const res = await authFetch<ApiResponse<TaskProjectDetail>>('/v1/task-projects', { method: 'POST', body });
			return res.data;
		},

		async updateProject(id: number, body: UpdateTaskProjectBody): Promise<TaskProjectDetail> {
			const res = await authFetch<ApiResponse<TaskProjectDetail>>(`/v1/task-projects/${id}`, {
				method: 'PATCH',
				body,
			});
			return res.data;
		},

		async closeProject(id: number): Promise<TaskProjectDetail> {
			const res = await authFetch<ApiResponse<TaskProjectDetail>>(`/v1/task-projects/${id}/close`, {
				method: 'POST',
			});
			return res.data;
		},

		async reopenProject(id: number): Promise<TaskProjectDetail> {
			const res = await authFetch<ApiResponse<TaskProjectDetail>>(`/v1/task-projects/${id}/reopen`, {
				method: 'POST',
			});
			return res.data;
		},

		async addProjectMember(id: number, employeeId: number, role?: TaskProjectRole): Promise<TaskProjectMember> {
			const res = await authFetch<ApiResponse<TaskProjectMember>>(`/v1/task-projects/${id}/members`, {
				method: 'POST',
				body: { employeeId, role },
			});
			return res.data;
		},

		async updateProjectMember(id: number, employeeId: number, role: TaskProjectRole): Promise<TaskProjectMember> {
			const res = await authFetch<ApiResponse<TaskProjectMember>>(`/v1/task-projects/${id}/members/${employeeId}`, {
				method: 'PATCH',
				body: { role },
			});
			return res.data;
		},

		async removeProjectMember(id: number, employeeId: number): Promise<void> {
			await authFetch<void>(`/v1/task-projects/${id}/members/${employeeId}`, { method: 'DELETE' });
		},

		// ─── Lô 2: dự án mẫu ────────────────────────────────────────────────────

		/** Mỗi người một dự án mẫu; lần hai 409 `TASK_SAMPLE_EXISTS` kèm `details.projectId`. */
		async createSampleProject(): Promise<TaskProjectDetail> {
			const res = await authFetch<ApiResponse<TaskProjectDetail>>('/v1/task-projects/sample', { method: 'POST' });
			return res.data;
		},

		/** Chỉ dự án mẫu. Có dữ liệu người khác → 409 `TASK_SAMPLE_HAS_OTHERS`. */
		async deleteProject(id: number): Promise<void> {
			await authFetch<void>(`/v1/task-projects/${id}`, { method: 'DELETE' });
		},

		// ─── Lô 2: nhóm việc ────────────────────────────────────────────────────

		async listGroups(projectId: number): Promise<TaskGroup[]> {
			const res = await authFetch<ApiResponse<TaskGroup[]>>(`/v1/task-projects/${projectId}/groups`);
			return res.data;
		},

		async createGroup(projectId: number, body: { name: string; sortOrder?: number }): Promise<TaskGroup> {
			const res = await authFetch<ApiResponse<TaskGroup>>(`/v1/task-projects/${projectId}/groups`, { method: 'POST', body });
			return res.data;
		},

		async updateGroup(
			projectId: number,
			groupId: number,
			body: { name?: string; sortOrder?: number; archived?: boolean },
		): Promise<TaskGroup> {
			const res = await authFetch<ApiResponse<TaskGroup>>(`/v1/task-projects/${projectId}/groups/${groupId}`, {
				method: 'PATCH',
				body,
			});
			return res.data;
		},

		// ─── Lô 2: đợt ──────────────────────────────────────────────────────────

		async listSprints(projectId: number): Promise<TaskSprint[]> {
			const res = await authFetch<ApiResponse<TaskSprint[]>>(`/v1/task-projects/${projectId}/sprints`);
			return res.data;
		},

		async createSprint(projectId: number, body: TaskSprintBody): Promise<TaskSprint> {
			const res = await authFetch<ApiResponse<TaskSprint>>(`/v1/task-projects/${projectId}/sprints`, { method: 'POST', body });
			return res.data;
		},

		async updateSprint(projectId: number, sprintId: number, body: Partial<TaskSprintBody>): Promise<TaskSprint> {
			const res = await authFetch<ApiResponse<TaskSprint>>(`/v1/task-projects/${projectId}/sprints/${sprintId}`, {
				method: 'PATCH',
				body,
			});
			return res.data;
		},

		async startSprint(projectId: number, sprintId: number): Promise<TaskSprint> {
			const res = await authFetch<ApiResponse<TaskSprint>>(`/v1/task-projects/${projectId}/sprints/${sprintId}/start`, {
				method: 'POST',
			});
			return res.data;
		},

		async closeSprint(
			projectId: number,
			sprintId: number,
			body: { moveTo?: TaskSprintMoveTo; newSprint?: TaskSprintBody },
		): Promise<TaskSprintCloseResult> {
			const res = await authFetch<ApiResponse<TaskSprintCloseResult>>(
				`/v1/task-projects/${projectId}/sprints/${sprintId}/close`,
				{ method: 'POST', body },
			);
			return res.data;
		},

		// ─── Lô 2: việc định kỳ ─────────────────────────────────────────────────

		async listRecurrences(query: {
			isActive?: boolean;
			projectId?: number;
			assigneeId?: number;
			page?: number;
			limit?: number;
		}): Promise<{ data: TaskRecurrence[]; meta: PaginatedMeta }> {
			const res = await authFetch<ListResponse<TaskRecurrence>>('/v1/task-recurrences', { params: cleanQuery(query) });
			return { data: res.data, meta: res.meta };
		},

		async getRecurrence(id: number): Promise<TaskRecurrence> {
			const res = await authFetch<ApiResponse<TaskRecurrence>>(`/v1/task-recurrences/${id}`);
			return res.data;
		},

		async createRecurrence(body: TaskRecurrenceBody): Promise<TaskRecurrence> {
			const res = await authFetch<ApiResponse<TaskRecurrence>>('/v1/task-recurrences', { method: 'POST', body });
			return res.data;
		},

		/** Không đổi dự án; `endDate: null` để bỏ ngày kết thúc. */
		async updateRecurrence(id: number, body: Partial<Omit<TaskRecurrenceBody, 'projectId'>>): Promise<TaskRecurrence> {
			const res = await authFetch<ApiResponse<TaskRecurrence>>(`/v1/task-recurrences/${id}`, { method: 'PATCH', body });
			return res.data;
		},

		async pauseRecurrence(id: number): Promise<TaskRecurrence> {
			const res = await authFetch<ApiResponse<TaskRecurrence>>(`/v1/task-recurrences/${id}/pause`, { method: 'POST' });
			return res.data;
		},

		async resumeRecurrence(id: number): Promise<TaskRecurrence> {
			const res = await authFetch<ApiResponse<TaskRecurrence>>(`/v1/task-recurrences/${id}/resume`, { method: 'POST' });
			return res.data;
		},

		// ─── Lô 2: phụ thuộc, biểu đồ tiến độ, lịch ─────────────────────────────

		/** Việc `id` (việc sau) chờ `blockerId` (việc trước). Trả chi tiết việc sau. */
		async addDependency(id: number, blockerId: number): Promise<TaskDetail> {
			const res = await authFetch<ApiResponse<TaskDetail>>(`/v1/tasks/${id}/dependencies`, {
				method: 'POST',
				body: { blockerId },
			});
			return res.data;
		},

		async removeDependency(id: number, blockerId: number): Promise<void> {
			await authFetch<void>(`/v1/tasks/${id}/dependencies/${blockerId}`, { method: 'DELETE' });
		},

		/** `from`, `to` bắt buộc, tối đa 370 ngày. */
		async timeline(query: TaskListQuery & { from: string; to: string }): Promise<TaskTimeline> {
			const res = await authFetch<ApiResponse<TaskTimeline>>('/v1/tasks/timeline', { params: cleanQuery(query) });
			return res.data;
		},

		/** `from`, `to` bắt buộc, tối đa 62 ngày. */
		async calendar(query: TaskListQuery & { from: string; to: string }): Promise<TaskCalendar> {
			const res = await authFetch<ApiResponse<TaskCalendar>>('/v1/tasks/calendar', { params: cleanQuery(query) });
			return res.data;
		},

		// ─── Lô 2: báo cáo ──────────────────────────────────────────────────────

		async progressReport(query: TaskReportQuery): Promise<TaskProgressReport> {
			const res = await authFetch<ApiResponse<TaskProgressReport>>('/v1/task-reports/progress', {
				params: cleanQuery(query),
			});
			return res.data;
		},

		/** Danh sách việc làm nên một ô số (T-13); bỏ `assigneeId` cho dòng tổng. */
		async progressTasks(
			query: TaskReportQuery & { metric: TaskProgressMetric; assigneeId?: number; page?: number; limit?: number },
		): Promise<{ data: TaskListItem[]; meta: PaginatedMeta }> {
			const res = await authFetch<ListResponse<TaskListItem>>('/v1/task-reports/progress/tasks', {
				params: cleanQuery(query),
			});
			return { data: res.data, meta: res.meta };
		},

		async overdueReport(
			query: TaskReportQuery & { page?: number; limit?: number },
		): Promise<{ data: TaskOverdueItem[]; meta: PaginatedMeta }> {
			const res = await authFetch<ListResponse<TaskOverdueItem>>('/v1/task-reports/overdue', {
				params: cleanQuery(query),
			});
			return { data: res.data, meta: res.meta };
		},

		exportProgress(query: TaskReportQuery): Promise<Blob> {
			return authFetch<Blob>('/v1/task-reports/progress/export', { params: cleanQuery(query), responseType: 'blob' });
		},

		exportOverdue(query: TaskReportQuery): Promise<Blob> {
			return authFetch<Blob>('/v1/task-reports/overdue/export', { params: cleanQuery(query), responseType: 'blob' });
		},

		/** Tổng quan dự án: thành viên, ADMIN, DIRECTOR; người khác 404. */
		async projectOverview(id: number): Promise<TaskProjectOverview> {
			const res = await authFetch<ApiResponse<TaskProjectOverview>>(`/v1/task-reports/project/${id}`);
			return res.data;
		},
	};
};
