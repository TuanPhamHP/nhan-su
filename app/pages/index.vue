<script setup lang="ts">
	import { format } from 'date-fns';
	import { vi } from 'date-fns/locale';
	import { formatRelativeTime } from '~/utils/date';
	import { useDashboard, isCompanyDashboard, isDepartmentDashboard, isMyDashboard } from '~/composables/useDashboard';
	import type { ActivityItem, ActivityType } from '~/types/dashboard.types';

	const { user } = useAuth();
	const router = useRouter();
	const { dashboard, loading, error, fetchDashboard } = useDashboard();

	// ─── Greeting ────────────────────────────────────────────────────────────────

	const now = new Date();

	const firstName = computed(() => user.value?.fullName?.split(' ').slice(-1)[0] ?? '');

	const greeting = computed(() => {
		const h = now.getHours();
		const name = firstName.value;
		if (h >= 5 && h < 11) return `Chào buổi sáng, ${name}! ☀️`;
		if (h >= 11 && h < 13) return `Chào buổi trưa, ${name}! 🌤`;
		if (h >= 13 && h < 18) return `Chào buổi chiều, ${name}! 👋`;
		if (h >= 18) return `Chào buổi tối, ${name}! 🌙`;
		return `Làm việc muộn vậy, ${name}? 🌙`;
	});

	const todayFormatted = computed(() => format(now, "EEEE, dd 'tháng' MM, yyyy", { locale: vi }));

	// ─── Quotes ──────────────────────────────────────────────────────────────────

	const quotes = [
		{ text: 'Mỗi ngày là một cơ hội mới để trở nên tốt hơn.', author: 'Khuyết danh' },
		{
			text: 'Thành công không phải là chìa khóa của hạnh phúc. Hạnh phúc mới là chìa khóa của thành công.',
			author: 'Albert Schweitzer',
		},
		{ text: 'Hành trình ngàn dặm bắt đầu từ một bước chân.', author: 'Lão Tử' },
		{ text: 'Không có thang máy dẫn đến thành công — bạn phải đi cầu thang.', author: 'Zig Ziglar' },
		{ text: 'Điều duy nhất ngăn bạn thực hiện ước mơ là nỗi sợ rằng bạn sẽ thất bại.', author: 'Paulo Coelho' },
		{ text: 'Làm việc chăm chỉ trong im lặng và để thành công tạo ra tiếng ồn.', author: 'Frank Ocean' },
		{
			text: 'Người thành công không phải là người chưa bao giờ thất bại, mà là người biết đứng dậy sau mỗi lần vấp ngã.',
			author: 'Vince Lombardi',
		},
		{ text: 'Sự kiên nhẫn là đồng hành của trí tuệ.', author: 'Saint Augustine' },
		{ text: 'Đừng đếm những ngày đi qua, hãy làm cho mỗi ngày trở nên đáng nhớ.', author: 'Muhammad Ali' },
		{ text: 'Bí quyết thành công là bắt đầu.', author: 'Mark Twain' },
	];

	const todayQuote = computed(() => {
		const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
		return quotes[dayOfYear % quotes.length];
	});

	// ─── Stat cards ──────────────────────────────────────────────────────────────

	interface StatCard {
		label: string;
		value: string | number;
		sub: string;
		iconPath: string;
		iconBg: string;
		valueCls?: string;
	}

	const ICONS = {
		users:
			'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
		checkCircle:
			'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
		calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
		building:
			'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
		clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
		alert:
			'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
		reports:
			'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
		addUser: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
	};

	const statCards = computed((): StatCard[] => {
		const d = dashboard.value;
		if (!d) return [];

		if (isMyDashboard(d)) {
			const s = d.stats;
			let statusValue = 'Chưa check-in';
			let statusCls = 'text-red-600 dark:text-red-400';
			if (s.checkedOutToday) {
				statusValue = 'Hoàn thành';
				statusCls = 'text-green-600 dark:text-green-400';
			} else if (s.isCheckedInToday) {
				statusValue = 'Đã check-in';
				statusCls = 'text-green-600 dark:text-green-400';
			}

			return [
				{
					label: 'Trạng thái hôm nay',
					value: statusValue,
					sub: s.isCheckedInToday ? (s.checkedOutToday ? 'Đã check-out' : 'Chưa check-out') : 'Hôm nay chưa điểm danh',
					iconPath: ICONS.checkCircle,
					iconBg: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
					valueCls: `text-xl font-bold ${statusCls}`,
				},
				{
					label: 'Phép còn lại',
					value: s.leaveBalance != null ? `${s.leaveBalance.remainingDays} ngày` : '—',
					sub:
						s.leaveBalance != null
							? `đã dùng ${s.leaveBalance.usedDays}/${s.leaveBalance.totalDays} ngày`
							: 'Chưa khởi tạo phép năm',
					iconPath: ICONS.calendar,
					iconBg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
				},
				{
					label: 'Đơn đang chờ',
					value: s.pendingLeaveRequests + s.pendingOT,
					sub: `${s.pendingLeaveRequests} nghỉ phép · ${s.pendingOT} tăng ca`,
					iconPath: ICONS.clock,
					iconBg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
				},
				{
					label: 'Đi muộn tháng này',
					value: s.lateCountThisMonth,
					sub: `${s.absentCountThisMonth} lần vắng mặt`,
					iconPath: ICONS.alert,
					iconBg: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
				},
			];
		}

		if (isDepartmentDashboard(d)) {
			const s = d.stats;
			const pendingTotal = s.pendingLeave + s.pendingOT + s.pendingViolation + s.pendingOnlineWork;
			return [
				{
					label: 'Nhân viên phòng ban',
					value: s.totalMembersInDept,
					sub: s.departmentName,
					iconPath: ICONS.users,
					iconBg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
				},
				{
					label: 'Có mặt hôm nay',
					value: s.checkedInToday,
					sub: `${s.checkedInRate}% đã check-in`,
					iconPath: ICONS.checkCircle,
					iconBg: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
				},
				{
					label: 'Đơn chờ tôi duyệt',
					value: pendingTotal,
					sub: `${s.pendingLeave} phép · ${s.pendingOT} OT · ${s.pendingViolation} vi phạm`,
					iconPath: ICONS.calendar,
					iconBg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
				},
				{
					label: 'Đi muộn hôm nay',
					value: s.lateToday,
					sub: `${s.absentToday} vắng mặt`,
					iconPath: ICONS.clock,
					iconBg: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
				},
			];
		}

		// CompanyDashboard — ADMIN / HR / CHIEF
		const s = d.stats;
		const pendingTotal = s.pendingLeave + s.pendingOT + s.pendingViolation + s.pendingOnlineWork;
		return [
			{
				label: 'Tổng nhân viên',
				value: s.totalEmployees,
				sub: 'đang hoạt động',
				iconPath: ICONS.users,
				iconBg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
			},
			{
				label: 'Chấm công hôm nay',
				value: s.checkedInToday,
				sub: `${s.checkedInRate}% đã check-in`,
				iconPath: ICONS.checkCircle,
				iconBg: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
			},
			{
				label: 'Đơn chờ duyệt',
				value: pendingTotal,
				sub: `${s.pendingLeave} phép · ${s.pendingOT} OT · ${s.pendingViolation} vi phạm`,
				iconPath: ICONS.calendar,
				iconBg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
			},
			{
				label: 'Phòng ban',
				value: s.totalDepartments,
				sub: 'đang hoạt động',
				iconPath: ICONS.building,
				iconBg: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
			},
		];
	});

	// ─── Quick access ─────────────────────────────────────────────────────────────

	interface QuickAction {
		label: string;
		route: string;
		iconPath: string;
	}

	const quickActions = computed((): QuickAction[] => {
		const role = user.value?.role;
		if (!role) return [];

		if (role === 'EMPLOYEE') {
			return [
				{ label: 'Xem lịch sử chấm công', route: '/attendance', iconPath: ICONS.checkCircle },
				{ label: 'Xin nghỉ phép', route: '/leave/create', iconPath: ICONS.calendar },
				{ label: 'Đăng ký tăng ca', route: '/overtime/create', iconPath: ICONS.clock },
				{ label: 'Hồ sơ cá nhân', route: '/profile', iconPath: ICONS.users },
			];
		}

		if (role === 'MANAGER') {
			return [
				{ label: 'Xem chấm công phòng ban', route: '/attendance', iconPath: ICONS.checkCircle },
				{ label: 'Đơn nghỉ phép', route: '/leave', iconPath: ICONS.calendar },
				{ label: 'Phiếu vi phạm', route: '/violations', iconPath: ICONS.alert },
				{ label: 'Xem báo cáo', route: '/reports', iconPath: ICONS.reports },
			];
		}

		// ADMIN, HR, CHIEF
		return [
			{ label: 'Thêm nhân viên', route: '/employees/new', iconPath: ICONS.addUser },
			{ label: 'Xem chấm công', route: '/attendance', iconPath: ICONS.checkCircle },
			{ label: 'Đơn nghỉ phép', route: '/leave', iconPath: ICONS.calendar },
			{ label: 'Xem báo cáo', route: '/reports', iconPath: ICONS.reports },
		];
	});

	// ─── Activity helpers ─────────────────────────────────────────────────────────

	const TYPE_CLS: Record<ActivityType, string> = {
		leave: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
		overtime: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
		violation: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
		online_work: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
		makeup: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
	};

	function activityTypeCls(type: ActivityType): string {
		return TYPE_CLS[type] ?? 'bg-gray-100 text-gray-700';
	}

	function statusBadgeCls(status: string): string {
		if (['APPROVED', 'COMPLETED'].includes(status))
			return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
		if (status === 'REJECTED') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
		if (['PENDING', 'PENDING_L1', 'PENDING_L2', 'PENDING_L3'].includes(status))
			return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
		return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
	}

	const recentActivity = computed(() => dashboard.value?.recentActivity ?? []);

	function navigateActivity(item: ActivityItem) {
		switch (item.type) {
			case 'leave':
				router.push(`/leave?open_id=${item.targetId}`);
				break;

			default:
				break;
		}
		// router.push(targetUrl);
	}

	// ─── Lifecycle ────────────────────────────────────────────────────────────────

	onMounted(fetchDashboard);
