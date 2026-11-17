<script setup lang="ts">
	import {
		isExpiryBannerDismissed,
		moduleExpiryNotices,
		rememberExpiryBannerDismissed,
	} from '~/utils/module-expiry';

	const authStore = useAuthStore();
	const uiStore = useUiStore();
	const route = useRoute();
	const { modules } = useModuleAccess();

	const companyCode = computed(() => authStore.company?.code ?? null);
	const dismissed = ref(false);

	watch(
		companyCode,
		code => {
			dismissed.value = code ? isExpiryBannerDismissed(code) : false;
		},
		{ immediate: true },
	);

	/**
	 * Chỉ admin thấy vì admin là người liên hệ gia hạn. Đang xem theo vai trò khác thì theo vai trò đó.
	 * Trang trợ lý cao vừa khít màn hình, thêm banner sẽ đẩy ô nhập xuống khuất nên không hiện ở đó.
	 */
	const notices = computed(() => {
		if (route.path === '/assistant') return [];
		if ((uiStore.previewRole ?? authStore.user?.role) !== 'ADMIN' || dismissed.value) return [];
		return moduleExpiryNotices(modules.value);
	});

	function dismiss() {
		dismissed.value = true;
		if (companyCode.value) rememberExpiryBannerDismissed(companyCode.value);
	}
</script>

<template>
	<div
		v-if="notices.length"
		data-testid="module-expiry-banner"
		role="status"
		class="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20"
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
		<div class="min-w-0 flex-1 break-words text-sm text-amber-800 dark:text-amber-200">
			<p v-for="notice in notices" :key="notice.code">{{ notice.message }}</p>
			<p class="mt-1">Hãy liên hệ bên cung cấp để gia hạn.</p>
		</div>
		<button
			type="button"
			data-testid="module-expiry-banner-close"
			aria-label="Đóng thông báo hạn dùng"
			class="-mr-1 -mt-0.5 flex-shrink-0 rounded-lg p-1 text-amber-600 transition-colors hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/40"
			@click="dismiss"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
	</div>
</template>
