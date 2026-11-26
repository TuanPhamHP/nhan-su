import type { TourDefinition } from '~/types/tour.types';

/**
 * Hướng dẫn bốn màn KPI (mục 9.2): mỗi màn tối đa năm bước, câu ngắn như đồng nghiệp chỉ nhau, chỉ trỏ, không
 * bấm nút ghi nào. Bước nào trang chưa có phần tử sau 2 giây thì tự bỏ. Mở từ tab Hướng dẫn bên phải nên trang chưa có dữ
 * liệu vẫn mở được tour: lúc đó còn một bước không trỏ nói vì sao chưa có gì. Bước đó đứng cuối, và trang coi
 * "đang tải" là "có dữ liệu", để tour mở ngay lúc chuyển trang không báo trống khi dữ liệu chưa về.
 */

/** "Xem KPI của tôi", ở KPI của tôi. */
export function kpiMyTour(ctx: { hasReview: () => boolean; canFeedback: () => boolean }): TourDefinition {
	return {
		id: 'kpi-my',
		version: 1,
		steps: [
			{ id: 'periods', target: '[data-tour="kpi-periods"]', title: 'Các kỳ của bạn', body: 'Mỗi tháng hay mỗi quý có một phiếu. Bấm để xem kỳ khác.', when: () => ctx.hasReview() },
			{ id: 'score', target: '[data-testid="kpi-score"]', title: 'Điểm của bạn', body: 'Giữa kỳ là điểm tạm tính, hệ thống tính lại mỗi đêm.', when: () => ctx.hasReview() },
			{ id: 'lines', target: '[data-testid="kpi-lines"]', title: 'Từng chỉ tiêu', body: 'Số gạch chân bấm được, mở ra đúng các việc làm nên con số đó.', when: () => ctx.hasReview() },
			{ id: 'feedback', target: '[data-testid="kpi-feedback-box"]', title: 'Phản hồi', body: 'Cấp trên chấm xong thì bạn đồng ý hoặc ghi ý kiến. Đồng ý rồi vẫn ghi thêm được.', when: () => ctx.canFeedback() },
			{ id: 'empty', title: 'Chưa có phiếu KPI', body: 'Bạn chưa có phiếu nào. Đầu tháng hay đầu quý, khi kỳ đánh giá được mở thì phiếu của bạn hiện ở đây.', when: () => !ctx.hasReview() },
		],
	};
}

/** "Chấm KPI nhân viên", ở Đánh giá nhân viên. */
export function kpiReviewTour(ctx: { hasRows: () => boolean }): TourDefinition {
	return {
		id: 'kpi-review',
		version: 1,
		steps: [
			{ id: 'list', target: '[data-tour="kpi-review-list"]', title: 'Phiếu chờ bạn chấm', body: 'Kỳ khép thì phiếu của người bạn quản lý nằm ở đây.', when: () => ctx.hasRows() },
			{ id: 'lines', target: '[data-testid="kpi-lines"]', title: 'Chấm từng dòng', body: 'Chỉ tiêu nhập tay chấm bằng năm nút 1 đến 5. Số tự động thấy sai thì bấm **Chỉnh số** và ghi lý do.', when: () => ctx.hasRows() },
			{ id: 'submit', target: '[data-testid="kpi-submit-box"]', title: 'Gửi đánh giá', body: 'Ghi nhận xét chung rồi gửi. Gửi xong không sửa được nữa.', when: () => ctx.hasRows() },
			{ id: 'next', target: '[data-tour="kpi-next"]', title: 'Chấm liền tay', body: 'Bấm **Phiếu kế tiếp** để sang người sau, không phải quay lại danh sách.', when: () => ctx.hasRows() },
			{ id: 'empty', title: 'Chưa có phiếu để chấm', body: 'Kỳ đánh giá khép thì phiếu của người bạn quản lý chuyển sang đây. Lúc đó bạn mở lại hướng dẫn này.', when: () => !ctx.hasRows() },
		],
	};
}

/** "Cài đặt chỉ tiêu KPI", ở Cài đặt KPI. */
export function kpiSettingsTour(): TourDefinition {
	return {
		id: 'kpi-settings',
		version: 1,
		steps: [
			{ id: 'indicators', target: '[data-tour="kpi-tab-indicators"]', title: 'Chỉ tiêu', body: 'Tám chỉ tiêu tự động có sẵn. Thêm chỉ tiêu nhập tay như Chuyên môn khi cần.' },
			{ id: 'templates', target: '[data-tour="kpi-tab-templates"]', title: 'Mẫu đánh giá', body: 'Gom chỉ tiêu, mức giao, trọng số cho một phòng hay vị trí. Tổng trọng số đúng 100%.' },
			{ id: 'grades', target: '[data-tour="kpi-tab-grades"]', title: 'Thang xếp loại', body: 'Đổi tổng điểm thành A, B, C, D. Thang mới dùng cho kỳ mở sau.' },
		],
	};
}

/** "Mở kỳ đánh giá KPI", ở Kỳ đánh giá. */
export function kpiPeriodTour(ctx: { hasPeriod: () => boolean; canOpen: () => boolean }): TourDefinition {
	return {
		id: 'kpi-periods',
		version: 1,
		steps: [
			{ id: 'open', target: '[data-tour="kpi-open-period"]', title: 'Mở kỳ', body: 'Đầu tháng hay đầu quý bấm **Mở kỳ**, hệ thống tạo phiếu cho mọi người.', when: () => ctx.canOpen() },
			{ id: 'counts', target: '[data-tour="kpi-counts"]', title: 'Phiếu đang ở đâu', body: 'Số phiếu theo từng bước. Bấm số để lọc danh sách.', when: () => ctx.hasPeriod() },
			{ id: 'publish', target: '[data-tour="kpi-publish-all"]', title: 'Công bố', body: 'Phiếu chờ chốt công bố từng phiếu hoặc cả kỳ một lần.', when: () => ctx.hasPeriod() },
			{ id: 'results', target: '[data-tour="kpi-tab-results"]', title: 'Kết quả', body: 'Xem phân bố xếp loại theo phòng và xuất Excel.', when: () => ctx.hasPeriod() },
			{ id: 'empty', title: 'Chưa có kỳ nào', body: 'Mở kỳ đầu tiên xong thì trang này hiện số phiếu theo từng bước, nút công bố và kết quả.', when: () => !ctx.hasPeriod() },
		],
	};
}
