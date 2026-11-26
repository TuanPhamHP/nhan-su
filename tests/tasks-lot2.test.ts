import { describe, expect, it } from 'vitest';
import {
	DAY_WIDTH,
	dragDays,
	monthGrid,
	shiftMonth,
	tasksByDue,
	timelineAddDays,
	timelineBar,
	timelineSections,
	timelineTicks,
	timelineWindow,
} from '~/utils/task-timeline';
import { PROGRESS_COLUMNS, pctText, recurrenceText } from '~/utils/tasks.utils';
import { moduleOfPath } from '~/composables/useModuleAccess';
import { resolveNotificationRoute } from '~/utils/notification-route';

describe('Công việc lô 2: biểu đồ tiến độ', () => {
	it('khoảng xem bắt đầu từ thứ Hai và không quá 370 ngày ở mọi thang', () => {
		for (const s of ['day', 'week', 'month'] as const) {
			const w = timelineWindow(s, '2026-11-26');
			expect(new Date(`${w.from}T00:00:00`).getDay()).toBe(1);
			const days = (Date.parse(w.to) - Date.parse(w.from)) / 86400000 + 1;
			expect(days).toBeLessThanOrEqual(370);
			expect(w.from <= '2026-11-26' && w.to >= '2026-11-26').toBe(true);
		}
	});

	it('thanh từ ngày bắt đầu tới hạn; không có ngày bắt đầu là chấm; vạch hạn ban đầu khi đã đổi hạn', () => {
		const dw = DAY_WIDTH.day;
		const bar = timelineBar(
			{ startDate: '2026-11-25', dueDate: '2026-11-28', originalDueDate: '2026-11-26', dueChangeCount: 1 },
			'2026-11-23',
			'2026-12-31',
			dw,
		);
		expect(bar.left).toBe(2 * dw);
		expect(bar.width).toBe(4 * dw);
		expect(bar.dot).toBe(false);
		expect(bar.originalLeft).toBe(4 * dw);
		const dot = timelineBar({ startDate: null, dueDate: '2026-11-26', originalDueDate: '2026-11-26', dueChangeCount: 0 }, '2026-11-23', '2026-12-31', dw);
		expect(dot.dot).toBe(true);
		expect(dot.originalLeft).toBeNull();
		// Bắt đầu trước khoảng xem: thanh bị cắt ở mép trái.
		const clipped = timelineBar({ startDate: '2026-11-01', dueDate: '2026-11-24', originalDueDate: '2026-11-24', dueChangeCount: 0 }, '2026-11-23', '2026-12-31', dw);
		expect(clipped.clippedStart).toBe(true);
		expect(clipped.left).toBe(0);
		expect(clipped.width).toBe(2 * dw);
	});

	it('kéo tính theo ô ngày gần nhất, nhãn tháng phủ đúng số ngày', () => {
		expect(dragDays(DAY_WIDTH.day * 2.4, DAY_WIDTH.day)).toBe(2);
		expect(dragDays(-DAY_WIDTH.day * 0.6, DAY_WIDTH.day)).toBe(-1);
		const { months, minor } = timelineTicks('2026-11-23', '2026-12-06', 'day');
		expect(months.map(m => m.label)).toEqual(['Tháng 11/2026', 'Tháng 12/2026']);
		expect(months[0]!.width).toBe(8 * DAY_WIDTH.day);
		expect(minor).toHaveLength(14);
		expect(minor.filter(m => m.weekend)).toHaveLength(4);
		expect(timelineAddDays('2026-11-30', 1)).toBe('2026-12-01');
	});

	it('gom theo nhóm việc đúng thứ tự nhóm, việc không nhóm nằm cuối', () => {
		const tasks = [
			{ id: 1, group: { id: 2, name: 'Làm việc với cảng' } },
			{ id: 2, group: null },
			{ id: 3, group: { id: 1, name: 'Hồ sơ chứng từ' } },
		];
		const secs = timelineSections(tasks, true, [
			{ id: 1, name: 'Hồ sơ chứng từ' },
			{ id: 2, name: 'Làm việc với cảng' },
		]);
		expect(secs.map(s => s.label)).toEqual(['Hồ sơ chứng từ', 'Làm việc với cảng', 'Chưa có nhóm']);
		expect(timelineSections(tasks, false)).toHaveLength(1);
	});
});

describe('Công việc lô 2: lịch tháng', () => {
	it('lưới tháng từ thứ Hai tới Chủ nhật, không quá 62 ngày máy chủ cho', () => {
		const g = monthGrid('2027-02');
		expect(g.from).toBe('2027-02-01');
		expect(g.to).toBe('2027-02-28');
		const n = monthGrid('2026-11');
		expect(n.from).toBe('2026-10-26');
		expect(n.to).toBe('2026-12-06');
		expect(n.days.length % 7).toBe(0);
		expect(n.days.length).toBeLessThanOrEqual(62);
		expect(shiftMonth('2026-12', 1)).toBe('2027-01');
		const byDay = tasksByDue([{ dueDate: '2026-11-30' }, { dueDate: '2026-11-26' }, { dueDate: '2026-11-30' }]);
		expect([...byDay.keys()]).toEqual(['2026-11-26', '2026-11-30']);
		expect(byDay.get('2026-11-30')).toHaveLength(2);
	});
});

describe('Công việc lô 2: việc định kỳ, báo cáo', () => {
	it('câu đời thường cho quy tắc lặp', () => {
		expect(recurrenceText({ frequency: 'MONTHLY', dayOfMonth: 31 })).toBe('Ngày 31 hằng tháng');
		expect(recurrenceText({ frequency: 'WEEKLY', weekdays: [3, 1] })).toBe('Thứ Hai, Thứ Tư hằng tuần');
		expect(recurrenceText({ frequency: 'MONTHLY', dayOfMonth: 5, interval: 2 })).toBe('Ngày 5 mỗi 2 tháng');
		expect(recurrenceText({ frequency: 'QUARTERLY', dayOfMonth: 15, monthOfPeriod: 2 })).toBe('Ngày 15 tháng thứ 2 của quý, hằng quý');
		expect(recurrenceText({ frequency: 'YEARLY', dayOfMonth: 20, monthOfPeriod: 12 })).toBe('Ngày 20/12 hằng năm');
	});

	it('cột báo cáo đúng chín ô của bridge mục 16, tỷ lệ viết kiểu Việt', () => {
		expect(PROGRESS_COLUMNS.map(c => c.metric)).toEqual([
			'assigned',
			'cancelled',
			'done',
			'onTimeOriginal',
			'onTimeCurrent',
			'overdueOpen',
			'returned',
			'points',
			'quality',
		]);
		expect(pctText(66.666)).toBe('66,7%');
		expect(pctText(null)).toBe('—');
	});

	it('thông báo cảnh báo nghỉ việc mở danh sách việc của người nghỉ', () => {
		expect(resolveNotificationRoute('task_offboarding', 9, 'MANAGER', 'TASK_OFFBOARDING_OPEN')).toBe('/cong-viec?assigneeIds=9');
		expect(moduleOfPath('/cong-viec/bao-cao')).toBe('TASKS');
		expect(moduleOfPath('/cong-viec/dinh-ky')).toBe('TASKS');
	});
});
