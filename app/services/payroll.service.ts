import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedResponse, PaginatedMeta } from '~/types/api.types';
import type {
	PayrollSummary,
	PayrollDetail,
	CreatePayrollDto,
	UpdatePayrollDto,
	QueryPayrollParams,
} from '~/types/payroll.types';

export const usePayrollService = () => {
	const authFetch = useAuthFetch();

	return {
		async findAll(params?: QueryPayrollParams): Promise<{ data: PayrollSummary[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<PayrollSummary>>('/v1/payroll', { params });
			return { data: res.data, meta: res.meta };
		},

		async findOne(id: number): Promise<PayrollDetail> {
			const res = await authFetch<ApiResponse<PayrollDetail>>(`/v1/payroll/${id}`);
			return res.data;
		},

		async create(dto: CreatePayrollDto): Promise<PayrollDetail> {
			const res = await authFetch<ApiResponse<PayrollDetail>>('/v1/payroll', {
				method: 'POST',
				body: dto,
			});
			return res.data;
		},

		async update(id: number, dto: UpdatePayrollDto): Promise<PayrollDetail> {
			const res = await authFetch<ApiResponse<PayrollDetail>>(`/v1/payroll/${id}`, {
				method: 'PATCH',
				body: dto,
			});
			return res.data;
		},

		async publish(id: number): Promise<PayrollDetail> {
			const res = await authFetch<ApiResponse<PayrollDetail>>(`/v1/payroll/${id}/publish`, {
				method: 'POST',
			});
			return res.data;
		},

		async findMe(): Promise<PayrollSummary[]> {
			const res = await authFetch<ApiResponse<PayrollSummary[]>>('/v1/payroll/me');
			return res.data;
		},

		async exportPdf(id: number): Promise<Blob> {
			return authFetch<Blob>(`/v1/payroll/${id}/export`, { responseType: 'blob' });
		},
	};
};
