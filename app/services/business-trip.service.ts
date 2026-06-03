import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedResponse, PaginatedMeta } from '~/types/api.types';
import type {
	BusinessTripResponse,
	CreateBusinessTripDto,
	UpdateBusinessTripDto,
	SubmitBusinessTripDto,
	RejectBusinessTripDto,
	CreateTripReportDto,
	UpdateTripReportDto,
	QueryBusinessTripsParams,
} from '~/types/business-trip.types';

export const useBusinessTripService = () => {
	const authFetch = useAuthFetch();

	return {
		async findMe(params?: QueryBusinessTripsParams): Promise<{ data: BusinessTripResponse[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<BusinessTripResponse>>('/v1/business-trips/me', { params });
			return { data: res.data, meta: res.meta };
		},

		async findPendingForMe(): Promise<BusinessTripResponse[]> {
			const res = await authFetch<ApiResponse<BusinessTripResponse[]>>('/v1/business-trips/pending-for-me');
			return res.data;
		},

		async findAll(params?: QueryBusinessTripsParams): Promise<{ data: BusinessTripResponse[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<BusinessTripResponse>>('/v1/business-trips', { params });
			return { data: res.data, meta: res.meta };
		},

		async findOne(id: number): Promise<BusinessTripResponse> {
			const res = await authFetch<ApiResponse<BusinessTripResponse>>(`/v1/business-trips/${id}`);
			return res.data;
		},

		async create(dto: CreateBusinessTripDto): Promise<BusinessTripResponse> {
			const res = await authFetch<ApiResponse<BusinessTripResponse>>('/v1/business-trips', {
				method: 'POST',
				body: dto,
			});
			return res.data;
		},

		async update(id: number, dto: UpdateBusinessTripDto): Promise<BusinessTripResponse> {
			const res = await authFetch<ApiResponse<BusinessTripResponse>>(`/v1/business-trips/${id}`, {
				method: 'PATCH',
				body: dto,
			});
			return res.data;
		},

		async submit(id: number, dto: SubmitBusinessTripDto): Promise<BusinessTripResponse> {
			const res = await authFetch<ApiResponse<BusinessTripResponse>>(`/v1/business-trips/${id}/submit`, {
				method: 'PATCH',
				body: dto,
			});
			return res.data;
		},

		async approve(id: number): Promise<BusinessTripResponse> {
			const res = await authFetch<ApiResponse<BusinessTripResponse>>(`/v1/business-trips/${id}/approve`, {
				method: 'PATCH',
			});
			return res.data;
		},

		async reject(id: number, dto: RejectBusinessTripDto): Promise<BusinessTripResponse> {
			const res = await authFetch<ApiResponse<BusinessTripResponse>>(`/v1/business-trips/${id}/reject`, {
				method: 'PATCH',
				body: dto,
			});
			return res.data;
		},

		async createReport(id: number, dto: CreateTripReportDto): Promise<BusinessTripResponse> {
			const res = await authFetch<ApiResponse<BusinessTripResponse>>(`/v1/business-trips/${id}/report`, {
				method: 'POST',
				body: dto,
			});
			return res.data;
		},

		async updateReport(id: number, dto: UpdateTripReportDto): Promise<BusinessTripResponse> {
			const res = await authFetch<ApiResponse<BusinessTripResponse>>(`/v1/business-trips/${id}/report`, {
				method: 'PATCH',
				body: dto,
			});
			return res.data;
		},

		async submitReport(id: number): Promise<BusinessTripResponse> {
			const res = await authFetch<ApiResponse<BusinessTripResponse>>(`/v1/business-trips/${id}/report/submit`, {
				method: 'PATCH',
			});
			return res.data;
		},
	};
};
