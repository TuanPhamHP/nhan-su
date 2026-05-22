<script setup lang="ts">
	import { format, parseISO } from 'date-fns';
	import type { NotificationCategory, NotificationResponse } from '~/types/notification.types';

	const props = defineProps<{ open: boolean }>();
	const emit = defineEmits<{ close: [] }>();

	const router = useRouter();
	const toast = useToast();
	const { unreadCount, notifications, loading, fetchNotifications, markRead, markAllRead, deleteAll } = useNotifications();

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

	// ─── Actions menu ─────────────────────────────────────────────────────────────
	const showActionsMenu = ref(false);

	async function handleMarkAllRead() {
		showActionsMenu.value = false;
		try {
			const category = activeTab.value === 'ALL' ? undefined : activeTab.value;
			await markAllRead(category);
		} catch {
			toast.error('Không thể đánh dấu đã đọc');
		}
	}

	async function handleDeleteAll() {
		showActionsMenu.value = false;
		try {
			const category = activeTab.value === 'ALL' ? undefined : activeTab.value;
			await deleteAll(category);
		} catch {
			toast.error('Không thể xoá thông báo');
		}
	}

	// ─── Load data ────────────────────────────────────────────────────────────────
	watch(
		() => props.open,
		async open => {
			if (open) {
				showActionsMenu.value = false;
				await load();
			}
		},
	);

	watch(activeTab, async () => {
		if (props.open) await load();
	});

	async function load() {
		const category = activeTab.value === 'ALL' ? undefined : activeTab.value;
		await fetchNotifications({ limit: 20, category });
	}

	// ─── Notification click ───────────────────────────────────────────────────────
	async function handleItemClick(notif: NotificationResponse) {
		if (!notif.isRead) {
			try {
				await markRead(notif.id);
			} catch {
				// non-critical
			}
		}
		navigate(notif);
		emit('close');
	}

	function navigate(notif: NotificationResponse) {
		if (!notif.refType || notif.refId === null) return;
		const routes: Record<string, string> = {
			leave_request: `/leave?id=${notif.refId}`,
			overtime_request: `/overtime?id=${notif.refId}`,
			violation_request: `/violations?id=${notif.refId}`,
		};
		const route = routes[notif.refType];
		if (route) router.push(route);
	}

	// ─── Format ───────────────────────────────────────────────────────────────────
	function formatTime(iso: string): string {
		try {
			return format(parseISO(iso), 'HH:mm dd/MM');
		} catch {
			return '';
		}
	}

	// ─── Category icon path ───────────────────────────────────────────────────────
	function categoryIcon(category: NotificationCategory): string {
		if (category === 'ATTENDANCE') return 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z';
		if (category === 'LEAVE') return 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z';
		return 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9';
	}

	function categoryIconColor(category: NotificationCategory): string {
		if (category === 'ATTENDANCE') return 'text-green-500 bg-green-50';
		if (category === 'LEAVE') return 'text-blue-500 bg-blue-50';
		return 'text-orange-500 bg-orange-50';
	}
</script>

<template>
	<Transition
		enter-active-class="transition-all duration-200 ease-out"
		enter-from-class="opacity-0 scale-95 -translate-y-2"
		enter-to-class="opacity-100 scale-100 translate-y-0"
		leave-active-class="transition-all duration-150 ease-in"
		leave-from-class="opacity-100 scale-100 translate-y-0"
		leave-to-class="opacity-0 scale-95 -translate-y-2"
	>
		<div
			v-if="open"
			class="absolute right-0 top-full mt-2 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 flex flex-col"
			style="max-height: 480px"
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
				<span class="text-sm font-semibold text-gray-800 dark:text-gray-200">Thông báo</span>
				<div class="relative" data-notif-actions>
					<button
						class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
						@click.stop="showActionsMenu = !showActionsMenu"
					>
						<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
							<circle cx="5" cy="12" r="2" />
							<circle cx="12" cy="12" r="2" />
							<circle cx="19" cy="12" r="2" />
						</svg>
					</button>
					<Transition
						enter-active-class="transition-all duration-100 ease-out"
						enter-from-class="opacity-0 scale-95"
						enter-to-class="opacity-100 scale-100"
						leave-active-class="transition-all duration-75 ease-in"
						leave-from-class="opacity-100 scale-100"
						leave-to-class="opacity-0 scale-95"
					>
						<div
							v-if="showActionsMenu"
							class="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10"
						>
							<button
								class="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
								@click="handleMarkAllRead"
							>
								<svg class="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
								</svg>
								Đánh dấu đã đọc tất cả
							</button>
							<button
								class="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
								@click="handleDeleteAll"
							>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
								</svg>
								Xoá tất cả thông báo
							</button>
						</div>
					</Transition>
				</div>
			</div>

			<!-- Tabs -->
			<div class="flex border-b border-gray-100 dark:border-gray-700 flex-shrink-0 px-1">
				<button
					v-for="tab in tabs"
					:key="tab.key"
					class="flex items-center gap-1 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px"
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
						class="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full"
						:class="activeTab === tab.key ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'"
					>
						{{ tabUnreadCount(tab.key) > 99 ? '99+' : tabUnreadCount(tab.key) }}
					</span>
				</button>
			</div>

			<!-- List -->
			<div class="overflow-y-auto flex-1">
				<!-- Loading -->
				<div v-if="loading" class="flex items-center justify-center py-10">
					<svg class="w-5 h-5 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
					</svg>
				</div>

				<!-- Empty -->
				<div v-else-if="notifications.length === 0" class="flex flex-col items-center justify-center py-10 gap-2">
					<svg class="w-10 h-10 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
					</svg>
					<span class="text-sm text-gray-400 dark:text-gray-500">Không có thông báo nào</span>
				</div>

				<!-- Items -->
				<template v-else>
					<button
						v-for="notif in notifications"
						:key="notif.id"
						class="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-[3px]"
						:class="notif.isRead ? 'bg-white dark:bg-gray-800 border-transparent' : 'bg-blue-50 dark:bg-blue-900/10 border-green-500'"
						@click="handleItemClick(notif)"
					>
						<!-- Icon -->
						<div class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5" :class="categoryIconColor(notif.category)">
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" :d="categoryIcon(notif.category)" />
							</svg>
						</div>

						<!-- Content -->
						<div class="flex-1 min-w-0">
							<p class="text-sm font-medium text-gray-800 dark:text-gray-200 leading-snug">{{ notif.title }}</p>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{{ notif.body }}</p>
						</div>

						<!-- Right -->
						<div class="flex-shrink-0 flex flex-col items-end gap-1.5">
							<span class="text-xs text-gray-400 whitespace-nowrap">{{ formatTime(notif.createdAt) }}</span>
							<span v-if="!notif.isRead" class="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
						</div>
					</button>
				</template>
			</div>

			<!-- Footer -->
			<div class="border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
				<NuxtLink
					to="/notifications"
					class="flex items-center justify-center py-2.5 text-xs font-medium text-brand-600 dark:text-brand-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors rounded-b-xl"
					@click="emit('close')"
				>
					Xem tất cả thông báo
				</NuxtLink>
			</div>
		</div>
	</Transition>
</template>
