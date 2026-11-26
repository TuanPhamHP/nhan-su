/**
 * ============================================================
 * Test suite: chấm công bằng khuôn mặt, phần quyết định thuần
 * ============================================================
 *
 * Vì sao cần: màn chấm công rẽ nhánh hoàn toàn theo `error.code` và `error.errors[0].attemptsLeft`
 * của máy chủ. Đọc sai một chỗ là nhân viên kẹt ở màn chấm công: hiện nút Chụp lại khi đã hết lượt
 * (bấm mãi vẫn bị từ chối), giấu nút Vẫn xác nhận, hay không đưa sang bước đăng ký khi HR vừa xoá
 * khuôn mặt. Phần lọc danh sách cũng ở đây vì HR tìm tên không gõ dấu.
 *
 * Ký hiệu: [EDGE] trường hợp biên
 * ============================================================
 */

import { describe, expect, it } from 'vitest';
import {
	faceFailureStep,
	faceRegisterFailure,
	faceReviewLabel,
	filterFaceStatus,
	needsFaceRegistration,
	readFaceError,
} from '~/utils/attendance-face.utils';
import type {
	AttendanceRecordDetail,
	CheckAttendanceResponseDto,
	FaceStatusItemDto,
} from '~/types/attendance.types';

/** Lỗi giống hệt cái `authFetch` ném ra: Error mang câu của máy chủ, `data` là nguyên thân lỗi. */
function apiError(code: string, message: string, errors?: unknown[]): Error {
	const err = new Error(message) as Error & { data?: unknown; status?: number };
	err.data = { success: false, error: { code, message, ...(errors ? { errors } : {}) } };
	err.status = 400;
	return err;
}

describe('readFaceError', () => {
	it('đọc mã, câu và số lượt còn lại', () => {
		const info = readFaceError(apiError('FACE_NOT_MATCHED', 'Khuôn mặt chưa khớp', [{ attemptsLeft: 4 }]));
		expect(info).toEqual({ code: 'FACE_NOT_MATCHED', message: 'Khuôn mặt chưa khớp', attemptsLeft: 4 });
	});

	it('[EDGE] lỗi không kèm errors thì attemptsLeft là null', () => {
		expect(readFaceError(apiError('FACE_MULTIPLE', 'Nhiều mặt')).attemptsLeft).toBeNull();
	});

	it('[EDGE] lỗi mạng không có data vẫn ra câu, không có mã', () => {
		const info = readFaceError(new Error('Chưa gửi được vì mạng bị gián đoạn.'));
		expect(info.code).toBeUndefined();
		expect(info.message).toBe('Chưa gửi được vì mạng bị gián đoạn.');
	});

	it('[EDGE] thứ ném ra không phải Error thì dùng câu dự phòng', () => {
		expect(readFaceError('boom').message).toBe('Đã có lỗi xảy ra');
	});
});

describe('faceFailureStep: sau khi check-in, check-out bị từ chối', () => {
	it('không khớp, còn lượt: hộp thoại có cả Chụp lại', () => {
		expect(faceFailureStep(apiError('FACE_NOT_MATCHED', 'Chưa khớp', [{ attemptsLeft: 4 }]))).toEqual({
			kind: 'mismatch',
			message: 'Chưa khớp',
			attemptsLeft: 4,
			canRetake: true,
		});
	});

	it('không thấy mặt cũng mở hộp thoại', () => {
		const step = faceFailureStep(apiError('FACE_NOT_DETECTED', 'Không thấy mặt', [{ attemptsLeft: 2 }]));
		expect(step).toMatchObject({ kind: 'mismatch', attemptsLeft: 2, canRetake: true });
	});

	it('[EDGE] lần sai cuối cùng (attemptsLeft = 0): ẩn Chụp lại', () => {
		const step = faceFailureStep(apiError('FACE_NOT_MATCHED', 'Chưa khớp', [{ attemptsLeft: 0 }]));
		expect(step).toMatchObject({ kind: 'mismatch', attemptsLeft: 0, canRetake: false });
	});

	it('hết lượt trong ngày: chỉ còn Vẫn xác nhận', () => {
		const step = faceFailureStep(apiError('FACE_ATTEMPTS_EXCEEDED', 'Hết lượt', [{ attemptsLeft: 0 }]));
		expect(step).toMatchObject({ kind: 'mismatch', canRetake: false, attemptsLeft: 0 });
	});

	it('[EDGE] máy chủ không gửi số lượt: vẫn cho Chụp lại, máy chủ tự chặn', () => {
		const step = faceFailureStep(apiError('FACE_NOT_MATCHED', 'Chưa khớp'));
		expect(step).toMatchObject({ kind: 'mismatch', attemptsLeft: null, canRetake: true });
	});

	it('chưa đăng ký (công ty vừa bật hoặc HR vừa xoá): sang bước đăng ký', () => {
		expect(faceFailureStep(apiError('FACE_NOT_REGISTERED', 'Đăng ký trước'))).toEqual({
			kind: 'register',
			message: 'Đăng ký trước',
		});
	});

	it('máy chủ chưa so được mặt (503): chỉ báo lỗi, không mở hộp thoại', () => {
		expect(faceFailureStep(apiError('FACE_ENGINE_UNAVAILABLE', 'Máy chủ bận'))).toEqual({
			kind: 'toast',
			message: 'Máy chủ bận',
		});
	});

	it('gửi quá dồn dập (429 FACE_TOO_MANY_REQUESTS): chỉ báo lỗi', () => {
		expect(faceFailureStep(apiError('FACE_TOO_MANY_REQUESTS', 'Thử lại sau'))).toMatchObject({ kind: 'toast' });
	});

	it('lỗi chấm công cũ (ngoài giờ, ngoài vị trí): chỉ báo lỗi như trước', () => {
		expect(faceFailureStep(apiError('ATTENDANCE_WINDOW_CLOSED', 'Đã quá giờ'))).toMatchObject({ kind: 'toast' });
	});
});

