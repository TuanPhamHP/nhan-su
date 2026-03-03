// Các route công khai không cần đăng nhập
const PUBLIC_ROUTES = ['/login'];

export default defineNuxtRouteMiddleware(to => {
	const token = useCookie('access_token');

	const isPublicRoute = PUBLIC_ROUTES.includes(to.path);

	// Đã đăng nhập mà vào trang login → redirect về trang chủ
	if (isPublicRoute && token.value) {
		return navigateTo('/');
	}

	// Chưa đăng nhập mà vào private route → redirect về login
	if (!isPublicRoute && !token.value) {
		return navigateTo('/login');
	}
});
