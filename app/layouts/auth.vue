<script setup lang="ts"></script>

<template>
	<div class="min-h-screen bg-gray-50 dark:bg-gray-950">
		<slot />
		<ClientOnly><CommonAppToastContainer /></ClientOnly>
	</div>
</template>
