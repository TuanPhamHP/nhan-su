<script setup lang="ts">
	import { formatVnDate } from '~/utils/date';
	import { moduleLapsedMessage } from '~/utils/module-expiry';
	import type { ModuleCode } from '~/types/entitlement.types';

	const props = defineProps<{ module: ModuleCode }>();

	const { moduleEntitlement } = useModuleAccess();

	/** Dòng báo khi module không còn dùng đầy đủ. Bình thường không hiện gì. */
	const message = computed(() => {
		const entitlement = moduleEntitlement(props.module);
		if (!entitlement || entitlement.state === 'ENABLED') return '';
		const { label, state, reason, expiresAt, graceEndsAt } = entitlement;

		if (reason === 'LAPSED') return moduleLapsedMessage(label);
		if (state === 'DISABLED') return `${label} chưa được mở cho công ty này.`;
		if (reason === 'EXPIRED') {
			const since = expiresAt ? ` ngày ${formatVnDate(expiresAt)}` : '';
			const until = graceEndsAt ? ` đến hết ngày ${formatVnDate(graceEndsAt)}` : '';
			return `${label} đã hết hạn dùng${since} nên chỉ còn xem được${until}, không tạo, sửa hay duyệt được.`;
		}
		return `${label} đang ở chế độ chỉ xem, không tạo, sửa hay duyệt được.`;
	});
</script>

<template>
	<div
		v-if="message"
		data-testid="module-notice"
		class="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20"
	>
		<svg
			class="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
			/>
		</svg>
		<p class="min-w-0 break-words text-sm text-amber-800 dark:text-amber-200">{{ message }}</p>
	</div>
</template>
