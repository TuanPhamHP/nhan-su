import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedResponse } from '~/types/api.types';
import type {
	AddToJobBody,
	Availability,
	ApplicationQueryParams,
	CandidateQueryParams,
	CreateCandidateBody,
	CreateCommentBody,
	CreateHeadcountPlanBody,
	CreateInterviewBody,
	CreateJobBody,
	CreateOfferBody,
	CreateRecruitmentTemplateBody,
	CreateRequisitionBody,
	FunnelQuery,
	HeadcountChange,
	HeadcountRow,
	InterviewQueryParams,
	JobQueryParams,
	OfferQueryParams,
	PipelineTemplate,
	RecordConsentBody,
	RecordOfferResponseBody,
	RecruitInbox,
	RecruitInboxCounts,
	RecruitmentApplicationCard,
	RecruitmentApplicationDetail,
	RecruitmentApplicationView,
	RecruitmentBulkCvResult,
	RecruitmentBulkResult,
	RecruitmentCandidateDetail,
	RecruitmentCandidateFile,
	RecruitmentCandidateListItem,
	RecruitmentComment,
	RecruitmentCostRow,
	RecruitmentDashboard,
	RecruitmentDuplicateMatch,
	RecruitmentEmailLog,
	RecruitmentFunnel,
	RecruitmentImportResult,
	RecruitmentInterview,
	RecruitmentJob,
	RecruitmentOffer,
	RecruitmentReason,
	RecruitmentScorecard,
	RecruitmentSettings,
	RecruitmentSmtp,
	RecruitmentSource,
	RecruitmentSourceRow,
	RecruitmentStageScorecards,
	RecruitmentTag,
	RecruitmentTeamMember,
	RecruitmentTemplate,
	RecruitmentTemplateVariables,
	RecruitmentTestResult,
	RecruitmentTimeToHire,
	RecruitmentTimelineEvent,
	RejectApplicationBody,
	Requisition,
	RequisitionQueryParams,
	RequestScorecardBody,
	SaveHeadcountQuantityBody,
	SaveJobTeamBody,
	SavePipelineTemplateBody,
	SaveRecruitmentReasonBody,
	SaveRecruitmentSourceBody,
	SaveRecruitmentTagBody,
	SaveScorecardTemplateBody,
	SaveSmtpBody,
	SaveTestResultsBody,
	ScorecardTemplate,
	SendCandidateEmailBody,
	SendOfferBody,
	SourceReportQuery,
	StageInput,
	TimeToHireQuery,
	UpdateCandidateBody,
	UpdateJobBody,
	UpdateOfferBody,
	UpdateRecruitmentSettingsBody,
	UpdateRecruitmentTemplateBody,
	UpdateRequisitionBody,
} from '~/types/recruitment.types';

/**
 * Form thêm ứng viên: `multipart/form-data` vì có thể kèm CV.
 *
 * `FormData` chỉ nhận chuỗi, nên số và boolean phải đổi tay; bỏ trống trường nào thì KHÔNG
 * append, vì BE coi `""` là "không gửi" nhưng vẫn đếm nó vào validate ở vài chỗ.
 */
function candidateFormData(body: CreateCandidateBody): FormData {
	const form = new FormData();
	form.append('fullName', body.fullName);
	form.append('consentBasis', body.consentBasis);
	if (body.email) form.append('email', body.email);
	if (body.phone) form.append('phone', body.phone);
	if (body.consentNote) form.append('consentNote', body.consentNote);
	if (body.talentPoolConsent) form.append('talentPoolConsent', 'true');
	if (body.jobId != null) form.append('jobId', String(body.jobId));
	if (body.sourceId != null) form.append('sourceId', String(body.sourceId));
	// BE nhận cả ba kiểu (JSON, "1,2", lặp trường); chọn JSON vì nó không mập mờ khi chỉ có một id.
	if (body.tagIds?.length) form.append('tagIds', JSON.stringify(body.tagIds));
	if (body.dateOfBirth) form.append('dateOfBirth', body.dateOfBirth);
	if (body.gender) form.append('gender', body.gender);
	if (body.address) form.append('address', body.address);
	if (body.educationLevel) form.append('educationLevel', body.educationLevel);
	if (body.school) form.append('school', body.school);
	if (body.yearsOfExperience != null) form.append('yearsOfExperience', String(body.yearsOfExperience));
	if (body.currentTitle) form.append('currentTitle', body.currentTitle);
	if (body.currentCompany) form.append('currentCompany', body.currentCompany);
	if (body.linkedinUrl) form.append('linkedinUrl', body.linkedinUrl);
	if (body.portfolioUrl) form.append('portfolioUrl', body.portfolioUrl);
	if (body.expectedSalary != null) form.append('expectedSalary', String(body.expectedSalary));
	if (body.cv) form.append('cv', body.cv);
	return form;
}

/**
 * Trang quản lý tuyển dụng — `/v1/recruitment/*`.
 *
 * Mọi route ở đây đòi vai trò ADMIN, HR, DIRECTOR, MANAGER hoặc CHIEF; vai trò EMPLOYEE
 * nhận 403 kể cả khi được gán permission. Thành viên hội đồng mang vai trò EMPLOYEE dùng
 * nhóm `/v1/me/recruitment/*` (service riêng), trang công khai dùng fetcher không gắn
 * token. Xem `docs/backend/bridges/recruitment.md`.
 */
