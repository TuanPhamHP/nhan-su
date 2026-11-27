/**
 * Sửa sau thử nghiệm người dùng, phần 2 (27/11/2026): báo cáo tiến độ có cột Chưa có hạn và nhãn mới (UI-18b).
 *
 * Vì sao cần: việc chưa có hạn từng bị tính là "đúng hạn" nên báo cáo ghi 100% đúng hạn dù chưa việc nào có hạn; máy
 * chủ đã tách ra ô `noDue`, bảng phải có cột đó, đúng vị trí ngay sau hai cột đúng hạn, và nhãn nói rõ là báo xong.
 */
import { describe, expect, it } from 'vitest';
import { PROGRESS_COLUMNS } from '~/utils/tasks.utils';

describe('UI-18b: báo cáo tiến độ', () => {
	it('có cột Chưa có hạn ngay sau hai cột đúng hạn, không kèm tỷ lệ', () => {
		const metrics = PROGRESS_COLUMNS.map(c => c.metric);
		expect(metrics.indexOf('noDue')).toBe(metrics.indexOf('onTimeCurrent') + 1);
		const noDue = PROGRESS_COLUMNS.find(c => c.metric === 'noDue');
		expect(noDue?.label).toBe('Chưa có hạn');
		expect(noDue?.pct).toBeUndefined();
	});

	it('nhãn đúng hạn nói rõ là báo xong, gợi ý nói tỷ lệ chỉ tính việc có hạn', () => {
		const original = PROGRESS_COLUMNS.find(c => c.metric === 'onTimeOriginal');
		const current = PROGRESS_COLUMNS.find(c => c.metric === 'onTimeCurrent');
		expect(original?.label).toBe('Báo xong đúng hạn ban đầu');
		expect(current?.label).toBe('Báo xong đúng hạn hiện tại');
		expect(original?.hint).toMatch(/chỉ tính việc có hạn/);
		expect(current?.hint).toMatch(/chỉ tính việc có hạn/);
	});
});
