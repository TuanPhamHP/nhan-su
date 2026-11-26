import type { TourDefinition } from '~/types/tour.types';

export interface OfficeSupplyPeriodTourContext {
	/** Có `office:supply:manage` và module đang ghi được. */
	canManage: () => boolean;
	hasSites: () => boolean;
	hasPeriods: () => boolean;
	/** Đang có dòng gợi ý mở kỳ tháng sau. */
	hasSuggestion: () => boolean;
	isFormOpen: () => boolean;
	closeForm: () => void;
}

/**
 * "Mở kỳ văn phòng phẩm" (`/management/office/supply-periods`).
 *
 * Bước bấm "Mở kỳ mới" là bước `click` để người dùng thấy khung mở kỳ thật; tour kết thúc thì
 * khung tự đóng, không mở kỳ nào.
 */
export function officeSupplyPeriodOpenTour(ctx: OfficeSupplyPeriodTourContext): TourDefinition {
	const closeForm = () => {
		if (ctx.isFormOpen()) ctx.closeForm();
	};
	const ready = () => ctx.canManage() && ctx.hasSites();

	return {
		id: 'office-supply-period-open',
		version: 2,
		onEnd: closeForm,
		steps: [
			{
				id: 'no-site',
				title: 'Cần văn phòng trước',
				body: 'Kỳ đăng ký thuộc về một văn phòng, mà công ty chưa có văn phòng nào. Bạn tạo văn phòng ở **Cài đặt hành chính**, thẻ **Văn phòng và phòng họp**, rồi quay lại đây.',
				when: () => !ctx.hasSites(),
			},
			{
				id: 'list',
				target: '[data-tour="period-list"]',
				title: 'Các kỳ đang diễn ra',
				body: 'Mỗi thẻ là một tháng chi phí của một văn phòng: thanh tiến độ cho biết bao nhiêu phòng đã đăng ký, dòng dưới là hạn chót và thời gian còn lại. Kỳ đã đóng nằm thu gọn ở cuối. Bấm vào thẻ để xem chi tiết, chốt và cấp hàng.',
				when: () => ctx.hasPeriods(),
			},
			{
				id: 'suggest',
				target: '[data-tour="period-suggest"]',
				title: 'Mở kỳ tháng sau',
				body: 'Kỳ gần nhất của văn phòng đã khoá mà chưa có kỳ tháng sau thì trang nhắc ở đây. Bấm nút để mở hộp Mở kỳ đã điền sẵn văn phòng và tháng.',
				when: () => ready() && ctx.hasSuggestion(),
			},
			{
				id: 'open',
				target: '[data-tour="period-open"]',
				mode: 'click',
				title: 'Mở kỳ mới',
				body: 'Mỗi tháng bạn mở một kỳ để các phòng bắt đầu đăng ký.',
				action: 'Bạn bấm thử vào nút **Mở kỳ mới**, chỉ xem thôi, chưa mở kỳ nào.',
				when: ready,
				onEnter: closeForm,
			},
			{
				id: 'basics',
				target: '[data-tour="period-form-basics"]',
				title: 'Điền sẵn theo kỳ trước',
				body: 'Văn phòng, tháng chi phí và hạn chót đã điền sẵn theo kỳ gần nhất, bạn chỉ cần xem lại. Ngay dưới hạn chót là giờ phiếu tự khoá: 00:00 ngày sau hạn chót. Tiêu đề tự đặt theo tháng, muốn đổi thì bấm **Sửa**.',
				when: ready,
			},
			{
				id: 'departments',
				target: '[data-tour="period-form-departments"]',
				title: 'Phòng tham gia',
				body: 'Mặc định là các phòng của kỳ gần nhất ở văn phòng này. Bấm **Chỉnh sửa** để bỏ hay thêm phòng; mỗi phòng được chọn có một phiếu riêng và nhận thông báo khi kỳ mở.',
				when: ready,
			},
			{
				id: 'submit',
				target: '[data-tour="period-form-submit"]',
				title: 'Mở kỳ',
				body: 'Nút ghi rõ số phòng sẽ nhận phiếu. Còn thiếu gì thì bấm vào là nhảy tới đúng ô đó. Lần này bạn bấm **Xong** để đóng lại, chưa mở kỳ nào.',
				when: ready,
			},
		],
	};
}