</script>

<template>
	<div class="space-y-6">
		<!-- Header card -->
		<div
			class="bg-gradient-to-br from-brand-600 to-brand-800 dark:from-brand-800 dark:to-brand-950 rounded-2xl p-6 text-white shadow-lg"
		>
			<div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
				<div>
					<p class="text-brand-200 text-sm mb-1 capitalize">{{ todayFormatted }}</p>
					<h1 class="text-2xl font-bold mb-1">{{ greeting }}</h1>
					<p class="text-brand-200 text-sm">{{ user?.employeeCode }} · {{ user?.role }}</p>
				</div>
				<div class="flex items-center gap-2 flex-shrink-0">
					<button
						:disabled="loading"
						class="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors disabled:opacity-50"
						title="Làm mới dữ liệu"
						@click="fetchDashboard"
					>
						<svg
							:class="['w-4 h-4 text-white transition-transform', loading && 'animate-spin']"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/>
						</svg>
					</button>
					<div class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
						<svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
							/>
						</svg>
					</div>
				</div>
			</div>

			<!-- Quote -->
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

		<!-- Error state -->
		<div
			v-if="error && !loading"
			class="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800 p-4 flex items-center gap-3"
		>
			<svg
				class="w-5 h-5 text-red-500 flex-shrink-0"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="1.5"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
				/>
			</svg>
			<p class="text-sm text-red-700 dark:text-red-400">{{ error }}</p>
		</div>

		<!-- Stat cards -->
		<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
			<!-- Skeleton -->
			<template v-if="loading">
				<div
					v-for="n in 4"
					:key="n"
					class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm animate-pulse"
				>
					<div class="flex items-start justify-between">
						<div class="flex-1">
							<div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-3"></div>
							<div class="h-7 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-2"></div>
							<div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
						</div>
						<div class="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex-shrink-0"></div>
					</div>
				</div>
			</template>

			<!-- Actual cards -->
			<template v-else-if="statCards.length">
				<div
					v-for="card in statCards"
					:key="card.label"
					class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm"
				>
					<div class="flex items-start justify-between gap-3">
						<div class="flex-1 min-w-0">
							<p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								{{ card.label }}
							</p>
							<p :class="['mt-1 font-bold', card.valueCls ?? 'text-2xl text-gray-900 dark:text-white']">
								{{ card.value }}
							</p>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{{ card.sub }}</p>
						</div>
						<div :class="['w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', card.iconBg]">
							<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
								<path stroke-linecap="round" stroke-linejoin="round" :d="card.iconPath" />
							</svg>
						</div>
					</div>
				</div>
			</template>
		</div>

		<!-- Quick access -->
		<div v-if="quickActions.length">
			<h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Truy cập nhanh</h2>
			<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
				<NuxtLink
					v-for="action in quickActions"
					:key="action.route"
					:to="action.route"
					class="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-sm transition-all group"
				>
					<div
						class="w-10 h-10 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center group-hover:bg-brand-100 dark:group-hover:bg-brand-900/50 transition-colors"
					>
						<svg
							class="w-5 h-5 text-brand-600 dark:text-brand-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="1.5"
						>
							<path stroke-linecap="round" stroke-linejoin="round" :d="action.iconPath" />
						</svg>
					</div>
					<span class="text-xs font-medium text-gray-700 dark:text-gray-300 text-center leading-tight">
						{{ action.label }}
					</span>
				</NuxtLink>
			</div>
		</div>

		<!-- Recent activity -->
		<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
			<div class="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
				<h2 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Hoạt động gần đây</h2>
			</div>

			<!-- Skeleton -->
			<div v-if="loading" class="divide-y divide-gray-100 dark:divide-gray-700">
				<div v-for="n in 4" :key="n" class="px-5 py-4 animate-pulse">
					<div class="flex items-center gap-3">
						<div class="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0"></div>
						<div class="flex-1">
							<div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-36 mb-1.5"></div>
							<div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
						</div>
						<div class="flex flex-col items-end gap-1.5 flex-shrink-0">
							<div class="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
							<div class="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
						</div>
					</div>
				</div>
			</div>

			<!-- Activity list -->
			<div v-else-if="recentActivity.length" class="divide-y divide-gray-100 dark:divide-gray-700">
				<button
					v-for="item in recentActivity"
					:key="item.id"
					class="w-full px-5 py-4 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
					@click="navigateActivity(item)"
				>
					<!-- Type badge -->
					<span
						:class="[
							'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 mt-0.5',
							activityTypeCls(item.type),
						]"
					>
						{{ item.typeLabel }}
					</span>

					<!-- Content -->
					<div class="flex-1 min-w-0">
						<p class="text-sm font-medium text-gray-900 dark:text-white truncate">
							<span class="text-gray-500 dark:text-gray-400 mr-1">{{ item.employeeCode }}</span
							>{{ item.employeeName }}
						</p>
						<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ item.action }}</p>
					</div>

					<!-- Status + time -->
					<div class="flex flex-col items-end gap-1 flex-shrink-0">
						<span
							:class="[
								'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
								statusBadgeCls(item.status),
							]"
						>
							{{ item.statusLabel }}
						</span>
						<span class="text-xs text-gray-400 dark:text-gray-500">{{ formatRelativeTime(item.createdAt) }}</span>
					</div>
				</button>
			</div>

			<!-- Empty state -->
			<div v-else class="flex flex-col items-center justify-center py-12 text-center">
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
