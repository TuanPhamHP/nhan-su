import { useDepartmentService } from '~/services/department.service';
import type { DepartmentSummary, DepartmentQueryParams } from '~/types/department.types';
import type { PaginatedMeta } from '~/types/api.types';

export function useDepartment() {
	const service = useDepartmentService();
	const departments = ref<DepartmentSummary[]>([]);
	const meta = ref<PaginatedMeta | null>(null);
	const loading = ref(false);

	async function fetchList(params?: DepartmentQueryParams) {
		loading.value = true;
		try {
			const res = await service.findAll(params);
			departments.value = res.data;
			meta.value = res.meta;
		} finally {
			loading.value = false;
		}
	}

	// Kept for backward compatibility (e.g. employee page filter dropdown)
	async function fetchAll() {
		await fetchList({ pagination: false });
	}

	return { departments, meta, loading, fetchList, fetchAll };
}
