/**
 * Số đỏ cạnh mục "Tài sản của tôi": số lần cấp phát đang chờ chính người này xác nhận.
 *
 * Thanh bên tải số này một lần khi mở trang, còn trang "Tài sản của tôi" tải lại danh sách sau
 * mỗi lần bấm Đã nhận. Giữ chung một ref ở đây để trang cập nhật được số trên thanh bên ngay,
 * không bắt người dùng tải lại cả trang mới thấy số giảm (M5).
 */
const pendingAssetCount = ref(0);

export function useMyAssetBadge() {
	function setPendingAssetCount(count: number) {
		pendingAssetCount.value = Math.max(0, count);
	}
	return { pendingAssetCount, setPendingAssetCount };
}
