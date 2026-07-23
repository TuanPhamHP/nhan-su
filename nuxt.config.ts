// https://nuxt.com/docs/api/configuration/nuxt-config
import svgLoader from 'vite-svg-loader';
export default defineNuxtConfig({
	ssr: false,
	app: {
		baseURL: '/',
		// pageTransition: { name: 'page', mode: 'out-in' },
		pageTransition: false,
		head: {
			titleTemplate: 'Hệ thống nhân sự - %s',
			title: 'Booking',
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
				{ rel: 'icon', type: 'image/x-icon', href: '/favicon.svg' },
				{ rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon-180x180.png' },
			],
			meta: [
				{ name: 'theme-color', content: '#0e7e42' },
				{ name: 'apple-mobile-web-app-capable', content: 'yes' },
				{ name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
				{ name: 'apple-mobile-web-app-title', content: 'HR System' },
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
	devtools: { enabled: true },
	modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt', '@vee-validate/nuxt', '@nuxt/icon', '@vite-pwa/nuxt'],
	pwa: {
		registerType: 'autoUpdate',
		manifest: {
			name: 'Hệ thống nhân sự',
			short_name: 'HR System',
			description: 'Web Admin quản trị nhân sự — HR, Admin, Manager',
			lang: 'vi',
			display: 'standalone',
			orientation: 'portrait',
			start_url: '/',
			scope: '/',
			theme_color: '#0e7e42',
			background_color: '#ffffff',
			categories: ['business', 'productivity'],
			icons: [
				{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
				{ src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
				{ src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
			],
		},
		workbox: {
			navigateFallback: '/',
			navigateFallbackDenylist: [/^\/cdn-cgi\//, /^\/firebase-messaging-sw\.js$/],
			globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
			globIgnores: ['**/firebase-messaging-sw.js'],
			runtimeCaching: [
				{
					urlPattern: ({ url }) => url.origin !== self.location.origin,
					handler: 'NetworkOnly',
				},
			],
		},
		client: { installPrompt: true },
		devOptions: { enabled: false },
	},
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
