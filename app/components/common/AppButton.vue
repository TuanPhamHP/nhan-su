<script setup lang="ts">
	const props = withDefaults(
		defineProps<{
			variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'danger_outline';
			size?: 'sm' | 'md' | 'lg';
			loading?: boolean;
			disabled?: boolean;
			type?: 'button' | 'submit' | 'reset';
			fullWidth?: boolean;
		}>(),
		{
			variant: 'primary',
			size: 'md',
			loading: false,
			disabled: false,
			type: 'button',
			fullWidth: false,
		},
	);

	const baseClass =
		'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

	const sizeClass = computed(
		() =>
			({
				sm: 'px-3 py-1.5 text-sm gap-1.5',
				md: 'px-4 py-2 text-sm gap-2',
				lg: 'px-6 py-3 text-base gap-2',
			})[props.size],
	);

	const variantClass = computed(
		() =>
			({
				primary:
					'bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-500 dark:bg-brand-500 dark:hover:bg-brand-600',
				secondary:
					'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-400 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600',
				danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 dark:bg-red-500 dark:hover:bg-red-600',
				ghost:
					'bg-transparent text-gray-600 hover:bg-gray-100 focus:ring-gray-400 dark:text-gray-300 dark:hover:bg-gray-700',
				outline:
					'border border-gray-300 bg-transparent text-gray-700 hover:bg-gray-50 focus:ring-gray-400 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700',
				danger_outline:
					'border border-red-600 bg-transparent text-red-600 hover:bg-red-50 focus:ring-red-400 dark:border-red-600 dark:text-red-300 dark:hover:bg-red-700',
			})[props.variant],
	);
</script>

<template>
	<button
		:type="type"
		:disabled="disabled || loading"
		:class="[baseClass, sizeClass, variantClass, fullWidth ? 'w-full' : '']"
	>
		<svg
			v-if="loading"
			class="animate-spin -ml-1 h-4 w-4"
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
		>
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
			<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
		</svg>
		<slot />
	</button>
</template>
