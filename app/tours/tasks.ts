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
