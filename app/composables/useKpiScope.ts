import { useKpiService } from '~/services/kpi.service';
import { useTasksService } from '~/services/tasks.service';

/**
 * Người đang đăng nhập có từng được giao chấm phiếu KPI nào không (`GET /kpi/reviews?toReview=true&limit=1`).
 *
 * Dùng cho mục menu "Đánh giá nhân viên": hiện khi có phiếu chờ chấm (`kpiReviews` của `/approval/counts`), khi
 * người xem là quản lý hay trưởng phòng, hoặc khi đã có phiếu nào mình chấm (kể cả đã gửi), để nhân viên được giao
 * chấm quản lý trực tiếp vẫn mở lại được phiếu đã chấm. Gọi một lần, giữ trong `useState`.
 *
 * UI-16a: người có `kpi:manage` (thường là nhân sự) mà không có việc nào phải làm thì bấm "Công việc và KPI" vào
 * thẳng Kỳ đánh giá thay cho ngăn Tôi làm trống. "Không có việc" lấy từ `GET /v1/tasks?view=my&limit=1` (việc mình
 * làm, mọi trạng thái), chỉ gọi cho người có `kpi:manage`. Việc mình giao không tính: trong thử nghiệm nhân sự có
 * giao việc mà vẫn rơi vào ngăn Tôi làm trống.
 */
let inFlight: Promise<void> | null = null;

export function useKpiScope() {
	const reviewsAny = useState<boolean>('kpi-scope-reviews-any', () => false);
	const loaded = useState<boolean>('kpi-scope-loaded', () => false);
	/** Người có `kpi:manage` không có việc nào phải làm; `false` khi chưa biết hoặc không có quyền đó. */
	const managerWithoutTasks = useState<boolean>('kpi-scope-manager-without-tasks', () => false);

	async function load(force = false): Promise<void> {
		if (loaded.value && !force) return;
		if (inFlight) return inFlight;
		// Hỏi quyền lúc gọi chứ không lúc dựng: store auth cũng gọi `useKpiScope().reset()` khi đăng xuất.
		const checkTasks = usePermissions().hasPermission('kpi:manage');
		inFlight = Promise.all([
			useKpiService().listReviews({ toReview: true, limit: 1 }),
			checkTasks ? useTasksService().list({ view: 'my', limit: 1 }).catch(() => null) : Promise.resolve(null),
		])
			.then(([res, tasks]) => {
				reviewsAny.value = res.meta.total > 0;
				// Gọi danh sách việc hỏng thì coi như có việc: giữ trang đích cũ là Việc của tôi.
				managerWithoutTasks.value = checkTasks && !!tasks && tasks.meta.total === 0;
				loaded.value = true;
			})
			.catch(() => {
				// Không chặn menu vì một lần gọi hỏng: mục vẫn hiện theo vai trò và huy hiệu.
			})
			.finally(() => {
				inFlight = null;
			});
		return inFlight;
	}

	function reset() {
		reviewsAny.value = false;
		managerWithoutTasks.value = false;
		loaded.value = false;
	}

	return { reviewsAny, managerWithoutTasks, loaded, load, reset };
}
