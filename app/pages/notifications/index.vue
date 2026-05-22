<script setup lang="ts">
	import { format, parseISO } from 'date-fns';
	import { useNotificationService } from '~/services';
	import type { NotificationCategory, NotificationResponse, NotificationListMeta, QueryNotificationsParams } from '~/types/notification.types';

	definePageMeta({ title: 'Thông báo' });

	const router = useRouter();
	const toast = useToast();
	const { unreadCount, markRead, markAllRead, deleteAll } = useNotifications();
	const notifService = useNotificationService();

	// ─── Tabs ─────────────────────────────────────────────────────────────────────
	type Tab = 'ALL' | NotificationCategory;
	const activeTab = ref<Tab>('ALL');

	const tabs: { key: Tab; label: string }[] = [
		{ key: 'ALL', label: 'Tất cả' },
		{ key: 'EVENT', label: 'Sự kiện' },
		{ key: 'ATTENDANCE', label: 'Chấm công' },
		{ key: 'LEAVE', label: 'Xin nghỉ' },
	];

	function tabUnreadCount(tab: Tab): number {
		if (tab === 'ALL') return unreadCount.value.total;
		if (tab === 'EVENT') return unreadCount.value.event;
		if (tab === 'ATTENDANCE') return unreadCount.value.attendance;
		if (tab === 'LEAVE') return unreadCount.value.leave;
		return 0;
	}

	// ─── Data ─────────────────────────────────────────────────────────────────────
	const notifications = ref<NotificationResponse[]>([]);
	const meta = ref<NotificationListMeta | null>(null);
	const loading = ref(false);
	const page = ref(1);
	const limit = 20;

	async function load() {
		loading.value = true;
		try {
			const params: QueryNotificationsParams = {
				page: page.value,
				limit,
				category: activeTab.value === 'ALL' ? undefined : activeTab.value,
			};
			const res = await notifService.findAll(params);
			notifications.value = res.data;
			meta.value = res.meta;
			// sync global bell badge
			unreadCount.value.total = res.meta.unreadCount;
		} catch {
			toast.error('Không thể tải thông báo');
		} finally {
			loading.value = false;
		}
	}

	watch(activeTab, () => {
		page.value = 1;
		load();
	});

	watch(page, load);

	onMounted(load);

	// ─── Selection ────────────────────────────────────────────────────────────────
	const selected = ref<Set<number>>(new Set());

	const allSelected = computed(
		() => notifications.value.length > 0 && notifications.value.every(n => selected.value.has(n.id)),
	);

	function toggleSelectAll() {
		if (allSelected.value) {
			selected.value.clear();
		} else {
			notifications.value.forEach(n => selected.value.add(n.id));
		}
		selected.value = new Set(selected.value);
	}

	function toggleSelect(id: number) {
		if (selected.value.has(id)) {
			selected.value.delete(id);
		} else {
			selected.value.add(id);
		}
		selected.value = new Set(selected.value);
	}

	// ─── Bulk actions ─────────────────────────────────────────────────────────────
	const bulkLoading = ref(false);

	async function bulkMarkRead() {
		if (selected.value.size === 0) return;
		bulkLoading.value = true;
		try {
			await Promise.all([...selected.value].map(id => markRead(id)));
			notifications.value.forEach(n => {
				if (selected.value.has(n.id)) n.isRead = true;
			});
			selected.value = new Set();
			toast.success('Đã đánh dấu đã đọc');
		} catch {
			toast.error('Có lỗi xảy ra');
		} finally {
			bulkLoading.value = false;
		}
	}

	// ─── Mark all read ────────────────────────────────────────────────────────────
	async function handleMarkAllRead() {
		try {
			const category = activeTab.value === 'ALL' ? undefined : activeTab.value;
			await markAllRead(category);
			notifications.value.forEach(n => {
				if (!category || n.category === category) n.isRead = true;
			});
			toast.success('Đã đánh dấu tất cả đã đọc');
		} catch {
			toast.error('Có lỗi xảy ra');
		}
	}

	// ─── Delete all ───────────────────────────────────────────────────────────────
	async function handleDeleteAll() {
		try {
			const category = activeTab.value === 'ALL' ? undefined : activeTab.value;
			await deleteAll(category);
			await load();
			toast.success('Đã xoá thông báo');
		} catch {
			toast.error('Có lỗi xảy ra');
		}
	}

	// ─── Item click ───────────────────────────────────────────────────────────────
	async function handleItemClick(notif: NotificationResponse) {
		if (!notif.isRead) {
			try {
				await markRead(notif.id);
				notif.isRead = true;
			} catch {
				// non-critical
			}
		}
		if (!notif.refType || notif.refId === null) return;
		const routes: Record<string, string> = {
			leave_request: `/leave?id=${notif.refId}`,
			overtime_request: `/overtime?id=${notif.refId}`,
			violation_request: `/violations?id=${notif.refId}`,
		};
		const route = routes[notif.refType];
		if (route) router.push(route);
	}

	// ─── Helpers ──────────────────────────────────────────────────────────────────
	function formatTime(iso: string): string {
		try {
			return format(parseISO(iso), 'HH:mm dd/MM/yyyy');
		} catch {
			return '';
		}
	}

	function categoryIcon(category: NotificationCategory): string {
		if (category === 'ATTENDANCE') return 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z';
		if (category === 'LEAVE') return 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z';
		return 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9';
	}

	function categoryIconColor(category: NotificationCategory): string {
		if (category === 'ATTENDANCE') return 'text-green-500 bg-green-50 dark:bg-green-900/20';
		if (category === 'LEAVE') return 'text-blue-500 bg-blue-50 dark:bg-blue-900/20';
		return 'text-orange-500 bg-orange-50 dark:bg-orange-900/20';
	}
