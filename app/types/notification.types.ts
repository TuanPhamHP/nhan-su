export type NotificationCategory = 'EVENT' | 'ATTENDANCE' | 'LEAVE' | 'REQUEST';

export type NotificationActionType = 'NAVIGATE_ONLY' | 'APPROVE_REJECT' | null;

export type NotificationType =
	| 'CHECK_IN'
	| 'CHECK_OUT'
	| 'LATE'
	| 'ABSENT'
	| 'MISSING_CHECKOUT'
	| 'CHECKIN_REMINDER'
	| 'CHECKOUT_REMINDER'
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
	| 'VIOLATION_REJECTED'
	| 'ONLINE_WORK_CREATED'
	| 'ONLINE_WORK_APPROVED'
	| 'ONLINE_WORK_REJECTED'
	| 'ONLINE_WORK_CANCELLED'
	| 'ONLINE_WORK_COMPLETED'
	| 'MAKEUP_CREATED'
	| 'MAKEUP_APPROVED'
	| 'MAKEUP_REJECTED'
	| 'CONTRACT_EXPIRY_WARNING'
	| 'BUSINESS_TRIP_PENDING'
	| 'BUSINESS_TRIP_APPROVED'
	| 'BUSINESS_TRIP_REJECTED'
	| 'GENERAL_REQUEST_PENDING'
	| 'GENERAL_REQUEST_APPROVED'
	| 'GENERAL_REQUEST_REJECTED'
	| 'GENERAL_REQUEST_CANCELLED'
	| 'TEST';

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

/**
 * Payload trong `data` field của FCM message (mọi value đều là string vì FCM ép kiểu).
 * Tham khảo: docs/backend/bridges/fcm-notifications.md mục 3.
 */
export interface FcmDataPayload {
	category: NotificationCategory | string;
	type: NotificationType | string;
	refType: string;
	id: string;
	notificationId: string;
	title: string;
	body: string;
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
