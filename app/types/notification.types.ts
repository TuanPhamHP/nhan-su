export type NotificationCategory = 'EVENT' | 'ATTENDANCE' | 'LEAVE';

export type NotificationType =
	| 'CHECK_IN'
	| 'CHECK_OUT'
	| 'LATE'
	| 'ABSENT'
	| 'MISSING_CHECKOUT'
	| 'LEAVE_CREATED'
	| 'LEAVE_APPROVED'
	| 'LEAVE_REJECTED'
	| 'LEAVE_CANCELLED'
	| 'LEAVE_AUTO_CANCELLED'
	| 'OT_CREATED'
	| 'OT_APPROVED'
	| 'OT_REJECTED'
	| 'OT_CANCELLED'
	| 'OT_AUTO_CANCELLED'
	| 'VIOLATION_CREATED'
	| 'VIOLATION_APPROVED'
	| 'VIOLATION_REJECTED';

export interface NotificationResponse {
	id: number;
	title: string;
	body: string;
	category: NotificationCategory;
	type: NotificationType;
	refId: number | null;
	refType: string | null;
	isRead: boolean;
	createdAt: string;
}

export interface UnreadCountResponse {
	total: number;
	event: number;
	attendance: number;
	leave: number;
}

export interface NotificationListMeta {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
	unreadCount: number;
}

export interface QueryNotificationsParams {
	page?: number;
	limit?: number;
	category?: NotificationCategory;
}

export interface RegisterDeviceTokenDto {
	token: string;
	platform: 'WEB' | 'ANDROID' | 'IOS';
}
