<script setup lang="ts">
	import OfficeFullscreenBar from '~/components/modules/office/OfficeFullscreenBar.vue';

	/**
	 * Đưa một khối của trang ra khung lớn (toàn màn hình ở máy hẹp) mà không dựng lại nó.
	 *
	 * Nội dung nằm trong `Teleport` chỉ bật khi mở, nên lúc mở nó được chuyển nguyên trạng ra `body`
	 * (ô đang gõ, bộ lọc, dòng đang mở giữ nguyên) và lúc đóng thì về đúng chỗ cũ trong trang. Đóng
	 * bằng nút đóng hoặc Esc.
	 */
	withDefaults(
		defineProps<{
			open: boolean;
			/** Tên khung, hiện ở thanh trên cùng và làm nhãn hộp thoại. */
			title: string;
			/** Class của khung khi nằm trong trang. */
			inlineClass?: string;
		}>(),
		{ inlineClass: '' },
	);

	const emit = defineEmits<{
		close: [];
	}>();

	const panelRef = ref<HTMLElement | null>(null);
</script>

<template>
	<!--
		Màn hẹp thì phủ kín; từ md trở lên là khung 95vw × 95vh giữa nền tối, để vẫn thấy mình đang ở trang
		nào. Lúc nằm trong trang, hai lớp div đều là khối thường để `space-y-*` của trang và của
		`inlineClass` vẫn chia khoảng như cũ.
	-->
	<Teleport to="body" :disabled="!open">
		<div :class="open ? 'fixed inset-0 z-[60] flex items-center justify-center md:bg-black/40' : ''">
			<div
				ref="panelRef"
				:role="open ? 'dialog' : undefined"
				:aria-modal="open ? 'true' : undefined"
				:aria-label="open ? title : undefined"
				:class="
					open
						? 'flex h-full w-full flex-col overflow-hidden bg-white md:h-[95vh] md:w-[95vw] md:rounded-xl md:shadow-2xl dark:bg-gray-900'
						: inlineClass
				"
			>
				<OfficeFullscreenBar v-if="open" :container="panelRef" :title="title" @close="emit('close')" />
				<slot />
			</div>
		</div>
	</Teleport>
</template>
