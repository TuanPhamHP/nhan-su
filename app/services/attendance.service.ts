import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedResponse, PaginatedMeta } from '~/types/api.types';
import type {
	AttendanceRecordDetail,
	CheckAttendanceResponseDto,
	ManualEditAttendanceDto,
	QueryAttendanceParams,
} from '~/types/attendance.types';

interface CheckPhotoParams {
	latitude: number;
	longitude: number;
	photo: File;
	confirmFaceMismatch?: boolean;
}

export const useAttendanceService = () => {
	const authFetch = useAuthFetch();

	/**
	 * `confirmFaceMismatch` chỉ gửi khi nhân viên bấm "Vẫn xác nhận" sau lỗi khuôn mặt, dạng chuỗi
	 * `"true"`; lần chụp đầu không gửi trường này.
	 */
	function attendanceForm(params: CheckPhotoParams): FormData {
		const formData = new FormData();
		formData.append('photo', params.photo);
		formData.append('latitude', String(params.latitude));
		formData.append('longitude', String(params.longitude));
		if (params.confirmFaceMismatch) formData.append('confirmFaceMismatch', 'true');
		return formData;
	}

	return {
		async checkIn(params: CheckPhotoParams): Promise<AttendanceRecordDetail> {
			const res = await authFetch<ApiResponse<AttendanceRecordDetail>>('/v1/attendance/check-in', {
				method: 'POST',
				body: attendanceForm(params),
			});
			return res.data;
		},

		async checkOut(params: CheckPhotoParams): Promise<AttendanceRecordDetail> {
			const formData = attendanceForm(params);
			const res = await authFetch<ApiResponse<AttendanceRecordDetail>>('/v1/attendance/check-out', {
				method: 'POST',
				body: formData,
			});
			return res.data;
		},

		async findAll(params?: QueryAttendanceParams): Promise<{ data: AttendanceRecordDetail[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<AttendanceRecordDetail>>('/v1/attendance', { params });
			return { data: res.data, meta: res.meta };
		},

		async findMyHistory(params?: QueryAttendanceParams): Promise<{ data: AttendanceRecordDetail[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<AttendanceRecordDetail>>('/v1/attendance/me', { params });
			return { data: res.data, meta: res.meta };
		},

		async manualEdit(id: number, dto: ManualEditAttendanceDto): Promise<AttendanceRecordDetail> {
			const res = await authFetch<ApiResponse<AttendanceRecordDetail>>(`/v1/attendance/${id}`, {
				method: 'PATCH',
				body: dto,
			});
			return res.data;
		},

		async getPhotoPresignedUrl(fileUrl: string): Promise<string> {
			const res = await authFetch<ApiResponse<{ presignedUrl: string }>>('/v1/attendance/photo-url', {
				params: { fileUrl },
			});
			return res.data.presignedUrl;
		},

		async checkAttendance(latitude: number, longitude: number): Promise<CheckAttendanceResponseDto | null> {
			const res = await authFetch<ApiResponse<CheckAttendanceResponseDto | null>>('/v1/attendance/check-attendance', {
				params: { latitude, longitude },
			});
			return res.data;
		},
	};
};
