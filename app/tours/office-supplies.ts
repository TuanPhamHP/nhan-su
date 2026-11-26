import type { TourDefinition } from '~/types/tour.types';

export interface OfficeSuppliesTourContext {
	hasRequests: () => boolean;
	/** Phòng có từ hai phiếu trở lên (thẻ phiếu đang đăng ký hoặc menu Phiếu khác). */
	hasOtherRequests: () => boolean;
	/** Phiếu đang mở còn sửa được (`canEdit` của máy chủ). */
	canEdit: () => boolean;
	/** Danh mục đang hiện ít nhất một mặt hàng. */
	hasRows: () => boolean;
	/** Dòng đầu mối đã tải xong (người không thuộc phòng nào thì không có). */
	hasContact: () => boolean;
	isDepartmentManager: () => boolean;
	isContactFormOpen: () => boolean;
	closeContactForm: () => void;
}

/** "Đăng ký văn phòng phẩm" (`/office/supplies`): mỗi nhân viên gõ phần của mình trên form danh mục. */
export function officeSupplyRegisterTour(ctx: OfficeSuppliesTourContext): TourDefinition {
	const editable = () => ctx.hasRequests() && ctx.canEdit();
	return {
		id: 'office-supply-register',
		version: 2,
		steps: [
			{
				id: 'no-request',
				title: 'Chưa có kỳ đăng ký',
				body: 'Phòng bạn chưa có phiếu nào. Khi HCNS mở kỳ của tháng, bạn nhận thông báo và phiếu hiện ở trang này.',
				when: () => !ctx.hasRequests(),
			},
			{
				id: 'period',
				target: '[data-tour="supply-period-bar"]',
				title: 'Kỳ đang đăng ký',
				body: 'Mỗi kỳ cả phòng cùng nhập vào một phiếu. Thanh này ghi hạn chót, thời gian còn lại và giờ phiếu tự khoá, cùng đầu mối nhận hàng của phòng.',
				when: () => ctx.hasRequests(),
			},
			{
				id: 'tabs',
				target: '[data-tour="supply-request-tabs"]',
				title: 'Phiếu khác của phòng',
				body: 'Phòng có nhiều phiếu (hai văn phòng, phiếu bổ sung, các kỳ trước) thì chọn ở đây. Phiếu đang xem được tô đậm.',
				when: () => ctx.hasRequests() && ctx.hasOtherRequests(),
			},
			{
				id: 'copy',
				target: '[data-tour="supply-copy-previous"]',
				title: 'Lấy số tháng trước',
				body: 'Tháng nào cũng xin gần giống tháng trước thì bấm nút này để chép số của kỳ trước vào phiếu, rồi chỉ việc chỉnh lại vài dòng.',
				when: editable,
			},
			{
				id: 'toolbar',
				target: '[data-tour="supply-toolbar"]',
				title: 'Tìm và lọc mặt hàng',
				body: 'Gõ tên để tìm, không dấu cũng được. Bấm tên nhóm để chỉ xem nhóm đó, bật **Chỉ đã chọn** để xem lại những mặt hàng bạn đã gõ số.',
				when: editable,
			},
			{
				id: 'lines',
				target: '[data-tour="supply-lines"]',
				title: 'Gõ số ngay trên dòng',
				body: 'Ô số là phần của bạn: gõ số rồi bấm Enter, hoặc bấm + và −, số tự lưu. Đưa về 0 là bỏ phần của bạn. **Phòng** là tổng cả phòng đã xin, bấm vào để xem ai đăng ký bao nhiêu; biểu tượng bút để ghi chú cho dòng.',
				when: () => editable() && ctx.hasRows(),
			},
			{
				id: 'custom',
				target: '[data-tour="supply-custom"]',
				title: 'Mặt hàng ngoài danh mục',
				body: 'Không tìm thấy thứ cần thì bấm đây để tự ghi tên, đơn vị và số lượng.',
				when: editable,
			},
			{
				id: 'footer',
				target: '[data-tour="supply-footer"]',
				title: 'Đã lưu chưa',
				body: 'Thanh dưới cho biết bạn và cả phòng đã chọn bao nhiêu mặt hàng, và số vừa gõ đã lưu xong hay còn lỗi cần thử lại.',
				when: editable,
			},
			{
				id: 'deadline',
				title: 'Không có nút nộp',
				body: 'Tới hạn chót phiếu tự khoá và HCNS chốt số, nên bạn cứ nhập sớm, trước hạn vẫn sửa lại được.',
				when: () => ctx.hasRequests(),
			},
		],
	};
}

/** "Chọn người nhận hàng" (`/office/supplies`): trưởng phòng chỉ định đầu mối. */
export function officeSupplyContactTour(ctx: OfficeSuppliesTourContext): TourDefinition {
	const closeForm = () => {
		if (ctx.isContactFormOpen()) ctx.closeContactForm();
	};
	const manager = () => ctx.hasContact() && ctx.isDepartmentManager();
	return {
		id: 'office-supply-contact',
		version: 2,
		onEnd: closeForm,
		steps: [
			{
				id: 'about',
				target: '[data-tour="supply-contact"]',
				title: 'Đầu mối nhận hàng',
				body: 'Đầu mối là người nhận văn phòng phẩm khi HCNS cấp và bấm **Đã nhận** cho cả phòng. Chưa chỉ định thì việc này thuộc trưởng phòng.',
				when: () => ctx.hasContact(),
			},
			{
				id: 'not-manager',
				title: 'Việc của trưởng phòng',
				body: 'Chỉ trưởng phòng chỉ định được đầu mối. Bạn muốn đổi người nhận thì nhờ trưởng phòng làm theo hướng dẫn này.',
				when: () => !manager(),
			},
			{
				id: 'pick',
				target: '[data-tour="supply-contact-pick"]',
				mode: 'click',
				title: 'Đổi đầu mối',
				body: 'Bạn là trưởng phòng nên chọn được người nhận hàng thay mình.',
				action: 'Bạn bấm thử vào nút **Đổi**, hoặc **Chọn đầu mối** khi phòng chưa có.',
				when: manager,
				onEnter: closeForm,
			},
			{
				id: 'form',
				target: '[data-tour="supply-contact-form"]',
				title: 'Chọn người và lưu',
				body: 'Chọn một người trong phòng rồi bấm **Lưu đầu mối**. Người đó nhận thông báo khi hàng được cấp. Bỏ đầu mối thì việc nhận hàng về lại trưởng phòng. Lần này bạn bấm **Xong** để đóng lại.',
				when: manager,
			},
		],
	};
}
