<script setup lang="ts">
import type { MakeupRequestStatus } from '~/types/makeup-attendance.types';
import { makeupStatusClass, makeupStatusLabel } from '~/utils/makeup-attendance.utils';

const props = defineProps<{
	status: MakeupRequestStatus;
}>();
</script>

<template>
	<span
		:class="[
			'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap',
			makeupStatusClass(props.status),
		]"
	>
		{{ makeupStatusLabel(props.status) }}
	</span>
</template>
