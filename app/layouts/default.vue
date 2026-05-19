<script setup lang="ts">
const { load: loadDirectory } = useDirectoryStore();
onMounted(() => loadDirectory());
</script>

<template>
	<div class="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
		<LayoutAppSidebar />

		<div class="flex flex-col flex-1 min-w-0 overflow-hidden">
			<LayoutAppHeader />

			<main class="flex-1 overflow-y-auto p-6">
				<slot />
			</main>
		</div>

		<ClientOnly><CommonAppToastContainer /></ClientOnly>
	</div>
</template>
