// workDays convention: 0=CN, 1=T2, ..., 6=T7. Display order is T2→T7→CN.
export const WORK_DAY_LABELS: Record<number, string> = {
	0: 'CN',
	1: 'T2',
	2: 'T3',
	3: 'T4',
	4: 'T5',
	5: 'T6',
	6: 'T7',
};
/** Thứ tự hiển thị, dùng cho cả lưới chọn ngày trong trang ca và cho câu nhắc ở đây. */
export const ALL_WORK_DAYS = [1, 2, 3, 4, 5, 6, 0];

/**
 * Liệt kê ngày làm việc của một ca theo thứ tự hiển thị: dải liền thì viết gọn thành "T2–CN",
 * không liền thì liệt kê từng ngày "T2, T4, T6". Ca không khai ngày nào thì trả về chuỗi rỗng.
 */
export function formatWorkDays(workDays: number[]): string {
	const positions = [...new Set(workDays)]
		.map(day => ALL_WORK_DAYS.indexOf(day))
		.filter(pos => pos >= 0)
		.sort((a, b) => a - b);
	if (positions.length === 0) return '';

	const labels = positions.map(pos => WORK_DAY_LABELS[ALL_WORK_DAYS[pos] as number] as string);
	if (positions.length === 1) return labels[0] as string;

	const contiguous = positions.every((pos, i) => i === 0 || pos === (positions[i - 1] as number) + 1);
	return contiguous ? `${labels[0]}–${labels[labels.length - 1]}` : labels.join(', ');
}

/**
 * Câu dưới chân hai hộp gán ca theo khoảng ngày.
 *
 * Server mới chỉ gán những ngày nằm trong `workDays` của ca được chọn, nên câu này phải nói đúng
 * những ngày đó: trước đây hộp ghi "gán toàn bộ ngày trong khoảng" trong khi server chỉ gán T2–T6,
 * và người dùng chỉ phát hiện khi lưới phân ca trống thứ Bảy, Chủ nhật. FE chỉ hiển thị trước,
 * ngày gán thật vẫn do server quyết.
 */
export function shiftRangeHint(workDays: number[] | undefined | null): string {
	if (!workDays) return 'Chọn ca để xem những ngày sẽ được gán.';
	const days = formatWorkDays(workDays);
	if (!days) return 'Ca này chưa khai ngày làm việc nào nên sẽ không có ngày nào được gán.';
	return `Gán vào ${days} theo khuôn ca, ghi đè ca đã có.`;
}

/**
 * Câu nhắc cho ca đang chọn trong hộp, tra `workDays` từ danh sách ca đã nạp.
 *
 * Ca không còn trong danh sách (đã xoá hoặc danh sách chưa nạp xong) thì coi như chưa chọn, vì
 * đoán giúp người dùng những ngày không biết chắc còn tệ hơn là mời họ chọn lại ca.
 */
export function shiftRangeHintFor(
	shifts: { id: number; workDays: number[] }[],
	shiftId: number | undefined | null,
): string {
	if (!shiftId) return shiftRangeHint(undefined);
	return shiftRangeHint(shifts.find(s => s.id === shiftId)?.workDays);
}
