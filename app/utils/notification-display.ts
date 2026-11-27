import type { NotificationResponse } from '~/types/notification.types';

/**
 * Cách hiện một thông báo ở chuông và trang Thông báo: biểu tượng theo loại, chữ thân đã bỏ dấu vết trợ lý.
 *
 * Biểu tượng là icon của giao diện (không emoji, từ 19/11/2026). Mặc định chọn theo `category`; các loại Công việc
 * có biểu tượng riêng để người đọc nhận ra ngay đây là xin dời hạn, rút lại báo xong hay bị đổi người, không phải
 * một tin "việc" chung chung. `label` là tên loại cho trình đọc màn hình.
 */
export interface NotificationIcon {
	icon: string;
	cls: string;
	label: string;
}

const CATEGORY_ICONS: Record<string, NotificationIcon> = {
	ATTENDANCE: { icon: 'heroicons:clock', cls: 'text-amber-600 dark:text-amber-400', label: 'Chấm công' },
	LEAVE: { icon: 'heroicons:calendar-days', cls: 'text-sky-600 dark:text-sky-400', label: 'Xin nghỉ' },
	TASK: { icon: 'heroicons:clipboard-document-check', cls: 'text-brand-600 dark:text-brand-400', label: 'Công việc' },
};
const DEFAULT_ICON: NotificationIcon = { icon: 'heroicons:bell', cls: 'text-gray-500 dark:text-gray-400', label: 'Thông báo' };

/** KPI dùng chung category `TASK` với công việc; tách biểu tượng để người đọc phân biệt. */
const KPI_ICON: NotificationIcon = { icon: 'heroicons:chart-bar', cls: 'text-violet-600 dark:text-violet-400', label: 'KPI' };

/** Các loại Công việc thêm ngày 27/11/2026 (bridge `tasks.md` mục 27). */
const TYPE_ICONS: Partial<Record<string, NotificationIcon>> = {
	TASK_WITHDRAWN: { icon: 'heroicons:arrow-uturn-left', cls: 'text-amber-600 dark:text-amber-400', label: 'Rút lại báo xong' },
	TASK_DUE_REQUESTED: { icon: 'heroicons:calendar', cls: 'text-orange-600 dark:text-orange-400', label: 'Xin dời hạn' },
	TASK_DUE_REQUEST_DECIDED: { icon: 'heroicons:calendar-days', cls: 'text-emerald-600 dark:text-emerald-400', label: 'Kết quả xin dời hạn' },
	TASK_WATCHED_UPDATED: { icon: 'heroicons:eye', cls: 'text-brand-600 dark:text-brand-400', label: 'Việc bạn theo dõi' },
	TASK_UNASSIGNED: { icon: 'heroicons:user-minus', cls: 'text-rose-600 dark:text-rose-400', label: 'Đổi người làm' },
	TASK_OVERDUE: { icon: 'heroicons:exclamation-triangle', cls: 'text-rose-600 dark:text-rose-400', label: 'Quá hạn' },
	KPI_REVIEW_PENDING_FINAL: { icon: 'heroicons:document-check', cls: 'text-violet-600 dark:text-violet-400', label: 'Phiếu KPI chờ chốt' },
};

export function notificationIcon(n: Pick<NotificationResponse, 'type' | 'category'>): NotificationIcon {
	const byType = n.type ? TYPE_ICONS[n.type] : undefined;
	if (byType) return byType;
	if (n.type?.startsWith('KPI_')) return KPI_ICON;
	return CATEGORY_ICONS[n.category] ?? DEFAULT_ICON;
}

/**
 * Nội dung do trợ lý AI soạn (lý do xin dời hạn, mô tả việc…) mang đuôi truy vết
 * "⟦Trợ lý AI⟧ Soạn qua Trợ lý AI · {người} xác nhận lúc {dd/mm/yyyy hh:mm}" (bridge `tasks.md` mục 32). Thông báo nhúng
 * nguyên lý do đó vào thân, nên ở chuông đoạn đuôi này thành chữ rác giữa câu. Thay bằng " (soạn qua Trợ lý AI)",
 * giữ phần câu phía sau.
 */
const AGENT_TRAIL = /\s*⟦Trợ lý AI⟧\s*Soạn qua Trợ lý AI(?:\s*·\s*.*?xác nhận lúc \d{2}\/\d{2}\/\d{4} \d{2}:\d{2})?/g;

export function notificationBodyText(body: string | null | undefined): string {
	return String(body ?? '').replace(AGENT_TRAIL, ' (soạn qua Trợ lý AI)');
}

/** Thông báo xin dời hạn duyệt, không duyệt ngay trong chuông (bridge `tasks.md` mục 25.4). */
export function isTaskDueRequestAction(n: Pick<NotificationResponse, 'actionType' | 'actionPayload'>): boolean {
	return n.actionType === 'APPROVE_REJECT' && n.actionPayload?.refType === 'task_due_request';
}
