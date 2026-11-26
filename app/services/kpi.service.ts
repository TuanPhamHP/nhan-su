import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedMeta } from '~/types/api.types';
import type {
	CreateKpiGradeScaleBody,
	CreateKpiIndicatorBody,
	CreateKpiTemplateBody,
	KpiEvidence,
	KpiGradeScale,
	KpiIndicator,
	KpiPeriod,
	KpiPeriodDetail,
	KpiPublishAllResult,
	KpiRecomputeResult,
	KpiRemindResult,
	KpiResults,
	KpiReviewDetail,
	KpiReviewListItem,
	KpiReviewQuery,
	KpiTemplate,
	KpiYearResults,
	OpenKpiPeriodBody,
	UpdateKpiIndicatorBody,
	UpdateKpiLineBody,
	UpdateKpiTemplateBody,
} from '~/types/kpi.types';

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
 * KPI, lô 3 của module Công việc và KPI (`docs/backend/bridges/kpi.md` mục 5). Mọi route ghi trên phiếu trả
 * lại chi tiết phiếu mới nhất, trên kỳ trả chi tiết kỳ mới nhất: nơi gọi thay thẳng, không tải lại.
 * Lỗi đọc bằng `taskErrorInfo` (cùng dạng `{ code, message, details }`).
 */
