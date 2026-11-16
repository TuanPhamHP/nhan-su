/**
 * Hồ sơ mở rộng của nhân viên (lô 3a, 16/11/2026).
 *
 * Gồm phần không nhạy cảm (quốc tịch, hôn nhân, trình độ), phần nhạy cảm (ngân hàng, mã số
 * thuế), thân nhân, kinh nghiệm trước khi vào công ty, lịch sử công tác và luồng yêu cầu thay
 * đổi thông tin. Contract ở `docs/backend/bridges/hr-profile.md`.
 */

export type MaritalStatus = 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED';

export type EducationLevel =
	| 'NONE'
	| 'ELEMENTARY_VOCATIONAL'
	| 'INTERMEDIATE'
	| 'COLLEGE'
	| 'UNIVERSITY'
	| 'MASTER'
	| 'DOCTOR';

export type RelativeRelationship =
	| 'CHILD'
	| 'SPOUSE'
	| 'FATHER'
	| 'MOTHER'
	| 'FATHER_IN_LAW'
	| 'MOTHER_IN_LAW'
	| 'SIBLING'
	| 'OTHER';

export type DependentRegistration = 'NOT_REGISTERED' | 'SUBMITTED' | 'REGISTERED' | 'UNVERIFIED';

export type ProfileChangeSection = 'BASIC' | 'BANK' | 'TAX' | 'CITIZEN_ID' | 'RELATIVE' | 'EXPERIENCE';
export type ProfileChangeAction = 'UPDATE' | 'CREATE' | 'DELETE';
export type ProfileChangeStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type WorkExperienceSource = 'MANUAL' | 'RECRUITMENT';

export type EmploymentChangeType =
	| 'INITIAL'
	| 'HIRE'
	| 'DEPARTMENT'
	| 'POSITION'
	| 'MANAGER'
	| 'EMPLOYMENT_TYPE'
	| 'MULTIPLE';

export type EmploymentHistorySource = 'SYSTEM_INIT' | 'MANUAL' | 'IMPORT' | 'RECRUITMENT';

// ─── Nhãn tiếng Việt ─────────────────────────────────────────────────────────
//
// Server đã trả nhãn kèm mỗi bản ghi (`maritalStatusLabel`, `relationshipLabel`…), nên các
// bảng dưới đây chỉ dùng cho ô chọn trong form, nơi chưa có bản ghi nào để lấy nhãn. Giữ
// đúng câu chữ của `src/common/constants/vi-labels.ts` bên backend để hai nơi không lệch.

export const MARITAL_STATUS_LABELS: Record<MaritalStatus, string> = {
	SINGLE: 'Độc thân',
	MARRIED: 'Đã kết hôn',
	DIVORCED: 'Đã ly hôn',
	WIDOWED: 'Goá',
};

export const EDUCATION_LEVEL_LABELS: Record<EducationLevel, string> = {
	NONE: 'Chưa qua đào tạo',
	ELEMENTARY_VOCATIONAL: 'Sơ cấp nghề',
	INTERMEDIATE: 'Trung cấp',
	COLLEGE: 'Cao đẳng',
	UNIVERSITY: 'Đại học',
	MASTER: 'Thạc sĩ',
	DOCTOR: 'Tiến sĩ',
};

export const RELATIVE_RELATIONSHIP_LABELS: Record<RelativeRelationship, string> = {
	CHILD: 'Con',
	SPOUSE: 'Vợ hoặc chồng',
	FATHER: 'Bố',
	MOTHER: 'Mẹ',
	FATHER_IN_LAW: 'Bố vợ hoặc bố chồng',
	MOTHER_IN_LAW: 'Mẹ vợ hoặc mẹ chồng',
	SIBLING: 'Anh chị em',
	OTHER: 'Khác',
};

export const DEPENDENT_REGISTRATION_LABELS: Record<DependentRegistration, string> = {
	NOT_REGISTERED: 'Chưa đăng ký',
	SUBMITTED: 'Đã nộp hồ sơ',
	REGISTERED: 'Đã đăng ký',
	UNVERIFIED: 'Chưa xác nhận',
};

export const PROFILE_CHANGE_SECTION_LABELS: Record<ProfileChangeSection, string> = {
	BASIC: 'Thông tin định danh',
	BANK: 'Tài khoản ngân hàng',
	TAX: 'Mã số thuế',
	CITIZEN_ID: 'Căn cước công dân',
	RELATIVE: 'Thân nhân, người phụ thuộc',
	EXPERIENCE: 'Kinh nghiệm làm việc',
};

