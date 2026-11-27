// https://nuxt.com/docs/api/configuration/nuxt-config
import svgLoader from 'vite-svg-loader';
export default defineNuxtConfig({
	ssr: false,
	app: {
		baseURL: '/',
		// pageTransition: { name: 'page', mode: 'out-in' },
		pageTransition: false,
		head: {
			// Tiêu đề thật do `plugins/company-branding.client.ts` ghép: `{tên công ty} - {tên trang}`.
			// Ở đây chỉ còn cái hiện trong khoảnh khắc trước khi app chạy, nên không ghép thêm gì.
			titleTemplate: '%s',
			title: 'Hệ thống nhân sự',
			link: [
				{
					rel: 'preconnect',
					href: 'https://fonts.googleapis.com',
				},
				{
					rel: 'preconnect',
					href: 'https://fonts.gstatic.com',
					crossorigin: '',
				},
				{
					rel: 'stylesheet',
					href: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap',
				},
				// `key` để plugin nhận diện công ty thay được chính thẻ này. Không khai `type`: favicon
				// công ty là PNG, ICO hoặc WebP tuỳ ảnh người vận hành tải lên.
				{ rel: 'icon', key: 'favicon', href: '/favicon.svg' },
				{ rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon-180x180.png' },
			],
			meta: [
				{ name: 'theme-color', content: '#0e7e42' },
				{ name: 'mobile-web-app-capable', content: 'yes' },
				{ name: 'mobile-web-app-status-bar-style', content: 'default' },
				{ name: 'mobile-web-app-title', content: 'HR System' },
			],
		},
	},
	devServer: {
		port: 6001,
	},
	runtimeConfig: {
		// Private keys (chỉ có ở Server-side)
		apiSecret: '',

		// Public keys (có thể truy cập ở cả Client và Server)
		public: {
			baseApiUrl: process.env.NUXT_PUBLIC_BASE_API_URL || 'https://api.example.com',
			apiKey: process.env.NUXT_PUBLIC_API_KEY || '123456',
			firebaseApiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY || '',
			firebaseAuthDomain: process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
			firebaseProjectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID || '',
			firebaseStorageBucket: process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
			firebaseMessagingSenderId: process.env.NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
			firebaseAppId: process.env.NUXT_PUBLIC_FIREBASE_APP_ID || '',
			firebaseVapidKey: process.env.NUXT_PUBLIC_FIREBASE_VAPID_KEY || '',
		},
	},
	nitro: {
		prerender: {
			crawlLinks: false,
			routes: ['/', '/200.html', '/404.html'],
		},
	},
	compatibilityDate: '2025-07-15',
	experimental: {
		// Mặc định Nuxt hỏi `builds/latest.json` mỗi giờ; thấy có bản mới (mỗi lần đẩy develop là Netlify
		// dựng lại) thì gắn `router.beforeResolve` tải lại TOÀN TRANG ở lần điều hướng kế tiếp, kể cả khi
		// chỉ đổi query như mở, đóng khung chi tiết việc (`?task=`). Tắt đi: lỗi tải chunk sau khi dựng mới
		// vẫn do plugin chunk-reload của Nuxt tự tải lại.
		checkOutdatedBuildInterval: false,
	},
	devtools: { enabled: true },
	modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt', '@vee-validate/nuxt', '@nuxt/icon'],
	css: ['~/assets/styles/globals.scss', '~/assets/styles/announcement.css', 'leaflet/dist/leaflet.css'],
	vite: {
		plugins: [svgLoader({ defaultImport: 'component' })],
		server: {
			hmr: {
				protocol: 'ws',
				host: '0.0.0.0',
			},
		},
		css: {
			preprocessorOptions: {
				scss: {
					additionalData: `@use "~/assets/styles/variables.scss" as *;`,
				},
			},
		},
	},
});
