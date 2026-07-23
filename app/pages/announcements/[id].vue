<script setup lang="ts">
	import DOMPurify from 'dompurify';
	import AnnouncementComments from '~/components/modules/announcement/AnnouncementComments.vue';
	import AnnouncementReactions from '~/components/modules/announcement/AnnouncementReactions.vue';
	import { useCompanyAnnouncements } from '~/composables/useCompanyAnnouncements';
	import { formatRelativeTime } from '~/utils/date';
	import {
		ANNOUNCEMENT_TYPE_CONFIG,
		type MyAnnouncementItem,
	} from '~/types/announcement.types';

	definePageMeta({ title: 'Chi tiết thông báo' });

	const route = useRoute();
	const { fetchMyAnnouncements, markAsRead } = useCompanyAnnouncements();

	const id = computed(() => Number(route.params.id));
	const announcement = ref<MyAnnouncementItem | null>(null);
	const loading = ref(true);
	const notFound = ref(false);
	const recalled = ref(false);

	// BE không có endpoint GET /my/:id, phải quét list /my để tìm.
	// Server đã tự filter bài đã recall khỏi /my, nên nếu không tìm thấy
	// có khả năng bài đã bị thu hồi (hoặc chưa bao giờ dành cho user này).
	async function findByIdViaMy(targetId: number): Promise<MyAnnouncementItem | null> {
		const limit = 50;
		let page = 1;
		while (page <= 20) {
			const res = await fetchMyAnnouncements({ page, limit });
			const found = res.data.find(i => i.id === targetId);
			if (found) return found;
			if (page >= res.meta.totalPages) return null;
			page++;
		}
		return null;
	}

	function isNotFoundError(e: unknown): boolean {
		if (!(e instanceof Error)) return false;
		return /404|not[_ ]?found|thu hồi|đã bị thu hồi/i.test(e.message);
	}

	async function load() {
		if (!id.value || Number.isNaN(id.value)) {
			notFound.value = true;
			loading.value = false;
			return;
		}
		try {
			const item = await findByIdViaMy(id.value);
			if (!item) {
				// Có thể bài đã bị thu hồi hoặc không tồn tại — không hiển thị toast, chỉ show fallback screen.
				recalled.value = true;
				return;
			}
			announcement.value = item;
			// markAsRead có thể trả 404 nếu bài đã bị recall sau khi ta lấy list
			// → nuốt lỗi, không toast.
			markAsRead(id.value).catch(err => {
				if (isNotFoundError(err)) {
					recalled.value = true;
					announcement.value = null;
				}
			});
		} catch (e) {
			if (isNotFoundError(e)) {
				recalled.value = true;
			} else {
				notFound.value = true;
			}
		} finally {
			loading.value = false;
		}
	}

	const sanitizedBody = computed(() =>
		announcement.value ? DOMPurify.sanitize(announcement.value.body) : '',
	);
	const config = computed(() =>
		announcement.value
			? ANNOUNCEMENT_TYPE_CONFIG[announcement.value.announcementType]
			: null,
	);

	function attachmentIcon(name: string): string {
		const lower = name.toLowerCase();
		if (lower.endsWith('.pdf')) return '📕';
		if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return '📊';
		if (lower.endsWith('.docx') || lower.endsWith('.doc')) return '📝';
		if (/\.(jpg|jpeg|png|gif|webp)$/.test(lower)) return '🖼️';
		return '📎';
	}

	onMounted(load);
</script>

