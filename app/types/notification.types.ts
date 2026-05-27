export type NotificationCategory = 'EVENT' | 'ATTENDANCE' | 'LEAVE';

export type NotificationActionType = 'NAVIGATE_ONLY' | 'APPROVE_REJECT' | null;

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

export interface NotificationActionPayload {
	approveEndpoint: string;
	rejectEndpoint: string;
	label: string;
	refType: string;
	refId: number;
}

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
	targetUrl: string | null;
	actionType: NotificationActionType;
	actionPayload: NotificationActionPayload | null;
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

// ─── Notification Testing ──────────────────────────────────────────────────────

export type NotificationPlatform = 'email' | 'in-app' | 'fcm';

export interface TestNotificationDto {
	employeeId: number;
	title: string;
	body: string;
	platforms: NotificationPlatform[];
	emailTo?: string;
}

export interface FcmTestResult {
	sent: number;
	invalidRemoved: number;
	tokens: string[];
}

export interface PlatformResult {
	sent: boolean;
	detail?: FcmTestResult;
	error?: string;
}

export interface TestNotificationResult {
	platforms: {
		'in-app'?: PlatformResult;
		email?: PlatformResult;
		fcm?: PlatformResult;
	};
}

export interface TestFcmDto {
	employeeId: number;
	title: string;
	body: string;
	type?: string;
}

export interface TestEmailResult {
	message: string;
}
