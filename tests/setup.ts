/**
 * Vitest global setup — simulates Nuxt auto-imports for composables/utils
 * that use `ref`, `computed`, etc. without explicit import statements.
 */
import { ref, computed, reactive, watch, nextTick } from 'vue'
import { vi } from 'vitest'

Object.assign(globalThis, {
	ref,
	computed,
	reactive,
	watch,
	nextTick,
	// Nuxt composable stubs
	useRuntimeConfig: () => ({
		public: { baseApiUrl: 'http://test-api.local' },
	}),
	navigateTo: vi.fn(),
	$fetch: vi.fn(),
})
