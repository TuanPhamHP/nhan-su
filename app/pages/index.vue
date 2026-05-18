<script setup lang="ts">
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const { user } = useAuth();

const now = new Date();

const greeting = computed(() => {
	const hour = now.getHours();
	if (hour < 12) return 'Chào buổi sáng';
	if (hour < 18) return 'Chào buổi chiều';
	return 'Chào buổi tối';
});

const todayFormatted = computed(() =>
	format(now, "EEEE, dd 'tháng' MM, yyyy", { locale: vi }),
);

const quotes = [
	{ text: 'Mỗi ngày là một cơ hội mới để trở nên tốt hơn hơn.', author: 'Khuyết danh' },
	{ text: 'Thành công không phải là chìa khóa của hạnh phúc. Hạnh phúc mới là chìa khóa của thành công.', author: 'Albert Schweitzer' },
	{ text: 'Hành trình ngàn dặm bắt đầu từ một bước chân.', author: 'Lão Tử' },
	{ text: 'Không có thang máy dẫn đến thành công — bạn phải đi cầu thang.', author: 'Zig Ziglar' },
	{ text: 'Điều duy nhất ngăn bạn thực hiện ước mơ là nỗi sợ rằng bạn sẽ thất bại.', author: 'Paulo Coelho' },
	{ text: 'Làm việc chăm chỉ trong im lặng và để thành công tạo ra tiếng ồn.', author: 'Frank Ocean' },
	{ text: 'Người thành công không phải là người chưa bao giờ thất bại, mà là người biết đứng dậy sau mỗi lần vấp ngã.', author: 'Vince Lombardi' },
];

const todayQuote = computed(() => {
	const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
	return quotes[dayOfYear % quotes.length];
});

interface StatCard {
	label: string;
	value: string;
	change: string;
	changeType: 'up' | 'down' | 'neutral';
	icon: string;
	iconBg: string;
	roles: string[];
}

const statCards: StatCard[] = [
	{
		label: 'Tổng nhân viên',
		value: '—',
		change: 'đang hoạt động',
		changeType: 'neutral',
		icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
		iconBg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
		roles: ['ADMIN', 'HR'],
	},
	{
		label: 'Chấm công hôm nay',
		value: '—',
		change: 'đã check-in',
		changeType: 'neutral',
		icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
		iconBg: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
		roles: ['ADMIN', 'HR', 'MANAGER'],
	},
	{
		label: 'Đơn nghỉ phép',
		value: '—',
		change: 'đang chờ duyệt',
		changeType: 'neutral',
		icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
		iconBg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
		roles: ['ADMIN', 'HR', 'MANAGER'],
	},
	{
		label: 'Phòng ban',
		value: '—',
		change: 'đang hoạt động',
		changeType: 'neutral',
		icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
		iconBg: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
		roles: ['ADMIN', 'HR'],
	},
];

const visibleStats = computed(() =>
	user.value ? statCards.filter(c => c.roles.includes(user.value!.role)) : [],
);

const quickActions = computed(() => {
	const role = user.value?.role;
	const actions = [];
	if (role === 'ADMIN' || role === 'HR') {
		actions.push({ label: 'Thêm nhân viên', route: '/employees/new', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' });
	}
	if (role === 'ADMIN' || role === 'HR' || role === 'MANAGER') {
		actions.push({ label: 'Xem chấm công', route: '/attendance', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' });
		actions.push({ label: 'Đơn nghỉ phép', route: '/leave', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' });
	}
	if (role === 'ADMIN' || role === 'HR') {
		actions.push({ label: 'Xem báo cáo', route: '/reports', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' });
	}
	return actions;
});
</script>

<template>
	<div class="space-y-6">
		<!-- Greeting + Quote card -->
		<div class="bg-gradient-to-br from-brand-600 to-brand-800 dark:from-brand-800 dark:to-brand-950 rounded-2xl p-6 text-white shadow-lg">
			<div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
				<div>
					<p class="text-brand-200 text-sm mb-1 capitalize">{{ todayFormatted }}</p>
					<h1 class="text-2xl font-bold mb-1">
						{{ greeting }}, {{ user?.fullName?.split(' ').slice(-1)[0] }}! 👋
					</h1>
					<p class="text-brand-200 text-sm">{{ user?.employeeCode }} · {{ user?.role }}</p>
				</div>
				<div class="flex-shrink-0">
					<div class="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
						<svg class="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
						</svg>
					</div>
				</div>
			</div>

			<!-- Divider -->
			<div class="mt-5 pt-5 border-t border-white/20">
				<div class="flex items-start gap-3">
					<span class="text-3xl font-serif text-brand-300 leading-none mt-1">"</span>
					<div>
						<p class="text-sm text-white/90 leading-relaxed italic">{{ todayQuote.text }}</p>
						<p class="text-xs text-brand-300 mt-2">— {{ todayQuote.author }}</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Stats grid -->
		<div v-if="visibleStats.length" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
			<div
				v-for="stat in visibleStats"
				:key="stat.label"
				class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm"
			>
				<div class="flex items-start justify-between">
					<div>
						<p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
							{{ stat.label }}
						</p>
						<p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{ stat.value }}</p>
						<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ stat.change }}</p>
					</div>
					<div :class="['w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', stat.iconBg]">
						<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" :d="stat.icon" />
						</svg>
					</div>
				</div>
			</div>
		</div>

		<!-- Quick actions -->
		<div v-if="quickActions.length">
			<h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Truy cập nhanh</h2>
			<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
				<NuxtLink
					v-for="action in quickActions"
					:key="action.route"
					:to="action.route"
					class="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-sm transition-all group"
				>
					<div class="w-10 h-10 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center group-hover:bg-brand-100 dark:group-hover:bg-brand-900/50 transition-colors">
						<svg class="w-5 h-5 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" :d="action.icon" />
						</svg>
					</div>
					<span class="text-xs font-medium text-gray-700 dark:text-gray-300 text-center leading-tight">
						{{ action.label }}
					</span>
				</NuxtLink>
			</div>
		</div>

		<!-- Placeholder recent activity -->
		<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
			<div class="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
				<h2 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Hoạt động gần đây</h2>
			</div>
			<div class="flex flex-col items-center justify-center py-12 text-center">
				<div class="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
					<svg class="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</div>
				<p class="text-sm text-gray-500 dark:text-gray-400">Chưa có hoạt động nào gần đây</p>
			</div>
		</div>
	</div>
</template>
