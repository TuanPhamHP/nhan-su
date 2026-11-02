<script setup lang="ts">
	import type { CompanyLinkPrompt } from '~/composables/useLegacyNotificationRedirect';

	/**
	 * Hộp hỏi khi mở link đơn mang `?t=` của công ty khác công ty đang mở.
	 * Dùng trong các trang chuyển hướng link cũ (`/leave-requests/:id`, …).
	 */
	defineProps<{
		prompt: CompanyLinkPrompt;
		switching: boolean;
		error: string;
	}>();

	const emit = defineEmits<{ confirm: []; cancel: [] }>();
</script>

<template>
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" data-testid="company-link-prompt">
		<div
			role="dialog"
			aria-modal="true"
			class="w-full max-w-md rounded-xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 p-6"
		>
			<template v-if="prompt.kind === 'switch'">
				<div class="flex items-start gap-3">
					<div
						class="w-10 h-10 flex-shrink-0 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center"
					>
						<svg
							class="w-5 h-5 text-brand-700 dark:text-brand-300"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
							/>
						</svg>
					</div>
					<div class="min-w-0">
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Chuyển công ty?</h2>
						<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
							Đơn này thuộc {{ prompt.company.name }}. Bạn có muốn chuyển sang công ty đó để xem đơn không?
						</p>
					</div>
				</div>

				<p v-if="error" class="mt-4 text-sm text-red-600 dark:text-red-400">{{ error }}</p>

				<div class="mt-6 flex justify-end gap-2">
					<CommonAppButton variant="outline" :disabled="switching" @click="emit('cancel')">
						Không, về trang chủ
					</CommonAppButton>
					<CommonAppButton :loading="switching" data-testid="company-link-confirm" @click="emit('confirm')">
						{{ switching ? 'Đang chuyển...' : `Chuyển sang ${prompt.company.name}` }}
					</CommonAppButton>
				</div>
			</template>

			<template v-else>
				<div class="flex items-start gap-3">
					<div class="w-10 h-10 flex-shrink-0 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
						<svg
							class="w-5 h-5 text-red-600 dark:text-red-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
							/>
						</svg>
					</div>
					<div class="min-w-0">
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Không có quyền xem đơn này</h2>
						<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
							Đơn này thuộc một công ty mà tài khoản của bạn không tham gia, nên bạn không thể mở nó. Nếu bạn cho rằng
							đây là nhầm lẫn, hãy liên hệ bộ phận nhân sự.
						</p>
					</div>
				</div>

				<div class="mt-6 flex justify-end">
					<CommonAppButton @click="emit('cancel')">Về trang chủ</CommonAppButton>
				</div>
			</template>
		</div>
	</div>
</template>
