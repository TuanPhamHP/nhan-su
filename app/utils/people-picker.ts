import type { PickablePerson } from '~/components/modules/general-request/EmployeePicker.vue';
import type { DepartmentSummary } from '~/types/department.types';
import type { EmployeeSummary } from '~/types/employee.types';

/**
 * Danh sách người cho ô chọn người của Công việc: tên phòng (hoặc mã nhân viên) hiện mờ bên cạnh,
 * trưởng phòng có thêm nhãn "Trưởng phòng <tên phòng>".
 *
 * Người giao việc sang phòng khác thường không biết ai là trưởng phòng bên đó; có nhãn thì gõ tên
 * phòng hay gõ "trưởng phòng" là thấy ngay (ô chọn người đưa người khớp nhãn lên đầu).
 */
export function taskPickablePeople(
	employees: EmployeeSummary[],
	departments: Pick<DepartmentSummary, 'name' | 'manager'>[],
): PickablePerson[] {
	const headOf = new Map<number, string[]>();
	for (const d of departments) {
		if (!d.manager) continue;
		headOf.set(d.manager.id, [...(headOf.get(d.manager.id) ?? []), d.name]);
	}
	return employees.map(e => {
		const heads = headOf.get(e.id);
		return {
			id: e.id,
			fullName: e.fullName,
			hint: e.department?.name ?? e.employeeCode,
			badge: heads ? `Trưởng phòng ${heads.join(', ')}` : null,
		};
	});
}
