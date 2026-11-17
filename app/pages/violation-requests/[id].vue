<script setup lang="ts">
	import CompanyLinkPrompt from '~/components/notifications/CompanyLinkPrompt.vue';

	// Route cũ trong email duyệt phiếu vi phạm — xem useLegacyNotificationRedirect.
	const { prompt, switching, switchError, confirmSwitch, cancel } = useLegacyNotificationRedirect('violation_request');
</script>

<template>
	<CompanyLinkPrompt
		v-if="prompt"
		:prompt="prompt"
		:switching="switching"
		:error="switchError"
		@confirm="confirmSwitch"
		@cancel="cancel"
	/>
	<div v-else class="py-10 text-center text-sm text-gray-400 dark:text-gray-500">Đang chuyển hướng…</div>
</template>
