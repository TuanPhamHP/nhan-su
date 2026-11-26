import type { TourDefinition } from '~/types/tour.types';

export interface AssetListTourContext {
	/** Thêm, nhập tài sản: có `asset:manage` và module đang ghi được. */
	canManage: () => boolean;
	/** Trưởng phòng chỉ xem tài sản của phòng mình. */
	isDepartmentScoped: () => boolean;
	departmentName: () => string | null;
	hasAssets: () => boolean;
	/** Mở phần Tổng quan nếu người dùng đã thu gọn, để bước đầu có chỗ trỏ. */
	expandOverview: () => void;
	isFormOpen: () => boolean;
	closeForm: () => void;
}

/**
 * Hướng dẫn trang Quản lý tài sản (`/management/assets`).
 *
 * Tối đa năm bước, chỉ những việc chính: xem nhanh, tìm, mở chi tiết, thêm tài sản. Người không
 * thêm được tài sản (trưởng phòng, module chỉ xem) còn ba bước.
 */
export function assetListTour(ctx: AssetListTourContext): TourDefinition {
	const scoped = ctx.isDepartmentScoped();
	const dept = ctx.departmentName();
	const wide = typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches;
	const whose = scoped ? (dept ? `phòng ${dept}` : 'phòng bạn') : 'công ty';
	const manage = () => ctx.canManage();
	const closeForm = () => {
		if (ctx.isFormOpen()) ctx.closeForm();
	};
	const openOne = wide ? 'Bấm vào tên một tài sản' : 'Chạm vào một tài sản';

	return {
		id: 'asset-list',
		version: 1,
		// Bấm Xong ở bước trong khung, Bỏ qua hay Esc đều đóng khung thêm tài sản, không lưu gì.
		onEnd: closeForm,
		steps: [
			{
				id: 'overview',
				target: '[data-tour="asset-overview"]',
				title: 'Xem nhanh',
				body: `Chào bạn! Phần này cho biết ${whose} đang có bao nhiêu tài sản và có việc gì đang chờ. Bấm vào một ô là danh sách bên dưới chỉ hiện những tài sản đó.`,
				onEnter: () => ctx.expandOverview(),
			},
			{
				id: 'search',
				target: '[data-tour="asset-filters"]',
				title: 'Tìm tài sản',
				body: scoped
					? 'Gõ tên, mã hoặc tên người đang giữ để tìm. Muốn xem theo loại thì chọn ở các ô bên cạnh.'
					: 'Gõ tên, mã hoặc tên người đang giữ để tìm. Muốn xem theo loại hay theo phòng ban thì chọn ở các ô bên cạnh.',
			},
			{
				id: 'list',
				target: '[data-tour="asset-list"]',
				title: 'Xem chi tiết',
				// Người không có quyền quản lý chỉ xem được, nên không hứa cấp phát hay thu hồi với họ.
				body: ctx.canManage()
					? `${openOne} để xem chi tiết. Cấp phát, điều chuyển hay thu hồi đều làm ở trang đó.`
					: `${openOne} để xem ai đang giữ và tài sản đó đã qua những gì.`,
				when: () => ctx.hasAssets(),
			},
			{
				id: 'add',
				target: '[data-tour="asset-add"]',
				mode: 'click',
				title: 'Thêm tài sản mới',
				body: 'Có tài sản mới thì bấm **Thêm tài sản**. Nhiều tài sản một lúc thì dùng **Nhập Excel** cho nhanh.',
				action: 'Bạn bấm thử vào nút **Thêm tài sản**, chỉ xem thôi, chưa lưu gì.',
				when: manage,
				// Quay lại từ bước sau thì đóng khung, để nút Thêm tài sản bấm lại được.
				onEnter: closeForm,
			},
			{
				id: 'form-main',
				target: '[data-tour="asset-form-main"]',
				title: 'Điền thông tin',
				body: 'Chỉ cần điền tên và chọn loại tài sản là lưu được, các ô khác bổ sung sau cũng được. Xong thì bấm **Tạo tài sản**. Lần này bạn bấm **Xong** để đóng lại.',
				when: manage,
			},
		],
	};
}