<template>
	<div class="max-w-3xl mx-auto space-y-4">
		<!-- Back nav -->
		<NuxtLink
			to="/announcements"
			class="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
		>
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
			</svg>
			Quay lại danh sách
		</NuxtLink>

		<!-- Loading -->
		<div
			v-if="loading"
			class="p-16 flex justify-center bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700"
		>
			<svg class="animate-spin w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
			</svg>
		</div>

		<!-- Recalled (silent) -->
		<div
			v-else-if="recalled"
			class="p-12 text-center bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3"
		>
			<p class="text-4xl">🚫</p>
			<div>
				<p class="text-base font-semibold text-gray-800 dark:text-gray-200">
					Thông báo đã bị thu hồi hoặc không còn khả dụng
				</p>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
					Bộ phận HR đã thu hồi thông báo này. Vui lòng quay lại danh sách để xem các thông báo khác.
				</p>
			</div>
			<NuxtLink
				to="/announcements"
				class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
				</svg>
				Quay lại danh sách
			</NuxtLink>
		</div>

		<!-- Not found -->
		<div
			v-else-if="notFound || !announcement || !config"
			class="p-16 text-center bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700"
		>
			<p class="text-4xl mb-2">🔍</p>
			<p class="text-sm text-gray-500 dark:text-gray-400">Không tìm thấy thông báo</p>
		</div>

		<!-- Content -->
		<div
			v-else
			class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
		>
			<!-- Header -->
			<div class="px-8 py-6 space-y-2 border-b border-gray-100 dark:border-gray-800">
				<div
					class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold"
				>
					<span>{{ config.icon }}</span>
					<span>{{ config.label }}</span>
				</div>
				<h1 class="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
					{{ announcement.title }}
				</h1>
				<p class="text-xs text-gray-500 dark:text-gray-400">
					Gửi bởi
					<span class="font-medium text-gray-700 dark:text-gray-300">
						{{ announcement.createdBy.fullName }}
					</span>
					<span class="mx-1.5">·</span>
					{{ formatRelativeTime(announcement.sentAt) }}
				</p>
			</div>

			<!-- Body -->
			<div class="px-8 py-6 space-y-5">
				<div
					class="announcement-body text-gray-800 dark:text-gray-200"
					v-html="sanitizedBody"
				/>

				<!-- Links -->
				<div
					v-if="(announcement.links?.length ?? 0) > 0"
					class="space-y-2 pt-4 border-t border-gray-100 dark:border-gray-800"
				>
					<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
						Liên kết đính kèm ({{ announcement.links.length }})
					</p>
					<div class="space-y-1.5">
						<a
							v-for="(l, i) in announcement.links"
							:key="i"
							:href="l.url"
							target="_blank"
							rel="noopener noreferrer"
							class="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-brand-400 dark:hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-colors text-sm"
						>
							<span class="flex-shrink-0">🔗</span>
							<div class="flex-1 min-w-0">
								<p class="text-gray-800 dark:text-gray-200 font-medium truncate">{{ l.label || l.url }}</p>
								<p v-if="l.label" class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ l.url }}</p>
							</div>
							<svg class="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
							</svg>
						</a>
					</div>
				</div>

				<!-- Attachments -->
				<div
					v-if="(announcement.attachments?.length ?? 0) > 0"
					class="space-y-2 pt-4 border-t border-gray-100 dark:border-gray-800"
				>
					<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
						File đính kèm ({{ announcement.attachments.length }})
					</p>
					<div class="space-y-1.5">
						<a
							v-for="(a, idx) in announcement.attachments"
							:key="`${a.name}-${idx}`"
							:href="a.url"
							target="_blank"
							rel="noopener noreferrer"
							class="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-brand-400 dark:hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-colors text-sm text-gray-700 dark:text-gray-300"
						>
							<span>{{ attachmentIcon(a.name) }}</span>
							<span class="truncate flex-1">{{ a.name }}</span>
							<svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
							</svg>
						</a>
					</div>
				</div>

				<!-- CTA -->
				<div v-if="config.actionUrl" class="pt-4 border-t border-gray-100 dark:border-gray-800">
					<NuxtLink
						:to="config.actionUrl"
						class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors"
					>
						{{ config.actionLabel }}
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
						</svg>
					</NuxtLink>
				</div>

				<!-- Reactions -->
				<div class="border-t border-gray-100 dark:border-gray-800 pt-3 mt-4">
					<AnnouncementReactions :announcement-id="announcement.id" />
				</div>

				<!-- Comments -->
				<div class="border-t border-gray-100 dark:border-gray-800 pt-4 mt-4">
					<AnnouncementComments :announcement-id="announcement.id" />
				</div>
			</div>
		</div>
	</div>
</template>
