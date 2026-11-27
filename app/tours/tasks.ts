import type { TourDefinition } from '~/types/tour.types';

/**
 * Hướng dẫn của Công việc (mục 9.2): tối đa năm bước, câu ngắn như đồng nghiệp chỉ nhau, chỉ trỏ,
 * không bấm nút ghi nào. Bước nào trang chưa có phần tử sau 2 giây thì tự bỏ.
 *
 * Mở từ tab Hướng dẫn bên phải, nên người dùng có thể đang đứng ở chế độ xem hay thẻ khác của cùng
 * trang: bước đầu mỗi tour gọi hàm `show…` của trang để chuyển về đúng chỗ.
 */
export interface TasksMyTourContext {
	hasRows: () => boolean;
	hasReview: () => boolean;
	canCreate: () => boolean;
	/** Chuyển Việc của tôi về chế độ Danh sách, thẻ Tôi làm. */
	showList: () => void;
}

/** "Làm việc được giao" ở Việc của tôi. */
export function tasksMyTour(ctx: TasksMyTourContext): TourDefinition {
	return {
		id: 'tasks-my',
		version: 1,
		steps: [
			{
				id: 'intro',
				title: 'Việc của tôi',
				body: 'Đây là mọi việc bạn làm, việc bạn giao và việc bạn theo dõi, xếp theo hạn.',
				onEnter: () => ctx.showList(),
			},
			{
				id: 'groups',
				target: '[data-tour="task-groups"]',
				title: 'Việc của bạn',
				body: 'Việc chia theo hạn: **Quá hạn**, **Hôm nay**, **Sắp tới**, **Sau đó**. Làm từ trên xuống là kịp.',
				when: () => ctx.hasRows(),
			},
			{
				id: 'row-action',
				target: '[data-tour="task-row"]',
				title: 'Làm xong thì bấm luôn',
				body: 'Làm xong bấm **Báo xong** ngay trên dòng, người giao sẽ nghiệm thu.',
				when: () => ctx.hasRows(),
			},
			{
				id: 'review',
				target: '[data-tour="task-review"]',
				title: 'Chờ bạn nghiệm thu',
				body: 'Việc người khác báo xong cho bạn nằm ở đây. Ổn thì **Nghiệm thu**, chưa ổn thì **Trả lại** kèm lý do.',
				when: () => ctx.hasReview(),
			},
			{
				id: 'create',
				target: '[data-tour="task-create"]',
				title: 'Giao việc',
				body: 'Bấm **Tạo việc** để giao cho mình hoặc cho đồng nghiệp, chỉ cần tiêu đề và người làm, hạn và điểm điền thêm nếu có.',
				when: () => ctx.canCreate(),
			},
			{
				id: 'board',
				target: '[data-tour="task-board-tab"]',
				title: 'Bảng việc',
				body: 'Thích kéo thẻ qua cột thì chuyển sang **Bảng việc**.',
			},
		],
	};
}

/** "Kéo việc trên Bảng việc", ở Việc của tôi và ở thẻ Việc của một dự án. */
export function tasksBoardTour(ctx: { showBoard: () => void }): TourDefinition {
	return {
		id: 'tasks-board',
		version: 1,
		steps: [
			{
				id: 'columns',
				target: '[data-tour="task-board"]',
				// Không ghi số cột: mặc định bốn cột, tick Hiện cột Đã huỷ thì thành năm.
				title: 'Mỗi cột là một trạng thái',
				body: 'Việc đi từ **Chưa làm** sang **Đang làm**, **Chờ nghiệm thu** rồi **Hoàn thành**. Muốn thấy việc đã huỷ thì tick **Hiện cột Đã huỷ**.',
				onEnter: () => ctx.showBoard(),
			},
			{
				id: 'drag',
				target: '[data-sortable-id]',
				title: 'Kéo thẻ để chuyển',
				body: 'Kéo thẻ sang cột khác để đổi trạng thái, kéo lên xuống để xếp thứ tự.',
			},
			{
				id: 'blocked',
				title: 'Cột mờ là không thả được',
				body: 'Khi kéo, cột nào mờ đi là bạn không chuyển vào được, lý do ghi ngay trong cột. Không kéo được thì dùng nút ba chấm trên thẻ.',
			},
		],
	};
}

export interface TasksProjectOpenTourContext {
	hasProjects: () => boolean;
	isLoading: () => boolean;
}

/**
 * Nửa đầu của các hướng dẫn chạy trong một dự án (Tiến độ, Đợt), ở danh sách Dự án: bấm mở dự án
 * đầu tiên, trang dự án đăng ký cùng `tourId` và chạy tiếp. `id` là mã của hướng dẫn đang mở.
 */
export function tasksProjectOpenTour(id: string, ctx: TasksProjectOpenTourContext): TourDefinition {
	return {
		id,
		version: 1,
		steps: [
			{
				id: 'open',
				target: '[data-tour="project-card"]',
				mode: 'click',
				title: 'Mở một dự án',
				body: 'Việc này làm trong từng dự án. Bấm vào thẻ dự án để mở, hướng dẫn đi tiếp ở đó.',
				action: 'Bạn bấm vào dự án đầu tiên.',
				when: () => ctx.isLoading() || ctx.hasProjects(),
			},
			{
				id: 'empty',
				title: 'Chưa có dự án nào',
				body: 'Danh sách đang trống. Đang lọc thì bạn bấm **Xoá bộ lọc**; chưa ở dự án nào thì bấm **Tạo dự án mẫu** để có một dự án thử, rồi mở lại hướng dẫn.',
				when: () => !ctx.isLoading() && !ctx.hasProjects(),
			},
		],
	};
}

