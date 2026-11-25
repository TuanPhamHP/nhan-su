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
	TaskChecklistItem,
	TaskComment,
	TaskDetail,
	TaskListItem,
	TaskListQuery,
	TaskProject,
	TaskProjectDetail,
	TaskProjectMember,
	TaskProjectRole,
	TaskProjectStatus,
	TaskScope,
	TaskSignedUrl,
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
	};
};
