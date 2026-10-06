import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
	// Không có plugin này thì mọi `import ... from '*.vue'` trong test đều lỗi
	// "contains invalid JS syntax" — tức là @vue/test-utils trong devDependencies
	// không dùng được. `@vitejs/plugin-vue` đang có sẵn trong node_modules vì nuxt
	// kéo theo; nên khai thẳng vào devDependencies để không phụ thuộc may rủi.
	plugins: [vue()],
	test: {
		globals: true,
		environment: 'happy-dom',
		setupFiles: ['./tests/setup.ts'],
	},
	resolve: {
		alias: {
			'~': resolve(__dirname, 'app'),
		},
	},
})
