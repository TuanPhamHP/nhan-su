export const MAX_LATE_EARLY_MINUTES = 120;

export function isOverLateEarlyLimit(minutes: number): boolean {
	return minutes > MAX_LATE_EARLY_MINUTES;
}

export function getLateEarlyWarningMessage(type: 'LATE' | 'EARLY'): string {
	const action = type === 'LATE' ? 'đi muộn' : 'về sớm';
	return `Thời gian ${action} vượt quá 2 giờ. Hệ thống sẽ chuyển sang đơn nghỉ nửa ngày.`;
}

export interface LeaveDurationInput {
	/** Mã loại phép đang chọn. */
	code: string | null | undefined;
	/** Đang chờ `POST /v1/leave-requests/preview` trả về. */
	previewLoading?: boolean;
	/** `totalDays` của preview; `null` khi chưa có hoặc gọi lỗi. */
	totalDays?: number | null;
	lateMinutes?: number | null;
	earlyMinutes?: number | null;
}

/**
 * Câu "Khoảng thời gian" trên form tạo đơn nghỉ.
 *
 * Số ngày phép lấy nguyên từ preview của máy chủ, vì từ bản vá 18/11/2026 ngày nghỉ tính theo ca
 * của chính người gửi: ngày có ca thì tính, kể cả thứ Bảy và Chủ nhật. Client không biết lịch ca
 * của từng người nên tự đếm là sai — trước đây form đếm ngày trong khoảng rồi bỏ cuối tuần, và
 * người làm ca cuối tuần nhìn thấy số ngày ít hơn số ngày thật sự bị trừ.
 */
export function leaveDurationText(input: LeaveDurationInput): string | null {
	const { code, previewLoading, totalDays, lateMinutes, earlyMinutes } = input;
	if (!code) return null;

	if (code === 'ANNUAL') {
		if (previewLoading) return 'Đang tính số ngày…';
		if (totalDays === null || totalDays === undefined) return null;
		if (totalDays === 0) return '0 ngày: khoảng này không có ngày nào bạn có ca';
		return `${totalDays} ngày nghỉ (tính theo ca)`;
	}

	if (code === 'HALF_DAY') return '0.5 ngày';
	if (code === 'LATE' && lateMinutes) return `${lateMinutes} phút`;
	if (code === 'EARLY' && earlyMinutes) return `${earlyMinutes} phút`;

	return null;
}