/** "Đổi hạn trên biểu đồ Tiến độ", ở thẻ Việc của một dự án. */
export function tasksTimelineTour(ctx: { showTimeline: () => void }): TourDefinition {
	return {
		id: 'tasks-timeline',
		version: 1,
		steps: [
			{
				id: 'chart',
				target: '[data-tour="task-timeline"]',
				title: 'Mỗi việc một dòng',
				body: 'Thanh chạy từ ngày bắt đầu tới hạn. Việc chưa có ngày bắt đầu là một chấm ở hạn.',
				onEnter: () => ctx.showTimeline(),
			},
			{
				id: 'drag-due',
				title: 'Kéo để đổi hạn',
				body: 'Kéo đầu phải thanh hoặc cả thanh rồi thả, hộp **Đổi hạn** hiện ra để ghi lý do. Không có quyền đổi hạn thì không kéo được.',
			},
			{
				id: 'link',
				title: 'Nối việc phải chờ',
				body: 'Kéo chấm tròn cuối thanh này thả lên thanh khác: việc kia sẽ chờ việc này. Đường nối đỏ là việc trước đang trễ.',
			},
		],
	};
}

export interface TasksSprintTourContext {
	/** Dự án đang mở có bật Chia việc theo đợt; dự án còn đang tải thì coi là có. */
	useSprints: () => boolean;
	showSprints: () => void;
}

/** "Xếp việc vào đợt", ở thẻ Việc chờ xếp và Đợt của một dự án. */
export function tasksSprintTour(ctx: TasksSprintTourContext): TourDefinition {
	return {
		id: 'tasks-sprints',
		version: 1,
		steps: [
			{
				id: 'sprint',
				target: '[data-tour="task-sprint"]',
				title: 'Đợt',
				body: 'Mỗi đợt là một khoảng ngắn. Đầu đợt có tổng điểm và điểm theo trạng thái.',
				onEnter: () => ctx.showSprints(),
				when: () => ctx.useSprints(),
			},
			{
				id: 'backlog',
				target: '[data-tour="task-backlog"]',
				title: 'Việc chờ xếp',
				body: 'Việc chưa vào đợt nào nằm ở đây. Kéo việc lên đợt, hoặc bấm nút mũi tên trên dòng.',
				onEnter: () => ctx.showSprints(),
				when: () => ctx.useSprints(),
			},
			{
				id: 'close',
				title: 'Đóng đợt',
				body: 'Hết đợt thì bấm **Đóng đợt**. Việc chưa xong được chuyển sang đợt kế hoặc về **Việc chờ xếp**.',
				when: () => ctx.useSprints(),
			},
			{
				id: 'off',
				title: 'Dự án chưa chia đợt',
				body: 'Dự án này chưa bật đợt. Quản lý dự án bật **Chia việc theo đợt** ở thẻ **Cài đặt**, dự án có thêm thẻ **Việc chờ xếp và Đợt**.',
				when: () => !ctx.useSprints(),
			},
		],
	};
}

/** "Xem báo cáo công việc", ở thẻ Tiến độ của Báo cáo công việc. */
export function tasksReportTour(ctx: { showProgress: () => void }): TourDefinition {
	return {
		id: 'tasks-report',
		version: 1,
		steps: [
			{
				id: 'filters',
				target: '[data-tour="task-report-filters"]',
				title: 'Chọn khoảng và phạm vi',
				body: 'Chọn khoảng ngày, phòng hoặc dự án. Việc tính theo hạn ban đầu nằm trong khoảng.',
				onEnter: () => ctx.showProgress(),
			},
			{
				id: 'numbers',
				target: '[data-tour="task-report-table"]',
				title: 'Bấm số để xem việc',
				body: 'Mỗi con số bấm được, mở ra đúng các việc làm nên con số đó.',
			},
			{
				id: 'export',
				target: '[data-tour="task-report-export"]',
				title: 'Xuất Excel',
				body: 'Tải bảng đang xem về máy để gửi hay lưu.',
			},
		],
	};
}

/** "Đặt việc định kỳ", ở Việc định kỳ. */
export function tasksRecurrenceTour(ctx: { canCreate: () => boolean; hasRows: () => boolean }): TourDefinition {
	return {
		id: 'tasks-recurrences',
		version: 1,
		steps: [
			{
				id: 'create',
				target: '[data-tour="task-recurrence-create"]',
				title: 'Việc lặp lại',
				body: 'Việc làm đều đặn như nộp báo cáo tháng thì bấm **Đặt việc định kỳ** một lần, hệ thống tự giao mỗi kỳ.',
				when: () => ctx.canCreate(),
			},
			{
				id: 'row',
				target: '[data-tour="task-recurrence-row"]',
				title: 'Lần tới',
				body: 'Mỗi dòng ghi hạn lần tới và ngày việc hiện ra. Bấm vào để xem năm hạn sắp tới.',
				when: () => ctx.hasRows(),
			},
			{
				id: 'pause',
				title: 'Dừng khi cần',
				body: 'Tạm nghỉ thì bấm **Dừng**, chạy lại lúc nào cũng được. Người làm nghỉ việc thì hệ thống tự dừng.',
			},
		],
	};
}
