import { useEmployeeService } from '~/services/employee.service';
import type {
	Employee,
	EmployeeSummary,
	EmployeeQueryParams,
	CreateEmployeeDto,
	UpdateEmployeeDto,
	TerminateEmployeeDto,
} from '~/types/employee.types';
import type { PaginatedMeta } from '~/types/api.types';

export function useEmployee() {
	const service = useEmployeeService();

	const items = ref<EmployeeSummary[]>([]);
	const currentEmployee = ref<Employee | null>(null);
	const meta = ref<PaginatedMeta | null>(null);
	const loading = ref(false);
	const detailLoading = ref(false);

	async function fetchList(params?: EmployeeQueryParams) {
		loading.value = true;
		try {
			const res = await service.findAll(params);
			items.value = res.data;
			meta.value = res.meta;
		} finally {
			loading.value = false;
		}
	}

	async function fetchOne(id: number) {
		detailLoading.value = true;
		try {
			currentEmployee.value = await service.findOne(id);
		} finally {
			detailLoading.value = false;
		}
	}

	async function create(payload: CreateEmployeeDto): Promise<Employee> {
		return service.create(payload);
	}

	/**
	 * `terminationDate` ("YYYY-MM-DD") là ngày nghỉ việc HR nhập; bỏ trống → BE lấy ngày
	 * hôm nay. Sau khi vô hiệu hóa thì nạp lại chi tiết để `terminationDate` hiển thị
	 * đúng theo BE (không tự đoán ngày ở FE, tránh lệch múi giờ).
	 */
	async function deactivate(id: number, terminationDate?: string) {
		await service.deactivate(id, terminationDate);
		items.value = items.value.filter(emp => emp.id !== id);
		if (currentEmployee.value?.id === id) {
			try {
				currentEmployee.value = await service.findOne(id);
			} catch {
				currentEmployee.value = {
					...currentEmployee.value,
					status: 'INACTIVE',
					terminationDate: terminationDate ?? currentEmployee.value.terminationDate,
				};
			}
		}
	}

	/**
	 * Xác nhận nghỉ việc (hoặc sửa lại ngày/lý do của người đã nghỉ).
	 * BE trả nguyên bản ghi sau cập nhật → lấy thẳng từ response, không đoán ở FE.
	 */
	async function terminate(id: number, payload: TerminateEmployeeDto): Promise<Employee> {
		const updated = await service.terminate(id, payload);
		if (currentEmployee.value?.id === id) currentEmployee.value = updated;
		const idx = items.value.findIndex(e => e.id === id);
		if (idx !== -1) {
			items.value[idx] = {
				...items.value[idx],
				status: updated.status,
				terminationDate: updated.terminationDate,
			};
		}
		return updated;
	}

	async function resetPassword(id: number): Promise<string> {
		return service.resetPassword(id);
	}

	async function update(id: number, payload: UpdateEmployeeDto): Promise<Employee> {
		const updated = await service.update(id, payload);
		if (currentEmployee.value?.id === id) {
			currentEmployee.value = updated;
		}
		const idx = items.value.findIndex(e => e.id === id);
		if (idx !== -1) {
			items.value[idx] = {
				...items.value[idx],
				fullName: updated.fullName,
				department: updated.department,
				status: updated.status,
			};
		}
		return updated;
	}

	return {
		items,
		currentEmployee,
		meta,
		loading,
		detailLoading,
		fetchList,
		fetchOne,
		create,
		deactivate,
		terminate,
		update,
		resetPassword,
	};
}
