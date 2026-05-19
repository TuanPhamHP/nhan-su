import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse } from '~/types/api.types';
import type { WorkShiftResponse, CreateWorkShiftDto, UpdateWorkShiftDto } from '~/types/shift.types';

export const useWorkShiftService = () => {
	const authFetch = useAuthFetch();

	return {
		async findAll(): Promise<WorkShiftResponse[]> {
			const res = await authFetch<ApiResponse<WorkShiftResponse[]>>('/v1/work-shifts');
			return res.data;
		},

		async create(dto: CreateWorkShiftDto): Promise<WorkShiftResponse> {
			const res = await authFetch<ApiResponse<WorkShiftResponse>>('/v1/work-shifts', {
				method: 'POST',
				body: dto,
			});
			return res.data;
		},

		async update(id: number, dto: UpdateWorkShiftDto): Promise<WorkShiftResponse> {
			const res = await authFetch<ApiResponse<WorkShiftResponse>>(`/v1/work-shifts/${id}`, {
				method: 'PATCH',
				body: dto,
			});
			return res.data;
		},

		// Soft delete — set isActive = false. 400 nếu đã inactive.
		deactivate(id: number): Promise<void> {
			return authFetch<void>(`/v1/work-shifts/${id}`, { method: 'DELETE' });
		},
	};
};
