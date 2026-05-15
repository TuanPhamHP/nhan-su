// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	// ssr: false,
	app: {
		baseURL: '/',
	},
	devServer: {
		port: 4000,
	},
	runtimeConfig: {
		// Private keys (chỉ có ở Server-side)
		apiSecret: '',

		// Public keys (có thể truy cập ở cả Client và Server)
		public: {
			baseApiUrl: process.env.NUXT_BASE_API_URL || 'https://api.example.com',
			apiKey: process.env.NUXT_PUBLIC_API_KEY || '123456',
		},
	},
	compatibilityDate: '2025-07-15',
	devtools: { enabled: true },
	modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
});
