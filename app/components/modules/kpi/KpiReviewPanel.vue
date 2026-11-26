<script setup lang="ts">
	import KpiReviewDetail from '~/components/modules/kpi/KpiReviewDetail.vue';
	import type { KpiReviewDetail as KpiReviewDetailType } from '~/types/kpi.types';

	/**
	 * Khung phiếu trượt từ phải cho màn Kỳ đánh giá và Kết quả: danh sách phía sau vẫn giữ chỗ đang xem. Màn hẹp
	 * thì chiếm toàn màn hình. Esc đóng khung khi không còn hộp nào mở phía trên.
	 */
	defineProps<{ reviewId: number }>();
	const emit = defineEmits<{ close: []; changed: [review: KpiReviewDetailType] }>();
	const panelRef = ref<HTMLElement | null>(null);
	onMounted(() => nextTick(() => panelRef.value?.focus()));

	function onKey(e: KeyboardEvent) {
		if (e.key !== 'Escape' || e.defaultPrevented) return;
		// Hộp chỉnh số, xác nhận, bằng chứng tự đóng bằng Esc trước.
		if (document.querySelector('[data-testid="kpi-line-edit"], [data-testid="kpi-confirm"], [data-testid="kpi-evidence"], [data-testid="kpi-change-reviewer"]')) return;
		emit('close');
	}
	onMounted(() => window.addEventListener('keydown', onKey));
	onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[55] bg-black/20" @click.self="emit('close')">
			<aside
				ref="panelRef"
				tabindex="-1"
				role="dialog"
				aria-label="Phiếu KPI"
				data-testid="kpi-review-panel"
				class="fixed inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl outline-none lg:w-[820px] lg:border-l lg:border-gray-200 dark:bg-gray-900 dark:lg:border-gray-700"
			>
				<div class="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
					<KpiReviewDetail :key="reviewId" :review-id="reviewId" @changed="r => emit('changed', r)">
						<template #tools>
							<button
								type="button"
								class="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:hover:bg-gray-800"
								aria-label="Đóng phiếu"
								data-testid="kpi-review-panel-close"
								@click="emit('close')"
							>
								<Icon name="heroicons:x-mark" class="h-5 w-5" />
							</button>
						</template>
						<template #not-found>
							<CommonAppButton size="sm" variant="secondary" @click="emit('close')">Đóng</CommonAppButton>
						</template>
					</KpiReviewDetail>
				</div>
			</aside>
		</div>
	</Teleport>
</template>
