import type { TourDefinition } from '~/types/tour.types';

export interface OfficeRoomsTourContext {
	hasSites: () => boolean;
	/** Văn phòng đang chọn có phòng họp và module đang ghi được. */
	canBook: () => boolean;
	showGrid: () => void;
}

/** "Đặt phòng họp" (`/office/rooms`): xem lịch phòng, giữ khung giờ trống. */
export function officeRoomBookingTour(ctx: OfficeRoomsTourContext): TourDefinition {
	return {
		id: 'office-room-booking',
		version: 1,
		steps: [
			{
				id: 'no-site',
				title: 'Chưa có phòng họp',
				body: 'Công ty chưa có văn phòng hay phòng họp nào để đặt. HCNS tạo chúng ở **Cài đặt hành chính**.',
				when: () => !ctx.hasSites(),
			},
			{
				id: 'filters',
				target: '[data-tour="room-filters"]',
				title: 'Chọn văn phòng và ngày',
				body: 'Chọn văn phòng bạn họp và ngày muốn xem. Lần sau trang nhớ văn phòng bạn đã chọn.',
				when: () => ctx.hasSites(),
				onEnter: () => ctx.showGrid(),
			},
			{
				id: 'calendar',
				target: '[data-tour="room-calendar"]',
				title: 'Lịch phòng',
				body: 'Lịch hiện những khung giờ đã có người đặt của từng phòng. Bấm vào một khung còn trống để đặt ngay giờ đó, hoặc bấm **Tuần** ở góc trên để xem cả tuần.',
				when: () => ctx.hasSites(),
			},
			{
				id: 'book',
				target: '[data-tour="room-book"]',
				title: 'Đặt phòng',
				body: 'Hoặc bấm **Đặt phòng** rồi tự chọn phòng, giờ và mời người dự. Không có bước duyệt, đặt xong là phòng được giữ. Họp online thì không cần chọn phòng.',
				when: () => ctx.canBook(),
			},
			{
				id: 'mine',
				target: '[data-tour="room-tabs"]',
				title: 'Lịch của tôi',
				body: 'Thẻ **Lịch của tôi** gom các cuộc họp bạn đặt, chủ trì hoặc được mời thành lịch xem theo **Ngày**, **Tuần** hay **Tháng**. Bấm vào một cuộc họp để sửa giờ hay huỷ khi cần.',
			},
		],
	};
}
