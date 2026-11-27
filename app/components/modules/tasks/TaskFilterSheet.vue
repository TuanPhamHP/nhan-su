<script setup lang="ts">
	import { useEscapeLayer } from '~/composables/useEscapeKey';

	/**
	 * Bộ lọc trên điện thoại: màn hẹp chỉ còn nút "Lọc (n)", bấm thì các ô lọc mở thành tấm dưới đáy màn
	 * hình; màn rộng hiện các ô ngay trên một hàng như cũ. Trước đây bộ lọc chiếm nửa màn hình điện thoại
	 * và đẩy danh sách việc xuống dưới.
	 *
	 * Nút đặt ở slot `trigger` của nơi dùng (cạnh ô tìm) qua `#button`; các ô lọc đặt ở slot mặc định.
	 */
	defineProps<{
		/** Số bộ lọc đang bật, hiện trên nút. */
		count: number;
	}>();

	const open = ref(false);

	function close() {
		open.value = false;
	}

	useEscapeLayer(() => open.value, close);
	defineExpose({ open: () => (open.value = true), close });
</script>

<template>
	<button
		type="button"
		class="flex h-[38px] shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 sm:hidden"
		:class="count ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200'"
		:aria-expanded="open"
		data-testid="task-filter-sheet-open"
		@click="open = true"
	>
		<Icon name="heroicons:funnel" class="h-4 w-4" aria-hidden="true" />
		Lọc<template v-if="count"> ({{ count }})</template>
	</button>
	<Teleport to="body" :disabled="!open">
		<div v-if="open" class="fixed inset-0 z-[55] bg-black/40 sm:hidden" aria-hidden="true" @click="close" />
		<div
			:role="open ? 'dialog' : undefined"
			:aria-label="open ? 'Lọc việc' : undefined"
			:class="[
				open
					? 'fixed inset-x-0 bottom-0 z-[56] grid grid-cols-2 gap-2 rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl dark:bg-gray-900'
					: 'hidden',
				'sm:static sm:z-auto sm:flex sm:flex-wrap sm:items-center sm:gap-2 sm:rounded-none sm:bg-transparent sm:p-0 sm:shadow-none sm:dark:bg-transparent',
			]"
			data-testid="task-filter-sheet"
		>
			<div v-if="open" class="col-span-2 flex items-center justify-between sm:hidden">
				<span class="text-base font-semibold text-gray-900 dark:text-white">Lọc việc</span>
				<CommonAppButton size="sm" data-testid="task-filter-sheet-done" @click="close">Xong</CommonAppButton>
			</div>
			<slot />
		</div>
	</Teleport>
</template>
