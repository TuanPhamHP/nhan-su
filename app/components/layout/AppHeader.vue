<script setup lang="ts">
	import NotificationPanel from '~/components/notifications/NotificationPanel.vue';
	import { isManagementRole } from '~/utils/role';

	const { toggle } = useSidebar();
	const { user, logout } = useAuth();
	const toast = useToast();
	const router = useRouter();
	const route = useRoute();
	const { unreadCount, fetchUnreadCount } = useNotifications();
	const uiStore = useUiStore();
	const { previewRole } = storeToRefs(uiStore);

	const showUserMenu = ref(false);
	const showNotifPanel = ref(false);

	const isManagementUser = computed(() => !!user.value && isManagementRole(user.value.role));
	const isPreviewingAsEmployee = computed(() => previewRole.value === 'EMPLOYEE');

	function toggleViewAs() {
		showUserMenu.value = false;
		if (isPreviewingAsEmployee.value) {
			uiStore.previewAs(null);
			setPageLayout('default');
			if (!route.path.startsWith('/management')) {
				router.push('/management');
			}
		} else {
			uiStore.previewAs('EMPLOYEE');
			setPageLayout('employee');
			if (route.path !== '/') {
				router.push('/');
			}
		}
	}

	function toggleNotificationPanel() {
		showNotifPanel.value = !showNotifPanel.value;
		if (showUserMenu.value) showUserMenu.value = false;
	}

	async function handleLogout() {
		showUserMenu.value = false;
		await logout();
		toast.success('Đăng xuất thành công');
		setTimeout(() => {
			router.push('/login');
		}, 100);
	}

	function closeAll(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('[data-user-menu]')) showUserMenu.value = false;
		if (!target.closest('[data-notif-panel]')) showNotifPanel.value = false;
	}

	onMounted(() => {
		document.addEventListener('click', closeAll);
		fetchUnreadCount().catch(() => {});
	});
	onUnmounted(() => document.removeEventListener('click', closeAll));
</script>

<template>
	<header
		class="h-16 flex items-center justify-between px-4 border-b flex-shrink-0"
		:style="{
			backgroundColor: 'var(--color-header-bg)',
			color: 'var(--color-header-text)',
			borderColor: 'var(--color-border-theme)',
		}"
	>
		<!-- Left: hamburger -->
		<button
			class="p-2 rounded-lg opacity-80 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
			@click="toggle"
		>
			<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
			</svg>
		</button>

		<!-- Right: actions -->
		<div class="flex items-center gap-2">
			<!-- Notification bell -->
			<div class="relative" data-notif-panel>
				<button
					class="relative p-2 rounded-lg opacity-80 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
					title="Thông báo"
					@click.stop="toggleNotificationPanel"
				>
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
						/>
					</svg>
					<span
						v-if="unreadCount.total > 0"
						class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none"
					>
						{{ unreadCount.total > 99 ? '99+' : unreadCount.total }}
					</span>
				</button>

				<NotificationPanel :open="showNotifPanel" @close="showNotifPanel = false" />
			</div>

			<!-- User menu -->
			<div class="relative" data-user-menu>
				<button
					class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
					@click.stop="showUserMenu = !showUserMenu"
				>
					<CommonAppAvatar :src="user?.avatarUrl" :name="user?.fullName" size="sm" />
					<div class="hidden sm:block text-left">
						<p class="text-sm font-medium leading-tight">{{ user?.fullName }}</p>
						<p class="text-xs opacity-70 leading-tight">{{ user?.employeeCode }}</p>
					</div>
					<svg class="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
					</svg>
				</button>

				<Transition
					enter-active-class="transition-all duration-150 ease-out"
					enter-from-class="opacity-0 scale-95 -translate-y-1"
					enter-to-class="opacity-100 scale-100 translate-y-0"
					leave-active-class="transition-all duration-100 ease-in"
					leave-from-class="opacity-100 scale-100 translate-y-0"
					leave-to-class="opacity-0 scale-95 -translate-y-1"
				>
					<div
						v-if="showUserMenu"
						class="absolute right-0 top-full mt-1 w-60 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50"
					>
						<div class="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
							<p class="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{{ user?.fullName }}</p>
							<p class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ user?.email }}</p>
						</div>
						<NuxtLink
							to="/profile"
							class="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
							@click="showUserMenu = false"
						>
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
								/>
							</svg>
							Hồ sơ cá nhân
						</NuxtLink>
						<button
							v-if="isManagementUser"
							class="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-t border-gray-100 dark:border-gray-700"
							@click="toggleViewAs"
						>
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 3M21 7.5H7.5"
								/>
							</svg>
							{{ isPreviewingAsEmployee ? 'Về quản trị' : 'Xem giao diện nhân viên' }}
						</button>
						<button
							class="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
							@click="handleLogout"
						>
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
								/>
							</svg>
							Đăng xuất
						</button>
					</div>
				</Transition>
			</div>
		</div>
	</header>
</template>
