<script setup lang="ts">
	import type { ViolationRequestStatus } from '~/types/violation.types';
	import { violationStatusLabel, violationStatusClass } from '~/utils/violation.utils';

	defineProps<{ status: ViolationRequestStatus }>();
</script>

<template>
	<span :class="['inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', violationStatusClass(status)]">
		{{ violationStatusLabel(status) }}
	</span>
</template>