</script>

<template>
	<div class="p-6 max-w-3xl mx-auto">
		<!-- Page header -->
		<div class="flex items-center justify-between mb-6">
			<h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Thông báo</h1>
			<div class="flex items-center gap-2">
				<button
					v-if="selected.size > 0"
					class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors disabled:opacity-50"
					:disabled="bulkLoading"
					@click="bulkMarkRead"
				>
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
					</svg>
					Đánh dấu đã đọc ({{ selected.size }})
				</button>
				<button
					class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
					@click="handleMarkAllRead"
				>
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
					</svg>
					Đọc tất cả
				</button>
				<button
					class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
					@click="handleDeleteAll"
				>
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
					</svg>
					Xoá tất cả
				</button>
			</div>
		</div>

		<!-- Card -->
		<div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
			<!-- Tabs -->
			<div class="flex border-b border-gray-200 dark:border-gray-700 px-1">
				<button
					v-for="tab in tabs"
					:key="tab.key"
					class="flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px"
					:class="
						activeTab === tab.key
							? 'border-brand-600 text-brand-600 dark:text-brand-400'
							: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
					"
					@click="activeTab = tab.key"
				>
					{{ tab.label }}
					<span
						v-if="tabUnreadCount(tab.key) > 0"
						class="inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-semibold rounded-full"
						:class="activeTab === tab.key ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'"
					>
						{{ tabUnreadCount(tab.key) > 99 ? '99+' : tabUnreadCount(tab.key) }}
					</span>
				</button>
			</div>

			<!-- Select all bar (visible when there are items) -->
			<div
				v-if="notifications.length > 0"
				class="flex items-center gap-3 px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700"
			>
				<input
					type="checkbox"
					class="w-4 h-4 rounded text-brand-600 border-gray-300 dark:border-gray-600 cursor-pointer"
					:checked="allSelected"
					:indeterminate="selected.size > 0 && !allSelected"
					@change="toggleSelectAll"
				/>
				<span class="text-xs text-gray-500 dark:text-gray-400">
					{{ selected.size > 0 ? `Đã chọn ${selected.size} thông báo` : 'Chọn tất cả' }}
				</span>
			</div>

			<!-- Loading -->
			<div v-if="loading" class="flex items-center justify-center py-16">
				<svg class="w-6 h-6 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
				</svg>
			</div>

			<!-- Empty -->
			<div v-else-if="notifications.length === 0" class="flex flex-col items-center justify-center py-16 gap-3">
				<svg class="w-12 h-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
				</svg>
				<p class="text-sm text-gray-400 dark:text-gray-500">Không có thông báo nào</p>
			</div>

			<!-- List -->
			<template v-else>
				<div
					v-for="notif in notifications"
					:key="notif.id"
					class="flex items-start gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0 border-l-[3px] transition-colors"
					:class="notif.isRead ? 'bg-white dark:bg-gray-800 border-l-transparent' : 'bg-blue-50 dark:bg-blue-900/10 border-l-green-500'"
				>
					<!-- Checkbox -->
					<input
						type="checkbox"
						class="mt-1 w-4 h-4 flex-shrink-0 rounded text-brand-600 border-gray-300 dark:border-gray-600 cursor-pointer"
						:checked="selected.has(notif.id)"
						@change="toggleSelect(notif.id)"
					/>

					<!-- Clickable row -->
					<button class="flex items-start gap-3 flex-1 min-w-0 text-left" @click="handleItemClick(notif)">
						<!-- Icon -->
						<div class="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center mt-0.5" :class="categoryIconColor(notif.category)">
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" :d="categoryIcon(notif.category)" />
							</svg>
						</div>

						<!-- Content -->
						<div class="flex-1 min-w-0">
							<p class="text-sm font-medium text-gray-800 dark:text-gray-200 leading-snug">{{ notif.title }}</p>
							<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{{ notif.body }}</p>
						</div>

						<!-- Meta -->
						<div class="flex-shrink-0 flex flex-col items-end gap-1.5 ml-2">
							<span class="text-xs text-gray-400 whitespace-nowrap">{{ formatTime(notif.createdAt) }}</span>
							<span v-if="!notif.isRead" class="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
						</div>
					</button>
				</div>
			</template>

			<!-- Pagination -->
			<div
				v-if="meta && meta.totalPages > 1"
				class="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50"
			>
				<span class="text-sm text-gray-500 dark:text-gray-400">
					{{ (page - 1) * limit + 1 }}–{{ Math.min(page * limit, meta.total) }} / {{ meta.total }}
				</span>
				<div class="flex items-center gap-1">
					<button
						class="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
						:disabled="page === 1"
						@click="page--"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
						</svg>
					</button>
					<span class="px-2 text-sm text-gray-700 dark:text-gray-300">{{ page }} / {{ meta.totalPages }}</span>
					<button
						class="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
						:disabled="page >= meta.totalPages"
						@click="page++"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
						</svg>
					</button>
				</div>
			</div>
		</div>
	</div>
</template>
