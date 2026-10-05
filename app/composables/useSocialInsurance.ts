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
	const unlocking = ref(false);

	async function fetchByEmployee(employeeId: number) {
		loading.value = true;
		try {
			record.value = await service.findByEmployee(employeeId);
		} finally {
			loading.value = false;
		}
	}

	/**
	 * Mở khoá xem BHXH của chính mình bằng mật khẩu.
	 *
	 * Mật khẩu chỉ đi qua đây một lần rồi thôi — KHÔNG giữ lại ở bất kỳ state nào, và kết
	 * quả cũng không được cache ra ngoài vòng đời component (localStorage/cookie/pinia
	 * persist). Cache lại thì lần sau xem không cần mật khẩu, đúng thứ cửa mật khẩu sinh
	 * ra để chặn.
	 */
	async function viewOwn(password: string): Promise<SocialInsuranceResponse | null> {
		unlocking.value = true;
		try {
			record.value = await service.viewOwn(password);
			return record.value;
		} finally {
			unlocking.value = false;
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
		unlocking,
		fetchByEmployee,
		viewOwn,
		save,
	};
}
