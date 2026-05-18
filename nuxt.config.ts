// https://nuxt.com/docs/api/configuration/nuxt-config
import svgLoader from 'vite-svg-loader';
export default defineNuxtConfig({
	ssr: false,
	app: {
		baseURL: '/',
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
				{ rel: 'icon', type: 'image/x-icon', href: '/logo_web.svg' },
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
		},
	},
	compatibilityDate: '2025-07-15',
	devtools: { enabled: true },
	modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt', '@vee-validate/nuxt'],
	css: ['~/assets/styles/globals.scss', 'leaflet/dist/leaflet.css'],
	vite: {
		plugins: [svgLoader({ defaultImport: 'component' })],
		css: {
			preprocessorOptions: {
				scss: {
					additionalData: `@use "~/assets/styles/variables.scss" as *;`,
				},
			},
		},
	},
});
