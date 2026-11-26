import type { TourDefinition } from '~/types/tour.types';

/**
 * Các tour ở hồ sơ một nhân viên (`/management/employees/:id`). Đây là nửa sau của các hướng dẫn
 * bắt đầu ở trang danh sách nhân viên (`employee-list.ts`) hay danh sách hợp đồng
 * (`contract-list.ts`); đang đứng ở một hồ sơ thì hướng dẫn chạy thẳng từ đây.
 */

export interface EmployeeDetailTourContext {
	/** Đã tải xong mà không mở được hồ sơ (ngoài phạm vi xem, không tồn tại, lỗi tải). */
	failed: () => boolean;
	isEditing: () => boolean;
	/** Về thẻ Thông tin: các nút tài khoản chỉ hiện ở thẻ này. */
	showInfo: () => void;
}

export interface EmployeeViewTourContext extends EmployeeDetailTourContext {
	canUpdate: () => boolean;
}

export interface EmployeeAccountTourContext extends EmployeeDetailTourContext {
	canReset: () => boolean;
	canLock: () => boolean;
	canTerminate: () => boolean;
	isLocked: () => boolean;
}

export interface ContractCreateTourContext {
	failed: () => boolean;
	isEditing: () => boolean;
	/** Có thẻ Hợp đồng và nút Thêm hợp đồng: ADMIN, HR, `contract:create`, phân hệ ghi được. */
	canCreate: () => boolean;
	/** Sang thẻ Hợp đồng. */
	showContracts: () => void;
	isFormOpen: () => boolean;
	closeForm: () => void;
}

const failedStep = (ctx: { failed: () => boolean }) => ({
	id: 'failed',
	title: 'Chưa mở được hồ sơ',
	body: 'Hồ sơ này chưa tải được hoặc nằm ngoài phạm vi bạn được xem. Bạn quay lại danh sách rồi mở hồ sơ khác.',
	when: () => ctx.failed(),
});

/** Nửa sau của "Xem thông tin nhân viên". */
export function employeeViewTour(ctx: EmployeeViewTourContext): TourDefinition {
	const ok = () => !ctx.failed();

	return {
		id: 'employee-view',
		version: 1,
		steps: [
			failedStep(ctx),
			{
				id: 'head',
				target: '[data-tour="emp-detail-head"]',
				title: 'Tóm tắt hồ sơ',
				body: 'Đầu hồ sơ là ảnh, tên, trạng thái làm việc, loại hình lao động, email và mã nhân viên. Bấm vào ảnh để xem ảnh lớn.',
				when: ok,
				onEnter: () => ctx.showInfo(),
			},
			{
				id: 'tabs',
				target: '[data-tour="emp-detail-tabs"]',
				title: 'Các thẻ của hồ sơ',
				body: 'Mỗi thẻ là một phần hồ sơ, như **Thông tin**, **Tài liệu**, **Định danh**, **Hợp đồng**, **BHXH & Thuế** hay **Tài sản**. Bạn chỉ thấy những thẻ mình có quyền xem, nên số thẻ mỗi người thấy có thể khác nhau.',
				when: ok,
			},
			{
				id: 'info',
				target: '[data-tour="emp-detail-info"]',
				title: 'Thông tin chung',
				body: 'Thẻ **Thông tin** gồm thông tin liên lạc, nhóm quyền, phòng ban, chức vụ, quản lý trực tiếp, ngày vào làm và ngày nghỉ việc nếu có.',
				when: () => ok() && !ctx.isEditing(),
			},
			{
				id: 'edit',
				target: '[data-tour="emp-detail-edit"]',
				title: 'Sửa hồ sơ',
				body: 'Cần đổi gì thì bấm **Chỉnh sửa**, các ô mở ra để sửa ngay trên trang này, xong thì bấm **Lưu thay đổi**.',
				when: () => ok() && ctx.canUpdate() && !ctx.isEditing(),
			},
		],
	};
}

