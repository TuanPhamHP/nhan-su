export const MAX_LATE_EARLY_MINUTES = 120;

export function isOverLateEarlyLimit(minutes: number): boolean {
	return minutes > MAX_LATE_EARLY_MINUTES;
}

export function getLateEarlyWarningMessage(type: 'LATE' | 'EARLY'): string {
	const action = type === 'LATE' ? 'đi muộn' : 'về sớm';
	return `Thời gian ${action} vượt quá 2 giờ. Hệ thống sẽ chuyển sang đơn nghỉ nửa ngày.`;
}
