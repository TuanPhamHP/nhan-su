<script setup lang="ts">
const props = withDefaults(
	defineProps<{
		title?: string;
		description?: string;
	}>(),
	{
		title: 'Trang đang được xây dựng',
		description: 'Tính năng này đang trong quá trình phát triển. Vui lòng quay lại sau.',
	},
);

const router = useRouter();
</script>

<template>
	<div class="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
		<div class="w-20 h-20 mb-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
			<svg
				class="w-10 h-10 text-amber-500"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z"
				/>
			</svg>
		</div>

		<h2 class="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
			{{ title }}
		</h2>
		<p class="text-gray-500 dark:text-gray-400 max-w-md mb-8">
			{{ description }}
		</p>

		<button
			class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
			@click="router.back()"
		>
			<svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
			</svg>
			Quay lại
		</button>
	</div>
</template>
