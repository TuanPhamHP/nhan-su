import { useGeneralRequestService } from '~/services/general-request.service';
import type { DocumentTemplateDetail, QueryTemplateParams } from '~/types/general-request.types';

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

	async function fetchTemplate(id: number): Promise<DocumentTemplateDetail> {
		return service.findTemplate(id);
	}

	async function createTemplate(dto: Parameters<ReturnType<typeof useGeneralRequestService>['createTemplate']>[0]): Promise<DocumentTemplateDetail> {
		return service.createTemplate(dto);
	}

	async function updateTemplate(id: number, dto: Parameters<ReturnType<typeof useGeneralRequestService>['updateTemplate']>[1]): Promise<DocumentTemplateDetail> {
		return service.updateTemplate(id, dto);
	}

	return {
		templates,
		loading,
		fetchTemplates,
		fetchTemplate,
		createTemplate,
		updateTemplate,
	};
}
