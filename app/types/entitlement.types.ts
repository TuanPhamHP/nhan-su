/**
 * Quyền dùng module của công ty trong phiên hiện tại (`GET /v1/me/entitlements`).
 * Xem `docs/backend/bridges/entitlements.md`. Danh mục sẽ có thêm module, gặp mã lạ thì bỏ qua.
 */
export type ModuleCode =
	| 'CORE'
	| 'AI_AGENT'
	| 'REPORTS'
	| 'OVERTIME'
	| 'ONLINE_WORK'
	| 'BUSINESS_TRIP'
	| 'CONTRACT_INSURANCE'
	| 'ANNOUNCEMENT';

export type ModuleState = 'ENABLED' | 'READ_ONLY' | 'DISABLED';

export type ModuleStateReason = 'NOT_SUBSCRIBED' | 'SUSPENDED' | 'READ_ONLY' | 'EXPIRED' | null;

export interface ModuleEntitlement {
	code: ModuleCode;
	/** Tên tiếng Việt, hiển thị được ngay. */
	label: string;
	state: ModuleState;
	reason: ModuleStateReason;
	/** ISO 8601. Có thể có cả khi đang ENABLED. */
	expiresAt: string | null;
}

export interface EntitlementsResponse {
	modules: ModuleEntitlement[];
}
