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
	const loading = useState<boolean>('task-scope-loading', () => false);
	const failed = useState<boolean>('task-scope-failed', () => false);
	async function load(force = false): Promise<void> {
		if (scope.value && !force) return;
		if (inFlight) return inFlight;
		loading.value = true;
		failed.value = false;
		inFlight = useTasksService()
			.scope()
			.then(res => {
				scope.value = res;
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
		failed.value = false;
	}

	/** Có phòng để xem ở màn Việc của phòng. */
	const hasDepartmentView = computed(
		() => !!scope.value && (scope.value.seesAllTasks || scope.value.managedDepartments.length > 0),
	);

	return { scope, loading, failed, load, reset, hasDepartmentView };
}
