import type { TourDefinition } from '~/types/tour.types';

export interface AnnouncementCreateTourContext {
	/** Phân hệ đang ghi được; gói chỉ xem thì nút Gửi thông báo bị khoá. */
	canWrite: () => boolean;
}

/**
 * "Tạo thông báo", nửa sau ở trang tạo (`/management/announcements/create`). Nửa đầu là bước bấm
 * Tạo thông báo ở trang danh sách (`announcementCreateOpenTour`), cùng `tourId`.
 *
 * Tour chỉ trỏ vào từng phần của form, không điền và không gửi gì. Thông báo đã gửi không sửa
 * được, nên bước cuối nhắc dùng Xem trước.
 */
export function announcementCreateTour(ctx: AnnouncementCreateTourContext): TourDefinition {
	return {
		id: 'announcement-create',
		version: 1,
		steps: [
			{
				id: 'read-only',
				title: 'Đang ở chế độ chỉ xem',
				body: 'Gói Truyền thông nội bộ của công ty đang ở chế độ chỉ xem nên nút **Gửi thông báo** bị khoá. Bạn vẫn soạn thử được, lý do nằm ở dòng nhắc đầu trang.',
				when: () => !ctx.canWrite(),
			},
			{
				id: 'basics',
				target: '[data-tour="ann-create-basics"]',
				title: 'Tiêu đề và loại',
				body: '**Tiêu đề** là dòng nhân viên thấy đầu tiên trong danh sách và trong thông báo đẩy, nên bạn viết ngắn và rõ việc. **Loại thông báo** giúp nhân viên nhận ra đây là báo cáo chấm công, yêu cầu cập nhật hồ sơ hay tin chung.',
			},
			{
				id: 'body',
				target: '[data-tour="ann-create-body"]',
				title: 'Soạn nội dung',
				body: 'Bạn soạn **Nội dung thông báo** như soạn văn bản, có in đậm, danh sách và chèn ảnh ngay trong bài.',
			},
			{
				id: 'extras',
				target: '[data-tour="ann-create-extras"]',
				title: 'Liên kết và file đính kèm',
				body: 'Cần dẫn sang biểu mẫu hay tài liệu ở nơi khác thì bấm **Thêm liên kết**. Bấm **Chọn file** để đính kèm ảnh, PDF, Word hay Excel, tối đa năm file.',
			},
			{
				id: 'recipients',
				target: '[data-tour="ann-create-recipients"]',
				title: 'Chọn người nhận',
				body: 'Mặc định thông báo gửi cho tất cả nhân viên. Muốn gửi riêng thì bỏ tick ô **Gửi cho tất cả nhân viên** rồi chọn cả phòng ban hoặc từng người.',
			},
			{
				id: 'send',
				target: '[data-tour="ann-create-actions"]',
				title: 'Xem trước rồi gửi',
				body: 'Bấm **Xem trước** để thấy thông báo hiện ra với nhân viên thế nào. Bấm **Gửi thông báo** thì người nhận được báo ngay, và thông báo đã gửi không sửa được nữa, chỉ thu hồi được.',
			},
		],
	};
}
