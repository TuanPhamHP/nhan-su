import { useContractService } from '~/services/contract.service';
import type {
	ContractResponse,
	CreateContractDto,
	UpdateContractDto,
	TerminateContractDto,
	QueryContractParams,
} from '~/types/contract.types';
import type { PaginatedMeta } from '~/types/api.types';

export function useContracts() {
	const service = useContractService();

	const contracts = ref<ContractResponse[]>([]);
	const meta = ref<PaginatedMeta | null>(null);
	/**
	 * Lỗi tải, tách riêng khỏi `contracts = []`.
	 *
	 * Mảng rỗng KHÔNG đủ để diễn đạt mọi thứ: "nhân viên chưa có hợp đồng" và "bạn không
	 * được xem hợp đồng phòng ban khác" là hai chuyện khác hẳn, mà trước đây cùng hiện ra
	 * dòng "Chưa có hợp đồng nào". BE nay trả 403 kèm lý do — giữ lại để hiển thị đúng.
	 */
	const loadError = ref<string | null>(null);
	const loading = ref(false);

	async function fetchAll(params?: QueryContractParams) {
		loading.value = true;
		try {
			const res = await service.findAll(params);
			contracts.value = res.data;
			meta.value = res.meta;
		} finally {
			loading.value = false;
		}
	}

	async function fetchByEmployee(employeeId: number, params?: Omit<QueryContractParams, 'employeeId'>) {
		loading.value = true;
		loadError.value = null;
		try {
			const res = await service.findAll({ ...params, employeeId });
			contracts.value = res.data;
			meta.value = res.meta;
		} catch (e) {
			contracts.value = [];
			meta.value = null;
			loadError.value =
				e instanceof Error ? e.message : 'Không tải được danh sách hợp đồng';
		} finally {
			loading.value = false;
		}
	}

	async function create(dto: CreateContractDto, file?: File): Promise<ContractResponse> {
		const created = await service.create(dto, file);
		contracts.value.unshift(created);
		return created;
	}

	async function update(id: number, dto: UpdateContractDto, file?: File): Promise<ContractResponse> {
		const updated = await service.update(id, dto, file);
		_replace(updated);
		return updated;
	}

	async function activate(id: number): Promise<ContractResponse> {
		const updated = await service.activate(id);
		_replace(updated);
		return updated;
	}

	async function terminate(id: number, dto?: TerminateContractDto): Promise<ContractResponse> {
		const updated = await service.terminate(id, dto);
		_replace(updated);
		return updated;
	}

	function _replace(updated: ContractResponse) {
		const idx = contracts.value.findIndex(c => c.id === updated.id);
		if (idx !== -1) contracts.value.splice(idx, 1, updated);
	}

	return {
		contracts,
		meta,
		loadError,
		loading,
		fetchAll,
		fetchByEmployee,
		create,
		update,
		activate,
		terminate,
	};
}
