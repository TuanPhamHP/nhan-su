import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse } from '~/types/api.types';
import type {
	CreateRelativeDto,
	CreateWorkExperienceDto,
	EmployeeProfile,
	EmploymentHistoryItem,
	PrivateProfile,
	Relative,
	RelativeMutationResult,
	UpdateEmployeeProfileDto,
	UpdateRelativeDto,
	UpdateWorkExperienceDto,
	WorkExperience,
} from '~/types/hr-profile.types';

/**
 * Hồ sơ mở rộng, thân nhân, kinh nghiệm và lịch sử công tác của **người khác** (lô 3a).
 *
 * Phần hồ sơ của chính mình nằm ở `me-profile.service.ts`, vì các route `/v1/me/...` lấy nhân
 * viên từ token và không nhận id trên đường dẫn.
 */
export const useEmployeeProfileService = () => {
	const authFetch = useAuthFetch();

	return {
		async findProfile(employeeId: number): Promise<EmployeeProfile> {
			const res = await authFetch<ApiResponse<EmployeeProfile>>(`/v1/employees/${employeeId}/profile`);
			return res.data;
		},

		/**
		 * Ngân hàng, mã số thuế và liên hệ khẩn cấp.
		 *
		 * Mỗi lần gọi là một dòng nhật ký `employee.private_view`, nên chỉ gọi khi người dùng
		 * thực sự bấm Xem, đừng gọi lúc tải trang.
		 */
		async findPrivateProfile(employeeId: number): Promise<PrivateProfile> {
			const res = await authFetch<ApiResponse<PrivateProfile>>(`/v1/employees/${employeeId}/private-profile`);
			return res.data;
		},

		async updateProfile(employeeId: number, payload: UpdateEmployeeProfileDto): Promise<EmployeeProfile> {
			const res = await authFetch<ApiResponse<EmployeeProfile>>(`/v1/employees/${employeeId}/profile`, {
				method: 'PATCH',
				body: payload,
			});
			return res.data;
		},

		/** Cũng ghi nhật ký `employee.private_view`, vì response có số định danh của thân nhân. */
		async findRelatives(employeeId: number): Promise<Relative[]> {
			const res = await authFetch<ApiResponse<Relative[]>>(`/v1/employees/${employeeId}/relatives`);
			return res.data;
		},

		async createRelative(employeeId: number, payload: CreateRelativeDto): Promise<RelativeMutationResult> {
			const res = await authFetch<ApiResponse<RelativeMutationResult>>(
				`/v1/employees/${employeeId}/relatives`,
				{ method: 'POST', body: payload },
			);
			return res.data;
		},

		async updateRelative(
			employeeId: number,
			relativeId: number,
			payload: UpdateRelativeDto,
		): Promise<RelativeMutationResult> {
			const res = await authFetch<ApiResponse<RelativeMutationResult>>(
				`/v1/employees/${employeeId}/relatives/${relativeId}`,
				{ method: 'PATCH', body: payload },
			);
			return res.data;
		},

		removeRelative(employeeId: number, relativeId: number): Promise<void> {
			return authFetch<void>(`/v1/employees/${employeeId}/relatives/${relativeId}`, { method: 'DELETE' });
		},

		async findWorkExperiences(employeeId: number): Promise<WorkExperience[]> {
			const res = await authFetch<ApiResponse<WorkExperience[]>>(
				`/v1/employees/${employeeId}/work-experiences`,
			);
			return res.data;
		},

		async createWorkExperience(employeeId: number, payload: CreateWorkExperienceDto): Promise<WorkExperience> {
			const res = await authFetch<ApiResponse<WorkExperience>>(`/v1/employees/${employeeId}/work-experiences`, {
				method: 'POST',
				body: payload,
			});
			return res.data;
		},

		async updateWorkExperience(
			employeeId: number,
			experienceId: number,
			payload: UpdateWorkExperienceDto,
		): Promise<WorkExperience> {
			const res = await authFetch<ApiResponse<WorkExperience>>(
				`/v1/employees/${employeeId}/work-experiences/${experienceId}`,
				{ method: 'PATCH', body: payload },
			);
			return res.data;
		},

		removeWorkExperience(employeeId: number, experienceId: number): Promise<void> {
			return authFetch<void>(`/v1/employees/${employeeId}/work-experiences/${experienceId}`, {
				method: 'DELETE',
			});
		},

		/** Mới nhất trước; giao diện riêng cho lịch sử công tác là lô 3d. */
		async findEmploymentHistory(employeeId: number): Promise<EmploymentHistoryItem[]> {
			const res = await authFetch<ApiResponse<EmploymentHistoryItem[]>>(
				`/v1/employees/${employeeId}/employment-history`,
			);
			return res.data;
		},
	};
};
