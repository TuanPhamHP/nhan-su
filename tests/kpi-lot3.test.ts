import { describe, expect, it } from 'vitest';
import {
	kpiAtText,
	kpiDayText,
	kpiEventText,
	kpiGradeLegend,
	kpiMissingLines,
	kpiNum,
	kpiPeriodStartError,
	kpiTargetText,
	kpiValueText,
	kpiWeightText,
} from '~/utils/kpi.utils';
import { moduleOfPath } from '~/composables/useModuleAccess';
import { resolveNotificationRoute } from '~/utils/notification-route';
import type { KpiReviewEvent } from '~/types/kpi.types';

const GRADES = [
	{ label: 'A', minScore: 110 },
	{ label: 'B', minScore: 95 },
	{ label: 'C', minScore: 80 },
	{ label: 'D', minScore: 0 },
];

describe('KPI lô 3: chữ và số', () => {
	it('số kiểu Việt Nam: 98.1 thành "98,1", null thành gạch', () => {
		expect(kpiNum(98.1, 1)).toBe('98,1');
		expect(kpiNum(16.666, 1)).toBe('16,7');
		expect(kpiNum(1234)).toBe('1.234');
		expect(kpiNum(null)).toBe('—');
	});

	it('kết quả theo kiểu chỉ tiêu: đạt hay không, điểm 1–5, số kèm đơn vị', () => {
		expect(kpiValueText({ direction: 'PASS_FAIL', manualScale: false, unit: '' }, 1)).toBe('Đạt');
		expect(kpiValueText({ direction: 'PASS_FAIL', manualScale: false, unit: '' }, 0)).toBe('Không đạt');
		expect(kpiValueText({ direction: 'HIGHER', manualScale: true, unit: 'điểm' }, 4)).toBe('4/5');
		expect(kpiValueText({ direction: 'HIGHER', manualScale: false, unit: '%' }, 75)).toBe('75%');
		expect(kpiValueText({ direction: 'HIGHER', manualScale: false, unit: 'điểm' }, 46)).toBe('46 điểm');
		expect(kpiTargetText({ direction: 'BANDS', manualScale: false, unit: '%' }, 10)).toBe('≤ 10%');
	});

	it('tổng trọng số: còn thiếu, thừa, đủ (S-23)', () => {
		expect(kpiWeightText(95)).toEqual({ ok: false, text: 'Tổng trọng số đang là 95%, còn thiếu 5%' });
		expect(kpiWeightText(110).text).toContain('thừa 10%');
		expect(kpiWeightText(100).ok).toBe(true);
	});

	it('thang xếp loại: mức cuối từ 0 ghi "dưới" ngưỡng mức trên', () => {
		expect(kpiGradeLegend(GRADES)).toBe('A từ 110 · B từ 95 · C từ 80 · D dưới 80');
	});

	it('"Tính lúc" theo giờ Việt Nam dù máy đặt múi giờ nào', () => {
		expect(kpiAtText('2026-11-24T18:00:00.000Z')).toBe('01:00 ngày 25/11');
		expect(kpiDayText('2026-11-25T19:38:13.919Z')).toBe('26/11/2026');
	});

	it('ngày đầu kỳ: tháng từ ngày 1, quý từ ngày 1 tháng 1/4/7/10', () => {
		expect(kpiPeriodStartError('MONTH', '2026-11-01')).toBeNull();
		expect(kpiPeriodStartError('MONTH', '2026-11-15')).toBe('Kỳ bắt đầu từ ngày 1');
		expect(kpiPeriodStartError('QUARTER', '2026-10-01')).toBeNull();
		expect(kpiPeriodStartError('QUARTER', '2026-11-01')).toContain('tháng 1, 4, 7 hoặc 10');
	});

	it('lỗi thiếu điểm: máy chủ gửi tên chỉ tiêu, nhận thêm id', () => {
		expect(kpiMissingLines({ lines: ['Chuyên môn'] })).toEqual({ names: ['Chuyên môn'], ids: [] });
		expect(kpiMissingLines({ lines: [12] })).toEqual({ names: [], ids: [12] });
		expect(kpiMissingLines(null)).toEqual({ names: [], ids: [] });
	});

	it('dòng thời gian: câu tiếng Việt, hệ thống khi không có người làm', () => {
		const ev = (type: KpiReviewEvent['type'], payload: Record<string, unknown> | null, actor: KpiReviewEvent['actor'] = { id: 4, fullName: 'Trần Quốc Trưởng' }): KpiReviewEvent => ({
			id: 1,
			type,
			actor,
			payload,
			createdAt: '2026-11-25T19:38:13.922Z',
		});
		expect(kpiEventText(ev('LINE_UPDATED', { name: 'Tỷ lệ đúng hạn', from: 75, to: 85, reason: 'Khách đổi yêu cầu' })).title).toBe(
			'Trần Quốc Trưởng sửa "Tỷ lệ đúng hạn" từ 75 thành 85',
		);
		expect(kpiEventText(ev('FEEDBACK', { agreed: false, feedback: 'Xin xem lại' })).detail).toBe('Xin xem lại');
		expect(kpiEventText(ev('FEEDBACK_EXPIRED', null, null)).title).toContain('Hết hạn phản hồi');
		expect(kpiEventText(ev('REVIEWER_CHANGED', { from: 8, to: 4 }, { id: 2, fullName: 'HR' }), { id: 4, fullName: 'Trần Quốc Trưởng' }).title).toBe(
			'HR đổi người chấm sang Trần Quốc Trưởng',
		);
	});
});

describe('KPI lô 3: đường dẫn', () => {
	it('/kpi và /management/kpi thuộc module TASKS', () => {
		expect(moduleOfPath('/kpi')).toBe('TASKS');
		expect(moduleOfPath('/kpi/danh-gia')).toBe('TASKS');
		expect(moduleOfPath('/management/kpi/ky')).toBe('TASKS');
	});

	it('thông báo KPI mở đúng màn theo loại (bridge mục 8)', () => {
		expect(resolveNotificationRoute('kpi_review', 10, 'MANAGER', 'KPI_REVIEW_NEEDED')).toBe('/kpi/danh-gia?reviewId=10');
		expect(resolveNotificationRoute('kpi_review', 10, 'EMPLOYEE', 'KPI_FEEDBACK_NEEDED')).toBe('/kpi?reviewId=10');
		expect(resolveNotificationRoute('kpi_review', 4, 'HR', 'KPI_PUBLISHED')).toBe('/kpi?reviewId=4');
		expect(resolveNotificationRoute('kpi_period', 2, 'HR', 'KPI_REVIEW_OVERDUE')).toBe('/management/kpi/ky?periodId=2');
	});
});
