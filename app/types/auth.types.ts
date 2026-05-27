export type UserRole = 'ADMIN' | 'CHIEF' | 'HR' | 'MANAGER' | 'EMPLOYEE';

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

export interface AuthResponse {
	accessToken: string;
	token: string;
	refreshToken: string;
	user: AuthUser;
}

export interface LoginDto {
	email: string;
	password: string;
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
