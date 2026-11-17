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
	| 'ANNOUNCEMENT'
	| 'ASSET'
	| 'RECRUIT';

export type ModuleState = 'ENABLED' | 'READ_ONLY' | 'DISABLED';

export type ModuleStateReason = 'NOT_SUBSCRIBED' | 'SUSPENDED' | 'READ_ONLY' | 'EXPIRED' | 'LAPSED' | null;

export interface ModuleEntitlement {
	code: ModuleCode;
	/** Tên tiếng Việt, hiển thị được ngay. */
	label: string;
	state: ModuleState;
	reason: ModuleStateReason;
	/** ISO 8601. Có thể có cả khi đang ENABLED. */
	expiresAt: string | null;
	/** ISO 8601. Qua thời điểm này thì module quá hạn tắt hẳn. `null` khi không có hạn. Đừng tự cộng 14 ngày. */
	graceEndsAt: string | null;
}

/** Một nhóm trong lưới chọn phân hệ. `code` chỉ để ghép, chữ hiện lên là `label`. */
export interface AppGroup {
	code: string;
	label: string;
}

/**
 * Một ô trong lưới chọn phân hệ, do máy chủ trả (`docs/backend/bridges/entitlements.md`
 * mục "Danh mục phân hệ").
 *
 * Máy chủ giữ phần ô, client giữ phần "ô mở vào đâu": `code` ghép với bảng màn hình của web
 * trong `app/config/app-modules.ts`. Nhờ vậy đổi tên hay icon chỉ cần phát hành BE.
 */
export interface AppTile {
	/** Ghép với `AppScreensDef.code`. Mã lạ thì web bỏ qua, không lỗi. */
	code: string;
	label: string;
	description: string;
	/** Mã nhóm, tra trong `groups` để lấy chữ hiện lên. */
	group: string;
	/** Màu nền ô icon, dạng `#rrggbb` — đặt thẳng vào `style`, không phải class Tailwind. */
	color: string;
	/** `d` của một `<path>` heroicons outline. Vẽ bằng `:d`, không dùng `v-html`. */
	icon: string;
	/** Module bán riêng chứa mọi màn hình của phân hệ; `null` khi phân hệ gộp nhiều module. */
	module: ModuleCode | null;
	/** Công ty không dùng được `module`. Máy chủ suy ra từ `modules`, FE tính lại phải ra cùng kết quả. */
	locked: boolean;
	lockReason: ModuleStateReason;
}

export interface EntitlementsResponse {
	modules: ModuleEntitlement[];
	/**
	 * Hotline của nhà cung cấp phần mềm, lấy từ env `BUSINESS_HOTLINE` của BE (đã bỏ khoảng trắng
	 * hai đầu). `null` khi chưa cấu hình — và BE cũ không có trường này, nên nơi đọc phải chịu được
	 * `undefined`. Mọi người đã đăng nhập nhận cùng một giá trị.
	 */
	businessHotline: string | null;
	/** Nhóm của lưới chọn phân hệ, đúng thứ tự hiện. BE cũ không có, nên nơi đọc chịu được `undefined`. */
	groups: AppGroup[];
	/** Ô của lưới, xếp theo nhóm rồi theo thứ tự trong nhóm. Xem ghi chú `undefined` ở `groups`. */
	apps: AppTile[];
}
