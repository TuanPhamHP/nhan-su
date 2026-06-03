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
		try {
			const res = await service.findAll({ ...params, employeeId });
			contracts.value = res.data;
			meta.value = res.meta;
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
		loading,
		fetchAll,
		fetchByEmployee,
		create,
		update,
		activate,
		terminate,
	};
}
