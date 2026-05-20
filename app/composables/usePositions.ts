import { usePositionService } from '~/services/position.service';
import type {
	Position,
	PositionSummary,
	QueryPositionParams,
	CreatePositionDto,
	UpdatePositionDto,
} from '~/types/position.types';
import type { PaginatedMeta } from '~/types/api.types';

export function usePositions() {
	const service = usePositionService();

	const positions = ref<PositionSummary[]>([]);
	const meta = ref<PaginatedMeta | null>(null);
	const loading = ref(false);

	async function fetchList(params?: QueryPositionParams) {
		loading.value = true;
		try {
			const res = await service.findAll(params);
			positions.value = res.data;
			meta.value = res.meta;
		} finally {
			loading.value = false;
		}
	}

	async function create(dto: CreatePositionDto): Promise<Position> {
		return service.create(dto);
	}

	async function update(id: number, dto: UpdatePositionDto): Promise<Position> {
		const updated = await service.update(id, dto);
		const idx = positions.value.findIndex(p => p.id === id);
		if (idx !== -1) {
			positions.value[idx] = {
				id: updated.id,
				name: updated.name,
				department: updated.department.name,
				isActive: updated.isActive,
				employeeCount: updated.employeeCount,
			};
		}
		return updated;
	}

	async function deactivate(id: number): Promise<void> {
		await service.deactivate(id);
		const idx = positions.value.findIndex(p => p.id === id);
		if (idx !== -1) positions.value[idx].isActive = false;
	}

	return { positions, meta, loading, fetchList, create, update, deactivate };
}
