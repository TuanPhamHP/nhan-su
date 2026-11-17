import type {
	AuthResponse,
	LoginDto,
	LoginResponse,
	MeResponse,
	SelectCompanyDto,
	SwitchCompanyDto,
	AcceptInviteDto,
	AcceptInviteResponse,
	RefreshTokenDto,
	ChangePasswordDto,
	ForgotPasswordDto,
	ResetPasswordDto,
	ProfileResponse,
	UpdateProfilePayload,
} from '~/types/auth.types';
import type { Employee } from '~/types/employee.types';
import type { EntitlementsResponse } from '~/types/entitlement.types';
import type { ApiResponse } from '~/types/api.types';
import { useAuthFetch } from './http/auth.fetch';
import { usePublicFetch } from './http/public.fetch';

export const useAuthService = () => {
	const publicFetch = usePublicFetch();
	const authFetch = useAuthFetch();

	return {
		/** Thuộc một công ty thì trả token; thuộc nhiều công ty thì trả `selectionToken` để chọn. */
		async login(payload: LoginDto): Promise<LoginResponse> {
			const res = await publicFetch<ApiResponse<LoginResponse>>('/v1/auth/login', {
				method: 'POST',
				body: payload,
			});
			return res.data;
		},

		async selectCompany(payload: SelectCompanyDto): Promise<AuthResponse> {
			const res = await publicFetch<ApiResponse<AuthResponse>>('/v1/auth/select-company', {
				method: 'POST',
				body: payload,
			});
			return res.data;
		},

		/** Phiên ở công ty cũ bị hủy ngay khi gọi thành công, phải lưu cả hai token mới. */
		async switchCompany(payload: SwitchCompanyDto): Promise<AuthResponse> {
			const res = await authFetch<ApiResponse<AuthResponse>>('/v1/auth/switch', {
				method: 'POST',
				body: payload,
			});
			return res.data;
		},

		async acceptInvite(payload: AcceptInviteDto): Promise<AcceptInviteResponse> {
			const res = await publicFetch<ApiResponse<AcceptInviteResponse>>('/v1/auth/accept-invite', {
				method: 'POST',
				body: payload,
			});
			return res.data;
		},

		async logout(): Promise<void> {
			await authFetch<unknown>('/v1/auth/logout', { method: 'POST' });
		},

		async refresh(payload: RefreshTokenDto): Promise<AuthResponse> {
			const res = await publicFetch<ApiResponse<AuthResponse>>('/v1/auth/refresh', {
				method: 'POST',
				body: payload,
			});
			return res.data;
		},

		async changePassword(payload: ChangePasswordDto): Promise<void> {
			await authFetch<unknown>('/v1/auth/change-password', {
				method: 'PATCH',
				body: payload,
			});
		},

		async me(): Promise<Employee> {
			const res = await authFetch<ApiResponse<Employee>>('/v1/employees/me');
			return res.data;
		},

		/** Quyền ở công ty hiện tại, kèm công ty hiện tại và danh sách công ty của tài khoản. */
		async authMe(): Promise<MeResponse> {
			const res = await authFetch<ApiResponse<MeResponse>>('/v1/auth/me');
			return res.data;
		},

		/** Trạng thái mọi module của công ty trong phiên hiện tại. */
		async getEntitlements(): Promise<EntitlementsResponse> {
			const res = await authFetch<ApiResponse<EntitlementsResponse>>('/v1/me/entitlements');
			return res.data;
		},

		async updateProfile(payload: UpdateProfilePayload): Promise<ProfileResponse> {
			const res = await authFetch<ApiResponse<ProfileResponse>>('/v1/auth/profile', {
				method: 'PATCH',
				body: payload,
			});
			return res.data;
		},

		async uploadAvatar(file: File): Promise<ProfileResponse> {
			const formData = new FormData();
			formData.append('file', file);
			const res = await authFetch<ApiResponse<ProfileResponse>>('/v1/auth/avatar', {
				method: 'POST',
				body: formData,
			});
			return res.data;
		},

		async forgotPassword(payload: ForgotPasswordDto): Promise<void> {
			await publicFetch<unknown>('/v1/auth/forgot-password', {
				method: 'POST',
				body: payload,
			});
		},

		async resetPassword(payload: ResetPasswordDto): Promise<void> {
			await publicFetch<unknown>('/v1/auth/reset-password', {
				method: 'POST',
				body: payload,
			});
		},
	};
};
