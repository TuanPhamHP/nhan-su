<script setup lang="ts">
	import DOMPurify from 'dompurify';
	import AnnouncementAttachments from '~/components/modules/announcement/AnnouncementAttachments.vue';
	import AnnouncementComments from '~/components/modules/announcement/AnnouncementComments.vue';
	import AnnouncementReactions from '~/components/modules/announcement/AnnouncementReactions.vue';
	import { useCompanyAnnouncements } from '~/composables/useCompanyAnnouncements';
	import { formatRelativeTime } from '~/utils/date';
	import {
		ANNOUNCEMENT_TYPE_CONFIG,
		type MyAnnouncementDetail,
	} from '~/types/announcement.types';

	definePageMeta({ title: 'Chi tiết thông báo' });

	const route = useRoute();
	const { fetchMyAnnouncementDetail, markAsRead } = useCompanyAnnouncements();

	const id = computed(() => Number(route.params.id));
	const announcement = ref<MyAnnouncementDetail | null>(null);
	const loading = ref(true);
	const notFound = ref(false);

	async function load() {
		if (!id.value || Number.isNaN(id.value)) {
			notFound.value = true;
			loading.value = false;
			return;
		}
		try {
			announcement.value = await fetchMyAnnouncementDetail(id.value);
			// BE guarantees mark-as-read is idempotent — swallow errors silently
			// (bài có thể vừa bị recall giữa hai request).
			markAsRead(id.value).catch(() => {});
		} catch {
			// BE trả 404 chung cho: không tồn tại / không phải recipient / đã bị thu hồi.
			// Không cần phân biệt case, hiển thị 1 màn thông báo chung.
			notFound.value = true;
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

	function initials(name: string): string {
		return name
			.split(/\s+/)
			.filter(Boolean)
			.slice(-2) 
			.map(w => w.charAt(0).toUpperCase())
			.join('');
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

		<!-- Not found / recalled / not-a-recipient — server trả 404 chung cho cả 3 -->
		<div
			v-else-if="notFound || !announcement || !config"
			class="p-12 text-center bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3"
		>
			<p class="text-4xl">🚫</p>
			<p class="text-base font-semibold text-gray-800 dark:text-gray-200">
				Thông báo không tồn tại hoặc đã bị thu hồi.
			</p>
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

		<!-- Content -->
		<div
			v-else
			class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8 shadow-xs"
		>
			<!-- Header / Sender Info -->
			<div class="flex items-start justify-between gap-4">
				<div class="flex items-center gap-3.5 min-w-0">
					<!-- Sender Avatar -->
					<div class="w-11 h-11 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-sm flex-shrink-0 select-none overflow-hidden">
						<img
							v-if="announcement.createdBy.avatarUrl"
							:src="announcement.createdBy.avatarUrl"
							:alt="announcement.createdBy.fullName"
							class="w-full h-full object-cover"
						/>
						<span v-else>{{ initials(announcement.createdBy.fullName) }}</span>
					</div>

					<div class="min-w-0">
						<!-- Name & Role -->
						<div class="flex items-center gap-1.5 flex-wrap">
							<span class="font-bold text-gray-900 dark:text-white text-base">
								{{ announcement.createdBy?.fullName }}
							</span>
							<!-- <template v-if="announcement.createdBy.departmentName || announcement.createdBy.positionName || announcement.createdBy.roleName">
								<span class="text-gray-400">·</span>
								<span class="text-sm text-gray-500 dark:text-gray-400">
									{{ announcement.createdBy.departmentName || announcement.createdBy.positionName || announcement.createdBy.roleName }}
								</span>
							</template> -->
						</div>

						<!-- Type Badge & Date -->
						<div class="flex items-center gap-2 mt-1">
							<span
								class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs font-medium"
							>
								<span>{{ config.icon }}</span>
								<span>{{ config.label }}</span>
							</span>
							<span class="text-xs text-gray-500 dark:text-gray-400">
								{{ formatRelativeTime(announcement?.sentAt) }}
							</span>
						</div>
					</div>
				</div>

				<!-- Action Icons -->
				<div class="flex items-center gap-1 text-gray-400 flex-shrink-0">
					<button
						type="button"
						class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
						title="Ghim thông báo"
					>
						<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
							<path stroke-linecap="round" stroke-linejoin="round" d="M3 21l3-3m0 0l3-3m-3 3l9-9a2 2 0 00-2.828-2.828l-9 9m12-12L18 3l3 3-3 3" />
						</svg>
					</button>
					<button
						type="button"
						class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
						title="Thêm tùy chọn"
					>
						<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
							<path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
						</svg>
					</button>
				</div>
			</div>

			<!-- Title -->
			<h1 class="text-lg md:text-xl font-bold text-gray-900 dark:text-white mt-4 leading-tight">
				{{ announcement?.title }}
			</h1>

			<!-- Body -->
			<div
				class="announcement-body text-gray-800 dark:text-gray-200 mt-2 text-sm leading-relaxed"
				v-html="sanitizedBody"
			/>

			<!-- Attachments (ảnh dạng gallery Facebook) & Links -->
			<AnnouncementAttachments
				:attachments="announcement.attachments"
				:links="announcement.links"
			/>

			<!-- CTA -->
			<div v-if="config.actionUrl" class="mt-4">
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

			<!-- Reactions bar (Giữ nguyên UI hiển thị reactions, bỏ phần Đã đọc 24/31) -->
			<div class="border-t border-b border-gray-100 dark:border-gray-800 py-3 mt-5">
				<AnnouncementReactions :announcement-id="announcement.id" />
			</div>

			<!-- Comments -->
			<div class="pt-4">
				<AnnouncementComments :announcement-id="announcement.id" />
			</div>
		</div>
	</div>
</template>
