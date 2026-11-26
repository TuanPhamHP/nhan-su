import type { TourDefinition } from '~/types/tour.types';

export interface AnnouncementRecallTourContext {
	/** HR hoặc ADMIN và phân hệ đang ghi được: chỉ khi đó mới có mục Thu hồi. */
	canRecall: () => boolean;
	/** Danh sách đang hiện có ít nhất một thông báo chưa thu hồi. */
	hasActive: () => boolean;
	/**
	 * Đang tải danh sách. Hướng dẫn mở từ trang khác thì tour chạy lúc danh sách còn đang tải: khi
	 * đó vẫn đi các bước trỏ vào dòng (tour tự chờ dòng hiện ra), chứ không báo danh sách trống.
	 */
	isLoading: () => boolean;
	isMenuOpen: () => boolean;
	closeMenu: () => void;
}

export interface AnnouncementCreateOpenTourContext {
	/** HR hoặc ADMIN và phân hệ đang ghi được: chỉ khi đó mới có nút Tạo thông báo. */
	canSend: () => boolean;
}

export interface AnnouncementSearchTourContext {
	hasItems: () => boolean;
	/** Như ở tour Thu hồi: đang tải thì chưa coi là không có kết quả. */
	isLoading: () => boolean;
}

/**
 * "Thu hồi thông báo" (`/management/announcements`).
 *
 * Bước bấm nút ba chấm là bước `click` để người dùng thấy menu thật; tour chỉ trỏ vào mục Thu hồi
 * chứ không bấm, và kết thúc thì menu tự đóng.
 */
export function announcementRecallTour(ctx: AnnouncementRecallTourContext): TourDefinition {
	const closeMenu = () => {
		if (ctx.isMenuOpen()) ctx.closeMenu();
	};
	const ready = () => ctx.canRecall() && (ctx.isLoading() || ctx.hasActive());

	return {
		id: 'announcement-recall',
		version: 1,
		onEnd: closeMenu,
		steps: [
			{
				// Danh mục chỉ cho HR và ADMIN thấy hướng dẫn này, nên tới đây là phân hệ đang chỉ xem.
				id: 'read-only',
				title: 'Đang ở chế độ chỉ xem',
				body: 'Gói Truyền thông nội bộ của công ty đang ở chế độ chỉ xem nên mục **Thu hồi** bị ẩn. Lý do nằm ở dòng nhắc đầu trang.',
				when: () => !ctx.canRecall(),
			},
			{
				id: 'no-active',
				title: 'Chưa có thông báo để thu hồi',
				body: 'Danh sách đang hiện không có thông báo nào còn hiển thị với nhân viên. Đang lọc thì bạn bấm **Xóa lọc** để xem hết.',
				when: () => ctx.canRecall() && !ctx.isLoading() && !ctx.hasActive(),
			},
			{
				id: 'status',
				target: '[data-tour="ann-status"]',
				title: 'Thông báo đang hiển thị',
				body: 'Cột **Trạng thái** cho biết nhân viên còn thấy thông báo hay không. Chỉ thông báo **Đang hiển thị** mới thu hồi được.',
				when: ready,
			},
			{
				id: 'menu',
				target: '[data-tour="ann-recall"]',
				mode: 'click',
				title: 'Mở menu của thông báo',
				body: 'Mỗi thông báo có một nút ba chấm ở cột **Tác vụ**.',
				action: 'Bạn bấm thử vào nút ba chấm, chỉ xem thôi, chưa thu hồi gì.',
				when: ready,
				onEnter: closeMenu,
			},
			{
				id: 'menu-items',
				target: '[data-tour="ann-recall-menu"]',
				title: 'Chọn Thu hồi',
				body: 'Bấm **Thu hồi** thì hệ thống hỏi lại một lần rồi mới thu hồi. Lần này bạn chưa cần chọn gì.',
				when: ready,
			},
			{
				id: 'after',
				title: 'Sau khi thu hồi',
				body: 'Nhân viên không còn thấy thông báo đó nữa, và việc này không hoàn tác được. Thông báo vẫn nằm trong danh sách này với trạng thái **Đã thu hồi**. Gửi nhầm nội dung thì bạn thu hồi rồi tạo thông báo mới.',
				when: ready,
				onEnter: closeMenu,
			},
		],
	};
}

