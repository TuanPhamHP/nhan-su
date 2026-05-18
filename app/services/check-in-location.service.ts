import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse } from '~/types/api.types';
import type {
	CheckInLocation,
	CreateCheckInLocationDto,
	UpdateCheckInLocationDto,
} from '~/types/check-in-location.types';

export const useCheckInLocationService = () => {
	const authFetch = useAuthFetch();

	return {
		async findAll(): Promise<CheckInLocation[]> {
			const res = await authFetch<ApiResponse<CheckInLocation[]>>('/v1/check-in-locations');
			return res.data;
		},

		async create(dto: CreateCheckInLocationDto): Promise<CheckInLocation> {
			const res = await authFetch<ApiResponse<CheckInLocation>>('/v1/check-in-locations', {
				method: 'POST',
				body: dto,
			});
			return res.data;
		},

		async update(id: number, dto: UpdateCheckInLocationDto): Promise<CheckInLocation> {
			const res = await authFetch<ApiResponse<CheckInLocation>>(`/v1/check-in-locations/${id}`, {
				method: 'PATCH',
				body: dto,
			});
			return res.data;
		},

		deactivate(id: number): Promise<void> {
			return authFetch<void>(`/v1/check-in-locations/${id}`, { method: 'DELETE' });
		},

		assignEmployee(locationId: number, employeeId: number): Promise<void> {
			return authFetch<void>(`/v1/check-in-locations/${locationId}/employees/${employeeId}`, {
				method: 'POST',
			});
		},

		removeEmployee(locationId: number, employeeId: number): Promise<void> {
			return authFetch<void>(`/v1/check-in-locations/${locationId}/employees/${employeeId}`, {
				method: 'DELETE',
			});
		},
	};
};