describe('faceRegisterFailure: khi gửi ảnh đăng ký lỗi', () => {
	it.each(['FACE_NOT_DETECTED', 'FACE_MULTIPLE', 'FACE_TOO_SMALL', 'FACE_IMAGE_INVALID', 'FACE_CONSENT_REQUIRED'])(
		'%s: hiện câu ngay dưới camera để chụp lại',
		code => {
			expect(faceRegisterFailure(apiError(code, 'Câu của máy chủ'))).toEqual({
				kind: 'inline',
				message: 'Câu của máy chủ',
			});
		},
	);

	it('đã đăng ký ở máy khác: coi như xong', () => {
		expect(faceRegisterFailure(apiError('FACE_ALREADY_REGISTERED', 'Đã đăng ký')).kind).toBe('already');
	});

	it.each(['FACE_ENGINE_UNAVAILABLE', 'FACE_TOO_MANY_REQUESTS'])('%s: báo lỗi bằng toast', code => {
		expect(faceRegisterFailure(apiError(code, 'Thử lại sau')).kind).toBe('toast');
	});
});

describe('needsFaceRegistration', () => {
	const base = { faceRequired: true, faceRegistered: false } as CheckAttendanceResponseDto;

	it('bật mà chưa đăng ký thì phải đăng ký', () => {
		expect(needsFaceRegistration(base)).toBe(true);
	});

	it('đã đăng ký hoặc công ty tắt thì không', () => {
		expect(needsFaceRegistration({ ...base, faceRegistered: true })).toBe(false);
		expect(needsFaceRegistration({ ...base, faceRequired: false })).toBe(false);
	});

	it('[EDGE] chưa có kết quả kiểm vị trí thì không', () => {
		expect(needsFaceRegistration(null)).toBe(false);
	});
});

describe('faceReviewLabel: chip ở bảng chấm công HR', () => {
	const record = {
		checkInFaceResult: 'CONFIRMED_MISMATCH',
		checkInFaceResultLabel: 'Không khớp, nhân viên vẫn xác nhận',
		checkOutFaceResult: 'MATCHED',
		checkOutFaceResultLabel: 'Khớp',
	} as AttendanceRecordDetail;

	it('chỉ hiện chip cho lượt không khớp mà vẫn xác nhận', () => {
		expect(faceReviewLabel(record, 'in')).toBe('Không khớp, nhân viên vẫn xác nhận');
		expect(faceReviewLabel(record, 'out')).toBeNull();
	});

	it('[EDGE] lúc chấm công ty tắt khuôn mặt (null) thì không có chip', () => {
		expect(faceReviewLabel({ ...record, checkInFaceResult: null }, 'in')).toBeNull();
	});
});

describe('filterFaceStatus: danh sách đăng ký ở trang cài đặt', () => {
	const items: FaceStatusItemDto[] = [
		{ employeeId: 1, fullName: 'Nguyễn Văn Đức', employeeCode: 'NV001', department: null, registeredAt: '2026-11-23T01:00:00Z' },
		{ employeeId: 2, fullName: 'Trần Thị Hoa', employeeCode: 'NV002', department: null, registeredAt: null },
	];

	it('lọc theo tình trạng đăng ký', () => {
		expect(filterFaceStatus(items, 'registered', '').map(i => i.employeeId)).toEqual([1]);
		expect(filterFaceStatus(items, 'unregistered', '').map(i => i.employeeId)).toEqual([2]);
		expect(filterFaceStatus(items, 'all', '')).toHaveLength(2);
	});

	it('tìm tên không cần gõ dấu, cả chữ đ', () => {
		expect(filterFaceStatus(items, 'all', 'van duc').map(i => i.employeeId)).toEqual([1]);
	});

	it('tìm theo mã nhân viên', () => {
		expect(filterFaceStatus(items, 'all', 'nv002').map(i => i.employeeId)).toEqual([2]);
	});
});
