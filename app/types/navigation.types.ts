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
	/**
	 * Lối vào thứ hai: không qua được `roles`/`management`/`permission` ở trên thì mục vẫn hiện
	 * cho người thuộc `roles` này mà có `permission` này (vẫn phải qua `module`). Dùng khi một màn
	 * hình có cả người làm và người chỉ xem, ví dụ Kiểm kê: người có `asset:manage`, hoặc lãnh đạo
	 * có `asset:read` xem ở chế độ chỉ xem.
	 *
	 * `permission` nhận mảng với nghĩa "có ít nhất một", cho màn gom nhiều thứ như Cài đặt: trưởng
	 * bộ phận chỉ cần xem được một thẻ trong đó là đã có lý do để thấy mục này.
	 */
	alsoFor?: { roles: UserRole[]; permission: string | string[] };
	dataTour?: string;
	matchQuery?: Record<string, string>;
	/**
	 * Nguồn số badge, chỉ hiện khi > 0. Khai bằng KHOÁ chứ không phải hàm closure: file
	 * cấu hình là dữ liệu tĩnh, không với tay vào store được. Sidebar dịch khoá này sang
	 * số thật (xem `badgeValue`).
	 */
	badgeKey?: 'approval' | 'unreadAnnouncement' | 'pendingAsset' | 'taskReviews' | 'kpiReviews' | 'kpiPendingFinal';
	/**
	 * Điều kiện hiện mục lấy từ dữ liệu máy chủ chứ không từ vai trò hay quyền. `taskDepartments`:
	 * chỉ hiện khi `GET /v1/tasks/scope` cho biết người này xem mọi việc hoặc làm trưởng phòng.
	 * `taskReports`: báo cáo công việc, hiện cho ADMIN, người có `task:report`, trưởng phòng, quản lý dự án.
	 * `kpiReviewer`: Đánh giá nhân viên (KPI), hiện khi có phiếu chờ chấm hoặc người xem là quản lý, trưởng phòng.
	 * `kpiResults`: Kết quả KPI, hiện cho giám đốc, ADMIN, trưởng phòng và người có `kpi:manage` (UI-16a).
	 */
	showWhen?: 'taskDepartments' | 'taskReports' | 'kpiReviewer' | 'kpiResults';
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
 * Bảng màn hình của web cho một phân hệ: "ô này mở vào đâu".
 *
 * Từ 17/11/2026 máy chủ giữ phần ô (tên, mô tả, nhóm, màu, icon, thứ tự) còn mỗi client giữ
 * bảng này, vì web và mobile có bộ màn hình khác nhau. Ở đây KHÔNG còn chữ nào để hiển thị:
 * thấy mình sắp thêm `label` hay `icon` cấp phân hệ vào đây thì chỗ cần sửa là
 * `src/tenancy/app-catalog.ts` của BE.
 */
export interface AppScreensDef {
	/** Ghép với `AppTile.code` của máy chủ; cũng dùng cho localStorage "gần đây" và `data-app`. */
	code: string;
	/** Bấm vào ô phân hệ thì đi đâu. Phải nằm trong `routes`. */
	home: string;
	/**
	 * Các tiền tố route thuộc app này — dùng để biết đang đứng ở app nào.
	 * Xếp từ CỤ THỂ đến TỔNG QUÁT không quan trọng: khi khớp sẽ lấy tiền tố dài nhất.
	 */
	routes: string[];
	items: NavItem[];
}

/**
 * Một "app" đã ghép: bảng màn hình của web cộng với phần hiển thị máy chủ trả.
 *
 * KHÁC với `ModuleCode`: `ModuleCode` là đơn vị BÁN HÀNG (công ty mua gói nào, còn hạn
 * không), còn app ở đây là đơn vị ĐIỀU HƯỚNG. Một app có thể gồm nhiều module bán hàng
 * (app Đơn từ chứa OVERTIME, ONLINE_WORK, BUSINESS_TRIP), và phần lớn màn hình nằm trong
 * `CORE` nên không thể lấy thẳng `ModuleCode` làm nhóm điều hướng.
 *
 * Chưa nạp được danh mục thì phần hiển thị rỗng mà `routes`, `items` vẫn đủ, nên điều hướng
 * không chết theo một lần gọi API hỏng.
 */
export interface AppModuleDef extends AppScreensDef {
	label: string;
	/** Một câu ngắn hiện dưới tên app trong lưới chọn app. */
	description: string;
	/** `d` của một `<path>` heroicons outline. */
	icon: string;
	/** Màu nền ô icon, dạng `#rrggbb`. Rỗng khi chưa nạp được danh mục. */
	color: string;
	/** Mã nhóm của máy chủ; chữ hiện lên tra trong `groups`. */
	group: string;
	/**
	 * Module bán riêng mà TOÀN BỘ màn hình của app này thuộc vào (`rec` → `RECRUIT`,
	 * `ast` → `ASSET`). Công ty chưa dùng được module đó thì ô app hiện ở trạng thái khoá chứ
	 * không biến mất. App gộp nhiều module (`chr`, `tal`) để `null` và vẫn lọc từng mục
	 * bằng `NavItem.module`.
	 */
	module: ModuleCode | null;
}
