<script setup lang="ts">
	import { formatDistanceToNow } from 'date-fns';
	import { vi } from 'date-fns/locale';
	import { useDashboard, isCompanyDashboard, isDepartmentDashboard } from '~/composables/useDashboard';
	import { useLeaveRequestService } from '~/services/leave-request.service';
	import type { ActivityItem, ActivityType, HRAnalyticsData, CompanyStats } from '~/types/dashboard.types';
	import DashboardDeptChart from '~/components/modules/dashboard/DashboardDeptChart.vue';
	import DashboardAgeChart from '~/components/modules/dashboard/DashboardAgeChart.vue';
	import DashboardContractChart from '~/components/modules/dashboard/DashboardContractChart.vue';
	import NewHiresModal from '~/components/modules/dashboard/NewHiresModal.vue';

	definePageMeta({ title: 'Dashboard' });

	const { user } = useAuth();
	if (import.meta.client && user.value?.role === 'EMPLOYEE') {
		navigateTo('/');
	}

	const toast = useToast();
	const router = useRouter();
	const { dashboard, loading, fetchDashboard } = useDashboard();
	const leaveService = useLeaveRequestService();

	// ─── Derived state ────────────────────────────────────────────────────────────

	const stats = computed((): (CompanyStats & { departmentName?: string; totalMembersInDept?: number }) | null => {
		const d = dashboard.value;
		if (!d) return null;
		if (isCompanyDashboard(d) || isDepartmentDashboard(d)) return d.stats;
		return null;
	});

	const hrAnalytics = computed((): HRAnalyticsData | null => {
		const d = dashboard.value;
		if (!d) return null;
		if (isCompanyDashboard(d) || isDepartmentDashboard(d)) return d.hrAnalytics;
		return null;
	});

	const recentActivity = computed(() => dashboard.value?.recentActivity ?? []);

	const pendingItems = computed(() =>
		recentActivity.value
			.filter(a => ['PENDING', 'PENDING_L1', 'PENDING_L2', 'PENDING_L3'].includes(a.status))
			.slice(0, 5),
	);

	const pendingTotal = computed(() => {
		const s = stats.value;
		if (!s) return 0;
		return s.pendingLeave + s.pendingOT + s.pendingViolation + s.pendingOnlineWork;
	});

	// ─── Stat card helpers ────────────────────────────────────────────────────────

	const activeCount = computed(() => hrAnalytics.value?.statusBreakdown.find(s => s.status === 'ACTIVE')?.count ?? 0);
	const onLeaveCount = computed(
		() => hrAnalytics.value?.statusBreakdown.find(s => s.status === 'ON_LEAVE')?.count ?? 0,
	);
	const inactiveCount = computed(
		() => hrAnalytics.value?.statusBreakdown.find(s => s.status === 'INACTIVE')?.count ?? 0,
	);

	const checkinRateColor = computed(() => {
		const r = stats.value?.checkedInRate ?? 0;
		if (r >= 80) return 'bg-green-500';
		if (r >= 60) return 'bg-orange-400';
		return 'bg-red-500';
	});

	// ─── Activity helpers ─────────────────────────────────────────────────────────

	const TYPE_BADGE: Record<ActivityType, string> = {
		leave: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
		overtime: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
		violation: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
		online_work: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
		makeup: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
	};

	const TYPE_LABEL: Record<ActivityType, string> = {
		leave: 'Nghỉ phép',
		overtime: 'Tăng ca',
		violation: 'Vi phạm',
		online_work: 'Online',
		makeup: 'Bổ sung',
	};

	const ACTIVITY_URL: Record<ActivityType, string> = {
		leave: '/management/leave',
		overtime: '/management/overtime',
		violation: '/management/violations',
		online_work: '/management/online-work',
		makeup: '/management/attendance',
	};

	function relativeTime(iso: string) {
		return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: vi });
	}

	function initials(name: string) {
		return name
			.split(' ')
			.slice(-2)
			.map(w => w[0])
			.join('')
			.toUpperCase();
	}

	function navigateActivity(item: ActivityItem) {
		router.push(`${ACTIVITY_URL[item.type]}?open_id=${item.targetId}`);
	}

	// ─── New hires modal ──────────────────────────────────────────────────────────

	const showNewHiresModal = ref(false);

	// ─── Quick approve ────────────────────────────────────────────────────────────

	const approvingId = ref<number | null>(null);

	async function quickApprove(item: ActivityItem) {
		if (item.type !== 'leave') {
			navigateActivity(item);
			return;
		}
		approvingId.value = item.targetId;
		try {
			await leaveService.approve(item.targetId);
			toast.success('Đã duyệt đơn nghỉ phép');
			await fetchDashboard();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không thể duyệt đơn');
		} finally {
			approvingId.value = null;
		}
	}

	// ─── Lifecycle ────────────────────────────────────────────────────────────────

	onMounted(fetchDashboard);
