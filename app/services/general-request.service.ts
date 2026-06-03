import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedResponse, PaginatedMeta } from '~/types/api.types';
import type {
	GeneralRequestResponse,
	DocumentTemplateDetail,
	SuggestedApprover,
	CreateTemplateDto,
	UpdateTemplateDto,
	CreateRequestDto,
	SaveDraftDto,
	SubmitRequestDto,
	ApproveRequestDto,
	RejectRequestDto,
	QueryRequestParams,
	QueryTemplateParams,
} from '~/types/general-request.types';

export const useGeneralRequestService = () => {
	const authFetch = useAuthFetch();

	return {
		async findTemplates(params?: QueryTemplateParams): Promise<DocumentTemplateDetail[]> {
			const res = await authFetch<ApiResponse<DocumentTemplateDetail[]>>('/v1/general-requests/templates', { params });
			return res.data;
		},

		async findTemplate(id: number): Promise<DocumentTemplateDetail> {
			const res = await authFetch<ApiResponse<DocumentTemplateDetail>>(`/v1/general-requests/templates/${id}`);
			return res.data;
		},

		async createTemplate(dto: CreateTemplateDto): Promise<DocumentTemplateDetail> {
			const res = await authFetch<ApiResponse<DocumentTemplateDetail>>('/v1/general-requests/templates', {
				method: 'POST',
				body: dto,
			});
			return res.data;
		},

		async updateTemplate(id: number, dto: UpdateTemplateDto): Promise<DocumentTemplateDetail> {
			const res = await authFetch<ApiResponse<DocumentTemplateDetail>>(`/v1/general-requests/templates/${id}`, {
				method: 'PATCH',
				body: dto,
			});
			return res.data;
		},

		async findMe(params?: QueryRequestParams): Promise<{ data: GeneralRequestResponse[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<GeneralRequestResponse>>('/v1/general-requests/me', { params });
			return { data: res.data, meta: res.meta };
		},

		async findPendingForMe(): Promise<GeneralRequestResponse[]> {
			const res = await authFetch<ApiResponse<GeneralRequestResponse[]>>('/v1/general-requests/pending-for-me');
			return res.data;
		},

		async findSuggestedApprovers(employeeId?: number): Promise<SuggestedApprover[]> {
			const res = await authFetch<ApiResponse<SuggestedApprover[]>>('/v1/general-requests/suggested-approvers', {
				params: employeeId ? { employeeId } : undefined,
			});
			return res.data;
		},

		async findAll(params?: QueryRequestParams): Promise<{ data: GeneralRequestResponse[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<GeneralRequestResponse>>('/v1/general-requests', { params });
			return { data: res.data, meta: res.meta };
		},

		async findOne(id: number): Promise<GeneralRequestResponse> {
			const res = await authFetch<ApiResponse<GeneralRequestResponse>>(`/v1/general-requests/${id}`);
			return res.data;
		},

		async create(dto: CreateRequestDto): Promise<GeneralRequestResponse> {
			const res = await authFetch<ApiResponse<GeneralRequestResponse>>('/v1/general-requests', {
				method: 'POST',
				body: dto,
			});
			return res.data;
		},

		async saveDraft(id: number, dto: SaveDraftDto): Promise<GeneralRequestResponse> {
			const res = await authFetch<ApiResponse<GeneralRequestResponse>>(`/v1/general-requests/${id}/draft`, {
				method: 'PATCH',
				body: dto,
			});
			return res.data;
		},

		async submit(id: number, dto: SubmitRequestDto): Promise<GeneralRequestResponse> {
			const res = await authFetch<ApiResponse<GeneralRequestResponse>>(`/v1/general-requests/${id}/submit`, {
				method: 'PATCH',
				body: dto,
			});
			return res.data;
		},

		async approve(id: number, dto?: ApproveRequestDto): Promise<GeneralRequestResponse> {
			const res = await authFetch<ApiResponse<GeneralRequestResponse>>(`/v1/general-requests/${id}/approve`, {
				method: 'PATCH',
				body: dto ?? {},
			});
			return res.data;
		},

		async reject(id: number, dto: RejectRequestDto): Promise<GeneralRequestResponse> {
			const res = await authFetch<ApiResponse<GeneralRequestResponse>>(`/v1/general-requests/${id}/reject`, {
				method: 'PATCH',
				body: dto,
			});
			return res.data;
		},

		async print(id: number): Promise<GeneralRequestResponse> {
			const res = await authFetch<ApiResponse<GeneralRequestResponse>>(`/v1/general-requests/${id}/print`, {
				method: 'POST',
				body: {},
			});
			return res.data;
		},
	};
};
