import type { UserRole } from './auth.types';

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
/** Nhãn giới tính; BE vẫn trả nhãn này để app cũ không vỡ. */
export type EmployeeGender = 'Nam' | 'Nữ' | 'Khác';
/** Mã giới tính (lô 3a); ô chọn gửi mã, màn hình vẫn hiện nhãn. */
export type GenderCode = 'MALE' | 'FEMALE' | 'OTHER';

export const GENDER_LABELS: Record<GenderCode, EmployeeGender> = {
	MALE: 'Nam',
	FEMALE: 'Nữ',
	OTHER: 'Khác',
};

/** Lý do nghỉ việc theo các trường hợp chấm dứt hợp đồng của Bộ luật Lao động 2019. */
export type TerminationReason =
	| 'RESIGNATION'
	| 'CONTRACT_EXPIRED'
	| 'MUTUAL_AGREEMENT'
	| 'PROBATION_FAILED'
	| 'DISMISSAL'
	| 'EMPLOYER_UNILATERAL'
	| 'RETIREMENT'
	| 'DEATH'
	| 'OTHER';

export const TERMINATION_REASON_LABELS: Record<TerminationReason, string> = {
	RESIGNATION: 'Người lao động xin nghỉ',
	CONTRACT_EXPIRED: 'Hết hạn hợp đồng',
	MUTUAL_AGREEMENT: 'Hai bên thoả thuận',
	PROBATION_FAILED: 'Không đạt thử việc',
	DISMISSAL: 'Sa thải',
	EMPLOYER_UNILATERAL: 'Công ty đơn phương chấm dứt',
	RETIREMENT: 'Nghỉ hưu',
	DEATH: 'Qua đời',
	OTHER: 'Lý do khác',
};

export type EmploymentType =
	| 'FULL_TIME'
	| 'PROBATION'
	| 'APPRENTICE'
	| 'INTERN'
	| 'PART_TIME'
	| 'CONTRACTOR';

export interface DepartmentSummary {
	id: number;
	name: string;
}

export interface PositionSummary {
	id: number;
	name: string;
}

export interface DefaultShiftSummary {
	id: number;
	name: string;
}

export interface EmployeeSummary {
	id: number;
	employeeCode: string;
	fullName: string;
	email: string;
	department: DepartmentSummary | null;
	status: EmployeeStatus;
	/** "YYYY-MM-DD" — chỉ khác null khi status = 'INACTIVE' (BE bổ sung 12/10/2026). */
	terminationDate: string | null;
	role: UserRole;
	employmentType: EmploymentType;
	position: {
		name: string;
		id: number;
	} | null;
	avatarUrl?: string | null;
}

export interface ManagerSummary {
	id: number;
	fullName: string;
	email: string;
}

export interface Employee {
	id: number;
	employeeCode: string;
	fullName: string;
	email: string;
	phone: string | null;
	role: UserRole;
	employmentType: EmploymentType;
	status: EmployeeStatus;
	joinDate: string;
	/** "YYYY-MM-DD" — chỉ khác null khi status = 'INACTIVE'. */
	terminationDate: string | null;
	/** Lý do nghỉ việc; chỉ có khi nghỉ qua POST /v1/employees/:id/terminate, null nếu chỉ bị khóa tài khoản. */
	terminationNote: string | null;
	/** Lô 3a; null với người nghỉ việc trước lô 3a. */
	terminationReason: TerminationReason | null;
	terminationReasonLabel: string | null;
	dateOfBirth: string | null;
	gender: EmployeeGender | null;
	/** Lô 3a: mã giới tính, dùng cho ô chọn trong form. */
	genderCode: GenderCode | null;
	address: string | null;
	avatarUrl: string | null;
	department: DepartmentSummary | null;
	position: PositionSummary | null;
	manager: ManagerSummary | null;
	defaultShift: DefaultShiftSummary | null;
	createdAt: string;
}

/**
 * Body POST /v1/employees. Không có `password`: nhân viên mới nhận email có link
 * tự đặt mật khẩu hạn 3 giờ, hoặc link nhận lời mời hạn 7 ngày nếu email đã có tài khoản
 * ở công ty khác. Response giống hệt nhau ở hai ca (xem docs/backend/bridges/employees.md).
 */
export interface CreateEmployeeDto {
	fullName: string;
	email: string;
	joinDate: string;
	role: UserRole;
	employmentType?: EmploymentType;
	departmentId?: number;
	positionId?: number;
	managerId?: number;
	defaultShiftId?: number;
	phone?: string;
	dateOfBirth?: string;
	/** Lô 3a: BE nhận cả nhãn cũ và mã; form gửi mã. */
	gender?: EmployeeGender | GenderCode;
	address?: string;
}

export interface UpdateEmployeeDto {
	fullName?: string;
	joinDate?: string;
	role?: UserRole;
	employmentType?: EmploymentType;
	departmentId?: number | null;
	positionId?: number;
	managerId?: number;
	phone?: string;
	dateOfBirth?: string;
	gender?: EmployeeGender | GenderCode;
	address?: string;
	/**
	 * Lô 3a: ngày hiệu lực của mốc lịch sử công tác khi đổi phòng ban, chức vụ, quản lý hoặc
	 * loại lao động. Bỏ trống là hôm nay. Không được sau hôm nay, không trước ngày vào làm và
	 * không trước ngày bắt đầu giai đoạn đang mở, sai thì BE trả 400.
	 */
	effectiveDate?: string;
	/** Ghi chú cho mốc lịch sử công tác, tối đa 500 ký tự. */
	historyNote?: string;
}

/** Body optional của DELETE /v1/employees/:id (khóa tài khoản) — bỏ trống thì BE lấy ngày hiện tại (giờ VN). */
export interface DeactivateEmployeeDto {
	terminationDate?: string; // "YYYY-MM-DD"
}

/**
 * Body của POST /v1/employees/:id/terminate (xác nhận nghỉ việc) — cả hai field BẮT BUỘC.
 * Khác hẳn khóa tài khoản: gọi lại khi nhân sự đã INACTIVE là cách duy nhất sửa ngày/lý do.
 */
export interface TerminateEmployeeDto {
	terminationDate: string; // "YYYY-MM-DD", phải >= joinDate
	terminationNote: string; // tối đa 1000 ký tự, không nhận chuỗi rỗng
	/** Lô 3a: bắt buộc, chọn từ ô Lý do nghỉ việc. */
	terminationReason: TerminationReason;
}

export interface EmployeeQueryParams {
	departmentId?: number;
	status?: EmployeeStatus;
	role?: UserRole;
	employmentType?: EmploymentType;
	search?: string;
	page?: number;
	limit?: number;
	pagination?: boolean;
}

/**
 * Tài liệu nhân viên chuyển sang `types/employee-document.types.ts` ở lô 3a, vì loại giấy tờ
 * nay là danh mục cấu hình được chứ không còn ba mã cố định.
 */
export type { EmployeeDocumentResponse, UploadDocumentPayload } from './employee-document.types';
