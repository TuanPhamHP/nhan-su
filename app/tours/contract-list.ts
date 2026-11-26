import type { TourDefinition } from '~/types/tour.types';

/**
 * Tour ở trang Quản lý hợp đồng (`/management/contracts`).
 *
 * Hợp đồng gắn với từng nhân viên nên được thêm trong hồ sơ, ở thẻ Hợp đồng, chứ không ở trang này.
 * Hướng dẫn "Thêm hợp đồng" bắt đầu ở đây bằng bước bấm Xem chi tiết của dòng đầu, rồi hồ sơ chạy
 * tiếp cùng `tourId` (xem mục 8 của `docs/frontend/feature-guides.md`).
 */

export interface ContractCreateOpenTourContext {
	/** Có vai trò ADMIN, HR, quyền `contract:create` và phân hệ đang ghi được. */
	canCreate: () => boolean;
	/** Có nút Import Excel. */
	canImport: () => boolean;
	/** Danh sách đang hiện ít nhất một hợp đồng để bấm mở hồ sơ. */
	hasItems: () => boolean;
	/** Đang tải danh sách: vẫn đi bước bấm (tour tự chờ dòng đầu hiện ra), chưa báo danh sách trống. */
	isLoading: () => boolean;
}

/** Nửa đầu của "Thêm hợp đồng": mở hồ sơ nhân viên ở thẻ Hợp đồng. */
export function contractCreateOpenTour(ctx: ContractCreateOpenTourContext): TourDefinition {
	const canOpenRow = () => ctx.canCreate() && (ctx.isLoading() || ctx.hasItems());

	return {
		id: 'contract-create',
		version: 1,
		steps: [
			{
				id: 'no-permission',
				title: 'Chưa có quyền thêm hợp đồng',
				body: 'Tài khoản của bạn chưa có quyền tạo hợp đồng, hoặc phân hệ Hợp đồng đang ở chế độ chỉ xem. Bạn nhờ quản trị viên cấp quyền nếu cần.',
				when: () => !ctx.canCreate(),
			},
			{
				id: 'import',
				target: '[data-tour="contract-import"]',
				title: 'Nhập nhiều hợp đồng',
				body: 'Cần đưa vào nhiều hợp đồng một lần thì bấm **Import Excel**, tải file mẫu rồi điền. Hướng dẫn này đi theo cách thêm từng hợp đồng một.',
				when: () => ctx.canCreate() && ctx.canImport(),
			},
			{
				id: 'empty',
				title: 'Thêm trong hồ sơ nhân viên',
				body: 'Hợp đồng được thêm trong hồ sơ của từng người, mà danh sách này chưa có dòng nào để mở. Bạn vào mục **Nhân viên**, bấm mã của người cần thêm, sang thẻ **Hợp đồng** rồi bấm **Thêm hợp đồng**.',
				when: () => ctx.canCreate() && !ctx.isLoading() && !ctx.hasItems(),
			},
			{
				id: 'open',
				target: '[data-tour="contract-row-open"]',
				mode: 'click',
				title: 'Mở hồ sơ nhân viên',
				body: 'Hợp đồng được thêm trong hồ sơ của từng người, ở thẻ **Hợp đồng**. **Xem chi tiết** mở thẳng thẻ đó. Người chưa có hợp đồng nào thì không có trên danh sách này, bạn mở hồ sơ của họ từ mục **Nhân viên**.',
				action: 'Bạn bấm **Xem chi tiết** ở dòng đầu, hướng dẫn đi tiếp trong hồ sơ.',
				when: canOpenRow,
			},
		],
	};
}