/**
 * Nửa đầu của "Tạo thông báo", chạy ở trang danh sách (`/management/announcements`).
 *
 * Bấm nút Tạo thông báo là đổi trang nên tour ở đây kết thúc; trang danh sách đặt hàng chờ cùng
 * `tourId` trước khi chuyển, và trang tạo chạy tiếp phần form (`announcementCreateTour`). Đang
 * đứng ở trang tạo thì hướng dẫn chạy thẳng phần form, không qua bước này.
 */
export function announcementCreateOpenTour(ctx: AnnouncementCreateOpenTourContext): TourDefinition {
	return {
		id: 'announcement-create',
		version: 1,
		steps: [
			{
				// Danh mục chỉ cho HR và ADMIN thấy hướng dẫn này, nên tới đây là phân hệ đang chỉ xem.
				id: 'read-only',
				title: 'Đang ở chế độ chỉ xem',
				body: 'Gói Truyền thông nội bộ của công ty đang ở chế độ chỉ xem nên nút **Tạo thông báo** bị ẩn. Lý do nằm ở dòng nhắc đầu trang.',
				when: () => !ctx.canSend(),
			},
			{
				id: 'open',
				target: '[data-tour="ann-create-open"]',
				mode: 'click',
				title: 'Mở trang soạn',
				body: 'Mọi thông báo bắt đầu từ nút **Tạo thông báo**. Trang soạn mở ra thì hướng dẫn đi tiếp ở đó.',
				action: 'Bạn bấm vào nút **Tạo thông báo**, chưa gửi gì cả.',
				when: () => ctx.canSend(),
			},
		],
	};
}

/** "Tìm kiếm thông báo" (`/management/announcements`). */
export function announcementSearchTour(ctx: AnnouncementSearchTourContext): TourDefinition {
	return {
		id: 'announcement-search',
		version: 1,
		steps: [
			{
				id: 'search',
				target: '[data-tour="ann-search"]',
				title: 'Tìm theo chữ',
				body: 'Gõ một từ có trong tiêu đề hoặc nội dung, danh sách tự lọc sau khi bạn ngừng gõ. Không phân biệt chữ hoa, chữ thường nhưng cần gõ đúng dấu tiếng Việt.',
			},
			{
				id: 'date',
				target: '[data-tour="ann-date"]',
				title: 'Lọc theo ngày tạo',
				body: 'Chọn khoảng ngày để chỉ xem thông báo tạo trong khoảng đó. Ô tìm và khoảng ngày dùng cùng lúc được.',
			},
			{
				id: 'reset',
				target: '[data-tour="ann-reset"]',
				title: 'Xóa lọc',
				body: 'Bấm **Xóa lọc** để bỏ hết điều kiện và xem lại toàn bộ thông báo. Điều kiện đang lọc được giữ trên đường dẫn, nên tải lại trang hay gửi đường dẫn cho người khác vẫn ra đúng kết quả này.',
			},
			{
				id: 'results',
				target: '[data-tour="ann-row"]',
				title: 'Mở một thông báo',
				body: 'Bấm vào tiêu đề để xem toàn bộ nội dung và ai đã đọc, ai chưa đọc.',
				when: () => ctx.isLoading() || ctx.hasItems(),
			},
			{
				id: 'empty',
				title: 'Không có kết quả',
				body: 'Không có thông báo nào khớp điều kiện đang lọc. Bạn thử từ khác, nới khoảng ngày hoặc bấm **Xóa lọc**.',
				when: () => !ctx.isLoading() && !ctx.hasItems(),
			},
		],
	};
}
