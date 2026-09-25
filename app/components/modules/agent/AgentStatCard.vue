<script setup lang="ts">
	defineProps<{
		label: string;
		value: string;
		hint?: string;
		tone?: 'default' | 'warn' | 'good';
	}>();
</script>

<template>
	<div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
		<p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ label }}</p>
		<p
			:class="[
				'mt-1 text-2xl font-semibold tabular-nums',
				tone === 'warn'
					? 'text-amber-600 dark:text-amber-400'
					: tone === 'good'
						? 'text-emerald-600 dark:text-emerald-400'
						: 'text-gray-900 dark:text-gray-100',
			]"
		>
			{{ value }}
		</p>
		<p v-if="hint" class="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{{ hint }}</p>
	</div>
</template>
