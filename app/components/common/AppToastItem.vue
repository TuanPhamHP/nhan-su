<script setup lang="ts">
import type { Toast } from '~/composables/useToast';

const props = defineProps<{ toast: Toast }>();
const emit = defineEmits<{ close: [id: string] }>();

const iconMap = {
	success: {
		path: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
		class: 'text-green-500',
	},
	error: {
		path: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
		class: 'text-red-500',
	},
	info: {
		path: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
		class: 'text-blue-500',
	},
	warning: {
		path: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
		class: 'text-yellow-500',
	},
};

const bgMap = {
	success: 'bg-white dark:bg-gray-800 border-l-4 border-green-500',
	error: 'bg-white dark:bg-gray-800 border-l-4 border-red-500',
	info: 'bg-white dark:bg-gray-800 border-l-4 border-blue-500',
	warning: 'bg-white dark:bg-gray-800 border-l-4 border-yellow-500',
};

const icon = computed(() => iconMap[props.toast.type]);
const bg = computed(() => bgMap[props.toast.type]);
</script>

<template>
	<div
		:class="[
			'flex items-start gap-3 w-80 px-4 py-3 rounded-lg shadow-lg pointer-events-auto',
			bg,
		]"
		role="alert"
	>
		<svg
			:class="['w-5 h-5 mt-0.5 flex-shrink-0', icon.class]"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2"
		>
			<path stroke-linecap="round" stroke-linejoin="round" :d="icon.path" />
		</svg>

		<p class="flex-1 text-sm text-gray-800 dark:text-gray-200">{{ toast.message }}</p>

		<button
			class="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
			@click="emit('close', toast.id)"
		>
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
	</div>
</template>
