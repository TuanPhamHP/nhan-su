<script setup lang="ts">
const { isOpen, close } = useSidebar();
const { user } = useAuth();
const route = useRoute();
const { isDark } = useColorMode();
const metaDataStore = useMetaDataStore();
const userRoleLabel = computed(() => (user.value ? metaDataStore.labelForRole(user.value.role) : ''));

watch(
	() => route.path,
	() => {
		if (import.meta.client && window.innerWidth < 1024) close();
	},
);

const navSections = [
	{
		label: 'Tổng quan',
		items: [
			{
				label: 'Dashboard',
				route: '/',
				icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
			},
		],
	},
	{
		label: 'Chấm công',
		items: [
			{
				label: 'Chấm công của tôi',
				route: '/attendance/my',
				icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
			},
			{
				label: 'Check-in / Check-out',
				route: '/attendance/check-in',
				icon: 'M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1',
			},
		],
	},
	{
		label: 'Đơn của tôi',
		items: [
			{
				label: 'Đơn xin nghỉ phép',
				route: '/users/leave-requests',
				icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
			},
			{
				label: 'Đơn OT của tôi',
				route: '/overtime/my',
				icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
			},
			{
				label: 'Đơn Online của tôi',
				route: '/online-work/my',
				icon: 'M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25',
			},
			{
				label: 'Đơn xin chỉnh công',
				route: '/violations/my',
				icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
			},
			{
				label: 'Đơn bù công của tôi',
				route: '/makeup-attendance/my',
				icon: 'M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z',
			},
			{
				label: 'Đơn công tác của tôi',
				route: '/business-trips',
				icon: 'M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5',
				dataTour: 'nav-my-business-trips',
			},
		],
	},
];

function isActive(itemRoute: string) {
	if (itemRoute === '/') return route.path === '/';
	if (route.path === itemRoute) return true;
	if (!route.path.startsWith(itemRoute + '/')) return false;
	const allRoutes = navSections.flatMap(s => s.items.map(i => i.route));
	return !allRoutes.some(
		r => r !== itemRoute && r.startsWith(itemRoute + '/') && (route.path === r || route.path.startsWith(r + '/')),
	);
}

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
			'flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 overflow-hidden',
			'fixed top-0 bottom-0 left-0 z-30 lg:static lg:z-auto',
			'transition-transform lg:transition-[width] duration-300 ease-in-out',
			isOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0 lg:w-16',
		]"
	>
		<!-- Logo -->
		<div class="flex items-center h-16 px-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
			<div class="flex items-center gap-3 min-w-0">
				<img
					:src="isDark ? '/app-logo-dark-mode.svg' : '/app-logo-light-mode.svg'"
					alt="HR System Logo"
					class="w-8 h-8 flex-shrink-0"
				/>
				<Transition
					enter-active-class="transition-opacity duration-200"
					enter-from-class="opacity-0"
					enter-to-class="opacity-100"
					leave-active-class="transition-opacity duration-100"
					leave-from-class="opacity-100"
					leave-to-class="opacity-0"
				>
					<span v-if="isOpen" class="text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">
						8Hours - Solution
					</span>
				</Transition>
			</div>
		</div>

		<!-- Nav -->
		<nav class="flex-1 px-2 py-3 overflow-y-auto space-y-4">
			<div v-for="section in navSections" :key="section.label">
				<!-- Section label — only when expanded -->
				<Transition
					enter-active-class="transition-opacity duration-150"
					enter-from-class="opacity-0"
					enter-to-class="opacity-100"
					leave-active-class="transition-opacity duration-100"
					leave-from-class="opacity-100"
					leave-to-class="opacity-0"
				>
					<p
						v-if="isOpen"
						class="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 whitespace-nowrap"
					>
						{{ section.label }}
					</p>
				</Transition>

				<!-- Divider when collapsed -->
				<div v-if="!isOpen" class="mx-2 h-px bg-gray-100 dark:bg-gray-800 mb-1" />

				<!-- Items -->
				<div class="space-y-0.5">
					<NuxtLink
						v-for="item in section.items"
						:key="item.route"
						:to="item.route"
						:data-tour="(item as { dataTour?: string }).dataTour"
						:class="[
							'group flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-medium transition-colors',
							!isOpen && 'justify-center',
							isActive(item.route)
								? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
								: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200',
						]"
						@mouseenter="!isOpen && showTooltip($event, item.label)"
						@mouseleave="hideTooltip"
					>
						<svg
							:class="[
								'w-5 h-5 flex-shrink-0 transition-colors',
								isActive(item.route)
									? 'text-brand-600 dark:text-brand-400'
									: 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300',
							]"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="1.5"
						>
							<path stroke-linecap="round" stroke-linejoin="round" :d="item.icon" />
						</svg>
						<Transition
							enter-active-class="transition-opacity duration-200"
							enter-from-class="opacity-0"
							enter-to-class="opacity-100"
							leave-active-class="transition-opacity duration-100"
							leave-from-class="opacity-100"
							leave-to-class="opacity-0"
						>
							<span v-if="isOpen" class="whitespace-nowrap">{{ item.label }}</span>
						</Transition>
					</NuxtLink>
				</div>
			</div>
		</nav>

		<!-- User Info Bottom -->
		<div class="border-t border-gray-200 dark:border-gray-700 p-3 flex-shrink-0">
			<div class="flex items-center gap-3 min-w-0">
				<div class="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center flex-shrink-0">
					<span class="text-xs font-semibold text-brand-700 dark:text-brand-300">
						{{ user?.fullName?.charAt(0)?.toUpperCase() ?? '?' }}
					</span>
				</div>
				<Transition
					enter-active-class="transition-opacity duration-200"
					enter-from-class="opacity-0"
					enter-to-class="opacity-100"
					leave-active-class="transition-opacity duration-100"
					leave-from-class="opacity-100"
					leave-to-class="opacity-0"
				>
					<div v-if="isOpen" class="flex-1 min-w-0">
						<p class="text-xs font-medium text-gray-900 dark:text-white truncate">{{ user?.fullName }}</p>
						<p class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ userRoleLabel }}</p>
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
