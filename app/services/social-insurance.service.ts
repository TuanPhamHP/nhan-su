import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedResponse, PaginatedMeta } from '~/types/api.types';
import type {
	SocialInsuranceResponse,
	UpsertSocialInsuranceDto,
	QuerySocialInsuranceParams,
} from '~/types/social-insurance.types';

export const useSocialInsuranceService = () => {
	const authFetch = useAuthFetch();

	return {
		async findByEmployee(employeeId: number): Promise<SocialInsuranceResponse | null> {
			const res = await authFetch<ApiResponse<SocialInsuranceResponse | null>>(
				`/v1/social-insurance/${employeeId}`,
			);
			return res.data;
		},

		async upsert(employeeId: number, dto: UpsertSocialInsuranceDto, file?: File): Promise<SocialInsuranceResponse> {
			const formData = new FormData();
			Object.entries(dto).forEach(([k, v]) => {
				if (v == null) return;
				if (k === 'dependentDetails') formData.append(k, JSON.stringify(v));
				else formData.append(k, String(v));
			});
			if (file) formData.append('siDoc', file);
			const res = await authFetch<ApiResponse<SocialInsuranceResponse>>(
				`/v1/social-insurance/${employeeId}`,
				{ method: 'PUT', body: formData },
			);
			return res.data;
		},

		async findAll(params?: QuerySocialInsuranceParams): Promise<{ data: SocialInsuranceResponse[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<SocialInsuranceResponse>>('/v1/social-insurance', { params });
			return { data: res.data, meta: res.meta };
		},
	};
};
