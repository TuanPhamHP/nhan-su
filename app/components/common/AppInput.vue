<script setup lang="ts">
const props = withDefaults(
	defineProps<{
		modelValue?: string | number;
		label?: string;
		placeholder?: string;
		type?: string;
		error?: string;
		hint?: string;
		disabled?: boolean;
		required?: boolean;
		id?: string;
	}>(),
	{
		type: 'text',
		disabled: false,
		required: false,
	},
);

const emit = defineEmits<{
	'update:modelValue': [value: string];
}>();

const inputId = computed(() => props.id ?? `input-${Math.random().toString(36).slice(2)}`);
</script>

<template>
	<div class="flex flex-col gap-1">
		<label
			v-if="label"
			:for="inputId"
			class="text-sm font-medium text-gray-700 dark:text-gray-300"
		>
			{{ label }}
			<span v-if="required" class="text-red-500 ml-0.5">*</span>
		</label>

		<input
			:id="inputId"
			:type="type"
			:value="modelValue"
			:placeholder="placeholder"
			:disabled="disabled"
			:class="[
				'block w-full rounded-lg border px-3 py-2.5 text-sm transition-colors',
				'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
				'placeholder:text-gray-400 dark:placeholder:text-gray-500',
				'focus:outline-none focus:ring-2 focus:ring-offset-0',
				'disabled:opacity-50 disabled:cursor-not-allowed',
				error
					? 'border-red-400 focus:border-red-400 focus:ring-red-300 dark:border-red-500'
					: 'border-gray-300 focus:border-brand-500 focus:ring-brand-200 dark:border-gray-600 dark:focus:border-brand-400',
			]"
			@input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
		/>

		<p v-if="error" class="text-xs text-red-500 dark:text-red-400">{{ error }}</p>
		<p v-else-if="hint" class="text-xs text-gray-500 dark:text-gray-400">{{ hint }}</p>
	</div>
</template>
