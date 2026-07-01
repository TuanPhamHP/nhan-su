import type { MakeupRequestStatus } from '~/types/makeup-attendance.types';
import type { SelectOption } from '~/components/ui/Select.vue';

export const MAKEUP_STATUS_LABEL: Record<MakeupRequestStatus, string> = {
	PENDING: 'Chờ duyệt',
	APPROVED: 'Đã duyệt',
	REJECTED: 'Từ chối',
};

export const MAKEUP_STATUS_CLASS: Record<MakeupRequestStatus, string> = {
	PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
	APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
	REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

export const MAKEUP_STATUS_OPTIONS: SelectOption[] = [
	{ value: undefined, label: 'Tất cả trạng thái' },
	{ value: 'PENDING', label: MAKEUP_STATUS_LABEL.PENDING },
	{ value: 'APPROVED', label: MAKEUP_STATUS_LABEL.APPROVED },
	{ value: 'REJECTED', label: MAKEUP_STATUS_LABEL.REJECTED },
];

export function makeupStatusLabel(status: MakeupRequestStatus): string {
	return MAKEUP_STATUS_LABEL[status];
}

export function makeupStatusClass(status: MakeupRequestStatus): string {
	return MAKEUP_STATUS_CLASS[status];
}
