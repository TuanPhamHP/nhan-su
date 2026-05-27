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
			],
		},
	},
	devServer: {
		port: 4000,
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
	modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt', '@vee-validate/nuxt', '@nuxt/icon'],
	css: ['~/assets/styles/globals.scss', 'leaflet/dist/leaflet.css'],
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
