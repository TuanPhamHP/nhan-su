import { useEmployeeDocumentTypeService } from '~/services/employee-document-type.service';
import type { EmployeeDocumentType } from '~/types/hr-profile.types';

/**
 * Danh mục loại giấy tờ, dùng cho cả form tải tài liệu và trang cài đặt danh mục.
 *
 * Form tải tài liệu chỉ cần loại đang dùng, còn trang cài đặt cần cả loại đã tắt, nên nơi gọi
 * tự chọn qua `includeInactive`.
 */
export function useEmployeeDocumentTypes() {
	const service = useEmployeeDocumentTypeService();

	const types = ref<EmployeeDocumentType[]>([]);
	const loading = ref(false);
	const error = ref<string | null>(null);

	async function fetchTypes(includeInactive = false) {
		loading.value = true;
		error.value = null;
		try {
			types.value = await service.findAll(includeInactive);
		} catch (e) {
			error.value = e instanceof Error ? e.message : 'Không tải được danh mục loại giấy tờ';
			throw e;
		} finally {
			loading.value = false;
		}
	}

	/** Loại đang dùng, đã sắp theo `sortOrder` rồi tới tên để ô chọn có thứ tự ổn định. */
	const activeTypes = computed(() =>
		types.value
			.filter(t => t.isActive)
			.slice()
			.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'vi')),
	);

	function upsert(type: EmployeeDocumentType) {
		const idx = types.value.findIndex(t => t.id === type.id);
		if (idx === -1) types.value = [...types.value, type];
		else types.value.splice(idx, 1, type);
	}

	return { types, activeTypes, loading, error, fetchTypes, upsert };
}
