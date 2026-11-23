import type {
	AttendanceFaceResult,
	AttendanceRecordDetail,
	CheckAttendanceResponseDto,
	FaceStatusItemDto,
} from '~/types/attendance.types';
import { vnSearchIncludes } from '~/utils/vn-text';

/**
 * Chấm công bằng khuôn mặt: phần quyết định thuần, tách khỏi trang để test được.
 *
 * Hợp đồng ở `docs/backend/bridges/attendance.md` mục "Chấm công bằng khuôn mặt". Mọi lỗi theo
 * envelope `{ error: { code, message, errors? } }`, `message` đã là câu tiếng Việt nên hiện thẳng,
 * còn số lượt thử còn lại nằm ở `error.errors[0].attemptsLeft`.
 */

/** Câu dự phòng khi lỗi không mang `message` của máy chủ. */
const FALLBACK_MESSAGE = 'Đã có lỗi xảy ra';

export interface FaceErrorInfo {
	code: string | undefined;
	message: string;
	/** null khi lỗi không kèm số lượt, ví dụ lỗi ở bước đăng ký. */
	attemptsLeft: number | null;
}

/** Đọc mã lỗi, câu và số lượt còn lại từ lỗi mà `authFetch` ném ra. */
export function readFaceError(e: unknown): FaceErrorInfo {
	const error = (e as { data?: { error?: { code?: unknown; errors?: unknown } } } | null)?.data?.error;
	const first = Array.isArray(error?.errors) ? (error.errors[0] as { attemptsLeft?: unknown } | undefined) : undefined;
	const attemptsLeft = typeof first?.attemptsLeft === 'number' ? first.attemptsLeft : null;
	return {
		code: typeof error?.code === 'string' ? error.code : undefined,
		message: e instanceof Error && e.message ? e.message : FALLBACK_MESSAGE,
		attemptsLeft,
	};
}

/**
 * Việc màn chấm công làm tiếp sau khi check-in hoặc check-out bị từ chối.
 *
 * - `mismatch`: hộp thoại Chụp lại / Vẫn xác nhận. `canRetake` tắt khi hết lượt thử.
 * - `register`: công ty vừa bật hoặc HR vừa xoá khuôn mặt, sang bước đăng ký.
 * - `toast`: lỗi khác, kể cả 503 `FACE_ENGINE_UNAVAILABLE` và 429 `FACE_TOO_MANY_REQUESTS`, chỉ báo lỗi.
 */
export type FaceFailureStep =
	| { kind: 'mismatch'; message: string; attemptsLeft: number | null; canRetake: boolean }
	| { kind: 'register'; message: string }
	| { kind: 'toast'; message: string };

export function faceFailureStep(e: unknown): FaceFailureStep {
	const { code, message, attemptsLeft } = readFaceError(e);
	switch (code) {
		case 'FACE_NOT_MATCHED':
		case 'FACE_NOT_DETECTED':
			// Không có số lượt thì để máy chủ tự chặn lần sau, đừng giấu nút Chụp lại.
			return { kind: 'mismatch', message, attemptsLeft, canRetake: attemptsLeft === null || attemptsLeft > 0 };
		case 'FACE_ATTEMPTS_EXCEEDED':
			return { kind: 'mismatch', message, attemptsLeft: 0, canRetake: false };
		case 'FACE_NOT_REGISTERED':
			return { kind: 'register', message };
		default:
			return { kind: 'toast', message };
	}
}

/**
 * Việc bước đăng ký làm tiếp khi `POST /face/me` lỗi.
 *
 * - `already`: đã đăng ký ở máy khác, coi như xong và kiểm lại trạng thái.
 * - `toast`: máy chủ chưa so được mặt (503) hoặc gửi quá dồn dập (429 `FACE_TOO_MANY_REQUESTS`),
 *   báo lỗi rồi để người dùng thử sau.
 * - `inline`: ảnh chưa đạt (không thấy mặt, nhiều mặt, mặt quá nhỏ...), hiện câu ngay dưới camera.
 */
export type FaceRegisterFailure = { kind: 'already' | 'toast' | 'inline'; message: string };

export function faceRegisterFailure(e: unknown): FaceRegisterFailure {
	const { code, message } = readFaceError(e);
	if (code === 'FACE_ALREADY_REGISTERED') return { kind: 'already', message };
	if (code === 'FACE_ENGINE_UNAVAILABLE' || code === 'FACE_TOO_MANY_REQUESTS') return { kind: 'toast', message };
	return { kind: 'inline', message };
}

/** Màn chấm công phải đưa sang bước đăng ký trước khi mở camera chấm công. */
export function needsFaceRegistration(check: CheckAttendanceResponseDto | null | undefined): boolean {
	return !!check?.faceRequired && !check.faceRegistered;
}

/** Nhãn cần HR xem lại của một lượt chấm; null khi khớp hoặc lúc đó công ty tắt khuôn mặt. */
export function faceReviewLabel(record: AttendanceRecordDetail, side: 'in' | 'out'): string | null {
	const result = side === 'in' ? record.checkInFaceResult : record.checkOutFaceResult;
	if (result !== 'CONFIRMED_MISMATCH') return null;
	const label = side === 'in' ? record.checkInFaceResultLabel : record.checkOutFaceResultLabel;
	return label || 'Không khớp, nhân viên vẫn xác nhận';
}

/** Lựa chọn của bộ lọc "Khuôn mặt" trên bảng chấm công HR. */
export const FACE_RESULT_FILTER_OPTIONS: { value: AttendanceFaceResult | undefined; label: string }[] = [
	{ value: undefined, label: 'Khuôn mặt: tất cả' },
	{ value: 'CONFIRMED_MISMATCH', label: 'Cần xem lại' },
	{ value: 'MATCHED', label: 'Khớp' },
];

export type FaceRegisteredFilter = 'all' | 'registered' | 'unregistered';

/** Lọc danh sách đăng ký khuôn mặt theo tình trạng và tên hoặc mã, tìm không cần gõ dấu. */
export function filterFaceStatus(
	items: FaceStatusItemDto[],
	status: FaceRegisteredFilter,
	query: string,
): FaceStatusItemDto[] {
	return items.filter(item => {
		if (status === 'registered' && !item.registeredAt) return false;
		if (status === 'unregistered' && item.registeredAt) return false;
		return vnSearchIncludes(`${item.fullName} ${item.employeeCode}`, query);
	});
}
