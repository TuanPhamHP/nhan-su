import type { TourDefinition } from '~/types/tour.types';

export interface EmployeeCreateTourContext {
	canCreate: () => boolean;
}

/**
 * "Thêm một nhân viên", nửa sau ở trang thêm mới (`/management/employees/new`). Nửa đầu là bước
 * bấm Thêm nhân viên ở trang danh sách (`employeeCreateOpenTour`), cùng `tourId`. Tour chỉ trỏ vào
 * từng phần của form, không điền và không lưu.
 */
export function employeeCreateTour(ctx: EmployeeCreateTourContext): TourDefinition {
	return {
		id: 'employee-create',
		version: 1,
		steps: [
			{
				id: 'no-permission',
				title: 'Chưa có quyền thêm nhân viên',
				body: 'Tài khoản của bạn chưa có quyền tạo nhân viên nên nút **Tạo nhân viên** đang khoá. Bạn nhờ quản trị viên cấp quyền nếu cần.',
				when: () => !ctx.canCreate(),
			},
			{
				id: 'account',
				target: '[data-tour="emp-new-account"]',
				title: 'Họ tên và email',
				body: '**Email** là địa chỉ nhân viên dùng để đăng nhập. Bạn không cần đặt mật khẩu: hệ thống gửi tới email này một link tự đặt mật khẩu, hạn 3 giờ.',
			},
			{
				id: 'work',
				target: '[data-tour="emp-new-work"]',
				title: 'Thông tin công việc',
				body: '**Vai trò** quyết định người này thấy và làm được gì trong hệ thống. Chọn **Phòng ban** trước thì ô **Chức vụ** chỉ còn chức vụ của phòng đó. Chọn **Ca làm việc mặc định** thì lịch ca được xếp sẵn từ **Ngày vào làm**.',
			},
			{
				id: 'personal',
				target: '[data-tour="emp-new-personal"]',
				title: 'Thông tin cá nhân',
				body: 'Phần này không bắt buộc, bạn bổ sung sau trong hồ sơ cũng được.',
			},
			{
				id: 'submit',
				target: '[data-tour="emp-new-submit"]',
				title: 'Tạo nhân viên',
				body: 'Bấm **Tạo nhân viên** thì hồ sơ người mới mở ra. CCCD, hợp đồng, thân nhân và giấy tờ bạn thêm tiếp ở các thẻ **Định danh**, **Hợp đồng**, **Thân nhân** và **Tài liệu** trong hồ sơ đó.',
			},
		],
	};
}
