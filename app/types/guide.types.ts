import type { NavItem } from '~/types/navigation.types';

/**
 * Hướng dẫn theo tính năng: một việc cụ thể trong một phân hệ, ví dụ "Mở kỳ văn phòng phẩm".
 *
 * Mỗi hướng dẫn chạy một tour đã khai ở `app/tours/` trên đúng một trang. Nút Hướng dẫn nổi bên
 * phải liệt kê các hướng dẫn của phân hệ đang mở mà người dùng làm được, chọn một cái thì đưa
 * người dùng tới trang đó rồi chạy tour.
 */
export interface FeatureGuide {
	/** Mã tour (`TourDefinition.id`) mà trang đích đăng ký. */
	tourId: string;
	/** Mã phân hệ (`AppScreensDef.code`), ví dụ `adm` là Hành chính văn phòng. */
	app: string;
	title: string;
	/** Một câu nói hướng dẫn giúp làm được việc gì. */
	description: string;
	/** Trang chạy tour, có thể kèm query (`/management/office/settings?tab=supplies`). */
	to: string;
	/**
	 * Ai thấy hướng dẫn này, cùng luật với mục menu: vai trò, quyền, gói module, `showWhen`. Hướng
	 * dẫn dẫn tới trang người dùng không vào được thì không được hiện.
	 */
	access: Pick<NavItem, 'roles' | 'management' | 'permission' | 'module' | 'alsoFor' | 'showWhen'>;
	/** Nhóm trong danh sách: việc quản lý hay việc của mỗi nhân viên. */
	audience: 'manage' | 'staff';
	/**
	 * Nhóm con cho phân hệ lớn, thường là tên mục menu: "Nhân viên", "Phòng ban", "Hợp đồng".
	 * Hướng dẫn cùng nhóm gom dưới một tiêu đề bấm mở được; bỏ trống thì nằm thẳng trong danh sách.
	 */
	group?: string;
}
