import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse } from '~/types/api.types';
import type {
	EmployeeFaceResponseDto,
	FaceSettingsResponseDto,
	FaceStatusItemDto,
	MyFaceStatusResponseDto,
} from '~/types/attendance.types';

/**
 * Chấm công bằng khuôn mặt (`docs/backend/bridges/attendance.md` mục cuối). Việc so khớp nằm trong
 * check-in, check-out của `attendance.service.ts`; file này chỉ lo công tắc, đăng ký và phần HR.
 */
export const useAttendanceFaceService = () => {
	const authFetch = useAuthFetch();

	return {
		async getSettings(): Promise<FaceSettingsResponseDto> {
			const res = await authFetch<ApiResponse<FaceSettingsResponseDto>>('/v1/attendance/face/settings');
			return res.data;
		},

		/** Cần `attendance:face:setting`. */
		async updateSettings(enabled: boolean): Promise<FaceSettingsResponseDto> {
			const res = await authFetch<ApiResponse<FaceSettingsResponseDto>>('/v1/attendance/face/settings', {
				method: 'PUT',
				body: { enabled },
			});
			return res.data;
		},

		async getMine(): Promise<MyFaceStatusResponseDto> {
			const res = await authFetch<ApiResponse<MyFaceStatusResponseDto>>('/v1/attendance/face/me');
			return res.data;
		},

		/** Tự đăng ký lần đầu; `consent` luôn là `"true"` vì nút gửi chỉ mở khi đã tick ô đồng ý. */
		async registerMine(photo: File): Promise<MyFaceStatusResponseDto> {
			const formData = new FormData();
			formData.append('photo', photo);
			formData.append('consent', 'true');
			const res = await authFetch<ApiResponse<MyFaceStatusResponseDto>>('/v1/attendance/face/me', {
				method: 'POST',
				body: formData,
			});
			return res.data;
		},

		/** Cần `attendance:face:manage`. */
		async listEmployees(): Promise<FaceStatusItemDto[]> {
			const res = await authFetch<ApiResponse<FaceStatusItemDto[]>>('/v1/attendance/face/employees');
			return res.data;
		},

		async getEmployee(employeeId: number): Promise<EmployeeFaceResponseDto> {
			const res = await authFetch<ApiResponse<EmployeeFaceResponseDto>>(
				`/v1/attendance/face/employees/${employeeId}`,
			);
			return res.data;
		},

		/** 204: xoá hẳn để nhân viên đăng ký lại. */
		async resetEmployee(employeeId: number): Promise<void> {
			await authFetch(`/v1/attendance/face/employees/${employeeId}`, { method: 'DELETE' });
		},
	};
};
