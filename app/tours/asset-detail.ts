import type { TourDefinition } from '~/types/tour.types';

export interface AssetDetailTourContext {
	isService: () => boolean;
	/** Có menu Tác vụ: `asset:manage` và module đang ghi được. */
	canManage: () => boolean;
	isMenuOpen: () => boolean;
	closeMenu: () => void;
}

/**
 * Hướng dẫn trang chi tiết tài sản (`/management/assets/:id`), cho cả thiết bị và dịch vụ thuê bao.
 * Người có quyền quản lý đi bốn bước; người chỉ xem còn hai bước.
 */
export function assetDetailTour(ctx: AssetDetailTourContext): TourDefinition {
	const service = ctx.isService();
	const manage = ctx.canManage();
	const closeMenu = () => {
		if (ctx.isMenuOpen()) ctx.closeMenu();
	};

	const tabsBody = service
		? `Các mục này cho biết ai đang dùng, các lần gia hạn và giấy tờ của dịch vụ.${manage ? ' Muốn thu hồi ghế thì vào mục Ghế.' : ''}`
		: `Các mục này cho biết ai đang giữ, tài sản đã sửa chữa những gì và có giấy tờ nào.${manage ? ' Muốn thu hồi thì vào mục Người dùng.' : ''}`;

	return {
		id: 'asset-detail',
		version: 1,
		onEnd: closeMenu,
		steps: [
			{
				id: 'head',
				target: '[data-tour="asset-detail-head"]',
				title: 'Tài sản này',
				body: service
					? 'Trang này có mọi thông tin về một dịch vụ. Tình trạng hiện tại nằm ngay cạnh tên, ví dụ Đang hoạt động hay Hết hạn.'
					: 'Trang này có mọi thông tin về một tài sản. Tình trạng hiện tại nằm ngay cạnh tên, ví dụ Sẵn sàng hay Đang sử dụng.',
			},
			{
				id: 'actions',
				target: '[data-tour="asset-actions"]',
				mode: 'click',
				title: 'Làm gì với tài sản',
				body: 'Muốn làm gì với tài sản này thì bấm Tác vụ.',
				action: 'Bạn bấm thử vào nút Tác vụ.',
				when: () => ctx.canManage(),
				onEnter: closeMenu,
			},
			{
				id: 'actions-menu',
				target: '[data-tour="asset-actions-menu"]',
				title: 'Chọn việc cần làm',
				body: service
					? 'Cấp ghế cho người dùng, sửa thông tin hay huỷ dịch vụ đều chọn ở đây. Lần này bạn chưa cần chọn gì.'
					: 'Cấp phát cho người dùng, điều chuyển, gửi sửa hay thanh lý đều chọn ở đây. Lần này bạn chưa cần chọn gì.',
				when: () => ctx.canManage(),
				onExit: closeMenu,
			},
			{
				id: 'tabs',
				target: '[data-tour="asset-tabs"]',
				title: 'Lịch sử và giấy tờ',
				body: tabsBody,
			},
		],
	};
}