/**
 * Tên trường trong yêu cầu thay đổi.
 *
 * Chi tiết yêu cầu đã có `fields[].label` nên không cần bảng này; danh sách thì chỉ trả
 * `changedFields` là mã trường, nên bảng danh sách dùng đây để đọc thành chữ. Mã lạ thì hiện
 * nguyên mã, còn hơn là bỏ trống.
 */
export const PROFILE_FIELD_LABELS: Record<string, string> = {
	fullName: 'Họ tên',
	email: 'Email công việc',
	dateOfBirth: 'Ngày sinh',
	gender: 'Giới tính',
	bankName: 'Ngân hàng',
	bankBranch: 'Chi nhánh',
	bankAccountNumber: 'Số tài khoản',
	bankAccountHolder: 'Chủ tài khoản',
	taxCode: 'Mã số thuế riêng',
	citizenIdNumber: 'Số CCCD',
	fullNameOnCard: 'Họ tên trên thẻ',
	issuedDate: 'Ngày cấp',
	expiryDate: 'Ngày hết hạn',
	issuedPlace: 'Nơi cấp',
	hometown: 'Quê quán',
	birthRegistrationPlace: 'Nơi đăng ký khai sinh',
	permanentAddress: 'Nơi thường trú',
	relationship: 'Quan hệ',
	identityNumber: 'Số định danh',
	occupation: 'Nghề nghiệp',
	phone: 'Số điện thoại',
	isEmergencyContact: 'Liên hệ khẩn cấp',
	isPrimaryEmergency: 'Liên hệ khẩn cấp chính',
	isDependent: 'Người phụ thuộc',
	dependentFrom: 'Giảm trừ từ tháng',
	dependentTo: 'Giảm trừ đến tháng',
	livesWith: 'Sống cùng',
	note: 'Ghi chú',
	companyName: 'Công ty',
	title: 'Chức danh',
	fromMonth: 'Từ tháng',
	toMonth: 'Đến tháng',
	description: 'Mô tả công việc',
	leaveReason: 'Lý do nghỉ',
};

