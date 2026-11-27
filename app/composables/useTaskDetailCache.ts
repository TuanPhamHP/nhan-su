import type { ComputedRef, InjectionKey } from 'vue';
import { useAuthStore } from '~/stores/auth';
import { useTasksService } from '~/services/tasks.service';
import type { TaskDetail, TaskGroup, TaskProjectRole, TaskSprint } from '~/types/tasks.types';

/**
 * Phần dự án mà khung chi tiết việc cần (nhóm việc, đợt, quyền đổi hai thứ đó). Trang dự án đã tải sẵn
 * nên `TaskWorkspace` chia cho khung qua `provide`, khung không gọi lại `GET /task-projects/:id`.
 */
export interface TaskProjectContext {
	projectId: number;
	groups: TaskGroup[];
	/** `null` khi dự án không bật đợt. */
	sprints: TaskSprint[] | null;
	canContribute: boolean;
}
export const TASK_PROJECT_CONTEXT: InjectionKey<ComputedRef<TaskProjectContext | null>> = Symbol('task-project-context');

export interface TaskProjectBits {
	id: number;
	myRole: TaskProjectRole | null;
	useSprints: boolean;
	groups: TaskGroup[];
	sprints: TaskSprint[];
}

/**
 * Việc vừa xem: mở lại thì hiện ngay bản đang giữ rồi lặng lẽ tải bản mới, không hiện khung xám. Phần dự án
 * giữ một phút vì ít đổi.
 */
const MAX_DETAILS = 30;
const PROJECT_TTL_MS = 60_000;
const details = new Map<string, TaskDetail>();
const projects = new Map<string, { at: number; bits: Promise<TaskProjectBits> }>();

/**
 * Bộ nhớ đệm của khung chi tiết việc, dùng chung mọi lần mở trong phiên. Khoá theo công ty để đổi công
 * ty không thấy việc của công ty trước.
 */
export function useTaskDetailCache() {
	const auth = useAuthStore();
	const service = useTasksService();
	const scope = () => `${auth.company?.code ?? ''}:${auth.user?.id ?? 0}`;

	function getDetail(code: string): TaskDetail | null {
		return details.get(`${scope()}:${code.toUpperCase()}`) ?? null;
	}

	function setDetail(t: TaskDetail, code = t.code) {
		const key = `${scope()}:${code.toUpperCase()}`;
		details.delete(key);
		details.set(key, t);
		if (details.size > MAX_DETAILS) details.delete(details.keys().next().value as string);
	}

	/** Nhóm, đợt, vai của người xem trong dự án; lỗi (không là thành viên) thì bỏ khỏi bộ nhớ để lần sau hỏi lại. */
	function projectBits(projectId: number): Promise<TaskProjectBits> {
		const key = `${scope()}:${projectId}`;
		const hit = projects.get(key);
		if (hit && Date.now() - hit.at < PROJECT_TTL_MS) return hit.bits;
		const bits = (async () => {
			const p = await service.getProject(projectId);
			const [groups, sprints] = await Promise.all([
				service.listGroups(projectId),
				p.useSprints ? service.listSprints(projectId) : Promise.resolve([] as TaskSprint[]),
			]);
			return { id: p.id, myRole: p.myRole, useSprints: p.useSprints, groups, sprints };
		})();
		projects.set(key, { at: Date.now(), bits });
		bits.catch(() => projects.delete(key));
		return bits;
	}

	return { getDetail, setDetail, projectBits };
}
