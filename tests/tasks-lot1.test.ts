import { describe, expect, it } from 'vitest';
import {
	dueTone,
	groupMyTasks,
	isBlankHtml,
	mentionIdsFromHtml,
	parsePointsFilter,
	pointsFilterLabel,
	pointsFilterParam,
	primaryActions,
	projectCodeError,
	quickDueOptions,
	secondaryActions,
	taskDueText,
	taskErrorInfo,
	taskPointsText,
} from '~/utils/tasks.utils';
import { moduleOfPath } from '~/composables/useModuleAccess';
import { resolveNotificationRoute } from '~/utils/notification-route';
import type { TaskStatus } from '~/types/tasks.types';

const t = (dueDate: string, status: TaskStatus = 'TODO', overdue = false) => ({ dueDate, status, overdue });

describe('Công việc lô 1: chia nhóm Việc của tôi', () => {
	it('chia Quá hạn theo cờ của máy chủ, rồi Hôm nay, 7 ngày, Sau đó', () => {
		const g = groupMyTasks(
			[t('2026-11-20', 'TODO', true), t('2026-11-26'), t('2026-11-27'), t('2026-12-03'), t('2026-12-04'), t('2026-11-24', 'IN_REVIEW')],
			'2026-11-26',
		);
		expect(g.overdue).toHaveLength(1);
		// Việc đã báo xong hạn đã qua không "quá hạn" (cờ máy chủ false) nên rơi vào Hôm nay.
		expect(g.today).toHaveLength(2);
		expect(g.upcoming.map(x => x.dueDate)).toEqual(['2026-11-27', '2026-12-03']);
		expect(g.later.map(x => x.dueDate)).toEqual(['2026-12-04']);
	});

	it('tô màu hạn: đỏ khi quá hạn, cam khi hôm nay, xám khi đã xong', () => {
		expect(dueTone(t('2026-11-20', 'IN_PROGRESS', true), '2026-11-26')).toBe('overdue');
		expect(dueTone(t('2026-11-26'), '2026-11-26')).toBe('today');
		expect(dueTone(t('2026-11-20', 'DONE'), '2026-11-26')).toBe('done');
		expect(taskDueText(t('2026-11-24', 'TODO', true), '2026-11-26')).toBe('Quá 2 ngày');
		expect(taskDueText(t('2026-11-27'), '2026-11-26')).toBe('Ngày mai');
		expect(taskDueText(t('2027-01-05'), '2026-11-26')).toBe('05/01/2027');
	});

	it('lựa chọn nhanh cho Hạn: thứ Năm 26/11 có Thứ sáu này và Tuần sau là thứ Hai', () => {
		expect(quickDueOptions('2026-11-26')).toEqual([
			{ label: 'Hôm nay', value: '2026-11-26' },
			{ label: 'Ngày mai', value: '2026-11-27' },
			{ label: 'Tuần sau', value: '2026-11-30' },
		]);
		expect(quickDueOptions('2026-11-24').map(o => o.label)).toEqual(['Hôm nay', 'Ngày mai', 'Thứ sáu này', 'Tuần sau']);
	});

	it('việc không có hạn: chữ "Chưa có hạn", màu thường, nằm nhóm cuối', () => {
		const noDue = { dueDate: null, status: 'TODO' as const, overdue: false };
		expect(taskDueText(noDue, '2026-11-26')).toBe('Chưa có hạn');
		expect(dueTone(noDue, '2026-11-26')).toBe('normal');
		const g = groupMyTasks([noDue, t('2026-11-26')], '2026-11-26');
		expect(g.noDue).toHaveLength(1);
		expect(g.today).toHaveLength(1);
	});
});

