import type { ViolationRequestType, ViolationRequestStatus } from '~/types/violation.types';
import type { SelectOption } from '~/components/ui/Select.vue';

// ─── Type labels & classes ────────────────────────────────────────────────────

export const VIOLATION_TYPE_LABEL: Record<ViolationRequestType, string> = {
	FORGOT_CHECKIN: 'Quên chấm công vào',
	FORGOT_CHECKOUT: 'Quên chấm công ra',
	LATE: 'Đi muộn',
	EARLY: 'Về sớm',
};

export const VIOLATION_TYPE_CLASS: Record<ViolationRequestType, string> = {
	FORGOT_CHECKIN: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
	FORGOT_CHECKOUT: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
	LATE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
	EARLY: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
};

// ─── Status labels & classes ──────────────────────────────────────────────────

export const VIOLATION_STATUS_LABEL: Record<ViolationRequestStatus, string> = {
	PENDING: 'Chờ duyệt',
	APPROVED: 'Đã duyệt',
	REJECTED: 'Từ chối',
	CANCELLED: 'Đã thu hồi',
};

export const VIOLATION_STATUS_CLASS: Record<ViolationRequestStatus, string> = {
	PENDING: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
	APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
	REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
	CANCELLED: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

// ─── Filter options ───────────────────────────────────────────────────────────

export const VIOLATION_TYPE_OPTIONS: SelectOption[] = [
	{ value: undefined, label: 'Tất cả loại' },
	{ value: 'FORGOT_CHECKIN', label: VIOLATION_TYPE_LABEL.FORGOT_CHECKIN },
	{ value: 'FORGOT_CHECKOUT', label: VIOLATION_TYPE_LABEL.FORGOT_CHECKOUT },
	{ value: 'LATE', label: VIOLATION_TYPE_LABEL.LATE },
	{ value: 'EARLY', label: VIOLATION_TYPE_LABEL.EARLY },
];

export const VIOLATION_STATUS_OPTIONS: SelectOption[] = [
	{ value: undefined, label: 'Tất cả trạng thái' },
	{ value: 'PENDING', label: VIOLATION_STATUS_LABEL.PENDING },
	{ value: 'APPROVED', label: VIOLATION_STATUS_LABEL.APPROVED },
	{ value: 'REJECTED', label: VIOLATION_STATUS_LABEL.REJECTED },
	{ value: 'CANCELLED', label: VIOLATION_STATUS_LABEL.CANCELLED },
];

// ─── Helper functions ─────────────────────────────────────────────────────────

export function violationTypeLabel(type: ViolationRequestType | string | null | undefined): string {
	if (!type) return '—';
	return VIOLATION_TYPE_LABEL[type as ViolationRequestType] ?? type;
}

export function violationTypeClass(type: ViolationRequestType | string | null | undefined): string {
	if (!type) return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
	return VIOLATION_TYPE_CLASS[type as ViolationRequestType] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
}

export function violationStatusLabel(status: ViolationRequestStatus): string {
	return VIOLATION_STATUS_LABEL[status] ?? status;
}

export function violationStatusClass(status: ViolationRequestStatus): string {
	return VIOLATION_STATUS_CLASS[status] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
}
