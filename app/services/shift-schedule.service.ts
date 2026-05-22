import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse } from '~/types/api.types';
import type {
	ShiftScheduleResponse,
	CalendarDayResponse,
	AssignShiftDto,
	BulkAssignShiftDto,
	BulkRangeAssignShiftDto,
	BulkRangeAssignResult,
	BulkOnlineSaturdayDto,
	BulkOnlineSaturdayResult,
	SetDefaultShiftDto,
	QueryShiftScheduleParams,
	QueryCalendarParams,
} from '~/types/shift.types';

export const useShiftScheduleService = () => {
	const authFetch = useAuthFetch();

	return {
		async findAll(params?: QueryShiftScheduleParams): Promise<ShiftScheduleResponse[]> {
			const res = await authFetch<ApiResponse<ShiftScheduleResponse[]>>('/v1/shift-schedules', { params });
			return res.data;
		},

		async findMine(params?: QueryShiftScheduleParams): Promise<ShiftScheduleResponse[]> {
			const res = await authFetch<ApiResponse<ShiftScheduleResponse[]>>('/v1/shift-schedules/me', { params });
			return res.data;
		},

		async fetchCalendar(params: QueryCalendarParams): Promise<CalendarDayResponse[]> {
			const res = await authFetch<ApiResponse<CalendarDayResponse[]>>('/v1/shift-schedules/calendar', { params });
			return res.data;
		},

		async assign(dto: AssignShiftDto): Promise<ShiftScheduleResponse> {
			const res = await authFetch<ApiResponse<ShiftScheduleResponse>>('/v1/shift-schedules', {
				method: 'POST',
				body: dto,
			});
			return res.data;
		},

		bulkAssign(dto: BulkAssignShiftDto): Promise<void> {
			return authFetch<void>('/v1/shift-schedules/bulk', {
				method: 'POST',
				body: dto,
			});
		},

		async bulkAssignRange(dto: BulkRangeAssignShiftDto): Promise<BulkRangeAssignResult> {
			const res = await authFetch<ApiResponse<BulkRangeAssignResult>>('/v1/shift-schedules/bulk-range', {
				method: 'POST',
				body: dto,
			});
			return res.data;
		},

		setDefault(employeeId: number, dto: SetDefaultShiftDto): Promise<void> {
			return authFetch<void>(`/v1/shift-schedules/employees/${employeeId}/default-shift`, {
				method: 'PATCH',
				body: dto,
			});
		},

		async bulkAssignOnlineSaturday(dto: BulkOnlineSaturdayDto): Promise<BulkOnlineSaturdayResult> {
			const res = await authFetch<ApiResponse<BulkOnlineSaturdayResult>>('/v1/shift-schedules/bulk-online-saturday', {
				method: 'POST',
				body: dto,
			});
			return res.data;
		},

		remove(employeeId: number, date: string): Promise<void> {
			return authFetch<void>(`/v1/shift-schedules/${employeeId}/${date}`, { method: 'DELETE' });
		},
	};
};
