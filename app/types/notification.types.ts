export type NotificationType = 'attendance.checkin' | 'attendance.checkout';

export interface NotificationRecord {
	id: number;
	type: NotificationType;
	title: string;
	body: string;
	payload: Record<string, unknown>;
	readAt: string | null;
	createdAt: string;
}

export interface UnreadCountResponse {
	unreadCount: number;
}

export interface RegisterDeviceTokenDto {
	token: string;
	platform: 'WEB' | 'ANDROID' | 'IOS';
}

export interface NotificationQueryParams {
	page?: number;
	limit?: number;
}
