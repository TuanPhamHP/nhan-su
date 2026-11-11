import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse } from '~/types/api.types';
import type {
	CreateCommentBody,
	MyInterviewScope,
	RecruitmentApplicationCard,
	RecruitmentComment,
	RecruitmentInterview,
	RecruitmentMyJob,
	RecruitmentMyScorecard,
	RecruitmentScorecard,
	RecruitmentStageScorecards,
	RecruitmentTeamApplication,
	SaveScorecardBody,
} from '~/types/recruitment-me.types';
import type { ApplicationQueryParams } from '~/types/recruitment.types';

/**
 * Hội đồng tuyển dụng và người phỏng vấn (`/v1/me/recruitment/*`).
 *
 * Nhóm route này chỉ cần JWT, không kiểm vai trò hay permission, nên `EMPLOYEE` ngồi hội đồng
 * dùng được. Người quản lý cũng gọi được, nhưng nếu họ KHÔNG ngồi hội đồng thì route mở file
 * phải dùng bản ở trang quản lý (`/v1/recruitment/candidate-files/:id/url`) vì bản ở đây chỉ
 * xét hội đồng.
 */
export const useRecruitmentMeService = () => {
	const authFetch = useAuthFetch();

	return {
		/** Buổi phỏng vấn của tôi: `SCHEDULED` từ 12 giờ trước đến 90 ngày tới. */
		async interviews(): Promise<RecruitmentInterview[]> {
			const res = await authFetch<ApiResponse<RecruitmentInterview[]>>('/v1/me/recruitment/interviews', {
				params: { scope: 'upcoming' satisfies MyInterviewScope },
			});
			return res.data;
		},

		/** Mọi phiếu đánh giá đang chờ tôi chấm, cũ trước. */
		async pendingScorecards(): Promise<RecruitmentMyScorecard[]> {
			const res = await authFetch<ApiResponse<RecruitmentMyScorecard[]>>('/v1/me/recruitment/interviews', {
				params: { scope: 'pending-scorecards' satisfies MyInterviewScope },
			});
			return res.data;
		},

		async interview(id: number): Promise<RecruitmentInterview> {
			const res = await authFetch<ApiResponse<RecruitmentInterview>>(`/v1/me/recruitment/interviews/${id}`);
			return res.data;
		},

		/** Tin tôi ngồi hội đồng, trừ tin Nháp. Không ngồi hội đồng nào thì trả mảng rỗng. */
		async jobs(): Promise<RecruitmentMyJob[]> {
			const res = await authFetch<ApiResponse<RecruitmentMyJob[]>>('/v1/me/recruitment/jobs');
			return res.data;
		},

		/** Hồ sơ của một tin tôi ngồi hội đồng. 403 `RECRUIT_SCOPE_FORBIDDEN` nếu không ngồi hội đồng tin đó. */
		async jobApplications(
			jobId: number,
			params?: ApplicationQueryParams,
		): Promise<RecruitmentApplicationCard[]> {
			const res = await authFetch<ApiResponse<RecruitmentApplicationCard[]>>(
				`/v1/me/recruitment/jobs/${jobId}/applications`,
				{ params },
			);
			return res.data;
		},

		async application(id: number): Promise<RecruitmentTeamApplication> {
			const res = await authFetch<ApiResponse<RecruitmentTeamApplication>>(
				`/v1/me/recruitment/applications/${id}`,
			);
			return res.data;
		},

		/** Chỉ phần phiếu theo vòng, dùng để tải lại sau khi nộp phiếu. */
		async applicationScorecards(id: number): Promise<RecruitmentStageScorecards[]> {
			const res = await authFetch<ApiResponse<RecruitmentStageScorecards[]>>(
				`/v1/me/recruitment/applications/${id}/scorecards`,
			);
			return res.data;
		},

		/** Link mở file, hết hạn sau 10 phút: gọi lúc bấm, đừng gắn sẵn vào `href`. */
		async candidateFileUrl(fileId: number): Promise<string> {
			const res = await authFetch<ApiResponse<{ url: string }>>(
				`/v1/me/recruitment/candidate-files/${fileId}/url`,
			);
			return res.data.url;
		},

		async comments(applicationId: number): Promise<RecruitmentComment[]> {
			const res = await authFetch<ApiResponse<RecruitmentComment[]>>(
				`/v1/me/recruitment/applications/${applicationId}/comments`,
			);
			return res.data;
		},

		/**
		 * Bình luận hoặc đề xuất. Chỉ thành viên hội đồng có vai trò `MANAGER` gửi được
		 * `SUGGEST_*`; người khác nhận 403 `RECRUIT_SUGGESTION_FORBIDDEN`.
		 */
		async addComment(applicationId: number, body: CreateCommentBody): Promise<RecruitmentComment> {
			const res = await authFetch<ApiResponse<RecruitmentComment>>(
				`/v1/me/recruitment/applications/${applicationId}/comments`,
				{ method: 'POST', body },
			);
			return res.data;
		},

		/** Lưu nháp phiếu (200). `scores` thay toàn bộ điểm, luôn gửi đủ danh sách trên form. */
		async saveScorecard(id: number, body: SaveScorecardBody): Promise<RecruitmentScorecard> {
			const res = await authFetch<ApiResponse<RecruitmentScorecard>>(`/v1/me/recruitment/scorecards/${id}`, {
				method: 'PUT',
				body,
			});
			return res.data;
		},

		/** Nộp phiếu (201). Mọi tiêu chí đang dùng phải có điểm; phiếu phỏng vấn phải có kết luận. */
		async submitScorecard(id: number, body: SaveScorecardBody): Promise<RecruitmentScorecard> {
			const res = await authFetch<ApiResponse<RecruitmentScorecard>>(
				`/v1/me/recruitment/scorecards/${id}/submit`,
				{ method: 'POST', body },
			);
			return res.data;
		},
	};
};
