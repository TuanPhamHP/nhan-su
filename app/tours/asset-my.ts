import type { TourDefinition } from '~/types/tour.types';

export interface AssetMyTourContext {
	hasHolding: () => boolean;
	/** Có lần cấp phát đang chờ bạn xác nhận (hiện hai nút Đã nhận, Báo chưa đúng). */
	hasPending: () => boolean;
	/** Có thẻ nào đang hiện nút Báo hỏng hoặc Báo mất. */
	canReport: () => boolean;
	/** Đưa về mục Thiết bị, vì mọi bước trỏ vào thẻ ở mục đó. */
	showAssetsTab: () => void;
}

/**
 * Hướng dẫn trang Tài sản của tôi (`/assets/my`). Tối đa ba bước, mọi bước chỉ để xem, không bấm
 * nút ghi nào. Người chưa giữ gì chỉ còn một bước không trỏ.
 */
export function assetMyTour(ctx: AssetMyTourContext): TourDefinition {
	const holding = ctx.hasHolding();

	return {
		id: 'asset-my',
		version: 1,
		steps: [
			{
				id: 'holding',
				target: '[data-tour="my-holding"]',
				title: 'Tài sản của bạn',
				body: 'Đây là những tài sản công ty đang giao cho bạn.',
				when: () => ctx.hasHolding(),
				onEnter: () => ctx.showAssetsTab(),
			},
			{
				id: 'confirm',
				target: '[data-tour="my-confirm"]',
				title: 'Nhận tài sản',
				body: 'Khi nhận được đồ, bạn kiểm tra rồi bấm **Đã nhận**. Thiếu hay sai gì thì bấm **Báo chưa đúng**.',
				when: () => ctx.hasPending(),
			},
			{
				id: 'confirm-later',
				title: holding ? 'Khi được giao tài sản mới' : 'Tài sản của bạn',
				body: holding
					? 'Bạn sẽ thấy hai nút **Đã nhận** và **Báo chưa đúng**. Kiểm tra đồ thật rồi bấm một trong hai.'
					: 'Hiện bạn chưa giữ tài sản nào. Khi được giao, bạn kiểm tra đồ thật rồi bấm **Đã nhận**, thiếu hay sai gì thì bấm **Báo chưa đúng**.',
				when: () => !ctx.hasPending(),
				onEnter: () => ctx.showAssetsTab(),
			},
			{
				id: 'report',
				target: '[data-tour="my-report"]',
				title: 'Hỏng hay mất',
				body: 'Đồ bị hỏng hay thất lạc thì bấm **Báo hỏng** hoặc **Báo mất** ngay trên tài sản đó.',
				when: () => ctx.canReport(),
			},
		],
	};
}
