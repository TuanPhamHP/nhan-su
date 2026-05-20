import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedResponse, PaginatedMeta } from '~/types/api.types';
import type {
	Position,
	PositionSummary,
	QueryPositionParams,
	CreatePositionDto,
	UpdatePositionDto,
} from '~/types/position.types';

export const usePositionService = () => {
	const authFetch = useAuthFetch();

	return {
		async findAll(params?: QueryPositionParams): Promise<{ data: PositionSummary[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<PositionSummary>>('/v1/positions', { params });
			return { data: res.data, meta: res.meta };
		},

		async findActive(departmentId?: number): Promise<PositionSummary[]> {
			const res = await authFetch<ApiResponse<PositionSummary[]>>('/v1/positions', {
				params: { isActive: true, limit: 100, departmentId },
			});
			return res.data;
		},

		async findOne(id: number): Promise<Position> {
			const res = await authFetch<ApiResponse<Position>>(`/v1/positions/${id}`);
			return res.data;
		},

		async create(dto: CreatePositionDto): Promise<Position> {
			const res = await authFetch<ApiResponse<Position>>('/v1/positions', {
				method: 'POST',
				body: dto,
			});
			return res.data;
		},

		async update(id: number, dto: UpdatePositionDto): Promise<Position> {
			const res = await authFetch<ApiResponse<Position>>(`/v1/positions/${id}`, {
				method: 'PATCH',
				body: dto,
			});
			return res.data;
		},

		async deactivate(id: number): Promise<void> {
			await authFetch(`/v1/positions/${id}`, { method: 'DELETE' });
		},
	};
};
