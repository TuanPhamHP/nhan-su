import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse } from '~/types/api.types';
import type { LeaveType, CreateLeaveTypeDto, UpdateLeaveTypeDto } from '~/types/leave.types';

export const useLeaveTypeService = () => {
	const authFetch = useAuthFetch();

	return {
		async findAll(): Promise<LeaveType[]> {
			const res = await authFetch<ApiResponse<LeaveType[]>>('/v1/leave-types');
			return res.data;
		},

		async create(dto: CreateLeaveTypeDto): Promise<LeaveType> {
			const res = await authFetch<ApiResponse<LeaveType>>('/v1/leave-types', {
				method: 'POST',
				body: dto,
			});
			return res.data;
		},

		async update(id: number, dto: UpdateLeaveTypeDto): Promise<LeaveType> {
			const res = await authFetch<ApiResponse<LeaveType>>(`/v1/leave-types/${id}`, {
				method: 'PATCH',
				body: dto,
			});
			return res.data;
		},

		async deactivate(id: number): Promise<void> {
			await authFetch(`/v1/leave-types/${id}`, { method: 'DELETE' });
		},
	};
};
