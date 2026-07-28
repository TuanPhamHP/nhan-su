import type { OvertimeRequestResponse, OvertimeSegment } from '~/types/overtime.types';

// ─── Rate badge helpers ──────────────────────────────────────────────────────

const RATE_CLASS_TABLE: Record<150 | 200 | 300, string> = {
	150: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
	200: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
	300: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const RATE_CLASS_TABLE_COMPACT: Record<150 | 200 | 300, string> = {
	150: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300',
	200: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300',
	300: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300',
};

export interface RateBadge {
	label: string; // "150%" hoặc "150% + 200%" khi multi-segment
	maxRate: 150 | 200 | 300; // rate cao nhất (dùng để tô màu badge)
	isMulti: boolean; // true khi có >1 segment
	segments: OvertimeSegment[];
}

export function getRateBadge(req: Pick<OvertimeRequestResponse, 'segments'>): RateBadge {
	const segments = req.segments ?? [];
	if (segments.length === 0) {
		return { label: '—', maxRate: 150, isMulti: false, segments: [] };
	}
	if (segments.length === 1) {
		const s = segments[0]!;
		return { label: s.otRateLabel, maxRate: s.otRate, isMulti: false, segments };
	}
	const maxRate = segments.reduce<150 | 200 | 300>((m, s) => (s.otRate > m ? s.otRate : m), 150);
	const label = segments.map(s => s.otRateLabel).join(' + ');
	return { label, maxRate, isMulti: true, segments };
}

export function rateBadgeClass(rate: 150 | 200 | 300): string {
	return RATE_CLASS_TABLE[rate];
}

export function rateBadgeClassCompact(rate: 150 | 200 | 300): string {
	return RATE_CLASS_TABLE_COMPACT[rate];
}
