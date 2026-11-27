import { describe, expect, it } from 'vitest';
import { checklistLeft, needsChecklistWarning } from '~/utils/tasks.utils';

describe('Công việc: mục kiểm tra chưa tick khi báo xong', () => {
	it('báo xong hay tự đóng việc mà còn mục chưa tick thì hỏi lại', () => {
		expect(needsChecklistWarning('submit', { total: 3, done: 0 })).toBe(true);
		expect(needsChecklistWarning('submit', { total: 3, done: 2 })).toBe(true);
		expect(needsChecklistWarning('self_close', { total: 1, done: 0 })).toBe(true);
	});

	it('tick hết hoặc không có mục nào thì không hỏi', () => {
		expect(needsChecklistWarning('submit', { total: 3, done: 3 })).toBe(false);
		expect(needsChecklistWarning('submit', { total: 0, done: 0 })).toBe(false);
		expect(needsChecklistWarning('self_close', { total: 0, done: 0 })).toBe(false);
	});

	it('thao tác khác không hỏi lại, Nghiệm thu chỉ ghi số mục còn lại', () => {
		expect(needsChecklistWarning('accept', { total: 3, done: 0 })).toBe(false);
		expect(needsChecklistWarning('start', { total: 3, done: 0 })).toBe(false);
		expect(checklistLeft({ total: 3, done: 1 })).toBe(2);
		expect(checklistLeft({ total: 2, done: 5 })).toBe(0);
	});
});
