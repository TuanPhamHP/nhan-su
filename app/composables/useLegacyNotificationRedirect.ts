import type { CompanyOption } from '~/types/auth.types';
import { resolveNotificationRoute } from '~/utils/notification-route';

/**
 * Link trong email mang `?t=<mã công ty>` vì cùng số đơn có ở mọi công ty. Khi `t` khác công ty
 * đang mở thì phải hỏi trước khi chuyển: `switch` là có công ty đó trong tài khoản, `denied` là
 * tài khoản không thuộc công ty đó nên không có quyền xem đơn.
 */
export type CompanyLinkPrompt = { kind: 'switch'; company: CompanyOption } | { kind: 'denied' };

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
 *
 * Từ khi có nhiều công ty (G1), link mang thêm `?t=`. Trang dùng composable này phải vẽ
 * `prompt` khi nó khác null (xem `CompanyLinkPrompt.vue`).
 */
export function useLegacyNotificationRedirect(refType: string) {
	const route = useRoute();
	const authStore = useAuthStore();
	const uiStore = useUiStore();

	const prompt = ref<CompanyLinkPrompt | null>(null);
	const switching = ref(false);
	const switchError = ref('');

	async function redirectToRecord() {
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
	}

	onMounted(async () => {
		const linkCompany = typeof route.query.t === 'string' ? route.query.t : '';
		const currentCompany = authStore.company?.code ?? null;

		// Không có `t` (link cũ), trùng công ty đang mở, hoặc chưa nạp được công ty hiện tại
		// (`/auth/me` lỗi) thì chạy như trước.
		if (!linkCompany || !currentCompany || linkCompany === currentCompany) {
			await redirectToRecord();
			return;
		}

		const target = authStore.companies.find(c => c.code === linkCompany);
		prompt.value = target ? { kind: 'switch', company: target } : { kind: 'denied' };
	});

	/** Đổi công ty rồi tải lại đúng link này; lúc đó `t` trùng công ty đang mở nên đi tiếp như cũ. */
	async function confirmSwitch() {
		if (prompt.value?.kind !== 'switch' || switching.value) return;
		switching.value = true;
		switchError.value = '';
		try {
			await authStore.switchCompany(prompt.value.company.code, route.fullPath);
		} catch (err) {
			switching.value = false;
			switchError.value = err instanceof Error ? err.message : 'Không chuyển được công ty. Vui lòng thử lại.';
		}
	}

	async function cancel() {
		await navigateTo('/', { replace: true });
	}

	return { prompt, switching, switchError, confirmSwitch, cancel };
}
