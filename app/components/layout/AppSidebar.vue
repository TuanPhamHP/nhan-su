<script setup lang="ts">
	import type { NavItem } from '~/types/navigation.types';
	import type { LockedApp } from '~/utils/app-launcher';
	import { isManagementRole } from '~/utils/role';
	// `app/services/` KHÔNG được Nuxt auto-import (chỉ composables/ và utils/), thiếu dòng
	// này là sidebar crash 500 ngay khi dựng.
	import { useAssetService } from '~/services/asset.service';

	/**
	 * Sidebar của khu quản trị.
	 *
	 * Trước đây đổ TẤT CẢ mục của mọi phân hệ vào một danh sách, hệ thống thêm phân hệ là
	 * sidebar dài thêm — tới 26 mục thì phải cuộn mới thấy hết. Giờ nó chỉ hiện mục của
	 * phân hệ đang đứng (bản đồ ở `app/config/app-modules.ts`), còn chuyển phân hệ thì qua
	 * lưới chọn phân hệ mở từ header.
	 */
	const { isOpen, close } = useSidebar();
	const { user } = useAuth();
	const { hasPermission } = usePermissions();
	const { modules, canUse } = useModuleAccess();
	const { visibleApps, lockedApps, currentApp } = useAppModules();
	/**
	 * Danh sách phân hệ ở trang chủ chỉ nhận ô CÓ TÊN.
	 *
	 * Chưa tải được danh mục của máy chủ thì phân hệ không còn tên lẫn icon, mà một danh sách
	 * toàn dòng trống thì vô dụng. Lúc đó lưới chọn phân hệ báo lỗi kèm nút thử lại, còn mục menu
	 * của phân hệ đang mở vẫn hiện bình thường.
	 */
	const namedApps = computed(() => visibleApps.value.filter(a => a.label));
	const namedLockedApps = computed(() => lockedApps.value.filter(a => a.label));
	const route = useRoute();
	/** Phân hệ khoá người dùng vừa bấm trong danh sách phân hệ ở trang chủ. */
	const lockedTarget = ref<LockedApp | null>(null);
	const metaDataStore = useMetaDataStore();
	const approvalStore = useApprovalStore();
	const { counts: approvalCounts } = storeToRefs(approvalStore);
	const userRoleLabel = computed(() => (user.value ? metaDataStore.labelForRole(user.value.role) : ''));

	onMounted(() => {
		if (user.value && isManagementRole(user.value.role)) {
			approvalStore.fetchCounts();
		}
	});

	// Module vừa đổi trạng thái thì số đơn chờ duyệt cũng đổi theo (BE trả 0 cho module không bật).
	watch(modules, () => {
		if (user.value && isManagementRole(user.value.role)) {
			approvalStore.fetchCounts();
		}
	});

	watch(
		() => route.path,
		() => {
			if (import.meta.client && window.innerWidth < 1024) close();
		},
	);

	const uiStore = useUiStore();
	const { activeTheme } = storeToRefs(uiStore);
	const logoSrc = computed(() =>
		activeTheme.value.logo === 'dark' ? '/app-logo-dark-mode.svg' : '/app-logo-light-mode.svg',
	);

	const { company } = useAuth();
	/**
	 * URL logo công ty vừa tải lỗi, để quay về logo app thay vì để ảnh vỡ.
	 *
	 * Giữ chính URL chứ không giữ một cờ đúng/sai: người vận hành đổi ảnh thì `?v=` tăng, URL mới
	 * khác URL đã lỗi nên thanh bên tự thử lại ở lần `/auth/me` kế tiếp.
	 */
	const companyLogoFailed = ref<string | null>(null);
	const companyLogo = computed(() => {
		const url = company.value?.logoUrl?.trim();
		return url && url !== companyLogoFailed.value ? url : null;
	});

	/** Mục ghim trên cùng, không thuộc phân hệ nào. */
	const PINNED: NavItem[] = [
		{
			label: 'Tổng quan',
			route: '/management',
			icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
			management: true,
		},
		{
			label: 'Tổng quan',
			route: '/',
			icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
			roles: ['EMPLOYEE'],
		},
	];

	const pinnedItems = computed(() =>
		PINNED.filter(item => {
			const u = user.value;
			if (!u) return false;
			if (item.roles && !item.roles.includes(u.role)) return false;
			if (item.management && !item.roles && !isManagementRole(u.role)) return false;
			if (item.permission && !hasPermission(item.permission)) return false;
			if (item.module && !canUse(item.module)) return false;
			return true;
		}),
	);

	const appItems = computed(() => currentApp.value?.items ?? []);

	/** Dùng cho `isActive` xử lý route lồng nhau — phải gồm MỌI mục, không riêng phân hệ hiện tại. */
	const allPaths = computed(() => [
		...PINNED.map(i => itemPath(i.route)),
		...visibleApps.value.flatMap(a => a.items.map(i => itemPath(i.route))),
	]);

	function itemPath(itemRoute: string) {
		const idx = itemRoute.indexOf('?');
		return idx >= 0 ? itemRoute.slice(0, idx) : itemRoute;
	}

	function isActive(item: NavItem) {
		const path = itemPath(item.route);
		if (path === '/') return route.path === '/';
		// Tổng quan chỉ sáng ở đúng nó, nếu không thì mọi trang /management/* đều làm nó sáng.
		if (path === '/management') return route.path === '/management';
		if (route.path === path) {
			if (item.matchQuery) {
				return Object.entries(item.matchQuery).every(([k, v]) => route.query[k] === v);
			}
			const siblings = appItems.value.filter(i => i !== item && itemPath(i.route) === path && i.matchQuery);
			if (siblings.length > 0) {
				const anyScopedActive = siblings.some(s =>
					Object.entries(s.matchQuery!).every(([k, v]) => route.query[k] === v),
				);
				return !anyScopedActive;
			}
			return true;
		}
		if (!route.path.startsWith(path + '/')) return false;
		// Mục cha chỉ sáng khi không có mục con khớp sâu hơn (/management/assets vs
		// /management/assets/vendors).
		return !allPaths.value.some(
			p => p !== path && p.startsWith(path + '/') && (route.path === p || route.path.startsWith(p + '/')),
		);
	}

	// ─── Badge cho các mục cá nhân ───────────────────────────────────────────────
	const unreadAnnouncementCount = ref(0);
	// Dùng chung với trang "Tài sản của tôi" để số giảm ngay sau khi bấm Đã nhận.
	const { pendingAssetCount, setPendingAssetCount } = useMyAssetBadge();
	const { fetchMyAnnouncements } = useCompanyAnnouncements();
	const assetService = useAssetService();
	const taskScope = useTaskScope();

	async function loadUnreadAnnouncementCount() {
		try {
			const res = await fetchMyAnnouncements({ page: 1, limit: 1, isRead: false });
			unreadAnnouncementCount.value = res.meta.total;
		} catch {
			// non-critical: thiếu badge thì vẫn vào trang được
		}
	}

	/** Badge "Tài sản của tôi": số lần cấp phát chờ chính người này xác nhận. */
	async function loadPendingAssetCount() {
		try {
			const res = await assetService.myAssets();
			setPendingAssetCount(res.pendingConfirmationCount);
		} catch {
			// non-critical
		}
	}

	onMounted(() => {
		if (!user.value) return;
		if (canUse('ANNOUNCEMENT')) loadUnreadAnnouncementCount();
		if (canUse('ASSET')) loadPendingAssetCount();
		// Phạm vi công việc quyết định có hiện mục Việc của phòng hay không.
		if (canUse('TASKS')) taskScope.load();
	});

	/** Dịch `badgeKey` trong cấu hình sang số thật. */
	function badgeValue(item: NavItem): number {
		if (item.badgeKey === 'approval') return approvalCounts.value.total;
		if (item.badgeKey === 'unreadAnnouncement') return unreadAnnouncementCount.value;
		if (item.badgeKey === 'pendingAsset') return pendingAssetCount.value;
		// Việc chờ mình nghiệm thu: máy chủ không cộng vào `total` của Duyệt đơn (bridge tasks mục 6).
		if (item.badgeKey === 'taskReviews') return approvalCounts.value.taskReviews ?? 0;
		return 0;
	}

	/**
	 * Tách mục quản lý và mục cá nhân trong cùng phân hệ. Quản lý mở `TAL` sẽ thấy cả bảng
	 * công toàn công ty lẫn bảng công của chính mình, nên cần một đường kẻ phân biệt.
	 */
	const managedItems = computed(() => appItems.value.filter(i => i.scope !== 'personal'));
	const personalItems = computed(() => appItems.value.filter(i => i.scope === 'personal'));

	const tooltip = reactive({ visible: false, text: '', x: 0, y: 0 });

	function showTooltip(event: MouseEvent, text: string) {
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		tooltip.x = rect.right + 8;
		tooltip.y = rect.top + rect.height / 2;
		tooltip.text = text;
		tooltip.visible = true;
	}

	function hideTooltip() {
		tooltip.visible = false;
	}
