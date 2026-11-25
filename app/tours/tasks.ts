import type { TourDefinition } from '~/types/tour.types';

/**
 * Hướng dẫn hai màn chính của Công việc (mục 9.2): tối đa năm bước, câu ngắn như đồng nghiệp chỉ
 * nhau, chỉ trỏ, không bấm nút ghi nào. Bước nào trang chưa có phần tử thì tự bỏ.
 */
export interface TasksMyTourContext {
	hasRows: () => boolean;
	hasReview: () => boolean;
	canCreate: () => boolean;
}

export function tasksMyTour(ctx: TasksMyTourContext): TourDefinition {
	return {
		id: 'tasks-my',
		version: 1,
		steps: [
			{
				id: 'groups',
				target: '[data-tour="task-groups"]',
				title: 'Việc của bạn',
				body: 'Việc chia theo hạn: Quá hạn, Hôm nay, Sắp tới, Sau đó. Làm từ trên xuống là kịp.',
				when: () => ctx.hasRows(),
			},
			{
				id: 'row-action',
				target: '[data-tour="task-row"]',
				title: 'Làm xong thì bấm luôn',
				body: 'Làm xong bấm Báo xong ngay trên dòng, người giao sẽ nghiệm thu.',
				when: () => ctx.hasRows(),
			},
			{
				id: 'review',
				target: '[data-tour="task-review"]',
				title: 'Chờ bạn nghiệm thu',
				body: 'Việc người khác báo xong cho bạn nằm ở đây. Ổn thì Nghiệm thu, chưa ổn thì Trả lại kèm lý do.',
				when: () => ctx.hasReview(),
			},
			{
				id: 'create',
				target: '[data-tour="task-create"]',
				title: 'Giao việc',
				body: 'Bấm Tạo việc để giao cho mình hoặc cho đồng nghiệp, ghi rõ hạn và điểm.',
				when: () => ctx.canCreate(),
			},
			{
				id: 'board',
				target: '[data-tour="task-board-tab"]',
				title: 'Bảng việc',
				body: 'Thích kéo thẻ qua cột thì chuyển sang Bảng việc.',
			},
		],
	};
}

export function tasksBoardTour(): TourDefinition {
	return {
		id: 'tasks-board',
		version: 1,
		steps: [
			{
				id: 'columns',
				target: '[data-tour="task-board"]',
				title: 'Năm cột, năm trạng thái',
				body: 'Mỗi cột là một trạng thái của việc, từ Chưa làm tới Hoàn thành.',
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

/** Biểu đồ tiến độ (lô 2): bốn bước, chỉ trỏ. */
export function tasksTimelineTour(): TourDefinition {
	return {
		id: 'tasks-timeline',
		version: 1,
		steps: [
			{
				id: 'chart',
				target: '[data-tour="task-timeline"]',
				title: 'Mỗi việc một dòng',
				body: 'Thanh chạy từ ngày bắt đầu tới hạn. Việc chưa có ngày bắt đầu là một chấm ở hạn.',
			},
			{
				id: 'drag-due',
				title: 'Kéo để đổi hạn',
				body: 'Kéo đầu phải thanh hoặc cả thanh rồi thả, hộp Đổi hạn hiện ra để ghi lý do. Không có quyền đổi hạn thì không kéo được.',
			},
			{
				id: 'link',
				title: 'Nối việc phải chờ',
				body: 'Kéo chấm tròn cuối thanh này thả lên thanh khác: việc kia sẽ chờ việc này. Đường nối đỏ là việc trước đang trễ.',
			},
		],
	};
}

/** Việc chờ xếp và Đợt (lô 2). */
export function tasksSprintTour(): TourDefinition {
	return {
		id: 'tasks-sprints',
		version: 1,
		steps: [
			{
				id: 'sprint',
				target: '[data-tour="task-sprint"]',
				title: 'Đợt',
				body: 'Mỗi đợt là một khoảng ngắn. Đầu đợt có tổng điểm và điểm theo trạng thái.',
			},
			{
				id: 'backlog',
				target: '[data-tour="task-backlog"]',
				title: 'Việc chờ xếp',
				body: 'Việc chưa vào đợt nào nằm ở đây. Kéo việc lên đợt, hoặc bấm nút mũi tên trên dòng.',
			},
			{
				id: 'close',
				title: 'Đóng đợt',
				body: 'Hết đợt thì bấm Đóng đợt. Việc chưa xong được chuyển sang đợt kế hoặc về Việc chờ xếp.',
			},
		],
	};
}

/** Báo cáo tiến độ (UI-06). */
export function tasksReportTour(): TourDefinition {
	return {
		id: 'tasks-report',
		version: 1,
		steps: [
			{
				id: 'filters',
				target: '[data-tour="task-report-filters"]',
				title: 'Chọn khoảng và phạm vi',
				body: 'Chọn khoảng ngày, phòng hoặc dự án. Việc tính theo hạn ban đầu nằm trong khoảng.',
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

/** Việc định kỳ (UI-07). */
export function tasksRecurrenceTour(ctx: { canCreate: () => boolean; hasRows: () => boolean }): TourDefinition {
	return {
		id: 'tasks-recurrences',
		version: 1,
		steps: [
			{
				id: 'create',
				target: '[data-tour="task-recurrence-create"]',
				title: 'Việc lặp lại',
				body: 'Việc làm đều đặn như nộp báo cáo tháng thì đặt một lần, hệ thống tự giao mỗi kỳ.',
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
				body: 'Tạm nghỉ thì bấm Dừng, chạy lại lúc nào cũng được. Người làm nghỉ việc thì hệ thống tự dừng.',
			},
		],
	};
}