export const useRecruitmentService = () => {
	const authFetch = useAuthFetch();

	return {
		// ─── Tổng quan và báo cáo ─────────────────────────────────────────────────

		async dashboard(year: number): Promise<RecruitmentDashboard> {
			const res = await authFetch<ApiResponse<RecruitmentDashboard>>('/v1/recruitment/dashboard', {
				params: { year },
			});
			return res.data;
		},

		async funnelReport(params?: FunnelQuery): Promise<RecruitmentFunnel> {
			const res = await authFetch<ApiResponse<RecruitmentFunnel>>('/v1/recruitment/reports/funnel', {
				params,
			});
			return res.data;
		},

		async exportFunnel(params?: FunnelQuery): Promise<Blob> {
			return authFetch<Blob>('/v1/recruitment/reports/funnel/export', {
				params,
				responseType: 'blob',
			});
		},

		async sourceReport(params?: SourceReportQuery): Promise<RecruitmentSourceRow[]> {
			const res = await authFetch<ApiResponse<RecruitmentSourceRow[]>>(
				'/v1/recruitment/reports/sources',
				{ params },
			);
			return res.data;
		},

		async exportSourceReport(params?: SourceReportQuery): Promise<Blob> {
			return authFetch<Blob>('/v1/recruitment/reports/sources/export', {
				params,
				responseType: 'blob',
			});
		},

		async headcountReport(params: { year: number; departmentId?: number }): Promise<HeadcountRow[]> {
			const res = await authFetch<ApiResponse<HeadcountRow[]>>('/v1/recruitment/reports/headcount', {
				params,
			});
			return res.data;
		},

		async exportHeadcountReport(params: { year: number; departmentId?: number }): Promise<Blob> {
			return authFetch<Blob>('/v1/recruitment/reports/headcount/export', {
				params,
				responseType: 'blob',
			});
		},

		async timeToHireReport(params?: TimeToHireQuery): Promise<RecruitmentTimeToHire> {
			const res = await authFetch<ApiResponse<RecruitmentTimeToHire>>(
				'/v1/recruitment/reports/time-to-hire',
				{ params },
			);
			return res.data;
		},

		async costReport(params?: { from?: string; to?: string }): Promise<RecruitmentCostRow[]> {
			const res = await authFetch<ApiResponse<RecruitmentCostRow[]>>('/v1/recruitment/reports/costs', {
				params,
			});
			return res.data;
		},

		async exportCostReport(params?: { from?: string; to?: string }): Promise<Blob> {
			return authFetch<Blob>('/v1/recruitment/reports/costs/export', {
				params,
				responseType: 'blob',
			});
		},

		// ─── Định biên ────────────────────────────────────────────────────────────

		async findHeadcountPlans(params: { year: number; departmentId?: number }): Promise<HeadcountRow[]> {
			const res = await authFetch<ApiResponse<HeadcountRow[]>>('/v1/recruitment/headcount-plans', {
				params,
			});
			return res.data;
		},

		async createHeadcountPlan(body: CreateHeadcountPlanBody): Promise<HeadcountRow> {
			const res = await authFetch<ApiResponse<HeadcountRow>>('/v1/recruitment/headcount-plans', {
				method: 'POST',
				body,
			});
			return res.data;
		},

		async saveHeadcountProposal(id: number, body: SaveHeadcountQuantityBody): Promise<HeadcountRow> {
			const res = await authFetch<ApiResponse<HeadcountRow>>(
				`/v1/recruitment/headcount-plans/${id}/proposal`,
				{ method: 'PATCH', body },
			);
			return res.data;
		},

		async saveConfirmedHeadcount(id: number, body: SaveHeadcountQuantityBody): Promise<HeadcountRow> {
			const res = await authFetch<ApiResponse<HeadcountRow>>(
				`/v1/recruitment/headcount-plans/${id}/confirmed`,
				{ method: 'PATCH', body },
			);
			return res.data;
		},

		async submitHeadcount(ids: number[]): Promise<HeadcountRow[]> {
			const res = await authFetch<ApiResponse<HeadcountRow[]>>(
				'/v1/recruitment/headcount-plans/submit',
				{ method: 'POST', body: { ids } },
			);
			return res.data;
		},

		async confirmHeadcount(ids: number[], reason?: string): Promise<HeadcountRow[]> {
			const res = await authFetch<ApiResponse<HeadcountRow[]>>(
				'/v1/recruitment/headcount-plans/confirm',
				{ method: 'POST', body: { ids, reason } },
			);
			return res.data;
		},

		async rejectHeadcount(ids: number[], reason: string): Promise<HeadcountRow[]> {
			const res = await authFetch<ApiResponse<HeadcountRow[]>>(
				'/v1/recruitment/headcount-plans/reject',
				{ method: 'POST', body: { ids, reason } },
			);
			return res.data;
		},

		/**
		 * Rút đề xuất Nháp hoặc Bị trả lại của một dòng ĐÃ CHỐT: số đã chốt giữ nguyên, lịch sử
		 * ghi `WITHDRAWN`. Dòng chưa từng chốt thì không có gì để rút, phải xoá cả dòng.
		 */
		async withdrawHeadcountProposal(id: number): Promise<HeadcountRow> {
			const res = await authFetch<ApiResponse<HeadcountRow>>(
				`/v1/recruitment/headcount-plans/${id}/proposal`,
				{ method: 'DELETE' },
			);
			return res.data;
		},

		/**
		 * Xoá hẳn dòng định biên cùng lịch sử.
		 *
		 * `reason` bắt buộc khi dòng đã chốt đang có người hoặc đang có yêu cầu tuyển; thiếu thì
		 * BE trả 400 `RECRUIT_REASON_REQUIRED`. Dòng khác gửi kèm cũng được, nhật ký vẫn lưu.
		 */
		async deleteHeadcountPlan(id: number, reason?: string): Promise<void> {
			await authFetch<void>(`/v1/recruitment/headcount-plans/${id}`, {
				method: 'DELETE',
				body: reason ? { reason } : undefined,
			});
		},

		async headcountChanges(id: number): Promise<HeadcountChange[]> {
			const res = await authFetch<ApiResponse<HeadcountChange[]>>(
				`/v1/recruitment/headcount-plans/${id}/changes`,
			);
			return res.data;
		},

		// ─── Yêu cầu tuyển dụng ───────────────────────────────────────────────────

		async findRequisitions(params?: RequisitionQueryParams): Promise<PaginatedResponse<Requisition>> {
			return authFetch<PaginatedResponse<Requisition>>('/v1/recruitment/requisitions', { params });
		},

		/**
		 * Còn trống của (vị trí, năm). Route này được khai TRƯỚC `/:id` ở BE nên gọi
		 * đường dẫn tĩnh là đúng, không phải là id.
		 */
		async availability(params: {
			positionId: number;
			year: number;
			excludeId?: number;
		}): Promise<Availability> {
			const res = await authFetch<ApiResponse<Availability>>(
				'/v1/recruitment/requisitions/availability',
				{ params },
			);
			return res.data;
		},

		async findRequisition(id: number): Promise<Requisition> {
			const res = await authFetch<ApiResponse<Requisition>>(`/v1/recruitment/requisitions/${id}`);
			return res.data;
		},

		async requisitionJdUrl(id: number): Promise<string | null> {
			const res = await authFetch<ApiResponse<{ url: string | null }>>(
				`/v1/recruitment/requisitions/${id}/jd-url`,
			);
			return res.data.url;
		},

		async createRequisition(body: CreateRequisitionBody): Promise<Requisition> {
			const res = await authFetch<ApiResponse<Requisition>>('/v1/recruitment/requisitions', {
				method: 'POST',
				body,
			});
			return res.data;
		},

		async updateRequisition(id: number, body: UpdateRequisitionBody): Promise<Requisition> {
			const res = await authFetch<ApiResponse<Requisition>>(`/v1/recruitment/requisitions/${id}`, {
				method: 'PATCH',
				body,
			});
			return res.data;
		},

		async uploadRequisitionJd(id: number, file: File): Promise<Requisition> {
			const form = new FormData();
			form.append('file', file);
			const res = await authFetch<ApiResponse<Requisition>>(`/v1/recruitment/requisitions/${id}/jd`, {
				method: 'POST',
				body: form,
			});
			return res.data;
		},

		async submitRequisition(id: number): Promise<Requisition> {
			const res = await authFetch<ApiResponse<Requisition>>(
				`/v1/recruitment/requisitions/${id}/submit`,
				{ method: 'POST' },
			);
			return res.data;
		},

		async approveRequisition(id: number, note?: string): Promise<Requisition> {
			const res = await authFetch<ApiResponse<Requisition>>(
				`/v1/recruitment/requisitions/${id}/approve`,
				{ method: 'POST', body: note ? { note } : {} },
			);
			return res.data;
		},

		/** Lý do từ chối gửi ở trường `note`, KHÔNG phải `reason`. */
		async rejectRequisition(id: number, note: string): Promise<Requisition> {
			const res = await authFetch<ApiResponse<Requisition>>(
				`/v1/recruitment/requisitions/${id}/reject`,
				{ method: 'POST', body: { note } },
			);
			return res.data;
		},

		/** Huỷ yêu cầu — ở route này trường lý do lại tên `reason`. */
		async cancelRequisition(id: number, reason: string): Promise<Requisition> {
			const res = await authFetch<ApiResponse<Requisition>>(
				`/v1/recruitment/requisitions/${id}/cancel`,
				{ method: 'POST', body: { reason } },
			);
			return res.data;
		},

		async deleteRequisition(id: number): Promise<void> {
			await authFetch<void>(`/v1/recruitment/requisitions/${id}`, { method: 'DELETE' });
		},

		// ─── Hộp việc chờ duyệt ───────────────────────────────────────────────────

		async approvalInbox(type?: 'REQUISITION' | 'OFFER'): Promise<RecruitInbox> {
			const res = await authFetch<ApiResponse<RecruitInbox>>('/v1/recruitment/approvals', {
				params: type ? { type } : undefined,
			});
			return res.data;
		},

		async approvalCounts(): Promise<RecruitInboxCounts> {
			const res = await authFetch<ApiResponse<RecruitInboxCounts>>('/v1/recruitment/approvals/counts');
			return res.data;
		},

		// ─── Tin tuyển dụng ───────────────────────────────────────────────────────

		async findJobs(params?: JobQueryParams): Promise<PaginatedResponse<RecruitmentJob>> {
			return authFetch<PaginatedResponse<RecruitmentJob>>('/v1/recruitment/jobs', { params });
		},

		async findJob(id: number): Promise<RecruitmentJob> {
			const res = await authFetch<ApiResponse<RecruitmentJob>>(`/v1/recruitment/jobs/${id}`);
			return res.data;
		},

		async createJob(body: CreateJobBody): Promise<RecruitmentJob> {
			const res = await authFetch<ApiResponse<RecruitmentJob>>('/v1/recruitment/jobs', {
				method: 'POST',
				body,
			});
			return res.data;
		},

		async updateJob(id: number, body: UpdateJobBody): Promise<RecruitmentJob> {
			const res = await authFetch<ApiResponse<RecruitmentJob>>(`/v1/recruitment/jobs/${id}`, {
				method: 'PATCH',
				body,
			});
			return res.data;
		},

		async openJob(id: number): Promise<RecruitmentJob> {
			const res = await authFetch<ApiResponse<RecruitmentJob>>(`/v1/recruitment/jobs/${id}/open`, {
				method: 'POST',
			});
			return res.data;
		},

		async pauseJob(id: number): Promise<RecruitmentJob> {
			const res = await authFetch<ApiResponse<RecruitmentJob>>(`/v1/recruitment/jobs/${id}/pause`, {
				method: 'POST',
			});
			return res.data;
		},

		async closeJob(id: number): Promise<RecruitmentJob> {
			const res = await authFetch<ApiResponse<RecruitmentJob>>(`/v1/recruitment/jobs/${id}/close`, {
				method: 'POST',
			});
			return res.data;
		},

		async deleteJob(id: number): Promise<void> {
			await authFetch<void>(`/v1/recruitment/jobs/${id}`, { method: 'DELETE' });
		},

		/** Thay danh sách vòng. Gửi kèm `id` của vòng đang có để GIỮ vòng đó. */
		async saveJobStages(id: number, stages: StageInput[]): Promise<RecruitmentJob> {
			const res = await authFetch<ApiResponse<RecruitmentJob>>(`/v1/recruitment/jobs/${id}/stages`, {
				method: 'PUT',
				body: { stages },
			});
			return res.data;
		},

		async findJobTeam(id: number): Promise<RecruitmentTeamMember[]> {
			const res = await authFetch<ApiResponse<RecruitmentTeamMember[]>>(
				`/v1/recruitment/jobs/${id}/team`,
			);
			return res.data;
		},

		/** Thay TOÀN BỘ hội đồng: người không có trong mảng bị gỡ, kể cả trưởng phòng tự thêm. */
		async saveJobTeam(id: number, body: SaveJobTeamBody): Promise<RecruitmentJob> {
			const res = await authFetch<ApiResponse<RecruitmentJob>>(`/v1/recruitment/jobs/${id}/team`, {
				method: 'PUT',
				body,
			});
			return res.data;
		},

		// ─── Hồ sơ ứng tuyển ──────────────────────────────────────────────────────

		async findJobApplications(
			jobId: number,
			params?: ApplicationQueryParams,
		): Promise<RecruitmentApplicationCard[]> {
			const res = await authFetch<ApiResponse<RecruitmentApplicationCard[]>>(
				`/v1/recruitment/jobs/${jobId}/applications`,
				{ params },
			);
			return res.data;
		},

		async exportJobApplications(jobId: number, params?: ApplicationQueryParams): Promise<Blob> {
			return authFetch<Blob>(`/v1/recruitment/jobs/${jobId}/applications/export`, {
				params,
				responseType: 'blob',
			});
		},

		async findApplication(id: number): Promise<RecruitmentApplicationView> {
			const res = await authFetch<ApiResponse<RecruitmentApplicationView>>(
				`/v1/recruitment/applications/${id}`,
			);
			return res.data;
		},

		async moveApplication(id: number, stageId: number): Promise<RecruitmentApplicationDetail> {
			const res = await authFetch<ApiResponse<RecruitmentApplicationDetail>>(
				`/v1/recruitment/applications/${id}/move`,
				{ method: 'POST', body: { stageId } },
			);
			return res.data;
		},

		async bulkMoveApplications(
			applicationIds: number[],
			stageId: number,
		): Promise<RecruitmentBulkResult[]> {
			const res = await authFetch<ApiResponse<RecruitmentBulkResult[]>>(
				'/v1/recruitment/applications/bulk-move',
				{ method: 'POST', body: { applicationIds, stageId } },
			);
			return res.data;
		},

		async rejectApplication(
			id: number,
			body: RejectApplicationBody,
		): Promise<RecruitmentApplicationDetail> {
			const res = await authFetch<ApiResponse<RecruitmentApplicationDetail>>(
				`/v1/recruitment/applications/${id}/reject`,
				{ method: 'POST', body },
			);
			return res.data;
		},

		async bulkRejectApplications(
			applicationIds: number[],
			body: RejectApplicationBody,
		): Promise<RecruitmentBulkResult[]> {
			const res = await authFetch<ApiResponse<RecruitmentBulkResult[]>>(
				'/v1/recruitment/applications/bulk-reject',
				{ method: 'POST', body: { ...body, applicationIds } },
			);
			return res.data;
		},

		async withdrawApplication(id: number, note?: string): Promise<RecruitmentApplicationDetail> {
			const res = await authFetch<ApiResponse<RecruitmentApplicationDetail>>(
				`/v1/recruitment/applications/${id}/withdraw`,
				{ method: 'POST', body: note ? { note } : {} },
			);
			return res.data;
		},

		async reopenApplication(id: number): Promise<RecruitmentApplicationDetail> {
			const res = await authFetch<ApiResponse<RecruitmentApplicationDetail>>(
				`/v1/recruitment/applications/${id}/reopen`,
				{ method: 'POST' },
			);
			return res.data;
		},

		// ─── Ứng viên ─────────────────────────────────────────────────────────────

		async findCandidates(
			params?: CandidateQueryParams,
		): Promise<PaginatedResponse<RecruitmentCandidateListItem>> {
			return authFetch<PaginatedResponse<RecruitmentCandidateListItem>>('/v1/recruitment/candidates', {
				params,
			});
		},

		/** Trả 200 (không phải 201) và vẫn chạy khi module chỉ xem. */
		async checkDuplicates(body: {
			email?: string;
			phone?: string;
		}): Promise<RecruitmentDuplicateMatch[]> {
			const res = await authFetch<ApiResponse<RecruitmentDuplicateMatch[]>>(
				'/v1/recruitment/candidates/check-duplicates',
				{ method: 'POST', body },
			);
			return res.data;
		},

		async findCandidate(id: number): Promise<RecruitmentCandidateDetail> {
			const res = await authFetch<ApiResponse<RecruitmentCandidateDetail>>(
				`/v1/recruitment/candidates/${id}`,
			);
			return res.data;
		},

		async createCandidate(body: CreateCandidateBody): Promise<RecruitmentCandidateDetail> {
			const res = await authFetch<ApiResponse<RecruitmentCandidateDetail>>(
				'/v1/recruitment/candidates',
				{ method: 'POST', body: candidateFormData(body) },
			);
			return res.data;
		},

		async updateCandidate(
			id: number,
			body: UpdateCandidateBody,
		): Promise<RecruitmentCandidateDetail> {
			const res = await authFetch<ApiResponse<RecruitmentCandidateDetail>>(
				`/v1/recruitment/candidates/${id}`,
				{ method: 'PATCH', body },
			);
			return res.data;
		},

		/**
		 * Gộp trùng. Bản được GIỮ là bản tạo sau, nên `data.id` có thể khác `id` ở đường
		 * dẫn: nơi gọi phải điều hướng theo `data.id`.
		 */
		async mergeCandidates(id: number, sourceId: number): Promise<RecruitmentCandidateDetail> {
			const res = await authFetch<ApiResponse<RecruitmentCandidateDetail>>(
				`/v1/recruitment/candidates/${id}/merge`,
				{ method: 'POST', body: { sourceId } },
			);
			return res.data;
		},

		async blacklistCandidate(id: number, reason: string): Promise<RecruitmentCandidateDetail> {
			const res = await authFetch<ApiResponse<RecruitmentCandidateDetail>>(
				`/v1/recruitment/candidates/${id}/blacklist`,
				{ method: 'POST', body: { reason } },
			);
			return res.data;
		},

		/** Route gỡ là `DELETE` CÓ body — `ofetch` hỗ trợ, đừng đổi sang query. */
		async unblacklistCandidate(id: number, note: string): Promise<RecruitmentCandidateDetail> {
			const res = await authFetch<ApiResponse<RecruitmentCandidateDetail>>(
				`/v1/recruitment/candidates/${id}/blacklist`,
				{ method: 'DELETE', body: { note } },
			);
			return res.data;
		},

		async addToTalentPool(id: number): Promise<RecruitmentCandidateDetail> {
			const res = await authFetch<ApiResponse<RecruitmentCandidateDetail>>(
				`/v1/recruitment/candidates/${id}/talent-pool`,
				{ method: 'POST' },
			);
			return res.data;
		},

		async removeFromTalentPool(id: number): Promise<RecruitmentCandidateDetail> {
			const res = await authFetch<ApiResponse<RecruitmentCandidateDetail>>(
				`/v1/recruitment/candidates/${id}/talent-pool`,
				{ method: 'DELETE' },
			);
			return res.data;
		},

		async recordConsent(id: number, body: RecordConsentBody): Promise<RecruitmentCandidateDetail> {
			const res = await authFetch<ApiResponse<RecruitmentCandidateDetail>>(
				`/v1/recruitment/candidates/${id}/consents`,
				{ method: 'POST', body },
			);
			return res.data;
		},

		/** Thay TOÀN BỘ tag; mảng rỗng là gỡ hết. */
		async saveCandidateTags(id: number, tagIds: number[]): Promise<RecruitmentCandidateDetail> {
			const res = await authFetch<ApiResponse<RecruitmentCandidateDetail>>(
				`/v1/recruitment/candidates/${id}/tags`,
				{ method: 'PUT', body: { tagIds } },
			);
			return res.data;
		},

		async addCandidateToJob(id: number, body: AddToJobBody): Promise<RecruitmentApplicationDetail> {
			const res = await authFetch<ApiResponse<RecruitmentApplicationDetail>>(
				`/v1/recruitment/candidates/${id}/applications`,
				{ method: 'POST', body },
			);
			return res.data;
		},

		async anonymizeCandidate(id: number, reason: string): Promise<void> {
			await authFetch<void>(`/v1/recruitment/candidates/${id}/anonymize`, {
				method: 'POST',
				body: { reason },
			});
		},

		async candidateTimeline(id: number): Promise<RecruitmentTimelineEvent[]> {
			const res = await authFetch<ApiResponse<RecruitmentTimelineEvent[]>>(
				`/v1/recruitment/candidates/${id}/timeline`,
			);
			return res.data;
		},

		async candidateComments(id: number): Promise<RecruitmentComment[]> {
			const res = await authFetch<ApiResponse<RecruitmentComment[]>>(
				`/v1/recruitment/candidates/${id}/comments`,
			);
			return res.data;
		},

		async addCandidateComment(id: number, body: CreateCommentBody): Promise<RecruitmentComment> {
			const res = await authFetch<ApiResponse<RecruitmentComment>>(
				`/v1/recruitment/candidates/${id}/comments`,
				{ method: 'POST', body },
			);
			return res.data;
		},

		async candidateEmails(id: number): Promise<RecruitmentEmailLog[]> {
			const res = await authFetch<ApiResponse<RecruitmentEmailLog[]>>(
				`/v1/recruitment/candidates/${id}/emails`,
			);
			return res.data;
		},

		async sendCandidateEmail(
			id: number,
			body: SendCandidateEmailBody,
		): Promise<RecruitmentEmailLog> {
			const res = await authFetch<ApiResponse<RecruitmentEmailLog>>(
				`/v1/recruitment/candidates/${id}/emails`,
				{ method: 'POST', body },
			);
			return res.data;
		},

		async cancelEmail(emailLogId: number): Promise<void> {
			await authFetch<void>(`/v1/recruitment/emails/${emailLogId}/cancel`, { method: 'POST' });
		},

		async uploadCandidateFile(
			id: number,
			file: File,
			kind: 'CV' | 'OTHER',
		): Promise<RecruitmentCandidateFile> {
			const form = new FormData();
			form.append('file', file);
			form.append('kind', kind);
			const res = await authFetch<ApiResponse<RecruitmentCandidateFile>>(
				`/v1/recruitment/candidates/${id}/files`,
				{ method: 'POST', body: form },
			);
			return res.data;
		},

		/** Link có hạn 10 phút: gọi lúc bấm, mở ngay, đừng lưu lại. */
		async candidateFileUrl(fileId: number): Promise<string | null> {
			const res = await authFetch<ApiResponse<{ url: string | null }>>(
				`/v1/recruitment/candidate-files/${fileId}/url`,
			);
			return res.data.url;
		},

		async downloadCandidateImportTemplate(): Promise<Blob> {
			return authFetch<Blob>('/v1/recruitment/candidate-imports/template', {
				responseType: 'blob',
			});
		},

		async importCandidates(file: File): Promise<RecruitmentImportResult> {
			const form = new FormData();
			form.append('file', file);
			const res = await authFetch<ApiResponse<RecruitmentImportResult>>(
				'/v1/recruitment/candidate-imports',
				{ method: 'POST', body: form },
			);
			return res.data;
		},

		/** Mỗi file thành một ứng viên nháp. Trường file lặp lại tên `files`. */
		async uploadBulkCv(files: File[], jobId?: number): Promise<RecruitmentBulkCvResult[]> {
			const form = new FormData();
			for (const f of files) form.append('files', f);
			if (jobId != null) form.append('jobId', String(jobId));
			const res = await authFetch<ApiResponse<RecruitmentBulkCvResult[]>>(
				'/v1/recruitment/candidates/bulk-cv',
				{ method: 'POST', body: form },
			);
			return res.data;
		},

		// ─── Phỏng vấn và đánh giá ────────────────────────────────────────────────

		async findInterviews(params: InterviewQueryParams): Promise<RecruitmentInterview[]> {
			const res = await authFetch<ApiResponse<RecruitmentInterview[]>>('/v1/recruitment/interviews', {
				params,
			});
			return res.data;
		},

		async findInterview(id: number): Promise<RecruitmentInterview> {
			const res = await authFetch<ApiResponse<RecruitmentInterview>>(
				`/v1/recruitment/interviews/${id}`,
			);
			return res.data;
		},

		async scheduleInterview(
			applicationId: number,
			body: CreateInterviewBody,
		): Promise<RecruitmentInterview> {
			const res = await authFetch<ApiResponse<RecruitmentInterview>>(
				`/v1/recruitment/applications/${applicationId}/interviews`,
				{ method: 'POST', body },
			);
			return res.data;
		},

		async updateInterview(id: number, body: Partial<CreateInterviewBody>): Promise<RecruitmentInterview> {
			const res = await authFetch<ApiResponse<RecruitmentInterview>>(
				`/v1/recruitment/interviews/${id}`,
				{ method: 'PATCH', body },
			);
			return res.data;
		},

		async cancelInterview(id: number): Promise<RecruitmentInterview> {
			const res = await authFetch<ApiResponse<RecruitmentInterview>>(
				`/v1/recruitment/interviews/${id}/cancel`,
				{ method: 'POST' },
			);
			return res.data;
		},

		async setInterviewStatus(id: number, status: 'DONE' | 'NO_SHOW'): Promise<RecruitmentInterview> {
			const res = await authFetch<ApiResponse<RecruitmentInterview>>(
				`/v1/recruitment/interviews/${id}/status`,
				{ method: 'POST', body: { status } },
			);
			return res.data;
		},

		async applicationScorecards(applicationId: number): Promise<RecruitmentStageScorecards[]> {
			const res = await authFetch<ApiResponse<RecruitmentStageScorecards[]>>(
				`/v1/recruitment/applications/${applicationId}/scorecards`,
			);
			return res.data;
		},

		async requestScorecard(body: RequestScorecardBody): Promise<RecruitmentScorecard> {
			const res = await authFetch<ApiResponse<RecruitmentScorecard>>(
				'/v1/recruitment/scorecards/request',
				{ method: 'POST', body },
			);
			return res.data;
		},

		async saveTestResults(body: SaveTestResultsBody): Promise<RecruitmentTestResult[]> {
			const res = await authFetch<ApiResponse<RecruitmentTestResult[]>>(
				'/v1/recruitment/test-results',
				{ method: 'POST', body },
			);
			return res.data;
		},

		// ─── Offer ────────────────────────────────────────────────────────────────

		async findOffers(params?: OfferQueryParams): Promise<PaginatedResponse<RecruitmentOffer>> {
			return authFetch<PaginatedResponse<RecruitmentOffer>>('/v1/recruitment/offers', { params });
		},

		async findOffer(id: number): Promise<RecruitmentOffer> {
			const res = await authFetch<ApiResponse<RecruitmentOffer>>(`/v1/recruitment/offers/${id}`);
			return res.data;
		},

		async createOffer(applicationId: number, body: CreateOfferBody): Promise<RecruitmentOffer> {
			const res = await authFetch<ApiResponse<RecruitmentOffer>>(
				`/v1/recruitment/applications/${applicationId}/offers`,
				{ method: 'POST', body },
			);
			return res.data;
		},

		async updateOffer(id: number, body: UpdateOfferBody): Promise<RecruitmentOffer> {
			const res = await authFetch<ApiResponse<RecruitmentOffer>>(`/v1/recruitment/offers/${id}`, {
				method: 'PATCH',
				body,
			});
			return res.data;
		},

		/** PDF sinh tại chỗ, không lưu — mở bằng `URL.createObjectURL`. */
		async offerPreviewPdf(id: number): Promise<Blob> {
			return authFetch<Blob>(`/v1/recruitment/offers/${id}/preview.pdf`, { responseType: 'blob' });
		},

		/** Link 10 phút tới bản PDF ĐÃ GỬI ứng viên; chỉ có khi `hasSentPdf`. */
		async offerPdfUrl(id: number): Promise<string | null> {
			const res = await authFetch<ApiResponse<{ url: string | null }>>(
				`/v1/recruitment/offers/${id}/pdf-url`,
			);
			return res.data.url;
		},

		async submitOffer(id: number): Promise<RecruitmentOffer> {
			const res = await authFetch<ApiResponse<RecruitmentOffer>>(
				`/v1/recruitment/offers/${id}/submit`,
				{ method: 'POST' },
			);
			return res.data;
		},

		async approveOffer(id: number, note?: string): Promise<RecruitmentOffer> {
			const res = await authFetch<ApiResponse<RecruitmentOffer>>(
				`/v1/recruitment/offers/${id}/approve`,
				{ method: 'POST', body: note ? { note } : {} },
			);
			return res.data;
		},

		async rejectOffer(id: number, note: string): Promise<RecruitmentOffer> {
			const res = await authFetch<ApiResponse<RecruitmentOffer>>(
				`/v1/recruitment/offers/${id}/reject`,
				{ method: 'POST', body: { note } },
			);
			return res.data;
		},

		async sendOffer(id: number, body?: SendOfferBody): Promise<RecruitmentOffer> {
			const res = await authFetch<ApiResponse<RecruitmentOffer>>(`/v1/recruitment/offers/${id}/send`, {
				method: 'POST',
				body: body ?? {},
			});
			return res.data;
		},

		/** Phiên bản mới có `id` KHÁC bản cũ: nơi gọi điều hướng sang id mới. */
		async reviseOffer(id: number): Promise<RecruitmentOffer> {
			const res = await authFetch<ApiResponse<RecruitmentOffer>>(
				`/v1/recruitment/offers/${id}/revise`,
				{ method: 'POST' },
			);
			return res.data;
		},

		async recordOfferResponse(
			id: number,
			body: RecordOfferResponseBody,
		): Promise<RecruitmentOffer> {
			const res = await authFetch<ApiResponse<RecruitmentOffer>>(
				`/v1/recruitment/offers/${id}/record-response`,
				{ method: 'POST', body },
			);
			return res.data;
		},

		async cancelOffer(id: number, reason: string): Promise<RecruitmentOffer> {
			const res = await authFetch<ApiResponse<RecruitmentOffer>>(
				`/v1/recruitment/offers/${id}/cancel`,
				{ method: 'POST', body: { reason } },
			);
			return res.data;
		},

		async markOfferNoShow(id: number, reason: string): Promise<RecruitmentOffer> {
			const res = await authFetch<ApiResponse<RecruitmentOffer>>(
				`/v1/recruitment/offers/${id}/no-show`,
				{ method: 'POST', body: { reason } },
			);
			return res.data;
		},

		async hireFromOffer(id: number, existingEmployeeId?: number): Promise<RecruitmentOffer> {
			const res = await authFetch<ApiResponse<RecruitmentOffer>>(`/v1/recruitment/offers/${id}/hire`, {
				method: 'POST',
				body: existingEmployeeId != null ? { existingEmployeeId } : {},
			});
			return res.data;
		},

		// ─── Cài đặt chung ────────────────────────────────────────────────────────

		async settings(): Promise<RecruitmentSettings> {
			const res = await authFetch<ApiResponse<RecruitmentSettings>>('/v1/recruitment/settings');
			return res.data;
		},

		async updateSettings(body: UpdateRecruitmentSettingsBody): Promise<RecruitmentSettings> {
			const res = await authFetch<ApiResponse<RecruitmentSettings>>('/v1/recruitment/settings', {
				method: 'PUT',
				body,
			});
			return res.data;
		},

		// ─── Danh mục ─────────────────────────────────────────────────────────────

		async findSources(activeOnly?: boolean): Promise<RecruitmentSource[]> {
			const res = await authFetch<ApiResponse<RecruitmentSource[]>>('/v1/recruitment/sources', {
				params: activeOnly ? { activeOnly: true } : undefined,
			});
			return res.data;
		},

		async createSource(body: SaveRecruitmentSourceBody): Promise<RecruitmentSource> {
			const res = await authFetch<ApiResponse<RecruitmentSource>>('/v1/recruitment/sources', {
				method: 'POST',
				body,
			});
			return res.data;
		},

		async updateSource(id: number, body: SaveRecruitmentSourceBody): Promise<RecruitmentSource> {
			const res = await authFetch<ApiResponse<RecruitmentSource>>(`/v1/recruitment/sources/${id}`, {
				method: 'PATCH',
				body,
			});
			return res.data;
		},

		async findReasons(params?: {
			kind?: 'REJECTION' | 'OFFER_DECLINE';
			activeOnly?: boolean;
		}): Promise<RecruitmentReason[]> {
			const res = await authFetch<ApiResponse<RecruitmentReason[]>>('/v1/recruitment/reasons', {
				params,
			});
			return res.data;
		},

		async createReason(body: SaveRecruitmentReasonBody): Promise<RecruitmentReason> {
			const res = await authFetch<ApiResponse<RecruitmentReason>>('/v1/recruitment/reasons', {
				method: 'POST',
				body,
			});
			return res.data;
		},

		async updateReason(id: number, body: SaveRecruitmentReasonBody): Promise<RecruitmentReason> {
			const res = await authFetch<ApiResponse<RecruitmentReason>>(`/v1/recruitment/reasons/${id}`, {
				method: 'PATCH',
				body,
			});
			return res.data;
		},

		async findTags(activeOnly?: boolean): Promise<RecruitmentTag[]> {
			const res = await authFetch<ApiResponse<RecruitmentTag[]>>('/v1/recruitment/tags', {
				params: activeOnly ? { activeOnly: true } : undefined,
			});
			return res.data;
		},

		async createTag(body: SaveRecruitmentTagBody): Promise<RecruitmentTag> {
			const res = await authFetch<ApiResponse<RecruitmentTag>>('/v1/recruitment/tags', {
				method: 'POST',
				body,
			});
			return res.data;
		},

		async updateTag(id: number, body: SaveRecruitmentTagBody): Promise<RecruitmentTag> {
			const res = await authFetch<ApiResponse<RecruitmentTag>>(`/v1/recruitment/tags/${id}`, {
				method: 'PATCH',
				body,
			});
			return res.data;
		},

		// ─── Mẫu email, thư mời ───────────────────────────────────────────────────

		async findTemplates(kind?: 'EMAIL' | 'OFFER_LETTER'): Promise<RecruitmentTemplate[]> {
			const res = await authFetch<ApiResponse<RecruitmentTemplate[]>>('/v1/recruitment/templates', {
				params: kind ? { kind } : undefined,
			});
			return res.data;
		},

		async templateVariables(): Promise<RecruitmentTemplateVariables> {
			const res = await authFetch<ApiResponse<RecruitmentTemplateVariables>>(
				'/v1/recruitment/templates/variables',
			);
			return res.data;
		},

		async createTemplate(body: CreateRecruitmentTemplateBody): Promise<RecruitmentTemplate> {
			const res = await authFetch<ApiResponse<RecruitmentTemplate>>('/v1/recruitment/templates', {
				method: 'POST',
				body,
			});
			return res.data;
		},

		async updateTemplate(
			id: number,
			body: UpdateRecruitmentTemplateBody,
		): Promise<RecruitmentTemplate> {
			const res = await authFetch<ApiResponse<RecruitmentTemplate>>(
				`/v1/recruitment/templates/${id}`,
				{ method: 'PATCH', body },
			);
			return res.data;
		},

		// ─── Quy trình mẫu, mẫu đánh giá ──────────────────────────────────────────

		async findPipelineTemplates(activeOnly?: boolean): Promise<PipelineTemplate[]> {
			const res = await authFetch<ApiResponse<PipelineTemplate[]>>(
				'/v1/recruitment/pipeline-templates',
				{ params: activeOnly ? { activeOnly: true } : undefined },
			);
			return res.data;
		},

		async createPipelineTemplate(body: SavePipelineTemplateBody): Promise<PipelineTemplate> {
			const res = await authFetch<ApiResponse<PipelineTemplate>>(
				'/v1/recruitment/pipeline-templates',
				{ method: 'POST', body },
			);
			return res.data;
		},

		/** PUT thay toàn bộ: `id` của vòng đổi sau mỗi lần lưu, tin đã tạo không bị ảnh hưởng. */
		async savePipelineTemplate(id: number, body: SavePipelineTemplateBody): Promise<PipelineTemplate> {
			const res = await authFetch<ApiResponse<PipelineTemplate>>(
				`/v1/recruitment/pipeline-templates/${id}`,
				{ method: 'PUT', body },
			);
			return res.data;
		},

		async findScorecardTemplates(activeOnly?: boolean): Promise<ScorecardTemplate[]> {
			const res = await authFetch<ApiResponse<ScorecardTemplate[]>>(
				'/v1/recruitment/scorecard-templates',
				{ params: activeOnly ? { activeOnly: true } : undefined },
			);
			return res.data;
		},

		async createScorecardTemplate(body: SaveScorecardTemplateBody): Promise<ScorecardTemplate> {
			const res = await authFetch<ApiResponse<ScorecardTemplate>>(
				'/v1/recruitment/scorecard-templates',
				{ method: 'POST', body },
			);
			return res.data;
		},

		async saveScorecardTemplate(
			id: number,
			body: SaveScorecardTemplateBody,
		): Promise<ScorecardTemplate> {
			const res = await authFetch<ApiResponse<ScorecardTemplate>>(
				`/v1/recruitment/scorecard-templates/${id}`,
				{ method: 'PUT', body },
			);
			return res.data;
		},

		// ─── SMTP công ty (chỉ vai trò ADMIN) ─────────────────────────────────────

		async smtp(): Promise<RecruitmentSmtp> {
			const res = await authFetch<ApiResponse<RecruitmentSmtp>>('/v1/recruitment/smtp');
			return res.data;
		},

		async saveSmtp(body: SaveSmtpBody): Promise<RecruitmentSmtp> {
			const res = await authFetch<ApiResponse<RecruitmentSmtp>>('/v1/recruitment/smtp', {
				method: 'PUT',
				body,
			});
			return res.data;
		},

		/**
		 * Gửi thử ĐỒNG BỘ. Gửi thất bại KHÔNG phải lỗi HTTP: BE vẫn trả 201 với
		 * `testStatus: 'FAILED'` và `testError`, nên nơi gọi đọc `testStatus` để báo kết quả.
		 */
		async testSmtp(to: string): Promise<RecruitmentSmtp> {
			const res = await authFetch<ApiResponse<RecruitmentSmtp>>('/v1/recruitment/smtp/test', {
				method: 'POST',
				body: { to },
			});
			return res.data;
		},

		async deleteSmtp(): Promise<void> {
			await authFetch<void>('/v1/recruitment/smtp', { method: 'DELETE' });
		},
	};
};
