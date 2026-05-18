<script setup lang="ts">
const props = withDefaults(
	defineProps<{
		currentPage: number;
		totalPages: number;
		maxVisible?: number;
	}>(),
	{ maxVisible: 5 },
);

const emit = defineEmits<{ 'update:currentPage': [page: number] }>();

function go(page: number) {
	if (page >= 1 && page <= props.totalPages) {
		emit('update:currentPage', page);
	}
}

const pages = computed(() => {
	const { totalPages: total, currentPage: current, maxVisible: max } = props;
	if (total <= max) return Array.from({ length: total }, (_, i) => i + 1);

	const half = Math.floor(max / 2);
	let start = Math.max(1, current - half);
	const end = Math.min(total, start + max - 1);
	if (end - start + 1 < max) start = Math.max(1, end - max + 1);

	return Array.from({ length: end - start + 1 }, (_, i) => start + i);
});
</script>

<template>
	<div class="flex items-center gap-1">
		<button
			:disabled="currentPage <= 1"
			class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
			@click="go(currentPage - 1)"
		>
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
		</button>

		<button
			v-for="p in pages"
			:key="p"
			:class="[
				'min-w-[36px] h-9 px-2 rounded-lg text-sm font-medium transition-colors',
				p === currentPage
					? 'bg-brand-600 text-white'
					: 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
			]"
			@click="go(p)"
		>
			{{ p }}
		</button>

		<button
			:disabled="currentPage >= totalPages"
			class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
			@click="go(currentPage + 1)"
		>
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
			</svg>
		</button>
	</div>
</template>
