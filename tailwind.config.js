/** @type {import('tailwindcss').Config} */
export default {
	darkMode: 'class',
	content: [
		'./app/**/*.{vue,js,ts}',
		'./components/**/*.{vue,js,ts}',
		'./pages/**/*.{vue,js,ts}',
		'./layouts/**/*.{vue,js,ts}',
		'./app.vue',
	],
	theme: {
		extend: {
			colors: {
				brand: {
					50: '#f5faf7',
					100: '#e7f2ec',
					200: '#cae3d5',
					300: '#a3ceb7',
					400: '#76b593',
					500: '#489d6f',
					600: '#0e7e42',
					700: '#0a582e',
					800: '#06391e',
					900: '#042011',
				},
			},
			transitionProperty: {
				width: 'width',
			},
		},
	},
	plugins: [],
};
