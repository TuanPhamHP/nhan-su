import type { UserRole } from '~/types/auth.types';
import type { ModuleCode } from '~/types/entitlement.types';

/** Một mục trong sidebar của một app. */
export interface NavItem {
	label: string;
	route: string;
	/** `d` của <path> trong heroicons outline. */
	icon: string;
	/** Allowlist vai trò. Khai cái này thì `management` bị bỏ qua. */
	roles?: UserRole[];
	/** Hiện cho mọi vai trò khác `EMPLOYEE`. */
	management?: boolean;
	/** Yêu cầu quyền `<module>:<action>`. Chuỗi = phải có đúng quyền; mảng = có ít nhất một. */
	permission?: string | string[];
	/** Công ty chưa mở module thì ẩn mục này, kể cả với ADMIN. */
	module?: ModuleCode;
	dataTour?: string;
	matchQuery?: Record<string, string>;
	/**
	 * Nguồn số badge, chỉ hiện khi > 0. Khai bằng KHOÁ chứ không phải hàm closure: file
	 * cấu hình là dữ liệu tĩnh, không với tay vào store được. Sidebar dịch khoá này sang
	 * số thật (xem `badgeValue`).
	 */
	badgeKey?: 'approval' | 'unreadAnnouncement' | 'pendingAsset';
	/**
	 * `personal` = màn hình dữ liệu của CHÍNH người đang đăng nhập (`/attendance/my`,
	 * `/users/leave-requests`…), ai cũng xem được kể cả quản lý. Bỏ trống = màn hình quản
	 * lý dữ liệu của người khác, cần `management`/`roles`/`permission`.
	 *
	 * Cùng một phân hệ chứa cả hai mặt: nhân viên mở `TAL` thấy bảng công của mình, quản
	 * lý mở `TAL` thấy thêm bảng công toàn công ty. Nhờ vậy nhân viên cũng có lưới chọn
	 * phân hệ chứ không bị bỏ ngoài mô hình module.
	 */
	scope?: 'personal';
}

/**
 * Nhóm phân hệ, theo đúng bức tranh tổng thể hệ thống quản trị nội bộ (A–D).
 * "Hệ thống" là nhóm thứ năm, không có trong bức tranh vì đó là quản trị kỹ thuật
 * (phân quyền, cấu hình, nhật ký) chứ không phải module nghiệp vụ.
 */
export type AppGroup =
	| 'Quản trị nhân sự'
	| 'Thu hút & Phát triển'
	| 'Hành chính & Vận hành'
	| 'Quản trị & Phân tích'
	| 'Hệ thống';

/**
 * Một "app" trong hệ thống — tương đương một ô trong lưới chọn app.
 *
 * KHÁC với `ModuleCode`: `ModuleCode` là đơn vị BÁN HÀNG (công ty mua gói nào, còn hạn
 * không), còn app ở đây là đơn vị ĐIỀU HƯỚNG. Một app có thể gồm nhiều module bán hàng
 * (app Đơn từ chứa OVERTIME, ONLINE_WORK, BUSINESS_TRIP), và phần lớn màn hình nằm trong
 * `CORE` nên không thể lấy thẳng `ModuleCode` làm nhóm điều hướng.
 */
export interface AppModuleDef {
	/** Mã nội bộ, dùng cho localStorage "gần đây" và `data-app`. */
	code: string;
	label: string;
	/** Một câu ngắn hiện dưới tên app trong lưới chọn app. */
	description: string;
	icon: string;
	group: AppGroup;
	/** Màu nền ô icon trong lưới chọn app (class Tailwind). */
	tone: string;
	/** Bấm vào ô app thì đi đâu. Phải nằm trong `routes`. */
	home: string;
	/**
	 * Các tiền tố route thuộc app này — dùng để biết đang đứng ở app nào.
	 * Xếp từ CỤ THỂ đến TỔNG QUÁT không quan trọng: khi khớp sẽ lấy tiền tố dài nhất.
	 */
	routes: string[];
	items: NavItem[];
}