/** Nửa sau của "Reset mật khẩu, khóa tài khoản". */
export function employeeAccountTour(ctx: EmployeeAccountTourContext): TourDefinition {
	const ready = () => !ctx.failed() && !ctx.isEditing();

	return {
		id: 'employee-account',
		version: 1,
		steps: [
			failedStep(ctx),
			{
				id: 'editing',
				title: 'Đang sửa hồ sơ',
				body: 'Trong lúc sửa hồ sơ, các nút tài khoản tạm ẩn. Bạn bấm **Lưu thay đổi** hoặc **Hủy** rồi mở lại hướng dẫn.',
				when: () => !ctx.failed() && ctx.isEditing(),
			},
			{
				id: 'reset',
				target: '[data-tour="emp-reset"]',
				title: 'Reset mật khẩu',
				body: 'Bấm **Reset mật khẩu** khi nhân viên quên mật khẩu hoặc link kích hoạt lúc tạo đã hết hạn. Hệ thống gửi tới email đăng nhập của họ một link tự đặt mật khẩu mới, hạn 3 giờ; nếu tài khoản chỉ dùng ở công ty này thì mật khẩu cũ hết hiệu lực ngay.',
				when: () => ready() && ctx.canReset(),
				onEnter: () => ctx.showInfo(),
			},
			{
				id: 'lock',
				target: '[data-tour="emp-lock"]',
				title: 'Khóa tài khoản',
				body: 'Bấm **Khóa tài khoản** thì nhân viên không đăng nhập được nữa. Hệ thống hỏi **Ngày nghỉ việc**, ngày này quyết định tháng cuối cùng còn xuất được bảng công. Ở trang danh sách, menu ba chấm của từng dòng cũng có **Khóa tài khoản**.',
				when: () => ready() && ctx.canLock() && !ctx.isLocked(),
				onEnter: () => ctx.showInfo(),
			},
			{
				id: 'locked',
				title: 'Tài khoản đã khóa',
				body: 'Tài khoản của người này đã bị khóa nên không còn nút **Khóa tài khoản**.',
				when: () => ready() && ctx.canLock() && ctx.isLocked(),
			},
			{
				id: 'terminate',
				target: '[data-tour="emp-terminate"]',
				title: 'Khóa khác với nghỉ việc',
				body: 'Khóa tài khoản chỉ chặn đăng nhập. Thủ tục nghỉ việc, gồm ngày, trường hợp và lý do, làm ở nút **Xác nhận nghỉ việc**; người đã nghỉ thì nút này là **Sửa thông tin nghỉ việc**.',
				when: () => ready() && ctx.canTerminate(),
			},
		],
	};
}

/**
 * Nửa sau của "Thêm hợp đồng". Bước bấm Thêm hợp đồng mở hộp nhập thật để người dùng thấy các ô;
 * tour kết thúc thì hộp tự đóng, không tạo hợp đồng nào.
 */
export function contractCreateTour(ctx: ContractCreateTourContext): TourDefinition {
	const closeForm = () => {
		if (ctx.isFormOpen()) ctx.closeForm();
	};
	const ready = () => !ctx.failed() && !ctx.isEditing() && ctx.canCreate();

	return {
		id: 'contract-create',
		version: 1,
		onEnd: closeForm,
		steps: [
			failedStep(ctx),
			{
				id: 'editing',
				title: 'Đang sửa hồ sơ',
				body: 'Bạn đang sửa thông tin của người này. Bấm **Lưu thay đổi** hoặc **Hủy** trước, rồi mở lại hướng dẫn.',
				when: () => !ctx.failed() && ctx.isEditing(),
			},
			{
				id: 'no-permission',
				title: 'Chưa có quyền thêm hợp đồng',
				body: 'Tài khoản của bạn chưa có quyền tạo hợp đồng, hoặc phân hệ Hợp đồng đang ở chế độ chỉ xem, nên không có nút **Thêm hợp đồng**.',
				when: () => !ctx.failed() && !ctx.isEditing() && !ctx.canCreate(),
			},
			{
				id: 'open',
				target: '[data-tour="contract-add"]',
				mode: 'click',
				title: 'Thêm hợp đồng',
				body: 'Thẻ **Hợp đồng** xếp các hợp đồng của người này theo thời gian, hợp đồng sắp hết hạn có viền vàng. Hợp đồng mới thêm từ nút **Thêm hợp đồng**.',
				action: 'Bạn bấm thử vào nút **Thêm hợp đồng**, chỉ xem thôi, chưa lưu gì.',
				when: ready,
				onEnter: () => {
					closeForm();
					ctx.showContracts();
				},
			},
			{
				id: 'basics',
				target: '[data-tour="contract-form-basics"]',
				title: 'Thông tin bắt buộc',
				body: 'Điền **Số hợp đồng**, chọn **Loại hợp đồng** và **Ngày bắt đầu**. Hợp đồng **Không xác định thời hạn** thì không có ô **Ngày kết thúc**.',
				when: ready,
			},
			{
				id: 'terms',
				target: '[data-tour="contract-form-terms"]',
				title: 'Lương và file hợp đồng',
				body: '**Lương cơ bản**, **Chức vụ theo hợp đồng** và **Ghi chú** để trống được. Bản scan hợp đồng thì đính kèm ở ô **Chọn tệp đính kèm**, nhận PDF, DOCX, JPG hay PNG tới 10MB.',
				when: ready,
			},
			{
				id: 'submit',
				target: '[data-tour="contract-form-submit"]',
				title: 'Tạo rồi kích hoạt',
				body: 'Bấm **Tạo hợp đồng** thì hợp đồng vào danh sách ở trạng thái **Nháp**, còn sửa được. Khi hợp đồng có hiệu lực, bạn bấm **Kích hoạt** trên thẻ của nó. Lần này bạn bấm **Xong** để đóng lại, chưa tạo hợp đồng nào.',
				when: ready,
			},
		],
	};
}
