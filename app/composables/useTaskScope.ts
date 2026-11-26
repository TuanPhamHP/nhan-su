import { useTasksService } from '~/services/tasks.service';
import type { TaskScope } from '~/types/tasks.types';

/**
 * Phạm vi xem việc của người đang đăng nhập (`GET /v1/tasks/scope`): có xem được mọi việc không
 * (ADMIN, Giám đốc) và đang làm trưởng phòng những phòng nào.
 *
 * Dùng cho mục menu "Việc của phòng" (chỉ hiện khi có phòng để xem) và màn Việc của phòng. Giữ
 * trong `useState` để menu và trang dùng chung một lần gọi; đổi công ty hay đăng xuất thì gọi
 * `reset()`.
 */
let inFlight: Promise<void> | null = null;

export function useTaskScope() {
	const scope = useState<TaskScope | null>('task-scope', () => null);
	/**
	 * Lô 2: dự án đang chạy người này làm quản lý dự án (trừ dự án mẫu). Quản lý dự án xem được báo cáo
	 * khi lọc đúng dự án mình (bridge mục 16), nên mục menu Báo cáo và ô chọn dự án cần danh sách này.
	 */
	const managedProjects = useState<Array<{ id: number; code: string; name: string }>>('task-scope-projects', () => []);
	const loading = useState<boolean>('task-scope-loading', () => false);
	const failed = useState<boolean>('task-scope-failed', () => false);
	async function load(force = false): Promise<void> {
		if (scope.value && !force) return;
		if (inFlight) return inFlight;
		loading.value = true;
		failed.value = false;
		const service = useTasksService();
		inFlight = Promise.all([service.scope(), service.listProjects({ status: 'ACTIVE', limit: 100 }).catch(() => null)])
			.then(([res, projects]) => {
				scope.value = res;
				managedProjects.value = (projects?.data ?? [])
					.filter(p => p.myRole === 'MANAGER' && !p.isSample)
					.map(p => ({ id: p.id, code: p.code, name: p.name }));
			})
			.catch(() => {
				failed.value = true;
			})
			.finally(() => {
				loading.value = false;
				inFlight = null;
			});
		return inFlight;
	}

	function reset() {
		scope.value = null;
		managedProjects.value = [];
		failed.value = false;
	}

	/** Có phòng để xem ở màn Việc của phòng. */
	const hasDepartmentView = computed(
		() => !!scope.value && (scope.value.seesAllTasks || scope.value.managedDepartments.length > 0),
	);

	/**
	 * Có thể có báo cáo để xem (ngoài quyền `task:report`, nơi gọi tự xét): xem mọi việc, làm trưởng
	 * phòng, hoặc làm quản lý dự án. Máy chủ vẫn là bên chặn thật (403 `TASK_REPORT_FORBIDDEN`).
	 */
	const hasReportScope = computed(() => hasDepartmentView.value || managedProjects.value.length > 0);

	return { scope, managedProjects, loading, failed, load, reset, hasDepartmentView, hasReportScope };
}
