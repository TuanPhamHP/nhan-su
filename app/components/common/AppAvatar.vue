<script setup lang="ts">
	type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

	const props = withDefaults(
		defineProps<{
			src?: string | null;
			name?: string | null;
			size?: AvatarSize;
			clickable?: boolean;
			bordered?: boolean;
			ring?: boolean;
			title?: string;
		}>(),
		{
			src: null,
			name: '',
			size: 'md',
			clickable: false,
			bordered: false,
			ring: false,
			title: undefined,
		},
	);

	const emit = defineEmits<{
		click: [src: string];
	}>();

	const FALLBACK_LOGO = '/app-logo-dark-mode.svg';

	const sizeClass = computed(
		() =>
			({
				xs: 'w-6 h-6',
				sm: 'w-8 h-8',
				md: 'w-10 h-10',
				lg: 'w-12 h-12',
				xl: 'w-16 h-16',
				'2xl': 'w-20 h-20',
			})[props.size],
	);

	const imgError = ref(false);
	watch(
		() => props.src,
		() => {
			imgError.value = false;
		},
	);

	const showFallback = computed(() => !props.src || imgError.value);
	const isClickable = computed(() => props.clickable && !!props.src && !imgError.value);

	function onClick() {
		if (isClickable.value && props.src) emit('click', props.src);
	}
</script>

<template>
	<component
		:is="isClickable ? 'button' : 'div'"
		:type="isClickable ? 'button' : undefined"
		:title="title"
		:class="[
			'rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800',
			sizeClass,
			bordered ? 'border border-gray-200 dark:border-gray-700' : '',
			ring ? 'ring-2 ring-gray-200 dark:ring-gray-700' : '',
			isClickable ? 'hover:ring-2 hover:ring-brand-400 transition-shadow cursor-pointer' : '',
		]"
		@click="onClick"
	>
		<img
			v-if="!showFallback"
			:src="src!"
			:alt="name ?? ''"
			class="w-full h-full object-cover"
			@error="imgError = true"
		/>
		<img
			v-else
			:src="FALLBACK_LOGO"
			:alt="name ?? 'avatar'"
			class="w-3/5 h-3/5 object-contain opacity-70"
		/>
	</component>
</template>
