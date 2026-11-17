<script setup lang="ts">
	/** Ô số liệu của trang Tổng quan và trang Báo cáo. */
	withDefaults(
		defineProps<{
			label: string;
			value: string | number;
			hint?: string;
			/** Tô cảnh báo khi con số là thứ cần xử lý (phiếu quá hạn, định biên âm). */
			warn?: boolean;
			to?: string;
		}>(),
		{ warn: false },
	);
</script>

<template>
	<component
		:is="to ? 'NuxtLink' : 'div'"
		:to="to"
		class="block rounded-xl border bg-white px-4 py-3 shadow-sm transition-colors dark:bg-gray-900"
		:class="[
			warn
				? 'border-amber-300 dark:border-amber-700'
				: 'border-gray-200 dark:border-gray-700',
			to ? 'hover:border-brand-400 dark:hover:border-brand-500' : '',
		]"
	>
		<p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
			{{ label }}
		</p>
		<p
			class="mt-1 text-2xl font-bold tabular-nums"
			:class="warn ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'"
		>
			{{ value }}
		</p>
		<p v-if="hint" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ hint }}</p>
	</component>
</template>
