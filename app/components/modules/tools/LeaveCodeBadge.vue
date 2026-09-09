<script setup lang="ts">
defineProps<{ code: string | null }>();

const classMap: Record<string, string> = {
	P: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
	KL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
	'P+KL': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
};

function badgeClass(code: string | null) {
	if (!code) return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
	return classMap[code] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
}
</script>

<template>
	<span
		class="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-md"
		:class="badgeClass(code)"
	>
		{{ code ?? '—' }}
	</span>
</template>
