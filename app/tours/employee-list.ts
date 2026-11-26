import type { TourDefinition } from '~/types/tour.types';

/**
 * Các tour ở trang danh sách nhân viên (`/management/employees`).
 *
 * Ba hướng dẫn "Thêm một nhân viên", "Xem thông tin nhân viên" và "Reset mật khẩu, khóa tài khoản"
 * bắt đầu ở đây bằng một bước bấm chuyển trang, rồi trang đích chạy tiếp cùng `tourId` (xem mục 8
 * của `docs/frontend/feature-guides.md`). "Nhập nhân viên từ Excel" chạy trọn ở trang này.
 */

export interface EmployeeCreateOpenTourContext {
	canCreate: () => boolean;
}

export interface EmployeeImportTourContext {
	canImport: () => boolean;
	isModalOpen: () => boolean;
	closeModal: () => void;
}

export interface EmployeeOpenProfileTourContext {
	/** Danh sách đang hiện ít nhất một người để bấm mở hồ sơ. */
	hasItems: () => boolean;
	/**
	 * Đang tải danh sách. Hướng dẫn mở từ trang khác thì tour chạy lúc danh sách còn đang tải: khi đó
	 * vẫn đi bước bấm mã nhân viên (tour tự chờ dòng đầu hiện ra), chứ không báo danh sách trống.
	 */
	isLoading: () => boolean;
}

const canOpenRow = (ctx: EmployeeOpenProfileTourContext) => ctx.isLoading() || ctx.hasItems();
const listEmpty = (ctx: EmployeeOpenProfileTourContext) => !ctx.isLoading() && !ctx.hasItems();

/** Nửa đầu của "Thêm một nhân viên": mở form thêm mới. */
export function employeeCreateOpenTour(ctx: EmployeeCreateOpenTourContext): TourDefinition {
	return {
		id: 'employee-create',
		version: 1,
		steps: [
			{
				id: 'no-permission',
				title: 'Chưa có quyền thêm nhân viên',
				body: 'Tài khoản của bạn chưa có quyền tạo nhân viên nên không có nút **Thêm nhân viên**. Bạn nhờ quản trị viên cấp quyền nếu cần.',
				when: () => !ctx.canCreate(),
			},
			{
				id: 'open',
				target: '[data-tour="emp-create-open"]',
				mode: 'click',
				title: 'Mở form thêm nhân viên',
				body: 'Thêm từng người một thì bắt đầu từ nút **Thêm nhân viên**. Form mở ra thì hướng dẫn đi tiếp ở đó.',
				action: 'Bạn bấm vào nút **Thêm nhân viên**, chưa lưu gì cả.',
				when: () => ctx.canCreate(),
			},
		],
	};
}

/**
 * "Nhập nhân viên từ Excel". Bước bấm Import Excel mở hộp nhập thật; tour chỉ trỏ vào từng phần,
 * không chọn file và không nhập, kết thúc thì hộp tự đóng.
 */
