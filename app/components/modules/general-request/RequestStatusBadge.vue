<script setup lang="ts">
	import { REQUEST_STATUS_CLASS, REQUEST_STATUS_LABELS, type GeneralRequestStatus } from '~/types/general-request.types';

	/**
	 * Nhãn trạng thái phiếu.
	 *
	 * Chữ lấy từ `statusLabel` của máy chủ khi có, vì nghiệp vụ đổi chữ thì chỉ sửa ở máy chủ.
	 * Bảng nhãn trong types chỉ là đường lùi cho chỗ chưa có dữ liệu máy chủ, VD ô lọc.
	 */
	const props = defineProps<{
		status: GeneralRequestStatus;
		statusLabel?: string | null;
	}>();

	const text = computed(() => props.statusLabel ?? REQUEST_STATUS_LABELS[props.status] ?? props.status);
	const tone = computed(() => REQUEST_STATUS_CLASS[props.status] ?? 'bg-gray-100 text-gray-600');
</script>

<template>
	<span class="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium" :class="tone">
		{{ text }}
	</span>
</template>
