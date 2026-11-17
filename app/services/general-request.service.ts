import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedResponse, PaginatedMeta } from '~/types/api.types';
import type {
	AddWatchersDto,
	ApproveRequestDto,
	AttachmentUrlResponse,
	CreateCommentDto,
	CreateRequestDto,
	CreateTemplateDto,
	DocumentTemplateDetail,
	FlowPreviewDto,
	FlowPreviewResponse,
	FlowResponse,
	GeneralRequestDetail,
	GeneralRequestResponse,
	OverrideRequestDto,
	PendingRequest,
	PutFlowDto,
	QueryRequestParams,
	QueryTemplateParams,
	ReassignRequestDto,
	RejectRequestDto,
	RequestAttachment,
	RequestComment,
	ReturnRequestDto,
	SaveDraftDto,
	SubmitRequestDto,
	SuggestedApprover,
	TransferRequestDto,
	UpdateTemplateDto,
} from '~/types/general-request.types';

/**
 * Phiếu đề xuất (`/v1/general-requests`, lô 4a).
 *
 * Mọi thao tác duyệt trả về CHI TIẾT phiếu mới nhất, nên màn chi tiết thay thẳng dữ liệu nhận
 * được thay vì gọi lại `findOne`.
 */
export const useGeneralRequestService = () => {
	const authFetch = useAuthFetch();

	return {
		// ─── Loại phiếu và luồng duyệt ────────────────────────────────────────────
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

		async findFlow(templateId: number): Promise<FlowResponse> {
			const res = await authFetch<ApiResponse<FlowResponse>>(`/v1/general-requests/templates/${templateId}/flow`);
			return res.data;
		},

		async saveFlow(templateId: number, dto: PutFlowDto): Promise<FlowResponse> {
			const res = await authFetch<ApiResponse<FlowResponse>>(`/v1/general-requests/templates/${templateId}/flow`, {
				method: 'PUT',
				body: dto,
			});
			return res.data;
		},

		/** Chuỗi người duyệt sẽ tính cho người đang gọi, theo giá trị biểu mẫu và người đã chọn. */
		async previewFlow(templateId: number, dto: FlowPreviewDto): Promise<FlowPreviewResponse> {
			const res = await authFetch<ApiResponse<FlowPreviewResponse>>(
				`/v1/general-requests/templates/${templateId}/flow/preview`,
				{ method: 'POST', body: dto },
			);
			return res.data;
		},

		// ─── Danh sách ────────────────────────────────────────────────────────────
		async findMe(params?: QueryRequestParams): Promise<{ data: GeneralRequestResponse[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<GeneralRequestResponse>>('/v1/general-requests/me', { params });
			return { data: res.data, meta: res.meta };
		},

		/** Mảng, không phân trang, hạn gần nhất trước. */
		async findPendingForMe(): Promise<PendingRequest[]> {
			const res = await authFetch<ApiResponse<PendingRequest[]>>('/v1/general-requests/pending-for-me');
			return res.data;
		},

		async findWatching(params?: QueryRequestParams): Promise<{ data: GeneralRequestResponse[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<GeneralRequestResponse>>('/v1/general-requests/watching', {
				params,
			});
			return { data: res.data, meta: res.meta };
		},

		/** Tra cứu trong phạm vi xem được. */
		async findAll(params?: QueryRequestParams): Promise<{ data: GeneralRequestResponse[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<GeneralRequestResponse>>('/v1/general-requests', { params });
			return { data: res.data, meta: res.meta };
		},

		/** Giữ cho trang tạo đơn công tác tới lô 4c; phiếu đề xuất không dùng nữa. */
		async findSuggestedApprovers(employeeId?: number): Promise<SuggestedApprover[]> {
			const res = await authFetch<ApiResponse<SuggestedApprover[]>>('/v1/general-requests/suggested-approvers', {
				params: employeeId ? { employeeId } : undefined,
			});
			return res.data;
		},

		// ─── Phiếu ────────────────────────────────────────────────────────────────
		async findOne(id: number): Promise<GeneralRequestDetail> {
			const res = await authFetch<ApiResponse<GeneralRequestDetail>>(`/v1/general-requests/${id}`);
			return res.data;
		},

		async create(dto: CreateRequestDto): Promise<GeneralRequestDetail> {
			const res = await authFetch<ApiResponse<GeneralRequestDetail>>('/v1/general-requests', {
				method: 'POST',
				body: dto,
			});
			return res.data;
		},

		async saveDraft(id: number, dto: SaveDraftDto): Promise<GeneralRequestDetail> {
			const res = await authFetch<ApiResponse<GeneralRequestDetail>>(`/v1/general-requests/${id}/draft`, {
				method: 'PATCH',
				body: dto,
			});
			return res.data;
		},

		remove(id: number): Promise<void> {
			return authFetch<void>(`/v1/general-requests/${id}`, { method: 'DELETE' });
		},

		/** Gửi lần đầu, hoặc nộp lại phiếu đang ở "Cần bổ sung". */
		async submit(id: number, dto: SubmitRequestDto): Promise<GeneralRequestDetail> {
			const res = await authFetch<ApiResponse<GeneralRequestDetail>>(`/v1/general-requests/${id}/submit`, {
				method: 'PATCH',
				body: dto,
			});
			return res.data;
		},

		async approve(id: number, dto?: ApproveRequestDto): Promise<GeneralRequestDetail> {
			const res = await authFetch<ApiResponse<GeneralRequestDetail>>(`/v1/general-requests/${id}/approve`, {
				method: 'PATCH',
				body: dto ?? {},
			});
			return res.data;
		},

		async reject(id: number, dto: RejectRequestDto): Promise<GeneralRequestDetail> {
			const res = await authFetch<ApiResponse<GeneralRequestDetail>>(`/v1/general-requests/${id}/reject`, {
				method: 'PATCH',
				body: dto,
			});
			return res.data;
		},

		async returnForEdit(id: number, dto: ReturnRequestDto): Promise<GeneralRequestDetail> {
			const res = await authFetch<ApiResponse<GeneralRequestDetail>>(`/v1/general-requests/${id}/return`, {
				method: 'PATCH',
				body: dto,
			});
			return res.data;
		},

		async transfer(id: number, dto: TransferRequestDto): Promise<GeneralRequestDetail> {
			const res = await authFetch<ApiResponse<GeneralRequestDetail>>(`/v1/general-requests/${id}/transfer`, {
				method: 'PATCH',
				body: dto,
			});
			return res.data;
		},

		/** Chỉ quản trị viên, và không với phiếu của chính mình. */
		async override(id: number, dto: OverrideRequestDto): Promise<GeneralRequestDetail> {
			const res = await authFetch<ApiResponse<GeneralRequestDetail>>(`/v1/general-requests/${id}/override`, {
				method: 'PATCH',
				body: dto,
			});
			return res.data;
		},

		/** Đổi người duyệt ở mọi bước còn mở; cần quyền `request:reassign`. */
		async reassign(id: number, dto: ReassignRequestDto): Promise<GeneralRequestDetail> {
			const res = await authFetch<ApiResponse<GeneralRequestDetail>>(`/v1/general-requests/${id}/reassign`, {
				method: 'PATCH',
				body: dto,
			});
			return res.data;
		},

		async cancel(id: number): Promise<GeneralRequestDetail> {
			const res = await authFetch<ApiResponse<GeneralRequestDetail>>(`/v1/general-requests/${id}/cancel`, {
				method: 'PATCH',
				body: {},
			});
			return res.data;
		},

		async print(id: number): Promise<GeneralRequestDetail> {
			const res = await authFetch<ApiResponse<GeneralRequestDetail>>(`/v1/general-requests/${id}/print`, {
				method: 'POST',
				body: {},
			});
			return res.data;
		},

		// ─── Bình luận, người theo dõi, file ──────────────────────────────────────
		async findComments(id: number): Promise<RequestComment[]> {
			const res = await authFetch<ApiResponse<RequestComment[]>>(`/v1/general-requests/${id}/comments`);
			return res.data;
		},

		async addComment(id: number, dto: CreateCommentDto): Promise<RequestComment> {
			const res = await authFetch<ApiResponse<RequestComment>>(`/v1/general-requests/${id}/comments`, {
				method: 'POST',
				body: dto,
			});
			return res.data;
		},

		async addWatchers(id: number, dto: AddWatchersDto): Promise<GeneralRequestDetail> {
			const res = await authFetch<ApiResponse<GeneralRequestDetail>>(`/v1/general-requests/${id}/watchers`, {
				method: 'POST',
				body: dto,
			});
			return res.data;
		},

		async uploadAttachment(id: number, file: File): Promise<RequestAttachment> {
			const formData = new FormData();
			formData.append('file', file);
			const res = await authFetch<ApiResponse<RequestAttachment>>(`/v1/general-requests/${id}/attachments`, {
				method: 'POST',
				body: formData,
			});
			return res.data;
		},

		removeAttachment(id: number, attachmentId: number): Promise<void> {
			return authFetch<void>(`/v1/general-requests/${id}/attachments/${attachmentId}`, { method: 'DELETE' });
		},

		/** Link ký sống một giờ. */
		async attachmentUrl(id: number, attachmentId: number): Promise<AttachmentUrlResponse> {
			const res = await authFetch<ApiResponse<AttachmentUrlResponse>>(
				`/v1/general-requests/${id}/attachments/${attachmentId}/url`,
			);
			return res.data;
		},
	};
};
