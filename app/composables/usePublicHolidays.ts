import { usePublicHolidayService } from '~/services/public-holiday.service';
import type {
	PublicHolidayResponse,
	CreatePublicHolidayDto,
	UpdatePublicHolidayDto,
	CreateHolidayRangeDto,
	RangeResponse,
} from '~/types/public-holiday.types';

export function usePublicHolidays() {
	const service = usePublicHolidayService();

	const holidays = ref<PublicHolidayResponse[]>([]);
	const loading = ref(false);

	async function fetchHolidays(year?: number) {
		loading.value = true;
		try {
			holidays.value = await service.findAll(year);
		} finally {
			loading.value = false;
		}
	}

	async function createHoliday(dto: CreatePublicHolidayDto): Promise<PublicHolidayResponse> {
		const created = await service.create(dto);
		holidays.value = [...holidays.value, created].sort((a, b) => a.date.localeCompare(b.date));
		return created;
	}

	async function updateHoliday(id: number, dto: UpdatePublicHolidayDto): Promise<PublicHolidayResponse> {
		const updated = await service.update(id, dto);
		const idx = holidays.value.findIndex(h => h.id === id);
		if (idx !== -1) {
			const next = [...holidays.value];
			next.splice(idx, 1, updated);
			holidays.value = next.sort((a, b) => a.date.localeCompare(b.date));
		}
		return updated;
	}

	async function createHolidayRange(dto: CreateHolidayRangeDto, year?: number): Promise<RangeResponse> {
		const result = await service.createRange(dto);
		const refetchYear = year ?? parseInt(dto.fromDate.slice(0, 4));
		await fetchHolidays(refetchYear);
		return result;
	}

	async function deleteHoliday(id: number): Promise<void> {
		await service.remove(id);
		holidays.value = holidays.value.filter(h => h.id !== id);
	}

	async function bulkCreateYear(year: number) {
		const result = await service.bulkCreateYear(year);
		await fetchHolidays(year);
		return result;
	}

	return {
		holidays,
		loading,
		fetchHolidays,
		createHoliday,
		createHolidayRange,
		updateHoliday,
		deleteHoliday,
		bulkCreateYear,
	};
}
