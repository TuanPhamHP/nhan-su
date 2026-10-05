import { useSocialInsuranceService } from '~/services/social-insurance.service';
import type {
	SocialInsuranceResponse,
	UpsertSocialInsuranceDto,
} from '~/types/social-insurance.types';

export function useSocialInsurance() {
	const service = useSocialInsuranceService();

	const record = ref<SocialInsuranceResponse | null>(null);
	/**
	 * Lỗi tải, tách riêng khỏi `record = null`.
	 *
	 * Trước đây `fetchByEmployee` chỉ có try/finally, không catch — request hỏng thì
	 * `record` vẫn là `null`, mà `null` lại được màn hình hiểu là "chưa có dữ liệu BHXH"
	 * nên nó hiện form TẠO MỚI. Hệ quả thật: quản lý phòng khác bị 403/500 vẫn thấy form
	 * nhập BHXH của người ta. "Tải hỏng" và "chưa có dữ liệu" phải là hai trạng thái khác
	 * nhau.
	 */
	const loadError = ref<string | null>(null);
	const loading = ref(false);
	const saving = ref(false);
	const unlocking = ref(false);

	async function fetchByEmployee(employeeId: number) {
		loading.value = true;
		loadError.value = null;
		try {
			record.value = await service.findByEmployee(employeeId);
		} catch (e) {
			record.value = null;
			loadError.value =
				e instanceof Error ? e.message : 'Không tải được thông tin BHXH';
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
		loadError,
		loading,
		saving,
		unlocking,
		fetchByEmployee,
		viewOwn,
		save,
	};
}
