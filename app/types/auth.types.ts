export type UserRole = 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE';

export interface AuthUser {
	id: number;
	fullName: string;
	email: string;
	employeeCode: string;
	role: UserRole;
	avatarUrl: string | null;
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
