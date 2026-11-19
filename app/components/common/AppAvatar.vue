<script setup lang="ts">
	/**
	 * Avatar người dùng — MỌI chỗ hiện avatar một người đều dùng component này.
	 *
	 * Có ảnh thì hiện ảnh; chưa có ảnh hoặc ảnh tải lỗi (URL ký hết hạn, file đã xoá) thì hiện chữ
	 * cái đầu trên nền màu accent của theme. Trước đây mỗi màn hình tự vẽ một kiểu — thanh bên hiện
	 * chữ đầu của họ, header hiện logo app — nên cùng một người trông khác nhau ở hai góc màn hình.
	 */
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

	const sizeClass = computed(
		() =>
			({
				xs: 'w-6 h-6 text-[10px]',
				sm: 'w-8 h-8 text-xs',
				md: 'w-10 h-10 text-sm',
				lg: 'w-12 h-12 text-base',
				xl: 'w-16 h-16 text-xl',
				'2xl': 'w-20 h-20 text-2xl',
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
	const initials = computed(() => personInitials(props.name));

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
			'rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-semibold leading-none select-none',
			showFallback ? 'text-white' : 'bg-gray-100 dark:bg-gray-800',
			sizeClass,
			bordered ? 'border border-gray-200 dark:border-gray-700' : '',
			ring ? 'ring-2 ring-gray-200 dark:ring-gray-700' : '',
			isClickable ? 'hover:ring-2 hover:ring-brand-400 transition-shadow cursor-pointer' : '',
		]"
		:style="showFallback ? { backgroundColor: 'var(--color-accent)' } : undefined"
		@click="onClick"
	>
		<img v-if="!showFallback" :src="src!" :alt="name ?? ''" class="w-full h-full object-cover" @error="imgError = true" />
		<span v-else-if="initials" :aria-label="name ?? undefined">{{ initials }}</span>
		<svg v-else class="w-3/5 h-3/5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
			/>
		</svg>
	</component>
</template>
