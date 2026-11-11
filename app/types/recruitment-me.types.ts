/**
 * Hội đồng tuyển dụng và người phỏng vấn (`/v1/me/recruitment/*`). Nhóm route này chỉ cần đăng
 * nhập, không kiểm vai trò, nên `EMPLOYEE` ngồi hội đồng dùng được. Xem
 * `docs/backend/bridges/recruitment.md` mục "Hội đồng tuyển dụng".
 *
 * File này CHỈ khai ba kiểu riêng của nhóm `/me`; mọi kiểu nền dùng chung với trang quản lý
 * (`RecruitmentScorecard`, `RecruitmentInterview`, `RecruitmentApplicationView`, bình luận…)
 * nằm ở `~/types/recruitment.types` và được tái xuất ở đây, để hai nhóm route không có hai định
 * nghĩa khác nhau cho cùng một response của BE.
 *
 * Những gì BE che ở nhóm này, kiểu không nói ra được nên phải nhớ: `candidate.expectedSalary`
 * là `null` khi không có cờ xem offer ở hội đồng của tin, các trường blacklist LUÔN `null` trừ
 * người có `recruitment:manage`, và không có `duplicates`, lịch sử hay email. Đọc cờ
 * `canViewSalary`, `canSeeBlacklist` của chính response, đừng suy từ vai trò.
 */
import type {
	RecruitmentApplicationView,
	RecruitmentJobStatus,
	RecruitmentPerson,
	RecruitmentRef,
	RecruitmentScorecard,
	RecruitmentStageScorecards,
} from '~/types/recruitment.types';

export type {
	RecruitmentApplicationCard,
	RecruitmentApplicationView,
	RecruitmentCandidateFile,
	RecruitmentCandidateProfile,
	RecruitmentComment,
	RecruitmentCommentKind,
	RecruitmentInterview,
	RecruitmentPerson,
	RecruitmentScorecard,
	RecruitmentStageKind,
	RecruitmentStageScorecards,
	RecruitmentVerdict,
	CreateCommentBody,
	SaveScorecardBody,
} from '~/types/recruitment.types';

export type MyInterviewScope = 'upcoming' | 'pending-scorecards';

/** Phiếu trong danh sách "chờ tôi chấm", có thêm ứng viên và tin để hiện ngữ cảnh. */
export interface RecruitmentMyScorecard extends RecruitmentScorecard {
	candidate: RecruitmentPerson;
	job: { id: number; title: string };
}

/** Một tin tôi ngồi hội đồng. Tin Nháp không bao giờ có ở đây. */
export interface RecruitmentMyJob {
	id: number;
	code: string;
	title: string;
	/** Nhóm `/me` không trả tin Nháp, nên hẹp hơn `RecruitmentJobStatus`. */
	status: Exclude<RecruitmentJobStatus, 'DRAFT'>;
	statusLabel: string;
	department: RecruitmentRef | null;
	/** YYYY-MM-DD */
	deadline: string | null;
	/** Tổng hồ sơ đang xét của tin. */
	activeCount: number;
	/**
	 * Thành viên hội đồng của tin, để FE dựng ô nhắc tên khi bình luận.
	 *
	 * Đây là nguồn DUY NHẤT cho danh sách người nhắc được ở nhóm `/me`: thành viên hội đồng có
	 * thể là `EMPLOYEE`, gọi `/v1/employees` sẽ 403, nên đừng lấy tên từ `useDirectoryStore`.
	 */
	team: RecruitmentPerson[];
	stages: {
		id: number;
		name: string;
		kind: string;
		kindLabel: string;
		order: number;
		activeCount: number;
	}[];
}

/** Chi tiết hồ sơ ở trang hội đồng: như trang quản lý, kèm phiếu theo vòng đã lọc theo BR-08. */
export interface RecruitmentTeamApplication extends RecruitmentApplicationView {
	scorecards: RecruitmentStageScorecards[];
}
