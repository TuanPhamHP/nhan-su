<script setup lang="ts">
import { usePresignedUrl } from '~/composables/usePresignedUrl';

const props = withDefaults(
	defineProps<{
		fileUrl: string | null;
		alt?: string;
		size?: 'sm' | 'md' | 'lg' | 'full';
	}>(),
	{
		alt: 'Ảnh chấm công',
		size: 'md',
	},
);

const emit = defineEmits<{
	click: [presignedUrl: string];
}>();

const { getPresignedUrl } = usePresignedUrl();

const presignedUrl = ref<string | null>(null);
const loading = ref(false);
const error = ref(false);

const sizeClass = computed(() => ({
	sm: 'w-10 h-10',
	md: 'w-20 h-20',
	lg: 'w-32 h-32',
	full: 'w-full h-full',
}[props.size]));

async function loadUrl(fileUrl: string | null) {
	if (!fileUrl) {
		presignedUrl.value = null;
		loading.value = false;
		error.value = false;
		return;
	}
	loading.value = true;
	error.value = false;
	presignedUrl.value = null;
	try {
		presignedUrl.value = await getPresignedUrl(fileUrl);
	} catch {
		error.value = true;
	} finally {
		loading.value = false;
	}
}

onMounted(() => loadUrl(props.fileUrl));
watch(() => props.fileUrl, loadUrl);
</script>

<template>
	<!-- Loading skeleton -->
	<div
		v-if="loading"
		:class="[sizeClass, 'rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse flex-shrink-0']"
	/>

	<!-- Image loaded -->
	<button
		v-else-if="presignedUrl && !error"
		:class="[sizeClass, 'rounded-lg overflow-hidden flex-shrink-0 block focus:outline-none focus:ring-2 focus:ring-brand-500']"
		:title="alt"
		@click="emit('click', presignedUrl)"
	>
		<img
			:src="presignedUrl"
			:alt="alt"
			class="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
			referrerpolicy="no-referrer"
			@error="error = true"
		/>
	</button>

	<!-- Error state -->
	<div
		v-else-if="(fileUrl && error) || (fileUrl && !presignedUrl && !loading)"
		:class="[sizeClass, 'rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0']"
		:title="alt"
	>
		<svg class="w-1/2 h-1/2 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
			<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
		</svg>
	</div>

	<!-- No photo -->
	<div
		v-else
		:class="[sizeClass, 'rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0']"
		:title="alt"
	>
		<svg class="w-1/2 h-1/2 text-gray-400 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
			<path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
			<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
		</svg>
	</div>
</template>