</script>

<template>
	<div class="space-y-6">
		<!-- Header -->
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-lg font-bold text-gray-900 dark:text-white">Dashboard</h1>
				<p
					v-if="stats && 'departmentName' in stats && stats.departmentName"
					class="text-sm text-gray-500 dark:text-gray-400 mt-0.5"
				>
					Phòng ban: {{ stats.departmentName }}
				</p>
				<p v-else class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Tổng quan toàn công ty</p>
			</div>
			<button
				:disabled="loading"
				class="w-9 h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
				title="Làm mới"
				@click="fetchDashboard"
			>
				<svg
					:class="['w-4 h-4 text-gray-500', loading && 'animate-spin']"
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
		</div>

		<!-- ─── ROW 1: STAT CARDS ─────────────────────────────────────────────────── -->
		<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
			<!-- Skeleton -->
			<template v-if="loading">
				<div
					v-for="n in 5"
					:key="n"
					class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse"
				>
					<div class="flex items-start justify-between gap-3">
						<div class="flex-1 space-y-2">
							<div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
							<div class="h-7 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
							<div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
						</div>
						<div class="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex-shrink-0"></div>
					</div>
				</div>
			</template>

			<template v-else-if="stats">
				<!-- Card 1: Nhân sự -->
				<NuxtLink
					to="/management/employees"
					class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md hover:border-brand-300 dark:hover:border-brand-700 transition-all group"
				>
					<div class="flex items-start justify-between gap-3">
						<div class="flex-1 min-w-0">
							<p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nhân sự</p>
							<p class="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{{ stats.totalEmployees }}</p>
							<div class="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
								<span class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
									<span class="w-2 h-2 rounded-full bg-green-500 inline-block"></span>{{ activeCount }} làm việc
								</span>
								<span class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
									<span class="w-2 h-2 rounded-full bg-yellow-400 inline-block"></span>{{ onLeaveCount }} nghỉ phép
								</span>
								<span class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
									<span class="w-2 h-2 rounded-full bg-gray-400 inline-block"></span>{{ inactiveCount }} không HĐ
								</span>
							</div>
						</div>
						<div
							class="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0"
						>
							<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
								/>
							</svg>
						</div>
					</div>
				</NuxtLink>

				<!-- Card 2: Có mặt hôm nay -->
				<NuxtLink
					to="/management/attendance"
					class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md hover:border-brand-300 dark:hover:border-brand-700 transition-all group"
				>
					<div class="flex items-start justify-between gap-3">
						<div class="flex-1 min-w-0">
							<p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Có mặt hôm nay</p>
							<p class="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{{ stats.checkedInToday }}</p>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
								{{ stats.checkedInRate }}% · {{ stats.lateToday }} đi muộn
							</p>
							<div class="mt-2 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
								<div
									:class="['h-full rounded-full transition-all', checkinRateColor]"
									:style="{ width: `${Math.min(stats.checkedInRate, 100)}%` }"
								></div>
							</div>
						</div>
						<div
							class="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center flex-shrink-0"
						>
							<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
								/>
							</svg>
						</div>
					</div>
				</NuxtLink>

				<!-- Card 3: Đơn chờ duyệt -->
				<NuxtLink
					to="/management/leave"
					class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-all"
					:class="
						pendingTotal > 0
							? 'hover:border-orange-300 dark:hover:border-orange-700'
							: 'hover:border-brand-300 dark:hover:border-brand-700'
					"
				>
					<div class="flex items-start justify-between gap-3">
						<div class="flex-1 min-w-0">
							<p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Chờ duyệt</p>
							<p
								:class="[
									'mt-1 text-2xl font-bold',
									pendingTotal > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-white',
								]"
							>
								{{ pendingTotal }}
							</p>
							<div class="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
								<span>📅 {{ stats.pendingLeave }}</span>
								<span>⏱ {{ stats.pendingOT }}</span>
								<span>🏠 {{ stats.pendingOnlineWork }}</span>
								<span>⚠ {{ stats.pendingViolation }}</span>
							</div>
						</div>
						<div
							:class="[
								'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
								pendingTotal > 0
									? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
									: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
							]"
						>
							<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
						</div>
					</div>
				</NuxtLink>

				<!-- Card 4: Nhân viên mới -->
				<NuxtLink
					to="/management/employees?sort=joinDate"
					class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md hover:border-brand-300 dark:hover:border-brand-700 transition-all"
				>
					<div class="flex items-start justify-between gap-3">
						<div class="flex-1 min-w-0">
							<p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nhân viên mới</p>
							<p class="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
								{{ hrAnalytics?.newHiresLast30Days ?? 0 }}
							</p>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">trong 30 ngày qua</p>
						</div>
						<div
							class="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center flex-shrink-0"
						>
							<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
								/>
							</svg>
						</div>
					</div>
				</NuxtLink>

				<!-- Card 5: Hợp đồng sắp hết hạn -->
				<NuxtLink
					to="/management/contracts?filter=expiring"
					class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-all"
					:class="
						(hrAnalytics?.expiringContractsNext30Days ?? 0) > 0
							? 'hover:border-red-300 dark:hover:border-red-700'
							: 'hover:border-brand-300 dark:hover:border-brand-700'
					"
				>
					<div class="flex items-start justify-between gap-3">
						<div class="flex-1 min-w-0">
							<p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">HĐ hết hạn</p>
							<p
								:class="[
									'mt-1 text-2xl font-bold',
									(hrAnalytics?.expiringContractsNext30Days ?? 0) > 0
										? 'text-red-600 dark:text-red-400'
										: 'text-gray-400 dark:text-gray-500',
								]"
							>
								{{ hrAnalytics?.expiringContractsNext30Days ?? 0 }}
							</p>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">trong 30 ngày tới</p>
						</div>
						<div
							:class="[
								'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
								(hrAnalytics?.expiringContractsNext30Days ?? 0) > 0
									? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
									: 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500',
							]"
						>
							<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
								/>
							</svg>
						</div>
					</div>
				</NuxtLink>
			</template>
		</div>

		<!-- ─── ROW 2: CHARTS ─────────────────────────────────────────────────────── -->
		<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
			<!-- Dept chart: 50% on xl -->
			<div
				class="xl:col-span-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm"
			>
				<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
					Nhân sự theo phòng ban
				</p>
				<div class="h-52">
					<template v-if="loading">
						<div class="space-y-2.5 animate-pulse">
							<div v-for="n in 5" :key="n" class="flex items-center gap-3">
								<div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24 flex-shrink-0"></div>
								<div class="h-5 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
							</div>
						</div>
					</template>
					<ClientOnly v-else-if="hrAnalytics">
						<DashboardDeptChart :data="hrAnalytics.byDepartment" />
					</ClientOnly>
				</div>
			</div>

			<!-- Age chart: 25% on xl -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
				<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
					Phân bổ độ tuổi
				</p>
				<div class="h-52">
					<template v-if="loading">
						<div class="flex items-end gap-2 h-full animate-pulse pb-2">
							<div
								v-for="n in 5"
								:key="n"
								class="flex-1 bg-gray-200 dark:bg-gray-700 rounded"
								:style="{ height: `${30 + n * 10}%` }"
							></div>
						</div>
					</template>
					<ClientOnly v-else-if="hrAnalytics">
						<DashboardAgeChart
							:age-groups="hrAnalytics.ageGroups"
							:average-age="hrAnalytics.averageAge"
							:age-data-coverage="hrAnalytics.ageDataCoverage"
							:total-employees="stats?.totalEmployees ?? 0"
						/>
					</ClientOnly>
				</div>
			</div>

			<!-- Contract donut: 25% on xl -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
				<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
					Loại hợp đồng
				</p>
				<div class="h-52">
					<template v-if="loading">
						<div class="flex items-center justify-center h-full animate-pulse">
							<div
								class="w-32 h-32 rounded-full border-8 border-gray-200 dark:border-gray-700 border-l-transparent"
							></div>
						</div>
					</template>
					<ClientOnly v-else-if="hrAnalytics">
						<DashboardContractChart :data="hrAnalytics.contractBreakdown" />
					</ClientOnly>
				</div>
			</div>
		</div>

		<!-- ─── ROW 3: LISTS ──────────────────────────────────────────────────────── -->
		<div class="grid grid-cols-1 lg:grid-cols-5 gap-4">
			<!-- Left 60%: Pending requests -->
			<div
				class="lg:col-span-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
			>
				<div class="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
					<h2 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Đơn cần duyệt</h2>
					<NuxtLink to="/management/leave" class="text-xs text-brand-600 dark:text-brand-400 hover:underline">
						Xem tất cả {{ pendingTotal > 0 ? `${pendingTotal} đơn` : '' }} →
					</NuxtLink>
				</div>

				<!-- Skeleton -->
				<div v-if="loading" class="divide-y divide-gray-100 dark:divide-gray-800">
					<div v-for="n in 4" :key="n" class="px-5 py-3.5 animate-pulse flex items-center gap-3">
						<div class="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0"></div>
						<div class="flex-1 space-y-1.5">
							<div class="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
							<div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
						</div>
						<div class="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
						<div class="h-7 w-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
					</div>
				</div>

				<template v-else-if="pendingItems.length">
					<div class="divide-y divide-gray-100 dark:divide-gray-800">
						<div
							v-for="item in pendingItems"
							:key="item.targetId"
							class="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
						>
							<!-- Avatar initials -->
							<div
								class="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 flex items-center justify-center text-xs font-bold flex-shrink-0"
							>
								{{ initials(item.employeeName) }}
							</div>
							<!-- Info -->
							<div class="flex-1 min-w-0">
								<p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ item.employeeName }}</p>
								<div class="flex items-center gap-2 mt-0.5">
									<span :class="['text-xs px-1.5 py-0.5 rounded font-medium', TYPE_BADGE[item.type]]">
										{{ TYPE_LABEL[item.type] }}
									</span>
									<span class="text-xs text-gray-400 dark:text-gray-500">{{ relativeTime(item.createdAt) }}</span>
								</div>
							</div>
							<!-- Quick action -->
							<button
								:disabled="approvingId === item.targetId"
								class="flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50"
								:class="
									item.type === 'leave'
										? 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
										: 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
								"
								@click="quickApprove(item)"
							>
								{{ item.type === 'leave' ? (approvingId === item.targetId ? '...' : 'Duyệt') : 'Xem' }}
							</button>
						</div>
					</div>
				</template>

				<div v-else-if="!loading" class="flex flex-col items-center justify-center py-12 text-gray-400">
					<svg class="w-10 h-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<p class="text-sm">Không có đơn nào chờ duyệt</p>
				</div>
			</div>

			<!-- Right 40%: New hires -->
			<div
				class="lg:col-span-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
			>
				<div class="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
					<h2 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Nhân viên mới (30 ngày)</h2>
					<span class="text-xs font-medium text-brand-600 dark:text-brand-400">
						{{ hrAnalytics?.newHiresLast30Days ?? 0 }} người
					</span>
				</div>

				<!-- Skeleton -->
				<div v-if="loading" class="p-5 space-y-3 animate-pulse">
					<div v-for="n in 4" :key="n" class="flex items-center gap-3">
						<div class="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0"></div>
						<div class="flex-1 space-y-1.5">
							<div class="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-28"></div>
							<div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
						</div>
					</div>
				</div>

				<template v-else-if="(hrAnalytics?.newHiresLast30Days ?? 0) > 0">
					<div class="p-5 flex flex-col gap-3">
						<div
							class="flex items-center gap-3 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50"
						>
							<div
								class="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0"
							>
								<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
									/>
								</svg>
							</div>
							<div>
								<p class="text-sm font-semibold text-indigo-800 dark:text-indigo-300">
									{{ hrAnalytics!.newHiresLast30Days }} nhân viên mới
								</p>
								<p class="text-xs text-indigo-600 dark:text-indigo-400">đã gia nhập trong 30 ngày qua</p>
							</div>
						</div>
						<button
							class="flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline transition-colors"
							@click="showNewHiresModal = true"
						>
							Xem danh sách nhân viên mới →
						</button>
					</div>
				</template>

				<div v-else-if="!loading" class="flex flex-col items-center justify-center py-12 text-gray-400">
					<svg class="w-10 h-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
						/>
					</svg>
					<p class="text-sm">Chưa có nhân viên mới</p>
					<NuxtLink
						to="/management/employees/new"
						class="text-xs text-brand-600 dark:text-brand-400 hover:underline mt-1"
					>
						Thêm nhân viên →
					</NuxtLink>
				</div>
			</div>
		</div>

		<!-- New hires modal -->
		<NewHiresModal :open="showNewHiresModal" @close="showNewHiresModal = false" />
	</div>
</template>
