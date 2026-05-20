import { useEmployeeDocumentService } from '~/services/employee-document.service';
import type { DocumentType, EmployeeDocumentResponse } from '~/types/employee.types';

export function useEmployeeDocuments() {
	const service = useEmployeeDocumentService();

	const documents = ref<EmployeeDocumentResponse[]>([]);
	const loading = ref(false);
	const uploading = ref(false);

	async function fetchDocuments(employeeId: number) {
		loading.value = true;
		try {
			documents.value = await service.findAll(employeeId);
		} finally {
			loading.value = false;
		}
	}

	async function uploadDocument(employeeId: number, file: File, type: DocumentType): Promise<EmployeeDocumentResponse> {
		uploading.value = true;
		try {
			const created = await service.upload(employeeId, file, type);
			documents.value = [created, ...documents.value];
			return created;
		} finally {
			uploading.value = false;
		}
	}

	async function deleteDocument(employeeId: number, documentId: number) {
		await service.remove(employeeId, documentId);
		documents.value = documents.value.filter(d => d.id !== documentId);
	}

	async function getDocumentUrl(employeeId: number, documentId: number): Promise<string> {
		return service.getUrl(employeeId, documentId);
	}

	return {
		documents,
		loading,
		uploading,
		fetchDocuments,
		uploadDocument,
		deleteDocument,
		getDocumentUrl,
	};
}
