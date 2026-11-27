import { describe, expect, it } from 'vitest';
import { kpiAllZero, kpiScaleName, kpiWeightShiftText } from '~/utils/kpi.utils';

const GRADES = [
	{ label: 'A', minScore: 90 },
	{ label: 'B', minScore: 75 },
	{ label: 'C', minScore: 60 },
	{ label: 'D', minScore: 0 },
];

describe('KPI sau thử nghiệm người dùng (UI-17a)', () => {
	it('dòng có trọng số tăng thì ghi số chỉ tiêu không áp dụng', () => {
		const lines = [
			{ applicable: true, weight: 30, effectiveWeight: 50 },
			{ applicable: true, weight: 30, effectiveWeight: 50 },
			{ applicable: false, weight: 40, effectiveWeight: 0 },
		];
		expect(kpiWeightShiftText(lines, lines[0]!)).toBe('trọng số tăng vì 1 chỉ tiêu không áp dụng');
		expect(kpiWeightShiftText(lines, lines[2]!)).toBeNull();
		const same = [{ applicable: true, weight: 50, effectiveWeight: 50 }];
		expect(kpiWeightShiftText(same, same[0]!)).toBeNull();
	});

	it('mọi chỉ tiêu áp dụng đều 0 thì hỏi lại, có một chỉ tiêu khác 0 thì thôi', () => {
		expect(kpiAllZero([{ applicable: true, score: 0 }, { applicable: true, score: null }, { applicable: false, score: 40 }])).toBe(true);
		expect(kpiAllZero([{ applicable: true, score: 0 }, { applicable: true, score: 12.5 }])).toBe(false);
		expect(kpiAllZero([{ applicable: false, score: null }])).toBe(false);
	});

	it('tên thang ghi ngày áp dụng và các mức', () => {
		expect(kpiScaleName({ effectiveFrom: '2026-01-01', grades: GRADES })).toBe('thang áp dụng từ 01/01/2026 (A từ 90 · B từ 75 · C từ 60 · D dưới 60)');
		expect(kpiScaleName({ effectiveFrom: '2000-01-01', grades: GRADES })).toMatch(/^thang áp dụng từ đầu/);
	});
});
