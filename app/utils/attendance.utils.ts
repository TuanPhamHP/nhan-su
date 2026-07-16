import type { AttendanceRecordDetail } from '~/types/attendance.types';

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

// Shift UTC timestamp to VN time, then read with getUTC* to avoid browser-local-timezone interference.
function toVNDate(iso: string): Date {
	return new Date(new Date(iso).getTime() + VN_OFFSET_MS);
}

export function parseEffectiveTime(iso: string): string {
	// effectiveStart/End are epoch-based TIME values — read raw UTC hours/minutes.
	const d = new Date(iso);
	const h = String(d.getUTCHours()).padStart(2, '0');
	const m = String(d.getUTCMinutes()).padStart(2, '0');
	return `${h}:${m}`;
}

export function formatShiftDisplay(record: AttendanceRecordDetail): string {
	if (!record.shift) return '—';
	if (record.isHalfDay && record.effectiveStart && record.effectiveEnd) {
		const start = parseEffectiveTime(record.effectiveStart);
		const end = parseEffectiveTime(record.effectiveEnd);
		return `Ca rút gọn (${start}–${end})`;
	}
	const { checkInTime, checkOutTime, breakStartTime, breakEndTime } = record.shift;
	if (breakStartTime && breakEndTime) {
		return `${checkInTime}–${breakStartTime} · Nghỉ ${breakStartTime}–${breakEndTime} · ${breakEndTime}–${checkOutTime}`;
	}
	return `${checkInTime}–${checkOutTime}`;
}

export function formatVNTime(iso: string | null): string {
	if (!iso) return '—';
	const d = toVNDate(iso);
	const h = String(d.getUTCHours()).padStart(2, '0');
	const m = String(d.getUTCMinutes()).padStart(2, '0');
	return `${h}:${m}`;
}

export function formatVNDateTime(iso: string | null): string {
	if (!iso) return '—';
	const d = toVNDate(iso);
	const day = String(d.getUTCDate()).padStart(2, '0');
	const month = String(d.getUTCMonth() + 1).padStart(2, '0');
	const year = d.getUTCFullYear();
	const h = String(d.getUTCHours()).padStart(2, '0');
	const m = String(d.getUTCMinutes()).padStart(2, '0');
	return `${day}/${month}/${year} ${h}:${m}`;
}

export function formatMinutes(minutes: number): string {
	if (minutes <= 0) return '';
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	if (h === 0) return `${m} phút`;
	if (m === 0) return `${h} tiếng`;
	return `${h} tiếng ${m} phút`;
}

export function calcAttendanceSummary(records: AttendanceRecordDetail[]): {
	present: number;
	late: number;
	absent: number;
	onLeave: number;
} {
	return records.reduce(
		(acc, r) => {
			if (r.status === 'PRESENT') acc.present++;
			else if (r.status === 'LATE') acc.late++;
			else if (r.status === 'ABSENT') acc.absent++;
			else if (r.status === 'LEAVE') acc.onLeave++;
			return acc;
		},
		{ present: 0, late: 0, absent: 0, onLeave: 0 },
	);
}
