import { storeToRefs } from 'pinia';
import { documentTitle, faviconHref, pageTitle } from '~/utils/company-branding';

/**
 * Favicon và tiêu đề tab theo công ty của phiên đang mở.
 *
 * Vì sao là plugin chứ không phải `useHead` trong layout: luật này phải áp cho MỌI trang, kể cả
 * trang đăng nhập (layout `auth`) và trang tuyển dụng công khai (layout `public`), mà ba layout
 * đó không có chung tổ tiên nào ngoài app. Đặt ở một plugin thì chỉ có một chỗ sửa.
 *
 * Trang nào tự gọi `useHead({ title })` vẫn thắng: unhead ưu tiên bản ghi đăng ký sau, mà plugin
 * chạy lúc khởi động app nên luôn đăng ký trước trang. `titleTemplate` ở đây nhận đúng cái tên
 * trang đó rồi gắn tên công ty vào trước.
 */
export default defineNuxtPlugin(() => {
	const router = useRouter();
	const { company } = storeToRefs(useAuthStore());

	useHead(() => {
		// Đọc `currentRoute` của router thay vì `useRoute()`: ngoài setup của component thì đây là
		// nguồn chắc chắn có, và nó vẫn reactive nên đổi trang là tiêu đề đổi theo.
		const route = router.currentRoute.value;
		const fallback = pageTitle(route.path, route.meta.title);

		return {
			title: fallback,
			titleTemplate: (title?: string) => documentTitle(route.path, company.value?.name, title?.trim() || fallback),
			// Cùng `key` với thẻ icon khai trong `nuxt.config.ts` để unhead thay thẻ đó, không thêm
			// thẻ thứ hai — hai thẻ `rel="icon"` thì mỗi trình duyệt chọn một kiểu.
			link: [{ rel: 'icon', key: 'favicon', href: faviconHref(route.path, company.value?.faviconUrl) }],
		};
	});
});
