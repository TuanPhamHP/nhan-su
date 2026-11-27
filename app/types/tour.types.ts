/**
 * Hướng dẫn từng bước trên một trang (tour).
 *
 * Một tour là danh sách bước khai báo ở `app/tours/`, chạy bởi `useTour` và vẽ bởi
 * `UiTourOverlay`. Tour không gọi API nào: mọi bước chỉ trỏ vào phần tử đã có trên trang.
 */

/**
 * `info`: chỉ xem, đi tiếp bằng nút Tiếp, phần tử được trỏ cũng không bấm được (tránh bấm nhầm
 * Xuất Excel, In tem…). `click`: người dùng phải bấm thật vào đúng phần tử đó, bấm xong tour
 * chờ phần tử của bước sau hiện ra rồi mới sang.
 */
export type TourStepMode = 'info' | 'click';

export interface TourStep {
	/** Mã bước, dùng cho log và kiểm thử; không hiện ra cho người dùng. */
	id: string;
	/**
	 * Bộ chọn CSS, thường là `[data-tour="..."]`. Nhiều phần tử khớp thì ô sáng bao trọn những
	 * phần tử đang hiện, nên cùng một mã gắn cho bảng (máy tính) và thẻ (điện thoại) vẫn đúng.
	 * Bỏ trống thì hộp hướng dẫn nằm giữa màn, không trỏ vào đâu.
	 */
	target?: string;
	title: string;
	body: string;
	/** Mặc định `info`. */
	mode?: TourStepMode;
	/** Câu chỉ dẫn của bước `click`, VD "Bạn bấm vào nút Thêm tài sản." */
	action?: string;
	/**
	 * Trả `false` thì bỏ hẳn bước này. Đọc lúc bắt đầu để đếm tổng số bước, và đọc lại mỗi lần đi qua;
	 * kết quả đổi giữa chừng thì hộp thôi ghi tổng, chỉ ghi "Bước n".
	 */
	when?: () => boolean;
	onEnter?: () => void;
	onExit?: () => void;
}

export interface TourDefinition {
	id: string;
	/** Đổi nội dung lớn thì tăng số này để người đã xem được tự hiện lại một lần. */
	version: number;
	steps: TourStep[];
	/** Chạy khi tour kết thúc vì bất kỳ lý do gì: xong, bỏ qua, đổi trang. */
	onEnd?: () => void;
}

export type TourFactory = () => TourDefinition;

export type TourEndReason = 'done' | 'skip' | 'route' | 'replace';

/** Trạng thái tour đang chạy. */
export interface TourState {
	tour: TourDefinition;
	index: number;
	/** Bước đã thử mà phần tử không xuất hiện, bị bỏ qua và không tính vào số bước. */
	skipped: number[];
	/** Các bước đã đi qua theo thứ tự, bước đang đứng ở cuối. Số "Bước n" là độ dài danh sách này. */
	history: number[];
	/** Số bước đếm lúc bắt đầu tour. */
	total: number;
	/** `false` khi số bước đã khác lúc bắt đầu; từ đó hộp chỉ ghi "Bước n", không ghi tổng. */
	exact: boolean;
	/** `waiting`: đang chờ phần tử của bước hiện ra. `shown`: đã trỏ được. */
	phase: 'waiting' | 'shown';
	/** Chiều vừa đi, để bước không tìm thấy phần tử biết nên bỏ qua về phía nào. */
	dir: 1 | -1;
}

export interface TourRect {
	top: number;
	left: number;
	width: number;
	height: number;
}
