import { useEmployeeCitizenIdService, type CitizenIdHistoryParams } from '~/services/employee-citizen-id.service';
import { useEmployeePassportService } from '~/services/employee-passport.service';
import { useEmployeeIdentityService } from '~/services/employee-identity.service';
import type {
	CitizenIdResponse,
	CreateCitizenIdPayload,
	UpdateCitizenIdPayload,
} from '~/types/employee-citizen-id.types';
import type {
	PassportResponse,
	CreatePassportPayload,
	UpdatePassportPayload,
	PassportPhotoSide,
} from '~/types/employee-passport.types';
import type { MyIdentityResponse } from '~/types/employee-identity.types';
import type { SystemLog } from '~/types/log.types';
import type { PaginatedMeta } from '~/types/api.types';

export function useEmployeeIdentity() {
	const citizenService = useEmployeeCitizenIdService();
	const passportService = useEmployeePassportService();
	const identityService = useEmployeeIdentityService();

	const citizenId = ref<CitizenIdResponse | null>(null);
	const citizenIdFetchedAt = ref<number | null>(null);
	const citizenIdLoading = ref(false);
	const citizenIdSubmitting = ref(false);
	const citizenIdUploading = ref(false);

	const passport = ref<PassportResponse | null>(null);
	const passportFetchedAt = ref<number | null>(null);
	const passportLoading = ref(false);
	const passportSubmitting = ref(false);
	const passportUploading = ref(false);

	const history = ref<SystemLog[]>([]);
	const historyMeta = ref<PaginatedMeta | null>(null);
	const historyLoading = ref(false);

	/**
	 * Định danh của CHÍNH MÌNH, lấy qua cửa mật khẩu.
	 *
	 * Cố ý nằm trong state của lần gọi composable này (composable tạo ref mới mỗi lần gọi,
	 * không phải store) — rời trang hoặc F5 là mất, lần sau phải nhập mật khẩu lại. KHÔNG
	 * được đẩy sang localStorage / sessionStorage / cookie / pinia persist: cache lại thì
	 * lần sau xem không cần mật khẩu, đúng cái mà cửa mật khẩu sinh ra để chặn.
	 */
	const ownIdentity = ref<MyIdentityResponse | null>(null);
	const ownIdentityUnlocking = ref(false);

	async function fetchCitizenId(employeeId: number) {
		citizenIdLoading.value = true;
		try {
			citizenId.value = await citizenService.findOne(employeeId);
			citizenIdFetchedAt.value = Date.now();
		} finally {
			citizenIdLoading.value = false;
		}
	}

	async function createCitizenId(employeeId: number, payload: CreateCitizenIdPayload) {
		citizenIdSubmitting.value = true;
		try {
			citizenId.value = await citizenService.create(employeeId, payload);
			citizenIdFetchedAt.value = Date.now();
			return citizenId.value;
		} finally {
			citizenIdSubmitting.value = false;
		}
	}

	async function updateCitizenId(employeeId: number, payload: UpdateCitizenIdPayload) {
		citizenIdSubmitting.value = true;
		try {
			citizenId.value = await citizenService.update(employeeId, payload);
			citizenIdFetchedAt.value = Date.now();
			return citizenId.value;
		} finally {
			citizenIdSubmitting.value = false;
		}
	}

	async function deleteCitizenId(employeeId: number) {
		citizenIdSubmitting.value = true;
		try {
			await citizenService.remove(employeeId);
			citizenId.value = null;
			citizenIdFetchedAt.value = null;
		} finally {
			citizenIdSubmitting.value = false;
		}
	}

	async function uploadCitizenIdPhotos(employeeId: number, front: File, back: File) {
		citizenIdUploading.value = true;
		try {
			citizenId.value = await citizenService.uploadPhotos(employeeId, front, back);
			citizenIdFetchedAt.value = Date.now();
			return citizenId.value;
		} finally {
			citizenIdUploading.value = false;
		}
	}

	async function fetchCitizenIdHistory(employeeId: number, params: CitizenIdHistoryParams = {}) {
		historyLoading.value = true;
		try {
			const res = await citizenService.findHistory(employeeId, params);
			history.value = res.data;
			historyMeta.value = res.meta;
		} finally {
			historyLoading.value = false;
		}
	}

	async function fetchPassport(employeeId: number) {
		passportLoading.value = true;
		try {
			passport.value = await passportService.findOne(employeeId);
			passportFetchedAt.value = Date.now();
		} finally {
			passportLoading.value = false;
		}
	}

	async function createPassport(employeeId: number, payload: CreatePassportPayload) {
		passportSubmitting.value = true;
		try {
			passport.value = await passportService.create(employeeId, payload);
			passportFetchedAt.value = Date.now();
			return passport.value;
		} finally {
			passportSubmitting.value = false;
		}
	}

	async function updatePassport(employeeId: number, payload: UpdatePassportPayload) {
		passportSubmitting.value = true;
		try {
			passport.value = await passportService.update(employeeId, payload);
			passportFetchedAt.value = Date.now();
			return passport.value;
		} finally {
			passportSubmitting.value = false;
		}
	}

	async function deletePassport(employeeId: number) {
		passportSubmitting.value = true;
		try {
			await passportService.remove(employeeId);
			passport.value = null;
			passportFetchedAt.value = null;
		} finally {
			passportSubmitting.value = false;
		}
	}

	async function uploadPassportPhoto(employeeId: number, side: PassportPhotoSide, file: File) {
		passportUploading.value = true;
		try {
			passport.value = await passportService.uploadPhoto(employeeId, side, file);
			passportFetchedAt.value = Date.now();
			return passport.value;
		} finally {
			passportUploading.value = false;
		}
	}

	async function deletePassportPhoto(employeeId: number, side: PassportPhotoSide) {
		passportUploading.value = true;
		try {
			passport.value = await passportService.removePhoto(employeeId, side);
			passportFetchedAt.value = Date.now();
			return passport.value;
		} finally {
			passportUploading.value = false;
		}
	}

	/**
	 * Mở khoá xem định danh của chính mình bằng mật khẩu.
	 *
	 * Mật khẩu chỉ đi qua đây một lần rồi thôi — KHÔNG giữ lại ở bất kỳ state nào, không
	 * log ra console. Lỗi được throw nguyên vẹn (kèm `status` + `data.error.code` do
	 * `auth.fetch.ts` gắn) để màn hình phân biệt: 400 → giữ modal cho nhập lại, 403 → khoá
	 * tài khoản, 429 → chờ.
	 */
	async function viewOwnIdentity(password: string): Promise<MyIdentityResponse> {
		ownIdentityUnlocking.value = true;
		try {
			const res = await identityService.viewOwn(password);
			ownIdentity.value = res;
			return res;
		} finally {
			ownIdentityUnlocking.value = false;
		}
	}

	return {
		// CCCD state
		citizenId,
		citizenIdFetchedAt,
		citizenIdLoading,
		citizenIdSubmitting,
		citizenIdUploading,
		// CCCD actions
		fetchCitizenId,
		createCitizenId,
		updateCitizenId,
		deleteCitizenId,
		uploadCitizenIdPhotos,
		// History
		history,
		historyMeta,
		historyLoading,
		fetchCitizenIdHistory,
		// Passport state
		passport,
		passportFetchedAt,
		passportLoading,
		passportSubmitting,
		passportUploading,
		// Passport actions
		fetchPassport,
		createPassport,
		updatePassport,
		deletePassport,
		uploadPassportPhoto,
		deletePassportPhoto,
		// Tự xem (có cửa mật khẩu)
		ownIdentity,
		ownIdentityUnlocking,
		viewOwnIdentity,
	};
}