export function employeeImportTour(ctx: EmployeeImportTourContext): TourDefinition {
	const closeModal = () => {
		if (ctx.isModalOpen()) ctx.closeModal();
	};

	return {
		id: 'employee-import',
		version: 1,
		onEnd: closeModal,
		steps: [
			{
				id: 'no-permission',
				title: 'Chưa có quyền nhập file',
				body: 'Tài khoản của bạn chưa có quyền nhập nhân viên từ Excel nên không có nút **Import Excel**. Bạn nhờ quản trị viên cấp quyền nếu cần.',
				when: () => !ctx.canImport(),
			},
			{
				id: 'open',
				target: '[data-tour="emp-import-open"]',
				mode: 'click',
				title: 'Nhập nhiều người một lúc',
				body: 'Có cả danh sách nhân viên trong Excel thì nhập một lần cho nhanh, khỏi thêm từng người.',
				action: 'Bạn bấm thử vào nút **Import Excel**, chỉ xem thôi, chưa nhập gì.',
				when: () => ctx.canImport(),
				onEnter: closeModal,
			},
			{
				id: 'template',
				target: '[data-tour="emp-import-template"]',
				title: 'Tải file mẫu và điền',
				body: 'Bấm **Tải file mẫu** rồi điền mỗi người một dòng, xoá dòng ví dụ đi. Cột **Phòng ban** phải ghi phòng đã có trong hệ thống, còn **Chức vụ** chưa có sẽ được tự tạo. Cột **Mã nhân viên** để trống thì hệ thống tự cấp.',
				when: () => ctx.canImport(),
			},
			{
				id: 'upload',
				target: '[data-tour="emp-import-upload"]',
				title: 'Chọn file đã điền',
				body: 'Ở khối **Chọn file để upload**, kéo thả hoặc chọn file .xlsx. Hệ thống chỉ tạo khi mọi dòng đều hợp lệ; có lỗi thì không ai được tạo và bảng lỗi hiện ra theo từng dòng, từng cột để bạn sửa file rồi chọn lại.',
				when: () => ctx.canImport(),
			},
			{
				id: 'submit',
				target: '[data-tour="emp-import-submit"]',
				title: 'Nhập',
				body: 'Chọn file xong thì bấm **Import**. Mỗi người mới nhận một email có link tự đặt mật khẩu. Lần này bạn bấm **Xong** để đóng lại, chưa nhập gì.',
				when: () => ctx.canImport(),
			},
		],
	};
}

/** Nửa đầu của "Xem thông tin nhân viên": tìm người rồi mở hồ sơ. */
export function employeeViewOpenTour(ctx: EmployeeOpenProfileTourContext): TourDefinition {
	return {
		id: 'employee-view',
		version: 1,
		steps: [
			{
				id: 'filters',
				target: '[data-tour="emp-filters"]',
				title: 'Tìm nhân viên',
				body: 'Gõ tên, email hoặc mã nhân viên để tìm, hoặc lọc theo phòng ban và loại hình lao động.',
			},
			{
				id: 'open',
				target: '[data-tour="emp-row-open"]',
				mode: 'click',
				title: 'Mở hồ sơ',
				body: 'Bấm vào mã ở cột **Mã NV** để mở hồ sơ của người đó. Hồ sơ mở ra thì hướng dẫn đi tiếp ở đó.',
				action: 'Bạn bấm vào mã nhân viên ở dòng đầu tiên.',
				when: () => canOpenRow(ctx),
			},
			{
				id: 'empty',
				title: 'Chưa có ai để mở',
				body: 'Danh sách đang trống. Đang lọc thì bạn bỏ bớt điều kiện, hoặc thêm nhân viên trước rồi mở lại hướng dẫn.',
				when: () => listEmpty(ctx),
			},
		],
	};
}

/** Nửa đầu của "Reset mật khẩu, khóa tài khoản": hai việc này làm trong hồ sơ của từng người. */
export function employeeAccountOpenTour(ctx: EmployeeOpenProfileTourContext): TourDefinition {
	return {
		id: 'employee-account',
		version: 1,
		steps: [
			{
				id: 'open',
				target: '[data-tour="emp-row-open"]',
				mode: 'click',
				title: 'Mở hồ sơ nhân viên',
				body: 'Nút **Reset mật khẩu** và **Khóa tài khoản** nằm trong hồ sơ của từng người. Bạn tìm người cần làm rồi bấm vào mã ở cột **Mã NV**; hồ sơ mở ra thì hướng dẫn đi tiếp ở đó.',
				action: 'Lần này bạn bấm vào mã nhân viên ở dòng đầu tiên.',
				when: () => canOpenRow(ctx),
			},
			{
				id: 'empty',
				title: 'Chưa có ai để mở',
				body: 'Danh sách đang trống. Đang lọc thì bạn bỏ bớt điều kiện rồi mở lại hướng dẫn.',
				when: () => listEmpty(ctx),
			},
		],
	};
}
