import { useKpiService } from '~/services/kpi.service';

/**
 * Người đang đăng nhập có từng được giao chấm phiếu KPI nào không (`GET /kpi/reviews?toReview=true&limit=1`).
 *
 * Dùng cho mục menu "Đánh giá nhân viên": hiện khi có phiếu chờ chấm (`kpiReviews` của `/approval/counts`), khi
 * người xem là quản lý hay trưởng phòng, hoặc khi đã có phiếu nào mình chấm (kể cả đã gửi), để nhân viên được giao
 * chấm quản lý trực tiếp vẫn mở lại được phiếu đã chấm. Gọi một lần, giữ trong `useState`.
 */
let inFlight: Promise<void> | null = null;

export function useKpiScope() {
	const reviewsAny = useState<boolean>('kpi-scope-reviews-any', () => false);
	const loaded = useState<boolean>('kpi-scope-loaded', () => false);

	async function load(force = false): Promise<void> {
		if (loaded.value && !force) return;
		if (inFlight) return inFlight;
		inFlight = useKpiService()
			.listReviews({ toReview: true, limit: 1 })
			.then(res => {
				reviewsAny.value = res.meta.total > 0;
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
		loaded.value = false;
	}

	return { reviewsAny, loaded, load, reset };
}
