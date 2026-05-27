import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedResponse, PaginatedMeta } from '~/types/api.types';
import type { SystemLog, QueryLogParams } from '~/types/log.types';

export const useLogService = () => {
	const authFetch = useAuthFetch();

	return {
		async findAll(params?: QueryLogParams): Promise<{ data: SystemLog[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<SystemLog>>('/v1/logs', { params });
			return { data: res.data, meta: res.meta };
		},

		async findOne(id: number): Promise<SystemLog> {
			const res = await authFetch<ApiResponse<SystemLog>>(`/v1/logs/${id}`);
			return res.data;
		},
	};
};
