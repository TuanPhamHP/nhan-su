import { useSocialInsuranceService } from '~/services/social-insurance.service';
import type {
	SocialInsuranceResponse,
	UpsertSocialInsuranceDto,
} from '~/types/social-insurance.types';

export function useSocialInsurance() {
	const service = useSocialInsuranceService();

	const record = ref<SocialInsuranceResponse | null>(null);
	const loading = ref(false);
	const saving = ref(false);

	async function fetchByEmployee(employeeId: number) {
		loading.value = true;
		try {
			record.value = await service.findByEmployee(employeeId);
		} finally {
			loading.value = false;
		}
	}

	async function save(employeeId: number, dto: UpsertSocialInsuranceDto, file?: File): Promise<SocialInsuranceResponse> {
		saving.value = true;
		try {
			const updated = await service.upsert(employeeId, dto, file);
			record.value = updated;
			return updated;
		} finally {
			saving.value = false;
		}
	}

	return {
		record,
		loading,
		saving,
		fetchByEmployee,
		save,
	};
}
