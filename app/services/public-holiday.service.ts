import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse } from '~/types/api.types';
import type {
	PublicHolidayResponse,
	CreatePublicHolidayDto,
	UpdatePublicHolidayDto,
	BulkYearDto,
	BulkYearResponse,
	CreateHolidayRangeDto,
	RangeResponse,
} from '~/types/public-holiday.types';

export const usePublicHolidayService = () => {
	const authFetch = useAuthFetch();

	return {
		async findAll(year?: number): Promise<PublicHolidayResponse[]> {
			const res = await authFetch<ApiResponse<PublicHolidayResponse[]>>('/v1/public-holidays', {
				params: year ? { year } : {},
			});
			return res.data;
		},

		async create(dto: CreatePublicHolidayDto): Promise<PublicHolidayResponse> {
			const res = await authFetch<ApiResponse<PublicHolidayResponse>>('/v1/public-holidays', {
				method: 'POST',
				body: dto,
			});
			return res.data;
		},

		async update(id: number, dto: UpdatePublicHolidayDto): Promise<PublicHolidayResponse> {
			const res = await authFetch<ApiResponse<PublicHolidayResponse>>(`/v1/public-holidays/${id}`, {
				method: 'PATCH',
				body: dto,
			});
			return res.data;
		},

		async remove(id: number): Promise<void> {
			await authFetch(`/v1/public-holidays/${id}`, { method: 'DELETE' });
		},

		async createRange(dto: CreateHolidayRangeDto): Promise<RangeResponse> {
			const res = await authFetch<ApiResponse<RangeResponse>>('/v1/public-holidays/range', {
				method: 'POST',
				body: dto,
			});
			return res.data;
		},

		async bulkCreateYear(year: number): Promise<BulkYearResponse> {
			const body: BulkYearDto = { year };
			const res = await authFetch<ApiResponse<BulkYearResponse>>('/v1/public-holidays/bulk-year', {
				method: 'POST',
				body,
			});
			return res.data;
		},
	};
};
