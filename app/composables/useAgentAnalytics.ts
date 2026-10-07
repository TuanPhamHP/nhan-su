import { useAgentAnalyticsService } from '~/services/agent-analytics.service';
import type {
	AgentAnalyticsOverview,
	AgentFeedbackAnalytics,
} from '~/types/agent-analytics.types';

function isoDaysAgo(days: number): string {
	const d = new Date();
	d.setDate(d.getDate() - days);
	return d.toISOString().slice(0, 10);
}

/**
 * @param scope 'all' = toàn hệ thống (cần ADMIN/HR/DIRECTOR), 'me' = của chính mình.
 */
export function useAgentAnalytics(scope: 'all' | 'me' = 'all') {
	const service = useAgentAnalyticsService();

	const data = ref<AgentAnalyticsOverview | null>(null);
	/** Bảng đánh giá chi tiết — chỉ có ở scope 'all', endpoint giới hạn ADMIN/HR/DIRECTOR. */
	const feedback = ref<AgentFeedbackAnalytics | null>(null);
	const loading = ref(false);
	const error = ref<string | null>(null);
	const from = ref(isoDaysAgo(30));
	const to = ref(new Date().toISOString().slice(0, 10));

	async function load(): Promise<void> {
		loading.value = true;
		error.value = null;
		try {
			const params = { from: from.value, to: to.value };
			// topLimit mặc định của BE là 10 — quá ít cho câu hỏi "có những ai đang dùng".
			// 50 là trần BE cho phép (@Max(50)); xin hơn là 400, không phải cắt bớt im lặng.
			data.value =
				scope === 'me'
					? await service.me(params)
					: await service.overview({ ...params, topLimit: 50 });
			// Bảng đánh giá hỏng (hoặc chưa có bảng trong DB) KHÔNG được làm trắng cả trang
			// mức dùng — nó là phần thêm, không phải phần chính.
			feedback.value =
				scope === 'me'
					? null
					: await service
							.feedback({ ...params, topLimit: 20 })
							.catch(() => null);
		} catch (err) {
			error.value = (err as Error)?.message ?? 'Không tải được dữ liệu';
			data.value = null;
		} finally {
			loading.value = false;
		}
	}

	/**
	 * Số liệu của riêng một nhân viên, trong đúng khoảng đang lọc.
	 *
	 * Dùng chính `/overview` kèm `employeeId` — endpoint này chỉ ADMIN/HR/DIRECTOR gọi
	 * được, nên không cần kiểm quyền lại ở FE. Không ghi vào `data` để bảng chính
	 * không bị thay dữ liệu dưới chân người đang xem.
	 */
	async function loadEmployee(employeeId: number): Promise<AgentAnalyticsOverview> {
		return service.overview({ from: from.value, to: to.value, employeeId });
	}

	/** Đổi nhanh khoảng thời gian rồi tải lại. */
	function setRange(days: number): void {
		from.value = isoDaysAgo(days);
		to.value = new Date().toISOString().slice(0, 10);
		void load();
	}

	const maxDailyTokens = computed(() =>
		Math.max(1, ...(data.value?.daily ?? []).map((d) => d.promptTokens + d.completionTokens)),
	);

	return {
		data,
		feedback,
		loading,
		error,
		from,
		to,
		load,
		loadEmployee,
		setRange,
		maxDailyTokens,
	};
}
