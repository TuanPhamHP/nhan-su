/**
 * Sửa giao diện Công việc sau thử nghiệm người dùng (phần 2, nối API mới 27/11/2026): các hàm thuần cho rút
 * lại báo xong, việc phải chờ, mã dự án có chữ số.
 */
import { describe, expect, it } from 'vitest';
import {
	ACTION_LABELS,
	ACTION_TARGET,
	blockerWarningText,
	isTaskRef,
	needsBlockerWarning,
	primaryActions,
	waitingText,
} from '~/utils/tasks.utils';

describe('UI-7a: rút lại báo xong', () => {
	it('nhãn và trạng thái đích của withdraw', () => {
		expect(ACTION_LABELS.withdraw).toBe('Rút lại báo xong');
		expect(ACTION_TARGET.withdraw).toBe('IN_PROGRESS');
	});

	it('việc chờ nghiệm thu mà người làm còn rút lại được thì nút hiện ở đầu khung', () => {
		expect(primaryActions(['withdraw'])).toEqual(['withdraw']);
		// Người nghiệm thu: Nghiệm thu, Trả lại đứng trước, không có Rút lại.
		expect(primaryActions(['accept', 'return'])).toEqual(['accept', 'return']);
	});
});

describe('UI-6: việc phải chờ việc khác chưa xong', () => {
	it('bắt đầu, báo xong, tự đóng, nghiệm thu thì hỏi lại; thao tác khác không hỏi', () => {
		for (const a of ['start', 'submit', 'self_close', 'accept'] as const) expect(needsBlockerWarning(a, ['HQ-1'])).toBe(true);
		for (const a of ['return', 'reopen', 'cancel', 'withdraw', 'back_to_todo'] as const) expect(needsBlockerWarning(a, ['HQ-1'])).toBe(false);
	});

	it('[EDGE] không còn việc phải chờ thì không hỏi, không ghi chữ Chờ', () => {
		expect(needsBlockerWarning('submit', [])).toBe(false);
		expect(needsBlockerWarning('submit', undefined)).toBe(false);
		expect(waitingText([])).toBeNull();
		expect(waitingText(undefined)).toBeNull();
	});

	it('câu hỏi lại và chữ trên dòng nêu đúng số hiệu', () => {
		expect(blockerWarningText(['HQ-1'])).toBe('Việc này đang phải chờ HQ-1 chưa xong. Vẫn tiếp tục?');
		expect(waitingText(['HQ-1', 'HQ-3'])).toBe('Chờ HQ-1, HQ-3');
	});
});

describe('TK-9: số hiệu việc của dự án có chữ số', () => {
	it('nhận L25-1, KT2-14, cv-3 và id số', () => {
		expect(isTaskRef('L25-1')).toBe(true);
		expect(isTaskRef('KT2-14')).toBe(true);
		expect(isTaskRef('cv-3')).toBe(true);
		expect(isTaskRef('41')).toBe(true);
	});

	it('[EDGE] mã bắt đầu bằng số hay dài quá 6 ký tự không phải số hiệu', () => {
		expect(isTaskRef('1AB-2')).toBe(false);
		expect(isTaskRef('ABCDEFG-1')).toBe(false);
		expect(isTaskRef('L25')).toBe(false);
	});
});
