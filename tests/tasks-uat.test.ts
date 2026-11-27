/**
 * Sửa giao diện Công việc sau thử nghiệm người dùng 26/11/2026 (phần 1): các hàm thuần mà màn hình dựa
 * vào để đặt chữ và lọc.
 *
 * - UI-3: tìm ở mọi ngăn thì mỗi dòng ghi việc nằm ở ngăn nào.
 * - UI-10: trưởng phòng có nhãn khi chọn người.
 * - UI-22: câu việc phải chờ nói rõ số hiệu và hai cái hạn.
 * - UI-23: hai ô Từ, Đến ra đúng cú pháp lọc điểm và đọc ngược được.
 */
import { describe, expect, it } from 'vitest';
import { lateBlockerText, parsePointsFilter, pointsRangeOf, pointsRangeParam, taskRelation } from '~/utils/tasks.utils';
import { taskPickablePeople } from '~/utils/people-picker';
import type { EmployeeSummary } from '~/types/employee.types';

const person = (id: number) => ({ id, fullName: `Người ${id}`, avatarUrl: null });
const task = (assignee: number, assigner: number, reviewer: number, id = 1) => ({
	id,
	assignee: person(assignee),
	assigner: person(assigner),
	reviewer: person(reviewer),
});

describe('UI-3: việc tìm được nằm ở ngăn nào', () => {
	it('tôi làm, tôi giao, tôi theo dõi, tôi nghiệm thu, còn lại là việc xem được', () => {
		expect(taskRelation(task(5, 4, 4), 5)).toBe('Tôi làm');
		expect(taskRelation(task(6, 5, 5), 5)).toBe('Tôi giao');
		expect(taskRelation(task(6, 4, 4, 9), 5, new Set([9]))).toBe('Tôi theo dõi');
		expect(taskRelation(task(6, 4, 5), 5)).toBe('Tôi nghiệm thu');
		expect(taskRelation(task(6, 4, 4), 5)).toBe('Việc bạn xem được');
	});

	it('[EDGE] tự giao cho mình tính là Tôi làm, không phải Tôi giao', () => {
		expect(taskRelation(task(5, 5, 5), 5)).toBe('Tôi làm');
	});
});

describe('UI-23: lọc điểm bằng hai ô Từ, Đến', () => {
	it('hai ô ra cùng cú pháp với ô Nâng cao', () => {
		expect(pointsRangeParam({ from: 2, to: 5 })).toBe('>=2,<=5');
		expect(pointsRangeParam({ from: 3, to: null })).toBe('>=3');
		expect(pointsRangeParam({ from: null, to: 5 })).toBe('<=5');
		expect(pointsRangeParam({ from: null, to: null })).toBe('');
	});

	it('đọc ngược bộ lọc đang có thành hai ô', () => {
		expect(pointsRangeOf(parsePointsFilter('>=2,<=5')!)).toEqual({ from: 2, to: 5 });
		expect(pointsRangeOf(parsePointsFilter('=0')!)).toEqual({ from: 0, to: 0 });
		expect(pointsRangeOf([])).toEqual({ from: null, to: null });
	});

	it('[EDGE] bộ lọc không viết được bằng hai ô thì để ô Nâng cao giữ nguyên', () => {
		expect(pointsRangeOf(parsePointsFilter('!=3')!)).toBeNull();
		expect(pointsRangeOf(parsePointsFilter('>2')!)).toBeNull();
		expect(pointsRangeOf(parsePointsFilter('>=2,>=3')!)).toBeNull();
	});
});

describe('UI-22: câu việc phải chờ đang trễ', () => {
	const blocker = { code: 'HQ-1', dueDate: '2026-12-03', late: true, visible: true };

	it('nêu số hiệu và hai cái hạn khi hạn việc phải chờ muộn hơn', () => {
		expect(lateBlockerText({ dueDate: '2026-11-28' }, [blocker], '2026-11-26')).toBe(
			'Phải chờ HQ-1, hạn HQ-1 (03/12) muộn hơn hạn việc này (28/11).',
		);
	});

	it('việc phải chờ đã quá hạn thì nói đang trễ hạn; không có việc nào trễ thì không có câu', () => {
		expect(lateBlockerText({ dueDate: null }, [blocker], '2026-11-26')).toBe('Phải chờ HQ-1, việc đó đang trễ hạn.');
		expect(lateBlockerText({ dueDate: '2026-11-28' }, [{ ...blocker, late: false }])).toBeNull();
	});

	it('[EDGE] việc phải chờ mà người xem không xem được thì không lộ số hiệu', () => {
		expect(lateBlockerText({ dueDate: '2026-11-28' }, [{ ...blocker, visible: false }])).toBe(
			'Phải chờ một việc bạn không xem được, việc đó đang trễ hạn.',
		);
	});
});

describe('UI-10: nhãn trưởng phòng khi chọn người', () => {
	const emp = (id: number, dept: string | null) =>
		({ id, fullName: `Người ${id}`, employeeCode: `NV${id}`, department: dept ? { id: id, name: dept } : null }) as unknown as EmployeeSummary;

	it('trưởng phòng có nhãn theo tên phòng, người khác không', () => {
		const people = taskPickablePeople([emp(4, 'Kế toán'), emp(5, 'Kế toán')], [{ name: 'Kế toán', manager: { id: 4, fullName: 'Người 4' } }]);
		expect(people.find(p => p.id === 4)?.badge).toBe('Trưởng phòng Kế toán');
		expect(people.find(p => p.id === 5)?.badge).toBeNull();
		expect(people.find(p => p.id === 5)?.hint).toBe('Kế toán');
	});

	it('[EDGE] API chưa trả trưởng phòng thì không có nhãn, không lỗi', () => {
		const people = taskPickablePeople([emp(4, 'Kế toán')], [{ name: 'Kế toán' }]);
		expect(people[0]?.badge).toBeNull();
	});

	it('[EDGE] một người làm trưởng hai phòng thì ghi cả hai', () => {
		const people = taskPickablePeople(
			[emp(4, 'Kế toán')],
			[
				{ name: 'Kế toán', manager: { id: 4, fullName: 'Người 4' } },
				{ name: 'Kho', manager: { id: 4, fullName: 'Người 4' } },
			],
		);
		expect(people[0]?.badge).toBe('Trưởng phòng Kế toán, Kho');
	});
});
