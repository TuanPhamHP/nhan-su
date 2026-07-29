<script setup lang="ts">
	import { useCompanyAnnouncements } from '~/composables/useCompanyAnnouncements';
	import { formatTimeAgo } from '~/utils/date';
	import {
		ANNOUNCEMENT_TYPE_CONFIG,
		type MyAnnouncementItem,
	} from '~/types/announcement.types';
	import type { PaginatedMeta } from '~/types/api.types';

	definePageMeta({ title: 'Thông báo công ty' });

	const toast = useToast();
	const { fetchMyAnnouncements } = useCompanyAnnouncements();

	const myFilter = ref<'all' | 'unread'>('all');
	const myItems = ref<MyAnnouncementItem[]>([]);
	const myMeta = ref<PaginatedMeta | null>(null);
	const myLoading = ref(false);
	const myPage = ref(1);

	async function loadMy() {
		myLoading.value = true;
		try {
			const res = await fetchMyAnnouncements({
				page: myPage.value,
				limit: 20,
				isRead: myFilter.value === 'unread' ? false : undefined,
			});
			myItems.value = res.data;
			myMeta.value = res.meta;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi tải danh sách thông báo');
		} finally {
			myLoading.value = false;
		}
	}

	function applyMyFilter(f: 'all' | 'unread') {
		myFilter.value = f;
		myPage.value = 1;
		loadMy();
	}

	onMounted(() => {
		loadMy();
	});
</script>

<template>
	<div class="space-y-5">
		<!-- Page header -->
		<div>
			<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Thông báo công ty</h1>
			<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
				Thông báo chung, báo cáo chấm công, yêu cầu cập nhật hồ sơ…
			</p>
		</div>

		<!-- Filter tabs -->
		<div class="flex items-center gap-2">
			<button
				type="button"
				:class="[
					'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
					myFilter === 'all'
						? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
						: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
				]"
				@click="applyMyFilter('all')"
			>
				Tất cả
			</button>
			<button
				type="button"
				:class="[
					'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
					myFilter === 'unread'
						? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
						: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
				]"
				@click="applyMyFilter('unread')"
			>
				Chưa đọc
			</button>
		</div>

		<!-- List -->
		<div class="space-y-2 w-[75%] mx-auto">
			<div v-if="myLoading" class="py-12 flex justify-center">
				<svg class="animate-spin w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
				</svg>
			</div>

			<div
				v-else-if="myItems.length === 0"
				class="py-16 text-center bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700"
			>
				<p class="text-4xl mb-2">📭</p>
				<p class="text-sm text-gray-500 dark:text-gray-400">Chưa có thông báo nào</p>
			</div>

			<NuxtLink
				v-for="item in myItems"
				:key="item.id"
				:to="`/announcements/${item.id}`"
				:class="[
					'flex gap-3 px-4 py-3 rounded-xl border transition-colors',
					'bg-white dark:bg-gray-900 hover:border-brand-400 dark:hover:border-brand-500',
					!item.isRead
						? 'border-l-4 border-l-brand-500 border-y border-r border-gray-200 dark:border-gray-700'
						: 'border-gray-200 dark:border-gray-700',
				]"
			>
				<div
					class="flex-shrink-0 w-10 h-10 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-lg"
				>
					{{ ANNOUNCEMENT_TYPE_CONFIG[item.announcementType].icon }}
				</div>
				<div class="flex-1 min-w-0 space-y-1">
					<div class="flex items-start justify-between gap-2">
						<h3 class="text-sm font-semibold text-gray-900 dark:text-white truncate">
							{{ item.title }}
						</h3>
						<span
							v-if="!item.isRead"
							class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 flex-shrink-0"
						>
							Mới
						</span>
					</div>
					<p class="text-xs text-gray-500 dark:text-gray-400">
						{{ ANNOUNCEMENT_TYPE_CONFIG[item.announcementType].label }}
					</p>
					<p class="text-xs text-gray-400 dark:text-gray-500">
						{{ item.createdBy.fullName }} · {{ formatTimeAgo(item.sentAt) }}
					</p>
				</div>
			</NuxtLink>
		</div>

		<!-- Pagination -->
		<div v-if="myMeta && myMeta.totalPages > 1" class="flex items-center justify-between pt-1">
			<p class="text-sm text-gray-500 dark:text-gray-400">
				Tổng <strong class="text-gray-700 dark:text-gray-300">{{ myMeta.total }}</strong> thông báo
			</p>
			<CommonAppPagination
				:current-page="myPage"
				:total-pages="myMeta.totalPages"
				@update:current-page="
					p => {
						myPage = p;
						loadMy();
					}
				"
			/>
		</div>
	</div>
</template>
