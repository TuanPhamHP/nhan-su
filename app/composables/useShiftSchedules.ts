import { useShiftScheduleService } from '~/services/shift-schedule.service';
import type {
	ShiftScheduleResponse,
	CalendarDayResponse,
	AssignShiftDto,
	BulkAssignShiftDto,
	SetDefaultShiftDto,
	QueryShiftScheduleParams,
	QueryCalendarParams,
} from '~/types/shift.types';

export function useShiftSchedules() {
	const service = useShiftScheduleService();

	// GET /calendar — grouped by date
	const calendarDays = ref<CalendarDayResponse[]>([]);
	// GET /shift-schedules — flat list
	const schedules = ref<ShiftScheduleResponse[]>([]);
	const loading = ref(false);

	async function fetchCalendar(params: QueryCalendarParams) {
		loading.value = true;
		try {
			calendarDays.value = await service.fetchCalendar(params);
		} finally {
			loading.value = false;
		}
	}

	async function fetchMySchedule(params?: QueryShiftScheduleParams) {
		loading.value = true;
		try {
			schedules.value = await service.findMine(params);
		} finally {
			loading.value = false;
		}
	}

	async function assignShift(dto: AssignShiftDto): Promise<ShiftScheduleResponse> {
		return service.assign(dto);
	}

	async function bulkAssign(dto: BulkAssignShiftDto): Promise<void> {
		await service.bulkAssign(dto);
	}

	async function removeShift(employeeId: number, date: string): Promise<void> {
		await service.remove(employeeId, date);
	}

	async function setDefaultShift(employeeId: number, dto: SetDefaultShiftDto): Promise<void> {
		await service.setDefault(employeeId, dto);
	}

	return {
		calendarDays,
		schedules,
		loading,
		fetchCalendar,
		fetchMySchedule,
		assignShift,
		bulkAssign,
		removeShift,
		setDefaultShift,
	};
}