</script>

<template>
	<aside
		:class="[
			'flex flex-col border-r overflow-hidden',
			'fixed top-0 bottom-0 left-0 z-30 lg:static lg:z-auto',
			'transition-transform lg:transition-[width] duration-300 ease-in-out',
			isOpen ? 'translate-x-0 w-60' : '-translate-x-full lg:translate-x-0 lg:w-16',
		]"
		:style="{
			backgroundColor: 'var(--color-sidebar-bg)',
			color: 'var(--color-sidebar-text)',
			borderColor: 'var(--color-border-theme)',
		}"
	>
		<!-- Logo -->
		<div
			:class="['flex items-center h-16 border-b flex-shrink-0', isOpen ? 'px-4' : 'px-2 justify-center']"
			:style="{ borderColor: 'var(--color-border-theme)' }"
		>
			<div class="flex items-center gap-3 min-w-0">
				<!--
					Logo công ty là ảnh người vận hành tải lên, tỉ lệ tuỳ ý và thường nằm ngang, nên
					khung chỉ cố định chiều cao và để `object-contain` tự thu. Lúc thanh bên thu gọn thì
					khung hẹp lại theo đúng chiều rộng còn lại, logo nhỏ đi chứ không bị cắt.

					Công ty có logo thì chữ "8Hours - Solution" nhường chỗ: ô này rộng 208px, mà một
					logo ngang cao 32px đã chiếm quá nửa, để cả hai thì chữ bị cắt mất đuôi. Logo công
					ty vốn đã mang tên họ, nên đứng một mình vẫn đủ nghĩa.
				-->
				<img
					v-if="companyLogo"
					:src="companyLogo"
					:alt="`Logo ${company?.name ?? 'công ty'}`"
					:class="['flex-shrink-0 object-contain', isOpen ? 'h-8 w-auto max-w-[11rem]' : 'h-8 w-12']"
					data-testid="sidebar-company-logo"
					@error="companyLogoFailed = companyLogo"
				/>
				<template v-else>
					<img :src="logoSrc" alt="HR System Logo" class="w-8 h-8 flex-shrink-0" data-testid="sidebar-app-logo" />
					<Transition
						enter-active-class="transition-opacity duration-200"
						enter-from-class="opacity-0"
						enter-to-class="opacity-100"
						leave-active-class="transition-opacity duration-100"
						leave-from-class="opacity-100"
						leave-to-class="opacity-0"
					>
						<span v-if="isOpen" class="text-[13px] font-bold whitespace-nowrap"> 8Hours - Solution </span>
					</Transition>
				</template>
			</div>
		</div>

		<nav class="flex-1 px-2 py-3 overflow-y-auto space-y-4">
			<!-- Ghim trên cùng -->
			<div class="space-y-0.5">
				<NuxtLink
					v-for="item in pinnedItems"
					:key="item.route"
					:to="item.route"
					:class="[
						'nav-item group flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium',
						!isOpen && 'justify-center px-2',
						isActive(item) && 'is-active',
					]"
					@mouseenter="!isOpen && showTooltip($event, item.label)"
					@mouseleave="hideTooltip"
				>
					<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" :d="item.icon" />
					</svg>
					<Transition
						enter-active-class="transition-opacity duration-200"
						enter-from-class="opacity-0"
						enter-to-class="opacity-100"
					>
						<span v-if="isOpen" class="whitespace-nowrap flex-1">{{ item.label }}</span>
					</Transition>
				</NuxtLink>
			</div>

			<!-- Phân hệ đang mở -->
			<div v-if="currentApp">
				<!--
					Chưa tải được danh mục thì phân hệ không có tên lẫn icon, nên ẩn hẳn dòng tiêu đề:
					một dòng chữ rỗng với ô màu trống trông như lỗi hiển thị. Danh sách mục bên dưới
					vẫn còn nên người dùng đi lại bình thường.
				-->
				<button
					v-if="isOpen && currentApp.label"
					type="button"
					class="w-full flex items-center gap-1.5 px-2 mb-1 py-1 rounded-lg text-left hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
					title="Đổi phân hệ"
					@click="uiStore.toggleLauncher()"
				>
					<span
						class="flex h-5 w-5 items-center justify-center rounded text-white flex-shrink-0"
						:style="{ backgroundColor: currentApp.color }"
					>
						<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" :d="currentApp.icon" />
						</svg>
					</span>
					<span class="text-[10px] font-semibold uppercase tracking-widest opacity-70 truncate min-w-0 flex-1">
						{{ currentApp.label }}
					</span>
					<svg class="w-3 h-3 opacity-50 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
					</svg>
				</button>

				<div v-else class="mx-2 h-px mb-1" :style="{ backgroundColor: 'var(--color-border-theme)' }" />

				<div class="space-y-0.5">
					<NuxtLink
						v-for="item in managedItems"
						:key="item.route"
						:to="item.route"
						:data-tour="item.dataTour"
						:class="[
							'nav-item group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium',
							!isOpen && 'justify-center px-2',
							isActive(item) && 'is-active',
						]"
						@mouseenter="!isOpen && showTooltip($event, item.label)"
						@mouseleave="hideTooltip"
					>
						<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" :d="item.icon" />
						</svg>
						<Transition
							enter-active-class="transition-opacity duration-200"
							enter-from-class="opacity-0"
							enter-to-class="opacity-100"
						>
							<span v-if="isOpen" class="whitespace-nowrap flex-1">{{ item.label }}</span>
						</Transition>
						<span
							v-if="badgeValue(item) > 0"
							:class="[
								'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold flex-shrink-0',
								'bg-red-500 text-white',
								!isOpen && 'absolute top-1 right-1 min-w-[16px] h-4 px-1 text-[10px]',
							]"
						>
							{{ badgeValue(item) > 99 ? '99+' : badgeValue(item) }}
						</span>
					</NuxtLink>
				</div>

				<!--
					Mục dữ liệu của chính người đang đăng nhập. Chỉ cần tiêu đề "Của tôi" khi
					phân hệ có CẢ hai loại — nhân viên thường chỉ thấy phần này nên thêm tiêu đề
					là thừa.
				-->
				<div v-if="personalItems.length" :class="managedItems.length ? 'mt-3' : ''">
					<p
						v-if="isOpen && managedItems.length"
						class="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest opacity-50 whitespace-nowrap"
					>
						Của tôi
					</p>
					<div
						v-else-if="!isOpen && managedItems.length"
						class="mx-2 h-px mb-1"
						:style="{ backgroundColor: 'var(--color-border-theme)' }"
					/>

					<div class="space-y-0.5">
						<NuxtLink
							v-for="item in personalItems"
							:key="item.route"
							:to="item.route"
							:data-tour="item.dataTour"
							:class="[
								'nav-item group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium',
								!isOpen && 'justify-center px-2',
								isActive(item) && 'is-active',
							]"
							@mouseenter="!isOpen && showTooltip($event, item.label)"
							@mouseleave="hideTooltip"
						>
							<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
								<path stroke-linecap="round" stroke-linejoin="round" :d="item.icon" />
							</svg>
							<Transition
								enter-active-class="transition-opacity duration-200"
								enter-from-class="opacity-0"
								enter-to-class="opacity-100"
							>
								<span v-if="isOpen" class="whitespace-nowrap flex-1">{{ item.label }}</span>
							</Transition>
							<span
								v-if="badgeValue(item) > 0"
								:class="[
									'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold flex-shrink-0',
									'bg-red-500 text-white',
									!isOpen && 'absolute top-1 right-1 min-w-[16px] h-4 px-1 text-[10px]',
								]"
							>
								{{ badgeValue(item) > 99 ? '99+' : badgeValue(item) }}
							</span>
						</NuxtLink>
					</div>
				</div>
			</div>

			<!-- Đang ở trang chủ: liệt kê phân hệ ngay tại sidebar, khỏi phải mở lưới -->
			<div v-else-if="namedApps.length || namedLockedApps.length">
				<p
					v-if="isOpen"
					class="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest opacity-50 whitespace-nowrap"
				>
					Phân hệ
				</p>
				<div v-else class="mx-2 h-px mb-1" :style="{ backgroundColor: 'var(--color-border-theme)' }" />
				<div class="space-y-0.5">
					<NuxtLink
						v-for="app in namedApps"
						:key="app.code"
						:to="app.home"
						:class="[
							'nav-item group flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium',
							!isOpen && 'justify-center px-2',
						]"
						@mouseenter="!isOpen && showTooltip($event, app.label)"
						@mouseleave="hideTooltip"
					>
						<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" :d="app.icon" />
						</svg>
						<Transition
							enter-active-class="transition-opacity duration-200"
							enter-from-class="opacity-0"
							enter-to-class="opacity-100"
						>
							<span v-if="isOpen" class="whitespace-nowrap flex-1">{{ app.label }}</span>
						</Transition>
					</NuxtLink>

					<!--
						Phân hệ công ty chưa dùng được: là `button` chứ không phải `NuxtLink`, vì bấm vào
						chỉ mở hộp thoại giải thích, không chuyển trang.
					-->
					<button
						v-for="app in namedLockedApps"
						:key="app.code"
						type="button"
						:data-locked-sidebar-app="app.code"
						:class="[
							'nav-item group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium opacity-60',
							!isOpen && 'justify-center px-2',
						]"
						@mouseenter="!isOpen && showTooltip($event, `${app.label} — ${app.lockBadge}`)"
						@mouseleave="hideTooltip"
						@click="lockedTarget = app"
					>
						<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" :d="app.icon" />
						</svg>
						<Transition
							enter-active-class="transition-opacity duration-200"
							enter-from-class="opacity-0"
							enter-to-class="opacity-100"
						>
							<span v-if="isOpen" class="whitespace-nowrap flex-1">{{ app.label }}</span>
						</Transition>
						<svg
							v-if="isOpen"
							class="h-3.5 w-3.5 flex-shrink-0"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
							/>
						</svg>
					</button>
				</div>
			</div>
		</nav>

		<CommonAppModuleLockedDialog
			v-if="lockedTarget"
			:label="lockedTarget.label"
			:description="lockedTarget.description"
			:reason="lockedTarget.lockReason"
			@close="lockedTarget = null"
		/>

		<!-- User Info Bottom -->
		<div class="border-t p-3 flex-shrink-0" :style="{ borderColor: 'var(--color-border-theme)' }">
			<div class="flex items-center gap-3 min-w-0">
				<CommonAppAvatar :src="user?.avatarUrl" :name="user?.fullName" size="sm" />
				<Transition
					enter-active-class="transition-opacity duration-200"
					enter-from-class="opacity-0"
					enter-to-class="opacity-100"
					leave-active-class="transition-opacity duration-100"
					leave-from-class="opacity-100"
					leave-to-class="opacity-0"
				>
					<div v-if="isOpen" class="flex-1 min-w-0">
						<p class="text-[11px] font-medium truncate">{{ user?.fullName }}</p>
						<p class="text-[11px] opacity-70 truncate">{{ userRoleLabel }}</p>
					</div>
				</Transition>
			</div>
		</div>
	</aside>

	<Teleport to="body">
		<div
			v-if="tooltip.visible"
			class="fixed z-50 px-2 py-1 text-xs font-medium text-white bg-gray-900 dark:bg-gray-700 rounded shadow-lg pointer-events-none whitespace-nowrap -translate-y-1/2"
			:style="{ top: `${tooltip.y}px`, left: `${tooltip.x}px` }"
		>
			{{ tooltip.text }}
		</div>
	</Teleport>
</template>
