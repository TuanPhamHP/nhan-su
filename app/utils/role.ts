import type { UserRole } from '~/types/auth.types';

/**
 * Binary role model:
 * - EMPLOYEE = personal view (chấm công cá nhân, đơn của mình)
 * - Mọi role còn lại (MANAGER, CHIEF, DIRECTOR, HR, ADMIN) = quản lý
 * Dùng 2 helper dưới thay cho việc liệt kê thủ công role list.
 */

export function isEmployeeRole(role: UserRole | null | undefined): boolean {
	return role === 'EMPLOYEE';
}

export function isManagementRole(role: UserRole | null | undefined): boolean {
	return !!role && role !== 'EMPLOYEE';
}
