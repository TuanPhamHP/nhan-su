import { useGeneralRequestService } from '~/services/general-request.service';
import type {
	CreateTemplateDto,
	DocumentTemplateDetail,
	FlowResponse,
	PutFlowDto,
	QueryTemplateParams,
	UpdateTemplateDto,
} from '~/types/general-request.types';

/**
 * Loại phiếu đề xuất và luồng duyệt của từng loại.
 *
 * Lưu luồng tạo một phiên bản mới; phiếu đang chạy giữ chuỗi duyệt tính lúc gửi, nên sửa luồng
 * không làm phiếu đang đi bị lệch bước.
 */
export function useDocumentTemplates() {
	const service = useGeneralRequestService();

	const templates = ref<DocumentTemplateDetail[]>([]);
	const loading = ref(false);

	async function fetchTemplates(params?: QueryTemplateParams) {
		loading.value = true;
		try {
			templates.value = await service.findTemplates(params);
		} finally {
			loading.value = false;
		}
	}

	function fetchTemplate(id: number): Promise<DocumentTemplateDetail> {
		return service.findTemplate(id);
	}

	function createTemplate(dto: CreateTemplateDto): Promise<DocumentTemplateDetail> {
		return service.createTemplate(dto);
	}

	function updateTemplate(id: number, dto: UpdateTemplateDto): Promise<DocumentTemplateDetail> {
		return service.updateTemplate(id, dto);
	}

	function fetchFlow(templateId: number): Promise<FlowResponse> {
		return service.findFlow(templateId);
	}

	function saveFlow(templateId: number, dto: PutFlowDto): Promise<FlowResponse> {
		return service.saveFlow(templateId, dto);
	}

	return {
		templates,
		loading,
		fetchTemplates,
		fetchTemplate,
		createTemplate,
		updateTemplate,
		fetchFlow,
		saveFlow,
	};
}
