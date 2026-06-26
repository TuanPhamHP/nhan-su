const PUBLIC_ROUTES = ['/login', '/forgot-password', '/reset-password'];

export default defineNuxtRouteMiddleware(to => {
	// Dùng store thay vì useCookie trực tiếp — store chia sẻ reactive state với login action
	const store = useAuthStore();
	const isPublicRoute = PUBLIC_ROUTES.includes(to.path);

	if (isPublicRoute && store.isAuthenticated) {
		return navigateTo('/', { replace: true });
	}

	if (!isPublicRoute && !store.isAuthenticated) {
		return navigateTo('/login', { replace: true });
	}
});
