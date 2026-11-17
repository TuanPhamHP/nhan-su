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
	/** Lô 3a: mã giới tính. */
	genderCode: 'MALE' | 'FEMALE' | 'OTHER' | null;
	address: string | null;
	avatarUrl: string | null;
	/**
	 * Lô 3a, chỉ có ở `PATCH /v1/auth/profile`: id yêu cầu thay đổi vừa được tạo cho họ tên,
	 * email công việc, ngày sinh hoặc giới tính. Null nghĩa là không có gì cần duyệt.
	 */
	pendingChangeRequestId?: number | null;
}

/**
 * Body `PATCH /v1/auth/profile`.
 *
 * Lô 3a chỉ còn số điện thoại và địa chỉ được ghi ngay; họ tên, email công việc, ngày sinh và
 * giới tính khác giá trị hiện tại thì server tạo yêu cầu cho phòng nhân sự duyệt.
 */
export interface UpdateProfilePayload {
	fullName?: string;
	email?: string;
	phone?: string;
	dateOfBirth?: string;
	gender?: Gender | 'MALE' | 'FEMALE' | 'OTHER';
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
	/**
	 * Logo hiện ở góc trên thanh bên. URL công khai tuyệt đối, đã kèm `?v=` của phiên bản ảnh:
	 * đặt thẳng vào `<img src>`, không gắn token, không bỏ hay đổi `v`. `null` nghĩa là công ty
	 * chưa có logo, dùng logo mặc định của app.
	 */
	logoUrl: string | null;
	/** Favicon của tab trình duyệt, cùng dạng URL như `logoUrl`. `null` thì dùng favicon của app. */
	faviconUrl: string | null;
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
