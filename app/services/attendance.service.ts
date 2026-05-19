import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedResponse, PaginatedMeta } from '~/types/api.types';
import type {
	AttendanceRecordDetail,
	ManualEditAttendanceDto,
	QueryAttendanceParams,
} from '~/types/attendance.types';

export const useAttendanceService = () => {
	const authFetch = useAuthFetch();

	return {
		async checkIn(params: { latitude: number; longitude: number; photo: File }): Promise<AttendanceRecordDetail> {
			const formData = new FormData();
			formData.append('photo', params.photo);
			formData.append('latitude', String(params.latitude));
			formData.append('longitude', String(params.longitude));
			const res = await authFetch<ApiResponse<AttendanceRecordDetail>>('/v1/attendance/check-in', {
				method: 'POST',
				body: formData,
			});
			return res.data;
		},

		async checkOut(photo: File): Promise<AttendanceRecordDetail> {
			const formData = new FormData();
			formData.append('photo', photo);
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
	};
};
