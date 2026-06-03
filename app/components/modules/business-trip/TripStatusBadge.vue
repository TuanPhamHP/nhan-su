<script setup lang="ts">
import type { BusinessTripStatus } from '~/types/business-trip.types';

const props = defineProps<{ status: BusinessTripStatus }>();

const config = computed(() => {
	const map: Record<BusinessTripStatus, { label: string; class: string }> = {
		DRAFT:       { label: 'Nháp',          class: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
		PENDING:     { label: 'Chờ duyệt',      class: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
		APPROVED:    { label: 'Đã duyệt',        class: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
		IN_PROGRESS: { label: 'Đang công tác',   class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
		COMPLETED:   { label: 'Hoàn thành',      class: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
		REJECTED:    { label: 'Bị từ chối',      class: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
	};
	return map[props.status] ?? { label: props.status, class: 'bg-gray-100 text-gray-600' };
});
</script>

<template>
	<span :class="['inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', config.class]">
		{{ config.label }}
	</span>
</template>
