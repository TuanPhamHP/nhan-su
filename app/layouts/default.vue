<script setup lang="ts">
const { load: loadDirectory } = useDirectoryStore();
const { isOpen, close, open } = useSidebar();

onMounted(() => {
	loadDirectory();
	if (window.innerWidth >= 1024) open();
});
</script>

<template>
	<div class="flex h-[100dvh] bg-gray-50 dark:bg-gray-950 overflow-hidden">
		<!-- Mobile sidebar backdrop -->
		<Transition
			enter-active-class="transition-opacity duration-300"
			enter-from-class="opacity-0"
			enter-to-class="opacity-100"
			leave-active-class="transition-opacity duration-300"
			leave-from-class="opacity-100"
			leave-to-class="opacity-0"
		>
			<div v-if="isOpen" class="fixed inset-0 z-20 bg-black/50 lg:hidden" @click="close" />
		</Transition>

		<LayoutAppSidebar />

		<div class="flex flex-col flex-1 min-w-0 overflow-hidden">
			<LayoutAppHeader />

			<main class="flex-1 overflow-y-auto p-4 lg:p-6">
				<slot />
			</main>
		</div>

		<ClientOnly><CommonAppToastContainer /></ClientOnly>
		<ClientOnly><CommonAppImageViewer /></ClientOnly>
	</div>
</template>
