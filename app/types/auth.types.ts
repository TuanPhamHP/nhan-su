export type UserRole = 'ADMIN' | 'CHIEF' | 'DIRECTOR' | 'HR' | 'MANAGER' | 'EMPLOYEE';

export type Gender = 'Nam' | 'Nữ' | 'Khác';

export interface ProfileResponse {
	id: number;
	fullName: string;
	email: string;
	employeeCode: string;
	role: UserRole;
	phone: string | null;
	dateOfBirth: string | null;
	gender: Gender | null;
	address: string | null;
	avatarUrl: string | null;
}

export interface UpdateProfilePayload {
	fullName?: string;
	email?: string;
	phone?: string;
	dateOfBirth?: string;
	gender?: Gender;
	address?: string;
}

export interface AuthUser {
	id: number;
	fullName: string;
	email: string;
	employeeCode: string;
	role: UserRole;
	avatarUrl: string | null;
	department: { id: number; name: string } | null;
}

/** Một công ty mà tài khoản vào được. `code` dùng cho select-company, switch và `?t=` trên link. */
export interface CompanyOption {
	code: string;
	name: string;
}

/** Người dùng trong một phiên trả về từ login (1 công ty), select-company, switch, refresh. */
export type SessionUser = Omit<AuthUser, 'department'>;

/** Response khi đã vào được một công ty: login (1 công ty), select-company, switch, refresh. */
export interface AuthResponse {
	requiresCompanySelection: false;
	accessToken: string;
	token: string;
	/** Chuỗi mờ, lưu nguyên rồi gửi lại ở /refresh. Không kiểm định dạng. */
	refreshToken: string;
	user: SessionUser;
	company: CompanyOption;
	companies: CompanyOption[];
}

/** Response khi đúng mật khẩu nhưng tài khoản thuộc nhiều công ty: chưa có token. */
export interface CompanySelectionResponse {
	requiresCompanySelection: true;
	/** Hạn 5 phút, chỉ dùng cho /select-company. Chỉ giữ trong bộ nhớ, không đưa lên URL. */
	selectionToken: string;
	companies: CompanyOption[];
}

export type LoginResponse = AuthResponse | CompanySelectionResponse;

/** GET /v1/auth/me — hồ sơ và quyền ở công ty hiện tại, kèm các công ty của tài khoản. */
export interface MeResponse extends SessionUser {
	permissions: string[];
	company: CompanyOption;
	companies: CompanyOption[];
}

export interface LoginDto {
	/** Email đăng nhập. Mã nhân viên không còn được nhận (400 AUTH_EMAIL_REQUIRED). */
	identifier: string;
	password: string;
}

export interface SelectCompanyDto {
	selectionToken: string;
	companyCode: string;
}

export interface SwitchCompanyDto {
	companyCode: string;
}

export interface AcceptInviteDto {
	/** Query `?token=` của link /accept-invite trong email (64 ký tự hex). */
	token: string;
	/**
	 * Chỉ gửi sau khi BE trả 400 `AUTH_INVITE_PASSWORD_REQUIRED` (tài khoản tạo từ dữ liệu trước G1).
	 * Tối thiểu 6 ký tự. Nhận lời mời kèm mật khẩu mới thì mọi phiên cũ của tài khoản bị hủy.
	 */
	newPassword?: string;
}

export interface AcceptInviteResponse {
	companyName: string;
}

export interface RefreshTokenDto {
	refreshToken: string;
}

export interface ChangePasswordDto {
	currentPassword: string;
	newPassword: string;
}

export interface ForgotPasswordDto {
	email: string;
}

export interface ResetPasswordDto {
	token: string;
	newPassword: string;
}