describe('Công việc: điểm và bộ lọc điểm', () => {
	it('chữ điểm: có điểm thì "3 điểm" (không viết "3 đ" dễ đọc thành tiền), chưa chấm thì gạch', () => {
		expect(taskPointsText(3)).toBe('3 điểm');
		expect(taskPointsText(null)).toBe('—');
	});

	it('đọc bộ lọc kiểu JQL, ghép VÀ, bỏ khoảng trắng', () => {
		expect(parsePointsFilter('>=3')).toEqual([{ op: '>=', value: 3 }]);
		expect(parsePointsFilter(' >= 2 , <=5 ')).toEqual([
			{ op: '>=', value: 2 },
			{ op: '<=', value: 5 },
		]);
		expect(parsePointsFilter('!=0')).toEqual([{ op: '!=', value: 0 }]);
		expect(parsePointsFilter('')).toEqual([]);
		expect(pointsFilterParam(parsePointsFilter(' >= 2 , <=5 ') ?? [])).toBe('>=2,<=5');
	});

	it('cú pháp sai thì trả null', () => {
		expect(parsePointsFilter('3')).toBeNull();
		expect(parsePointsFilter('=>3')).toBeNull();
		expect(parsePointsFilter('>=a')).toBeNull();
		expect(parsePointsFilter('>=2,abc')).toBeNull();
	});

	it('câu đọc của bộ lọc', () => {
		expect(pointsFilterLabel([{ op: '=', value: 0 }])).toBe('Chưa có điểm');
		expect(pointsFilterLabel([{ op: '>=', value: 2 }, { op: '<=', value: 5 }])).toBe('Điểm từ 2 và tối đa 5');
	});
});

describe('Công việc lô 1: nút theo allowedActions', () => {
	it('tối đa hai nút chính, người nghiệm thu thấy Nghiệm thu rồi Trả lại', () => {
		expect(primaryActions(['return', 'accept', 'cancel'])).toEqual(['accept', 'return']);
		expect(secondaryActions(['return', 'accept', 'cancel'])).toEqual(['cancel']);
		expect(primaryActions(['submit', 'back_to_todo', 'cancel'], 1)).toEqual(['submit']);
		expect(primaryActions(['cancel'])).toEqual([]);
	});
});

describe('Công việc lô 1: bình luận và lỗi', () => {
	it('đọc id người được nhắc từ HTML Tiptap, không trùng', () => {
		const html =
			'<p>Chị <span data-type="mention" class="task-mention" data-id="5" data-label="Lê Thị Lan">@Lê Thị Lan</span> và <span data-id="8" data-type="mention">@Bốn</span> <span data-type="mention" data-id="5">@Lan</span></p>';
		expect(mentionIdsFromHtml(html)).toEqual([5, 8]);
		expect(isBlankHtml('<p></p>')).toBe(true);
		expect(isBlankHtml('<p><span data-type="mention" data-id="5">@Lan</span></p>')).toBe(false);
	});

	it('đọc bản mới của 409 lệch phiên bản và tên người giao của 404', () => {
		const conflict = Object.assign(new Error('Việc vừa được người khác thay đổi.'), {
			status: 409,
			data: { error: { code: 'TASK_VERSION_CONFLICT', message: 'Việc vừa được người khác thay đổi.', details: { task: { id: 1, status: 'IN_REVIEW', version: 5 } } } },
		});
		const info = taskErrorInfo(conflict);
		expect(info.code).toBe('TASK_VERSION_CONFLICT');
		expect(info.task?.status).toBe('IN_REVIEW');
		const hidden = Object.assign(new Error('x'), {
			status: 404,
			data: { error: { code: 'TASK_NOT_VISIBLE', message: 'x', details: { code: 'HQ-1', assignerName: 'Lê Thị Lan' } } },
		});
		expect(taskErrorInfo(hidden).assignerName).toBe('Lê Thị Lan');
	});

	it('mã dự án 2–6 ký tự, chữ cái đầu rồi chữ hoặc số (bridge mục 29), không dùng CV', () => {
		expect(projectCodeError('hq')).toBeNull();
		expect(projectCodeError('L25')).toBeNull();
		expect(projectCodeError('H1')).toBeNull();
		expect(projectCodeError('CV')).toMatch(/việc lẻ/);
		expect(projectCodeError('1AB')).toMatch(/bắt đầu bằng chữ cái/);
		expect(projectCodeError('H')).toMatch(/2 đến 6/);
		expect(projectCodeError('ABCDEFG')).toMatch(/2 đến 6/);
	});
});

describe('Công việc lô 1: điều hướng', () => {
	it('/cong-viec thuộc module TASKS, thông báo task mở trang chi tiết', () => {
		expect(moduleOfPath('/cong-viec')).toBe('TASKS');
		expect(moduleOfPath('/cong-viec/du-an/HQ')).toBe('TASKS');
		expect(resolveNotificationRoute('task', 41, 'EMPLOYEE', 'TASK_ASSIGNED')).toBe('/cong-viec/41');
	});
});