export const PROFILE_CHANGE_STATUS_CLASS: Record<ProfileChangeStatus, string> = {
	PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
	APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
	REJECTED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
	CANCELLED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

export const PROFILE_CHANGE_STATUS_LABELS: Record<ProfileChangeStatus, string> = {
	PENDING: 'Chờ duyệt',
	APPROVED: 'Đã duyệt',
	REJECTED: 'Bị từ chối',
	CANCELLED: 'Đã huỷ',
};

// ─── Hồ sơ mở rộng ───────────────────────────────────────────────────────────

/** Phần không nhạy cảm, ai xem được hồ sơ nhân viên là xem được. */
export interface EmployeeProfile {
	employeeId: number;
	/** Bỏ trống thì hiểu là Việt Nam. */
	nationality: string | null;
	maritalStatus: MaritalStatus | null;
	maritalStatusLabel: string | null;
	personalEmail: string | null;
	educationLevel: EducationLevel | null;
	educationLevelLabel: string | null;
	updatedAt: string | null;
}

/** Hồ sơ mở rộng của chính mình, có thêm ba trường liên hệ nhân viên tự sửa được. */
export interface MyProfile extends EmployeeProfile {
	/** Email công việc, chỉ đổi được qua yêu cầu thay đổi mục BASIC. */
	email: string;
	phone: string | null;
	address: string | null;
}

/** Body PATCH hồ sơ mở rộng: không gửi là giữ nguyên, gửi `null` là xoá. */
export interface UpdateEmployeeProfileDto {
	nationality?: string | null;
	maritalStatus?: MaritalStatus | null;
	personalEmail?: string | null;
	educationLevel?: EducationLevel | null;
	taxCode?: string | null;
	bankName?: string | null;
	bankBranch?: string | null;
	bankAccountNumber?: string | null;
	bankAccountHolder?: string | null;
}

export interface UpdateMyContactDto {
	phone?: string | null;
	personalEmail?: string | null;
	address?: string | null;
}

/**
 * Ngân hàng, mã số thuế và liên hệ khẩn cấp.
 *
 * Chỉ lấy được qua endpoint có ghi nhật ký, nên trang chi tiết chỉ gọi khi người dùng bấm
 * Xem, không gọi lúc tải trang.
 */
export interface PrivateProfile {
	employeeId: number;
	bankName: string | null;
	bankBranch: string | null;
	bankAccountNumber: string | null;
	bankAccountHolder: string | null;
	/** Mã số thuế riêng, chỉ có với người nước ngoài hoặc mã 10 số cũ. */
	taxCode: string | null;
	/** Mã số thuế dùng thật: `taxCode` nếu có, không thì số căn cước. */
	effectiveTaxCode: string | null;
	effectiveTaxCodeSource: 'TAX_CODE' | 'CITIZEN_ID' | null;
	emergencyContacts: Relative[];
}

export interface MyPrivateProfile extends PrivateProfile {
	/** Mọi thân nhân của chính mình, không chỉ người là liên hệ khẩn cấp. */
	relatives: Relative[];
}

// ─── Thân nhân ───────────────────────────────────────────────────────────────

export interface Relative {
	id: number;
	fullName: string;
	relationship: RelativeRelationship;
	relationshipLabel: string;
	dateOfBirth: string | null;
	/** Số định danh 12 số, cũng là mã số thuế của người phụ thuộc. */
	identityNumber: string | null;
	occupation: string | null;
	phone: string | null;
	isEmergencyContact: boolean;
	/** Mỗi nhân viên chỉ một người; đặt người mới thì người cũ tự bỏ cờ. */
	isPrimaryEmergency: boolean;
	isDependent: boolean;
	/** Ngày 1 của tháng bắt đầu giảm trừ. */
	dependentFrom: string | null;
	/** Ngày 1 của tháng cuối được giảm trừ; bỏ trống là đang giảm trừ. */
	dependentTo: string | null;
	livesWith: boolean;
	registration: DependentRegistration | null;
	registrationLabel: string | null;
	note: string | null;
	updatedAt: string;
}

export interface CreateRelativeDto {
	fullName: string;
	relationship: RelativeRelationship;
	dateOfBirth?: string | null;
	identityNumber?: string | null;
	occupation?: string | null;
	phone?: string | null;
	isEmergencyContact?: boolean;
	isPrimaryEmergency?: boolean;
	isDependent?: boolean;
	dependentFrom?: string | null;
	dependentTo?: string | null;
	livesWith?: boolean;
	registration?: DependentRegistration | null;
	note?: string | null;
}

export type UpdateRelativeDto = Partial<CreateRelativeDto>;

/**
 * Kết quả thêm, sửa thân nhân.
 *
 * `warnings` có câu BR-04 khi số định danh đang là người phụ thuộc của nhân viên khác trong
 * công ty. Đó chỉ là cảnh báo, bản ghi vẫn được lưu, nên giao diện hiện câu cảnh báo màu vàng
 * sau khi lưu xong.
 */
export interface RelativeMutationResult {
	relative: Relative;
	warnings: string[];
}

/** Liên hệ khẩn cấp nhân viên tự thêm: luôn là liên hệ khẩn cấp và không phải người phụ thuộc. */
export interface CreateEmergencyContactDto {
	fullName: string;
	relationship: RelativeRelationship;
	phone?: string | null;
	occupation?: string | null;
	isPrimaryEmergency?: boolean;
	note?: string | null;
}

export type UpdateEmergencyContactDto = Partial<CreateEmergencyContactDto>;

// ─── Kinh nghiệm, lịch sử công tác ───────────────────────────────────────────

export interface WorkExperience {
	id: number;
	companyName: string;
	title: string | null;
	/** Ngày 1 của tháng. */
	fromMonth: string | null;
	toMonth: string | null;
	description: string | null;
	leaveReason: string | null;
	source: WorkExperienceSource;
	sourceLabel: string;
}

export interface CreateWorkExperienceDto {
	companyName: string;
	title?: string | null;
	fromMonth?: string | null;
	toMonth?: string | null;
	description?: string | null;
	leaveReason?: string | null;
}

export type UpdateWorkExperienceDto = Partial<CreateWorkExperienceDto>;

/** Một giai đoạn công tác với phòng ban, chức vụ, quản lý và loại lao động lúc đó. */
export interface EmploymentHistoryItem {
	id: number;
	department: { id: number; name: string } | null;
	position: { id: number; name: string } | null;
	manager: { id: number; name: string } | null;
	employmentType: string;
	employmentTypeLabel: string;
	changeType: EmploymentChangeType;
	changeTypeLabel: string;
	source: EmploymentHistorySource;
	sourceLabel: string;
	startedAt: string;
	/** Bỏ trống là giai đoạn đang mở. */
	endedAt: string | null;
	note: string | null;
	createdBy: { id: number; name: string } | null;
	createdAt: string;
}

// ─── Yêu cầu thay đổi thông tin ──────────────────────────────────────────────

export interface ProfileChangeField {
	key: string;
	label: string;
	/** Giá trị lúc gửi, server đã đổi sang chữ cho người đọc. */
	before: string | null;
	/** Giá trị đề nghị; bỏ trống với yêu cầu xoá. */
	after: string | null;
	/** Chỉ có ở chi tiết dành cho người duyệt. */
	current?: string | null;
}

export interface ProfileChange {
	id: number;
	employee: { id: number; employeeCode: string; fullName: string; departmentName: string | null };
	section: ProfileChangeSection;
	sectionLabel: string;
	action: ProfileChangeAction;
	actionLabel: string;
	targetId: number | null;
	changedFields: string[];
	documentCount: number;
	status: ProfileChangeStatus;
	statusLabel: string;
	/** Lý do huỷ, ví dụ "Thay bằng yêu cầu số 16" hoặc "Người gửi tự huỷ". */
	cancelReason: string | null;
	decidedBy: { id: number; name: string } | null;
	decidedAt: string | null;
	/** Ghi chú lúc duyệt, hoặc lý do từ chối. */
	decisionNote: string | null;
	createdAt: string;
}

/** Yêu cầu của chính mình: kèm giá trị cũ và mới. */
export interface MyProfileChange extends ProfileChange {
	fields: ProfileChangeField[];
	before: Record<string, unknown> | null;
	after: Record<string, unknown>;
}

export interface ProfileChangeDocument {
	id: number;
	fileName: string;
	type: string;
	typeLabel: string;
	uploadedAt: string;
}

/** Chi tiết cho người duyệt: thêm giá trị hiện tại, giấy tờ kèm theo và cảnh báo BR-04. */
export interface ProfileChangeDetail extends MyProfileChange {
	current: Record<string, unknown> | null;
	documents: ProfileChangeDocument[];
	warnings: string[];
}

export interface CreateProfileChangeDto {
	section: ProfileChangeSection;
	/** Mặc định là sửa; thêm và xoá chỉ dùng cho thân nhân và kinh nghiệm. */
	action?: ProfileChangeAction;
	targetId?: number;
	after: Record<string, unknown>;
	/** Tối đa 5 giấy tờ, lấy id từ `POST /me/profile-change-requests/documents`. */
	documentIds?: number[];
}

/**
 * Kết quả gửi yêu cầu.
 *
 * `supersededIds` là các yêu cầu đang chờ cùng mục và cùng bản ghi đích vừa bị huỷ để nhường
 * cho yêu cầu mới, nên lần gửi sau phải gửi đủ mọi trường muốn đổi.
 */
export interface CreateProfileChangeResult {
	request: MyProfileChange;
	supersededIds: number[];
}

export interface ProfileChangeQueryParams {
	status?: ProfileChangeStatus;
	section?: ProfileChangeSection;
	employeeId?: number;
	page?: number;
	limit?: number;
}

// ─── Danh mục loại giấy tờ ───────────────────────────────────────────────────

export interface EmployeeDocumentType {
	id: number;
	/** Chữ in hoa, số và gạch dưới; server tự viết hoa. */
	code: string;
	name: string;
	isSensitive: boolean;
	/** Thời hạn mặc định tính theo tháng, từ 1 đến 240. */
	validityMonths: number | null;
	employeeVisible: boolean;
	/** Loại mặc định của hệ thống: sửa được tên nhưng không đổi được mã. */
	isSystem: boolean;
	isActive: boolean;
	sortOrder: number;
}

export interface CreateEmployeeDocumentTypeDto {
	code: string;
	name: string;
	isSensitive?: boolean;
	validityMonths?: number | null;
	employeeVisible?: boolean;
	sortOrder?: number;
}

export interface UpdateEmployeeDocumentTypeDto {
	code?: string;
	name?: string;
	isSensitive?: boolean;
	validityMonths?: number | null;
	employeeVisible?: boolean;
	sortOrder?: number;
	isActive?: boolean;
}
