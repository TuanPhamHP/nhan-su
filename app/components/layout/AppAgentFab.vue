<script setup lang="ts">
	import agentAvatar from '~/assets/icons/ONGO_AI_BOT.png';

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
		<img :src="agentAvatar" alt="" draggable="false" class="h-7 w-7 shrink-0 object-contain select-none" />

		<!-- Nhãn chỉ bung ra khi hover trên máy có chuột; mobile giữ nguyên nút tròn -->
		<span
			class="ml-0 hidden max-w-0 overflow-hidden text-sm font-semibold whitespace-nowrap opacity-0 transition-all duration-300 group-hover:ml-2 group-hover:max-w-[8rem] group-hover:opacity-100 lg:block"
		>
			Trợ lý AI
		</span>
	</NuxtLink>
</template>
