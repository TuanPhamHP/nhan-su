/**
 * Trang tuyển dụng công khai và trang phản hồi offer (`/v1/public/careers/*`,
 * `/v1/public/offer-responses/*`). Xem `docs/backend/bridges/recruitment.md` mục
 * "Trang công khai (không đăng nhập)".
 *
 * Vì sao có file riêng thay vì dùng `recruitment.types.ts` của trang quản lý: response công
 * khai KHÔNG có khung lương nội bộ, người phụ trách, hội đồng, id của yêu cầu, phòng ban hay
 * vị trí. Trộn hai nhóm vào một kiểu sẽ khiến trang công khai tưởng là có những trường đó.
 */

export type RecruitmentEmploymentType =
	| 'FULL_TIME'
	| 'PROBATION'
	| 'APPRENTICE'
	| 'INTERN'
	| 'PART_TIME'
	| 'CONTRACTOR';

/** Loại hình của yêu cầu tuyển: như `RecruitmentEmploymentType` nhưng không có `PROBATION`. */
export type RecruitmentRequisitionEmploymentType = Exclude<RecruitmentEmploymentType, 'PROBATION'>;

export type RecruitmentJobVisibility = 'PUBLIC' | 'INTERNAL';

export type OfferLinkState = 'ACTIVE' | 'RESPONDED' | 'EXPIRED' | 'SUPERSEDED' | 'CANCELLED' | 'UNAVAILABLE';

export type RecruitmentProbationGroup =
	| 'NONE'
	| 'ENTERPRISE_MANAGER'
	| 'COLLEGE_OR_ABOVE'
	| 'INTERMEDIATE'
	| 'OTHER';

export interface PublicCareersJob {
	title: string;
	slug: string;
	locations: string[];
	salaryText: string | null;
	/** YYYY-MM-DD */
	deadline: string | null;
	departmentName: string;
	positionName: string;
	employmentType: RecruitmentRequisitionEmploymentType;
	employmentTypeLabel: string;
}

export interface PublicCareers {
	company: { code: string; name: string };
	/** Giới thiệu trang tuyển dụng, HR nhập ở cài đặt. */
	intro: string | null;
	/** Tin Công khai đang mở, mới mở trước. Tin Nội bộ không bao giờ có ở đây. */
	jobs: PublicCareersJob[];
}

export interface PublicJobDetail {
	company: { code: string; name: string };
	job: PublicCareersJob & {
		visibility: RecruitmentJobVisibility;
		visibilityLabel: string;
		description: string;
		requirements: string | null;
		benefits: string | null;
	};
	/** Gửi lại `version` trong `termsVersion` khi nộp hồ sơ. */
	terms: { version: number; text: string };
}

/**
 * Hồ sơ ứng viên tự nộp. Gửi dạng `multipart/form-data`, mọi giá trị thành chuỗi.
 *
 * `website` và `formStartedAt` là hai chốt chống spam thay cho captcha: ô `website` ẩn bằng CSS
 * (không dùng `type="hidden"`), người thật để trống; `formStartedAt` là `Date.now()` lúc mở form.
 * Gửi sau chưa đủ 3 giây hoặc `website` có chữ thì BE vẫn trả 201 nhưng không lưu gì.
 */
export interface PublicApplicationBody {
	fullName: string;
	email: string;
	phone?: string;
	consentProcessing: true;
	consentTalentPool?: boolean;
	termsVersion: number;
	website: string;
	formStartedAt: number;
	cv: File;
}

export interface PublicOfferSummary {
	candidateName: string;
	positionName: string;
	departmentName: string;
	level: string | null;
	employmentType: RecruitmentEmploymentType;
	employmentTypeLabel: string;
	/** Lương chính thức, số nguyên đồng. */
	baseSalary: number;
	probationGroup: RecruitmentProbationGroup;
	probationGroupLabel: string;
	probationDays: number | null;
	probationSalary: number | null;
	/** YYYY-MM-DD */
	startDate: string;
	probationEndDate: string | null;
	allowances: string | null;
	/** YYYY-MM-DD, hết lúc 23:59:59 giờ Việt Nam của ngày này. */
	responseDeadline: string;
	/** Chỉ có khi `state` là `RESPONDED`. */
	decision: 'ACCEPTED' | 'DECLINED' | null;
	respondedAt: string | null;
	respondedVia: 'LINK' | 'HR' | null;
	respondedViaLabel: string | null;
	/** Thư mời PDF, presigned URL hết hạn sau 10 phút — đừng cache, gọi lại route để lấy link mới. */
	pdfUrl: string | null;
}

export interface PublicOfferResponse {
	state: OfferLinkState;
	/** `null` khi link không xác định được công ty. */
	companyName: string | null;
	/** Chỉ có khi `state` là `ACTIVE` hoặc `RESPONDED`. */
	offer: PublicOfferSummary | null;
	/** Chỉ có khi `state` là `ACTIVE`. */
	declineReasons: { id: number; name: string }[];
}

export interface PublicOfferDeclineBody {
	reasonId: number;
	note?: string;
}
