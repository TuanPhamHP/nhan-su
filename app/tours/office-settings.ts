import type { TourDefinition } from '~/types/tour.types';

export interface OfficeSettingsTourContext {
	/** Mở đúng thẻ của tour; tour chạy từ thẻ khác thì bước đầu tự chuyển thẻ. */
	showTab: (tab: 'supplies' | 'quotas') => void;
	/** Có `office:manage` và module đang ghi được. */
	canEdit: () => boolean;
	hasGroups: () => boolean;
	/** Thẻ Định mức đã chọn phòng ban, nên bảng định mức đang hiện. */
	hasQuotaDepartment: () => boolean;
}

/**
 * "Tạo danh mục văn phòng phẩm" (`/management/office/settings`, thẻ Văn phòng phẩm).
 *
 * Danh mục là thứ phải có trước khi mở kỳ: nhập một lần từ file Excel đang dùng, rồi xem, sửa và
 * thêm lẻ mặt hàng ngay trên danh sách khi cần.
 */
export function officeSupplyCatalogTour(ctx: OfficeSettingsTourContext): TourDefinition {
	return {
		id: 'office-supply-catalog',
		version: 2,
		steps: [
			{
				id: 'import',
				target: '[data-tour="supply-import"]',
				title: 'Nhập danh mục từ Excel',
				body: 'Lần đầu, cách nhanh nhất là bấm **Nhập từ Excel**: ngăn bên phải có file mẫu và ô chọn file, nhận cả chính file đăng ký văn phòng phẩm hằng tháng đang dùng. Mặt hàng đã có không bị tạo lại.',
				onEnter: () => ctx.showTab('supplies'),
			},
			{
				id: 'toolbar',
				target: '[data-tour="supply-toolbar"]',
				title: 'Tìm và lọc mặt hàng',
				body: 'Gõ tên để tìm, không dấu cũng được. Bấm tên nhóm để chỉ xem nhóm đó, bật **Thiếu đơn giá** để thấy mặt hàng chưa có giá. Nút **+ Thêm mặt hàng** chọn sẵn nhóm đang lọc.',
				when: () => ctx.hasGroups(),
			},
			{
				id: 'items',
				target: '[data-tour="supply-item-groups"]',
				title: 'Sửa ngay trên danh sách',
				body: 'Bấm vào đơn giá (hoặc chip **Chưa có đơn giá**) để sửa nhanh, Enter là lưu. **Sửa** mở đủ thông tin mặt hàng, dấu ba chấm để ngừng dùng hay dùng lại. **+ Thêm nhanh** trên tiêu đề nhóm mở một dòng trống để gõ liền nhiều mặt hàng.',
				when: () => ctx.hasGroups(),
			},
			{
				id: 'group-add',
				target: '[data-tour="supply-group-add"]',
				title: 'Nhóm văn phòng phẩm',
				body: 'Nhóm gom các mặt hàng cùng loại. Khối nhóm thu gọn ở cuối trang, bấm tên khối để xem và sửa. Nhóm đánh dấu **Chỉ HCNS đặt** thì nhân viên các phòng không thấy trong ô chọn.',
				when: () => ctx.canEdit(),
			},
			{
				id: 'next',
				title: 'Bước tiếp theo',
				body: 'Có danh mục rồi thì bạn đặt định mức cho từng phòng ở thẻ **Định mức theo phòng** nếu cần, sau đó mở kỳ đăng ký ở mục **Kỳ văn phòng phẩm**.',
			},
		],
	};
}

/** "Đặt định mức theo phòng" (`/management/office/settings`, thẻ Định mức theo phòng). */
export function officeSupplyQuotaTour(ctx: OfficeSettingsTourContext): TourDefinition {
	return {
		id: 'office-supply-quota',
		version: 1,
		steps: [
			{
				id: 'department',
				target: '[data-tour="quota-department"]',
				title: 'Chọn phòng ban',
				body: 'Định mức đặt riêng cho từng phòng. Bạn chọn phòng muốn đặt ở ô này.',
				onEnter: () => ctx.showTab('quotas'),
			},
			{
				id: 'rows',
				target: '[data-tour="quota-rows"]',
				title: 'Số tối đa mỗi tháng',
				body: 'Mỗi dòng là một mặt hàng và số tối đa phòng được xin trong một tháng. Bấm **Thêm dòng** để thêm mặt hàng, xong thì bấm **Lưu định mức**. Mặt hàng không có dòng nào thì không giới hạn.',
				when: () => ctx.hasQuotaDepartment(),
			},
			{
				id: 'effect',
				title: 'Khi phòng xin quá định mức',
				body: 'Nhân viên vẫn gửi được nhưng phải ghi lý do, và HCNS thấy ngay dòng vượt định mức khi chốt phiếu.',
			},
		],
	};
}
