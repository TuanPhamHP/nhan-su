import { safeRedirectPath } from '~/utils/redirect';

const PUBLIC_ROUTES = ['/login', '/forgot-password', '/reset-password'];

export default defineNuxtRouteMiddleware(to => {
	// Dùng store thay vì useCookie trực tiếp — store chia sẻ reactive state với login action
	const store = useAuthStore();
	const isPublicRoute = PUBLIC_ROUTES.includes(to.path);

	if (isPublicRoute && store.isAuthenticated) {
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
