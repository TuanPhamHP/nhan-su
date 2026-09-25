<script setup lang="ts">
	import AgentChatPanel from '~/components/modules/agent/AgentChatPanel.vue';

	definePageMeta({ title: 'Trợ lý nhân sự' });
</script>

<template>
	<!-- Chiều cao = viewport trừ header (4rem) và padding của <main> (2rem, lg:3rem).
	     Full width: bảng báo cáo mà agent hay trả về cần hết chiều ngang, bó max-w là bị cắt. -->
	<div class="h-[calc(100dvh-6rem)] w-full lg:h-[calc(100dvh-7rem)]">
		<AgentChatPanel />
	</div>
</template>
