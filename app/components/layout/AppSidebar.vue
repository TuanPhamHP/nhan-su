<script setup lang="ts">
import type { UserRole } from '~/types/auth.types';

interface NavItem {
	label: string;
	route: string;
	icon: string;
	roles: UserRole[];
}

const { isOpen } = useSidebar();
const { user } = useAuth();
const route = useRoute();

const navItems: NavItem[] = [
	{
		label: 'Dashboard',
		route: '/',
		icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
		roles: ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'],
	},
	{
		label: 'Nhân viên',
		route: '/employees',
		icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
		roles: ['ADMIN', 'HR'],
	},
	{
		label: 'Phòng ban',
		route: '/departments',
		icon: 'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21',
		roles: ['ADMIN', 'HR'],
	},
	{
		label: 'Chấm công',
		route: '/attendance',
		icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
		roles: ['ADMIN', 'HR', 'MANAGER'],
	},
	{
		label: 'Nghỉ phép',
		route: '/leave',
		icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
		roles: ['ADMIN', 'HR', 'MANAGER'],
	},
	{
		label: 'Báo cáo',
		route: '/reports',
		icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
		roles: ['ADMIN', 'HR', 'MANAGER'],
	},
	{
		label: 'Bảng lương',
		route: '/payroll',
		icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
		roles: ['ADMIN', 'HR'],
	},
	{
		label: 'Phân quyền',
		route: '/roles',
		icon: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
		roles: ['ADMIN'],
	},
	{
		label: 'Cài đặt',
		route: '/settings',
		icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
		roles: ['ADMIN'],
	},
];

const visibleItems = computed(() =>
	user.value ? navItems.filter(item => item.roles.includes(user.value!.role)) : [],
);

function isActive(itemRoute: string) {
	if (itemRoute === '/') return route.path === '/';
	return route.path.startsWith(itemRoute);
}
</script>

<template>
	<aside
		:class="[
			'flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700',
			'transition-[width] duration-300 ease-in-out overflow-hidden',
			isOpen ? 'w-64' : 'w-16',
		]"
	>
		<!-- Logo -->
		<div class="flex items-center h-16 px-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
			<div class="flex items-center gap-3 min-w-0">
				<div class="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
					<svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
					</svg>
				</div>
				<Transition
					enter-active-class="transition-opacity duration-200"
					enter-from-class="opacity-0"
					enter-to-class="opacity-100"
					leave-active-class="transition-opacity duration-100"
					leave-from-class="opacity-100"
					leave-to-class="opacity-0"
				>
					<span v-if="isOpen" class="text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">
						HR System
					</span>
				</Transition>
			</div>
		</div>

		<!-- Nav Items -->
		<nav class="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
			<NuxtLink
				v-for="item in visibleItems"
				:key="item.route"
				:to="item.route"
				:title="!isOpen ? item.label : undefined"
				:class="[
					'group flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-medium transition-colors',
					isActive(item.route)
						? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
						: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200',
				]"
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
						<p class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ user?.role }}</p>
					</div>
				</Transition>
			</div>
		</div>
	</aside>
</template>
