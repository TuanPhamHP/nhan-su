import { safeRedirectPath } from '~/utils/redirect';

/** Trang mở được khi chưa đăng nhập, so khớp NGUYÊN đường dẫn. */
const PUBLIC_ROUTES = ['/login', '/forgot-password', '/reset-password', '/accept-invite', '/offer-response'];

/**
 * Trang công khai có tham số trên đường dẫn nên phải so TIỀN TỐ: trang tuyển dụng của công ty
 * là `/careers/:companyCode` và `/careers/:companyCode/:slug`, ứng viên mở từ link ngoài.
 */
const PUBLIC_PREFIXES = ['/careers'];

/**
 * Trang công khai mà người ĐANG đăng nhập vẫn phải mở được. Lời mời vào công ty khác thường
 * được bấm từ email khi người đó đang đăng nhập ở công ty hiện tại; đá họ về `/` là mất lời mời.
 *
 * Hai trang tuyển dụng cũng vậy: nhân viên công ty A hay bấm link tin tuyển dụng để giới thiệu
 * người quen, và ứng viên đã nhận offer có thể đang đăng nhập bằng tài khoản công ty cũ. Cả hai
 * trang này gọi API bằng fetcher KHÔNG gắn token, nên việc còn phiên đăng nhập không đổi nội dung.
 */
const OPEN_FOR_SIGNED_IN = ['/accept-invite', '/offer-response', '/careers'];

function matchesAny(path: string, prefixes: string[]): boolean {
	return prefixes.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
}

export default defineNuxtRouteMiddleware(to => {
	// Dùng store thay vì useCookie trực tiếp — store chia sẻ reactive state với login action
	const store = useAuthStore();
	const isPublicRoute = PUBLIC_ROUTES.includes(to.path) || matchesAny(to.path, PUBLIC_PREFIXES);

	if (isPublicRoute && store.isAuthenticated && !matchesAny(to.path, OPEN_FOR_SIGNED_IN)) {
		const redirect = safeRedirectPath(to.query.redirect);
		return navigateTo(redirect ?? '/', { replace: true });
	}

	if (!isPublicRoute && !store.isAuthenticated) {
		// Preserve intended URL (path + query) so login can redirect back after success.
		// Skip when target is '/' — that's already the default landing.
		const target = to.fullPath && to.fullPath !== '/' ? to.fullPath : null;
		return navigateTo(
			target ? { path: '/login', query: { redirect: target } } : '/login',
			{ replace: true },
		);
	}
});
