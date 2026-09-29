<script setup lang="ts">
	const route = useRoute();

	/** Đang ở ngay trang chat rồi thì nút nổi chỉ che mất ô nhập — ẩn đi. */
	const hidden = computed(() => route.path.startsWith('/assistant'));

	// Vị trí: mobile nâng lên trên (bottom-24) vì một số trang đã có FAB "tạo đơn"
	// riêng ở góc `bottom-6 right-6` (chỉ hiện dưới sm) — để nguyên góc sẽ chồng nút.
</script>

<template>
	<NuxtLink
		v-if="!hidden"
		to="/assistant"
		title="Trợ lý AI"
		aria-label="Mở trợ lý AI"
		class="group fixed right-5 bottom-24 z-10 flex items-center rounded-full bg-[var(--color-accent)] p-4 text-white shadow-lg transition duration-200 hover:scale-105 hover:shadow-xl active:scale-95 sm:right-6 sm:bottom-6"
	>
		<svg class="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
			/>
		</svg>

		<!-- Nhãn chỉ bung ra khi hover trên máy có chuột; mobile giữ nguyên nút tròn -->
		<span
			class="ml-0 hidden max-w-0 overflow-hidden text-sm font-semibold whitespace-nowrap opacity-0 transition-all duration-300 group-hover:ml-2 group-hover:max-w-[8rem] group-hover:opacity-100 lg:block"
		>
			Trợ lý AI
		</span>
	</NuxtLink>
</template>
