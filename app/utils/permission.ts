/**
 * Permission code duyệt đơn theo từng module.
 *
 * Source of truth: `docs/modules/auth/permission-master-list.md`.
 * Backend gate endpoint approve/reject bằng đúng các code này —
 * FE dùng để show/hide button "Duyệt / Từ chối", không implement lại logic approval.
 */
export const APPROVE_PERMISSIONS = {
	leave: 'leave:approve',
	overtime: 'overtime:approve',
	violation: 'violation:approve',
	makeup: 'makeup:approve',
	onlineWork: 'online-work:approve',
	businessTrip: 'business-trip:approve',
	generalRequest: 'general-request:approve',
} as const;

/** Dùng cho menu "Duyệt đơn" — hiện khi user duyệt được ít nhất 1 loại đơn. */
export const ALL_APPROVE_PERMISSIONS: string[] = Object.values(APPROVE_PERMISSIONS);
