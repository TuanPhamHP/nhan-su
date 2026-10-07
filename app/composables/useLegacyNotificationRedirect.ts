import { resolveNotificationRoute } from '~/utils/notification-route';

/**
 * Chuyển hướng các URL CŨ mà backend từng nhúng vào email duyệt đơn sang route thật.
 *
 * Email đã gửi nằm vĩnh viễn trong hộp thư người nhận, nên dù backend đã sửa link thì
 * những mail cũ vẫn trỏ vào `/violation-requests/:id`, `/leave-requests/:id`,
 * `/overtime-requests/:id`, `/online-work-requests/:id` — toàn bộ đều 404 vì FE không có
 * các route đó (trang quản lý nằm dưới prefix `/management/`).
 *
 * Đây là LỚP TƯƠNG THÍCH TẠM. Xoá được khi những email cũ đã hết giá trị sử dụng
 * (đơn trong đó đã duyệt xong từ lâu) — khoảng vài tháng sau khi backend sửa.
 *
 * Cố ý đi qua `resolveNotificationRoute` thay vì tự ghi đích đến: bảng route đã có một
 * nguồn sự thật duy nhất ở đó, chép lại lần hai là mai mốt sửa một chỗ quên chỗ kia.
 * Nhờ vậy link cũ cũng tôn trọng "xem theo vai trò khác" và đưa EMPLOYEE về trang cá
 * nhân thay vì đâm vào `/management/**` rồi bị middleware đá ngược.
 */
export function useLegacyNotificationRedirect(refType: string): void {
	const route = useRoute();
	const authStore = useAuthStore();
	const uiStore = useUiStore();

	onMounted(async () => {
		const raw = route.params.id;
		const id = Number(Array.isArray(raw) ? raw[0] : raw);
		const role = uiStore.previewRole ?? authStore.user?.role ?? null;

		// Chưa biết vai trò (fetchMe hỏng) thì không đoán bừa — về trang chủ, còn hơn
		// đẩy người dùng vào trang họ không có quyền.
		if (!role) {
			await navigateTo('/', { replace: true });
			return;
		}

		const target = resolveNotificationRoute(refType, Number.isFinite(id) && id > 0 ? id : null, role);
		await navigateTo(target ?? '/', { replace: true });
	});
}
