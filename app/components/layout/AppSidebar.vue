<script setup lang="ts">
	import type { UserRole } from '~/types/auth.types';
	import { isManagementRole } from '~/utils/role';

	interface NavItem {
		label: string;
		route: string;
		icon: string;
		/** Explicit role allowlist. Bỏ qua nếu dùng `management: true`. */
		roles?: UserRole[];
		/** Hiện cho tất cả role !== 'EMPLOYEE'. */
		management?: boolean;
		dataTour?: string;
		matchQuery?: Record<string, string>;
	}

	interface NavSection {
		label: string;
		items: NavItem[];
	}

	const { isOpen, close } = useSidebar();
	const { user } = useAuth();
	const route = useRoute();
	const metaDataStore = useMetaDataStore();
	const userRoleLabel = computed(() => (user.value ? metaDataStore.labelForRole(user.value.role) : ''));

	watch(
		() => route.path,
		() => {
			if (import.meta.client && window.innerWidth < 1024) close();
		},
	);
	const { isDark } = useColorMode();

	const navSections: NavSection[] = [
		{
			label: 'Tổng quan',
			items: [
				{
					label: 'Dashboard',
					route: '/management',
					icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
					management: true,
				},
				{
					label: 'Dashboard',
					route: '/',
					icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
					roles: ['EMPLOYEE'],
				},
			],
		},
		{
			label: 'Nhân sự',
			items: [
				{
					label: 'Nhân viên',
					route: '/management/employees',
					icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
					management: true,
				},
				{
					label: 'Phòng ban',
					route: '/management/departments',
					icon: 'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21',
					management: true,
				},
				{
					label: 'Chức vụ',
					route: '/management/positions',
					icon: 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3zM6 6h.008v.008H6V6z',
					roles: ['ADMIN', 'HR'],
				},
				{
					label: 'Hợp đồng',
					route: '/management/contracts',
					icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
					roles: ['ADMIN', 'HR', 'DIRECTOR'],
					management: true,
				},
			],
		},
		{
			label: 'Chấm công',
			items: [
				{
					label: 'Chấm công',
					route: '/management/attendance',
					icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
					management: true,
				},
			],
		},
		{
			label: 'Đơn từ',
			items: [
				{
					label: 'Nghỉ phép',
					route: '/management/leave',
					icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
					management: true,
				},
				{
					label: 'Làm thêm giờ',
					route: '/management/overtime',
					icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
					management: true,
				},
				{
					label: 'Làm online',
					route: '/management/online-work',
					icon: 'M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25',
					management: true,
				},
				{
					label: 'Vi phạm chuyên cần',
					route: '/management/violations',
					icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
					management: true,
				},
				{
					label: 'Bù công',
					route: '/management/makeup-attendance',
					icon: 'M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z',
					management: true,
				},
				{
					label: 'Công tác',
					route: '/management/business-trips',
					icon: 'M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5',
					management: true,
					dataTour: 'nav-business-trips',
				},
			],
		},
		{
			label: 'Phân tích',
			items: [
				{
					label: 'Báo cáo',
					route: '/management/reports',
					icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
					management: true,
				},
				{
					label: 'Bảng lương',
					route: '/management/payroll',
					icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
					roles: ['ADMIN', 'HR'],
				},
			],
		},
		{
			label: 'Hệ thống',
			items: [
				{
					label: 'Phân quyền',
					route: '/management/roles',
					icon: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
					roles: ['ADMIN'],
				},
				{
					label: 'Cài đặt',
					route: '/management/settings',
					icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
					roles: ['ADMIN', 'HR'],
				},
				{
					label: 'Logs',
					route: '/management/system-logs',
					icon: 'M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776',
					roles: ['ADMIN'],
				},
				{
					label: 'Test Notification',
					route: '/management/notifications/test',
					icon: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0M10.5 8.25h3l-3 4.5h3',
					roles: ['ADMIN'],
				},
			],
		},
	];

	const visibleSections = computed(() => {
		if (!user.value) return [];
		return navSections
			.map(section => ({
				...section,
				items: section.items.filter(item => {
					if (item.roles) return item.roles.includes(user.value!.role);
					if (item.management) return isManagementRole(user.value!.role);
					return true;
				}),
			}))
			.filter(section => section.items.length > 0);
	});

	function itemPath(itemRoute: string) {
		const idx = itemRoute.indexOf('?');
		return idx >= 0 ? itemRoute.slice(0, idx) : itemRoute;
	}

	function isActive(item: NavItem) {
		const path = itemPath(item.route);
		if (path === '/') return route.path === '/';
		if (route.path === path) {
			// If item is scoped to a query filter, require the query to match
			if (item.matchQuery) {
				return Object.entries(item.matchQuery).every(([k, v]) => route.query[k] === v);
			}
			// If another sibling requires a query and this one doesn't, this one is active only when no scoped query matches
			const siblings = navSections
				.flatMap(s => s.items)
				.filter(i => i !== item && itemPath(i.route) === path && i.matchQuery);
			if (siblings.length > 0) {
				const anyScopedActive = siblings.some(s =>
					Object.entries(s.matchQuery!).every(([k, v]) => route.query[k] === v),
				);
				return !anyScopedActive;
			}
			return true;
		}
		if (!route.path.startsWith(path + '/')) return false;
		const allPaths = navSections.flatMap(s => s.items.map(i => itemPath(i.route)));
		return !allPaths.some(
			p => p !== path && p.startsWith(path + '/') && (route.path === p || route.path.startsWith(p + '/')),
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
			<div v-for="section in visibleSections" :key="section.label">
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
						:data-tour="item.dataTour"
						:class="[
							'group flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-medium transition-colors',
							!isOpen && 'justify-center',
							isActive(item)
								? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
								: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200',
						]"
						@mouseenter="!isOpen && showTooltip($event, item.label)"
						@mouseleave="hideTooltip"
					>
						<svg
							:class="[
								'w-5 h-5 flex-shrink-0 transition-colors',
								isActive(item)
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
