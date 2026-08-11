import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedResponse, PaginatedMeta } from '~/types/api.types';
import type {
	ContractResponse,
	CreateContractDto,
	UpdateContractDto,
	TerminateContractDto,
	QueryContractParams,
	ImportContractsResponse,
} from '~/types/contract.types';

export const useContractService = () => {
	const authFetch = useAuthFetch();

	return {
		async findAll(params?: QueryContractParams): Promise<{ data: ContractResponse[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<ContractResponse>>('/v1/contracts', { params });
			return { data: res.data, meta: res.meta };
		},

		async findMe(params?: Pick<QueryContractParams, 'page' | 'limit' | 'status'>): Promise<{ data: ContractResponse[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<ContractResponse>>('/v1/contracts/me', { params });
			return { data: res.data, meta: res.meta };
		},

		async findById(id: number): Promise<ContractResponse> {
			const res = await authFetch<ApiResponse<ContractResponse>>(`/v1/contracts/${id}`);
			return res.data;
		},

		async create(dto: CreateContractDto, file?: File): Promise<ContractResponse> {
			const formData = new FormData();
			Object.entries(dto).forEach(([k, v]) => {
				if (v != null) formData.append(k, String(v));
			});
			if (file) formData.append('file', file);
			const res = await authFetch<ApiResponse<ContractResponse>>('/v1/contracts', {
				method: 'POST',
				body: formData,
			});
			return res.data;
		},

		async update(id: number, dto: UpdateContractDto, file?: File): Promise<ContractResponse> {
			const formData = new FormData();
			Object.entries(dto).forEach(([k, v]) => {
				if (v != null) formData.append(k, String(v));
			});
			if (file) formData.append('file', file);
			const res = await authFetch<ApiResponse<ContractResponse>>(`/v1/contracts/${id}`, {
				method: 'PATCH',
				body: formData,
			});
			return res.data;
		},

		async activate(id: number): Promise<ContractResponse> {
			const res = await authFetch<ApiResponse<ContractResponse>>(`/v1/contracts/${id}/activate`, {
				method: 'PATCH',
			});
			return res.data;
		},

		async terminate(id: number, dto?: TerminateContractDto): Promise<ContractResponse> {
			const res = await authFetch<ApiResponse<ContractResponse>>(`/v1/contracts/${id}/terminate`, {
				method: 'PATCH',
				body: dto ?? {},
			});
			return res.data;
		},

		async downloadImportTemplate(): Promise<Blob> {
			return authFetch<Blob>('/v1/contracts/import/template', { responseType: 'blob' });
		},

		async importFromExcel(file: File): Promise<ImportContractsResponse> {
			const formData = new FormData();
			formData.append('file', file);
			const res = await authFetch<ApiResponse<ImportContractsResponse>>('/v1/contracts/import', {
				method: 'POST',
				body: formData,
			});
			return res.data;
		},
	};
};
