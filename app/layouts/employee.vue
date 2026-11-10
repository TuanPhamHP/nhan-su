<script setup lang="ts">
const { load: loadDirectory } = useDirectoryStore();
const { isOpen, close, open } = useSidebar();
const uiStore = useUiStore();

onMounted(() => {
	loadDirectory();
	if (window.innerWidth >= 1024) open();
});
</script>

<template>
	<div class="flex h-[100dvh] bg-gray-50 dark:bg-gray-950 overflow-hidden">
		<!-- Mobile sidebar backdrop -->
		<Transition
			enter-active-class="transition-opacity duration-300"
			enter-from-class="opacity-0"
			enter-to-class="opacity-100"
			leave-active-class="transition-opacity duration-300"
			leave-from-class="opacity-100"
			leave-to-class="opacity-0"
		>
			<div v-if="isOpen" class="fixed inset-0 z-20 bg-black/50 lg:hidden" @click="close" />
		</Transition>

		<!--
			Dùng CHUNG sidebar với layout quản trị. Bản đồ phân hệ (`app/config/app-modules.ts`)
			chứa cả màn hình quản lý lẫn màn hình cá nhân, tự lọc theo vai trò — nhân viên mở
			ra chỉ thấy phần của mình, và có luôn lưới chọn phân hệ như mọi người khác.
		-->
		<LayoutAppSidebar />

		<div class="flex flex-col flex-1 min-w-0 overflow-hidden">
			<LayoutAppHeader />

			<main class="flex-1 overflow-y-auto p-4 lg:p-6">
				<slot />
			</main>
		</div>

		<LayoutAppAgentFab />

		<!--
			Cũng cần ở layout nhân viên: quản lý bật "Xem giao diện nhân viên" sẽ sang layout
			này nhưng nút lưới ở header vẫn hiện (role thật của họ có phân hệ). Thiếu dòng
			dưới thì bấm nút không ra gì. Khi nào gộp một layout duy nhất thì bỏ bớt được.
		-->
		<ClientOnly>
			<LayoutAppLauncher v-if="uiStore.launcherOpen" @close="uiStore.closeLauncher()" />
		</ClientOnly>

		<ClientOnly><CommonAppToastContainer /></ClientOnly>
		<ClientOnly><CommonAppImageViewer /></ClientOnly>
	</div>
</template>
