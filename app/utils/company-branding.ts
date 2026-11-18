import { APP_MODULES } from '~/config/app-modules';
import type { AppTile } from '~/types/entitlement.types';

/**
 * Nhận diện theo công ty: tiêu đề tab, favicon và chữ cái dự phòng cho logo.
 *
 * Mỗi công ty có logo và favicon riêng do người vận hành đặt ở control plane, app chỉ đọc. Phần
 * tính toán để ở đây, tách khỏi component, vì cùng một luật phải áp cho thanh bên, header, trang
 * đăng nhập và thẻ `<link rel="icon">` — ba chỗ sau không có chung component nào.
 */

/** Tên sản phẩm, dùng khi chưa biết người dùng đang ở công ty nào. */
export const PRODUCT_NAME = 'Hệ thống nhân sự';

/** Favicon của app, dùng khi công ty chưa có favicon riêng. */
export const DEFAULT_FAVICON = '/favicon.svg';

/**
 * Trang dành cho NGƯỜI NGOÀI công ty: trang tuyển dụng công khai và trang phản hồi thư mời.
 *
 * Tiêu đề và favicon ở đây không mang tên công ty của phiên đang mở, vì hai lý do. Ứng viên là
 * người đọc chính, mà họ không thuộc công ty nào. Và nhân viên công ty A mở link tuyển dụng của
 * công ty B vẫn đang đăng nhập ở A, nên lấy theo phiên là gắn sai tên công ty lên tab.
 */
const OUTSIDER_PREFIXES = ['/careers', '/offer-response'];

function matchesAny(path: string, prefixes: string[]): boolean {
	return prefixes.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
}

/** Đường dẫn trong cấu hình menu có thể kèm query (`?scope=mine`), tiêu đề chỉ cần phần path. */
function pathOf(route: string): string {
	const idx = route.indexOf('?');
	return idx >= 0 ? route.slice(0, idx) : route;
}

/**
 * Nhãn của mục menu ứng với đường dẫn, để trang nào chưa khai `title` vẫn có tên thật trên tab.
 *
 * Khớp theo tiền tố DÀI NHẤT, cùng luật với `currentApp` trong `useAppModules`, nếu không
 * `/management/assets/reports` sẽ nhận nhãn của `/management/reports`. Mục menu được ưu tiên hơn
 * nhãn phân hệ vì nó cụ thể hơn; không mục nào khớp thì lùi về nhãn phân hệ.
 *
 * Nhãn mục menu nằm trong cấu hình của web, còn tên phân hệ do máy chủ trả nên phải truyền vào
 * qua `tiles`. Chưa nạp được danh mục thì chỉ mất lớp dự phòng cấp phân hệ, các mục vẫn có tên.
 *
 * Cố tình KHÔNG lọc theo vai trò hay quyền: đây chỉ là chữ trên tab trình duyệt, còn chặn truy
 * cập là việc của middleware. Lọc ở đây chỉ khiến người không có quyền thấy tiêu đề rỗng.
 */
export function navLabelFor(path: string, tiles: AppTile[] = []): string | null {
	let best: { label: string; len: number; fromItem: boolean } | null = null;
	const labelOf = new Map(tiles.map(t => [t.code, t.label]));

	function offer(label: string | undefined, prefix: string, fromItem: boolean) {
		if (!label) return;
		if (!(path === prefix || path.startsWith(`${prefix}/`))) return;
		if (best && (prefix.length < best.len || (prefix.length === best.len && !fromItem))) return;
		best = { label, len: prefix.length, fromItem };
	}

	for (const app of APP_MODULES) {
		for (const prefix of app.routes) offer(labelOf.get(app.code), pathOf(prefix), false);
		for (const item of app.items) offer(item.label, pathOf(item.route), true);
	}

	return best?.label ?? null;
}

/** Tên trang: `route.meta.title` nếu trang khai, không thì nhãn menu, cuối cùng là tên sản phẩm. */
export function pageTitle(path: string, metaTitle: unknown, tiles: AppTile[] = []): string {
	if (typeof metaTitle === 'string' && metaTitle.trim() !== '') return metaTitle.trim();
	return navLabelFor(path, tiles) ?? PRODUCT_NAME;
}

/**
 * Tiêu đề tab trình duyệt: `{tên công ty} - {tên trang}` khi đã vào một công ty.
 *
 * Chưa đăng nhập thì thay tên công ty bằng tên sản phẩm; trang của người ngoài thì chỉ còn tên
 * trang. Ghép bằng hàm chứ không bằng mẫu `'%s'` của unhead để tên công ty có ký tự `%s` cũng
 * không làm xáo trộn chuỗi.
 */
export function documentTitle(path: string, companyName: string | null | undefined, pageName: string): string {
	const page = pageName.trim() || PRODUCT_NAME;
	if (matchesAny(path, OUTSIDER_PREFIXES)) return page;
	const company = (companyName ?? '').trim();
	return `${company || PRODUCT_NAME} - ${page}`;
}

/**
 * Favicon của tab: của công ty khi có, không thì của app.
 *
 * `faviconUrl` là URL công khai tuyệt đối đã kèm `?v=`, đặt thẳng vào `href` và giữ nguyên tham
 * số `v` để trình duyệt dùng được bộ nhớ đệm một năm của server.
 */
export function faviconHref(path: string, companyFavicon: string | null | undefined): string {
	if (matchesAny(path, OUTSIDER_PREFIXES)) return DEFAULT_FAVICON;
	return (companyFavicon ?? '').trim() || DEFAULT_FAVICON;
}

/**
 * Chữ cái dự phòng khi công ty chưa có logo hoặc logo tải không được.
 *
 * Lấy chữ đầu của TỪ CUỐI trong tên: tên công ty Việt Nam hay mở đầu bằng "Công ty cổ phần", nên
 * chữ đầu của từ đầu thì công ty nào cũng ra chữ C.
 */
export function companyInitial(name: string): string {
	return (name.trim().split(/\s+/).pop() ?? '').charAt(0).toUpperCase() || '?';
}
