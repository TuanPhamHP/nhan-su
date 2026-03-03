import { useAuthStore } from '~/stores/auth';

// Plugin chạy sau @pinia/nuxt → Pinia đã sẵn sàng, có thể dùng useCookie an toàn
export default defineNuxtPlugin(() => {
	const authStore = useAuthStore();
	authStore._initFromCookie();
});
