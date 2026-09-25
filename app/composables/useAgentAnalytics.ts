import { useAgentAnalyticsService } from '~/services/agent-analytics.service';
import type { AgentAnalyticsOverview } from '~/types/agent-analytics.types';

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
	const loading = ref(false);
	const error = ref<string | null>(null);
	const from = ref(isoDaysAgo(30));
	const to = ref(new Date().toISOString().slice(0, 10));

	async function load(): Promise<void> {
		loading.value = true;
		error.value = null;
		try {
			const params = { from: from.value, to: to.value };
			data.value = scope === 'me' ? await service.me(params) : await service.overview(params);
		} catch (err) {
			error.value = (err as Error)?.message ?? 'Không tải được dữ liệu';
			data.value = null;
		} finally {
			loading.value = false;
		}
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

	return { data, loading, error, from, to, load, setRange, maxDailyTokens };
}