export const useKpiService = () => {
	const authFetch = useAuthFetch();

	return {
		// ─── Cài đặt (kpi:manage) ───────────────────────────────────────────────
		async listIndicators(includeInactive = false): Promise<KpiIndicator[]> {
			const res = await authFetch<ApiResponse<KpiIndicator[]>>('/v1/kpi/indicators', { params: cleanQuery({ includeInactive: includeInactive || undefined }) });
			return res.data;
		},
		async createIndicator(body: CreateKpiIndicatorBody): Promise<KpiIndicator> {
			const res = await authFetch<ApiResponse<KpiIndicator>>('/v1/kpi/indicators', { method: 'POST', body });
			return res.data;
		},
		async updateIndicator(id: number, body: UpdateKpiIndicatorBody): Promise<KpiIndicator> {
			const res = await authFetch<ApiResponse<KpiIndicator>>(`/v1/kpi/indicators/${id}`, { method: 'PATCH', body });
			return res.data;
		},

		async listTemplates(includeInactive = false): Promise<KpiTemplate[]> {
			const res = await authFetch<ApiResponse<KpiTemplate[]>>('/v1/kpi/templates', { params: cleanQuery({ includeInactive: includeInactive || undefined }) });
			return res.data;
		},
		async getTemplate(id: number): Promise<KpiTemplate> {
			const res = await authFetch<ApiResponse<KpiTemplate>>(`/v1/kpi/templates/${id}`);
			return res.data;
		},
		async createTemplate(body: CreateKpiTemplateBody): Promise<KpiTemplate> {
			const res = await authFetch<ApiResponse<KpiTemplate>>('/v1/kpi/templates', { method: 'POST', body });
			return res.data;
		},
		/** Mẫu đã có phiếu thì máy chủ trả mẫu MỚI (id mới, `version + 1`), bản cũ ngừng dùng. */
		async updateTemplate(id: number, body: UpdateKpiTemplateBody): Promise<KpiTemplate> {
			const res = await authFetch<ApiResponse<KpiTemplate>>(`/v1/kpi/templates/${id}`, { method: 'PATCH', body });
			return res.data;
		},

		async listGradeScales(): Promise<KpiGradeScale[]> {
			const res = await authFetch<ApiResponse<KpiGradeScale[]>>('/v1/kpi/grade-scales');
			return res.data;
		},
		async createGradeScale(body: CreateKpiGradeScaleBody): Promise<KpiGradeScale> {
			const res = await authFetch<ApiResponse<KpiGradeScale>>('/v1/kpi/grade-scales', { method: 'POST', body });
			return res.data;
		},

		// ─── Kỳ (kpi:manage) ────────────────────────────────────────────────────
		async listPeriods(): Promise<KpiPeriod[]> {
			const res = await authFetch<ApiResponse<KpiPeriod[]>>('/v1/kpi/periods');
			return res.data;
		},
		async getPeriod(id: number): Promise<KpiPeriodDetail> {
			const res = await authFetch<ApiResponse<KpiPeriodDetail>>(`/v1/kpi/periods/${id}`);
			return res.data;
		},
		async openPeriod(body: OpenKpiPeriodBody): Promise<KpiPeriodDetail> {
			const res = await authFetch<ApiResponse<KpiPeriodDetail>>('/v1/kpi/periods', { method: 'POST', body });
			return res.data;
		},
		async addMissing(id: number): Promise<KpiPeriodDetail> {
			const res = await authFetch<ApiResponse<KpiPeriodDetail>>(`/v1/kpi/periods/${id}/add-missing`, { method: 'POST' });
			return res.data;
		},
		async recompute(id: number): Promise<KpiRecomputeResult> {
			const res = await authFetch<ApiResponse<KpiRecomputeResult>>(`/v1/kpi/periods/${id}/recompute`, { method: 'POST' });
			return res.data;
		},
		/** Nhắc người chấm còn phiếu Chờ cấp trên đánh giá; mỗi người chấm tối đa một lần mỗi ngày mỗi kỳ. */
		async remindReviewers(id: number): Promise<KpiRemindResult> {
			const res = await authFetch<ApiResponse<KpiRemindResult>>(`/v1/kpi/periods/${id}/remind`, { method: 'POST' });
			return res.data;
		},
		async publishPeriod(id: number): Promise<KpiPublishAllResult> {
			const res = await authFetch<ApiResponse<KpiPublishAllResult>>(`/v1/kpi/periods/${id}/publish`, { method: 'POST' });
			return res.data;
		},

		// ─── Kết quả (kpi:manage, ADMIN, DIRECTOR, trưởng phòng) ───────────────
		async periodResults(id: number, departmentId?: number): Promise<KpiResults> {
			const res = await authFetch<ApiResponse<KpiResults>>(`/v1/kpi/periods/${id}/results`, { params: cleanQuery({ departmentId }) });
			return res.data;
		},
		async exportPeriodResults(id: number, departmentId?: number): Promise<Blob> {
			return await authFetch<Blob>(`/v1/kpi/periods/${id}/results/export`, {
				params: cleanQuery({ departmentId }),
				responseType: 'blob',
			});
		},
		async yearResults(year: number, departmentId?: number): Promise<KpiYearResults> {
			const res = await authFetch<ApiResponse<KpiYearResults>>('/v1/kpi/year-results', { params: cleanQuery({ year, departmentId }) });
			return res.data;
		},

		// ─── Phiếu ──────────────────────────────────────────────────────────────
		async listReviews(query: KpiReviewQuery): Promise<{ data: KpiReviewListItem[]; meta: PaginatedMeta }> {
			const res = await authFetch<ListResponse<KpiReviewListItem>>('/v1/kpi/reviews', { params: cleanQuery(query) });
			return { data: res.data, meta: res.meta };
		},
		async getReview(id: number): Promise<KpiReviewDetail> {
			const res = await authFetch<ApiResponse<KpiReviewDetail>>(`/v1/kpi/reviews/${id}`);
			return res.data;
		},
		async evidence(id: number, lineId: number): Promise<KpiEvidence> {
			const res = await authFetch<ApiResponse<KpiEvidence>>(`/v1/kpi/reviews/${id}/lines/${lineId}/evidence`);
			return res.data;
		},
		async updateLine(id: number, lineId: number, body: UpdateKpiLineBody): Promise<KpiReviewDetail> {
			const res = await authFetch<ApiResponse<KpiReviewDetail>>(`/v1/kpi/reviews/${id}/lines/${lineId}`, { method: 'PATCH', body });
			return res.data;
		},
		async submit(id: number, comment?: string): Promise<KpiReviewDetail> {
			const res = await authFetch<ApiResponse<KpiReviewDetail>>(`/v1/kpi/reviews/${id}/submit`, {
				method: 'POST',
				body: cleanQuery({ comment }),
			});
			return res.data;
		},
		async feedback(id: number, body: { agreed: boolean; feedback?: string }): Promise<KpiReviewDetail> {
			const res = await authFetch<ApiResponse<KpiReviewDetail>>(`/v1/kpi/reviews/${id}/feedback`, { method: 'POST', body });
			return res.data;
		},
		async finalize(id: number): Promise<KpiReviewDetail> {
			const res = await authFetch<ApiResponse<KpiReviewDetail>>(`/v1/kpi/reviews/${id}/finalize`, { method: 'POST' });
			return res.data;
		},
		async publish(id: number): Promise<KpiReviewDetail> {
			const res = await authFetch<ApiResponse<KpiReviewDetail>>(`/v1/kpi/reviews/${id}/publish`, { method: 'POST' });
			return res.data;
		},
		async reopen(id: number, reason: string): Promise<KpiReviewDetail> {
			const res = await authFetch<ApiResponse<KpiReviewDetail>>(`/v1/kpi/reviews/${id}/reopen`, { method: 'POST', body: { reason } });
			return res.data;
		},
		async changeReviewer(id: number, body: { reviewerId: number; reason?: string }): Promise<KpiReviewDetail> {
			const res = await authFetch<ApiResponse<KpiReviewDetail>>(`/v1/kpi/reviews/${id}/reviewer`, { method: 'PATCH', body });
			return res.data;
		},
	};
};
