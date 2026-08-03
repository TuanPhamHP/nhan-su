<script setup lang="ts">
	import DOMPurify from 'dompurify';
	import AnnouncementAttachments from '~/components/modules/announcement/AnnouncementAttachments.vue';
	import AnnouncementComments from '~/components/modules/announcement/AnnouncementComments.vue';
	import AnnouncementReactions from '~/components/modules/announcement/AnnouncementReactions.vue';
	import AnnouncementReadersModal from '~/components/modules/announcement/AnnouncementReadersModal.vue';
	import { useCompanyAnnouncements } from '~/composables/useCompanyAnnouncements';
	import { formatDateTime, formatRelativeTime } from '~/utils/date';
	import {
		ANNOUNCEMENT_TYPE_CONFIG,
		type CompanyAnnouncementResponse,
	} from '~/types/announcement.types';

	definePageMeta({ title: 'Chi tiết thông báo — Quản lý' });

	const route = useRoute();
	const toast = useToast();
	const { fetchById, recall } = useCompanyAnnouncements();

	const id = computed(() => Number(route.params.id));
	const announcement = ref<CompanyAnnouncementResponse | null>(null);
	const loading = ref(true);
	const notFound = ref(false);
	const recalling = ref(false);
	const showReadersModal = ref(false);

	const isRecalled = computed(() => !!announcement.value?.recalledAt);

	const sanitizedBody = computed(() =>
		announcement.value ? DOMPurify.sanitize(announcement.value.body) : '',
	);

	const MAX_CHARS_BEFORE_COLLAPSE = 200;
	const MAX_LINES_BEFORE_COLLAPSE = 4;
	const bodyRef = ref<HTMLElement | null>(null);
	const isBodyExpanded = ref(false);
	const isBodyLong = ref(false);
	const collapsedMaxHeight = ref('none');

	const bodyPlainTextLength = computed(() => {
		if (!import.meta.client || !sanitizedBody.value) return 0;
		const tmp = document.createElement('div');
		tmp.innerHTML = sanitizedBody.value;
		return (tmp.textContent || '').trim().length;
	});

	async function measureBody() {
		if (!import.meta.client) return;
		await nextTick();
		const el = bodyRef.value;
		if (!el) {
			isBodyLong.value = false;
			return;
		}
		const prevMaxHeight = el.style.maxHeight;
		const prevOverflow = el.style.overflow;
		el.style.maxHeight = 'none';
		el.style.overflow = 'visible';

		const cs = getComputedStyle(el);
		const lineHeight = parseFloat(cs.lineHeight) || 20;
		const totalHeight = el.scrollHeight;
		const approxLines = totalHeight / lineHeight;
		const maxLinesHeight = Math.round(lineHeight * MAX_LINES_BEFORE_COLLAPSE);

		el.style.maxHeight = prevMaxHeight;
		el.style.overflow = prevOverflow;

		collapsedMaxHeight.value = `${maxLinesHeight}px`;
		isBodyLong.value =
			bodyPlainTextLength.value > MAX_CHARS_BEFORE_COLLAPSE ||
			approxLines > MAX_LINES_BEFORE_COLLAPSE;
	}

	watch(
		sanitizedBody,
		() => {
			isBodyExpanded.value = false;
			measureBody();
		},
		{ immediate: true },
	);

	const config = computed(() =>
		announcement.value
			? ANNOUNCEMENT_TYPE_CONFIG[announcement.value.announcementType]
			: null,
	);

	const readCount = computed(() =>
		announcement.value ? announcement.value.recipients.filter(r => r.isRead).length : 0,
	);
	const totalCount = computed(() => announcement.value?.recipients.length ?? 0);
	const unreadCount = computed(() => totalCount.value - readCount.value);
	const progressPercent = computed(() => {
		if (totalCount.value === 0) return 0;
		return Math.round((readCount.value / totalCount.value) * 100);
	});

	async function load() {
		if (!id.value || Number.isNaN(id.value)) {
			notFound.value = true;
			loading.value = false;
			return;
		}
		try {
			announcement.value = await fetchById(id.value);
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Không tải được chi tiết thông báo';
			toast.error(msg);
			notFound.value = true;
		} finally {
			loading.value = false;
		}
	}

	async function handleRecall() {
		if (!announcement.value || isRecalled.value) return;
		if (
			!confirm(
				`Thu hồi thông báo "${announcement.value.title}"? Sau khi thu hồi, nhân viên sẽ không còn thấy thông báo này. Không thể hoàn tác.`,
			)
		)
			return;
		recalling.value = true;
		try {
			await recall(announcement.value.id);
			announcement.value = await fetchById(announcement.value.id);
			toast.success('Đã thu hồi thông báo');
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Đã có lỗi xảy ra';
			if (/thu hồi|BAD_REQUEST|đã được thu hồi/i.test(msg)) {
				toast.error('Thông báo đã bị thu hồi trước đó, tải lại trang.');
				load();
			} else {
				toast.error(msg);
			}
		} finally {
			recalling.value = false;
		}
	}

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
			to="/management/announcements"
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

		<!-- Not found -->
		<div
			v-else-if="notFound || !announcement || !config"
			class="p-16 text-center bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3"
		>
			<p class="text-4xl">🔍</p>
			<p class="text-base font-semibold text-gray-800 dark:text-gray-200">
				Không tìm thấy thông báo
			</p>
			<NuxtLink
				to="/management/announcements"
				class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
				</svg>
				Quay lại danh sách
			</NuxtLink>
		</div>

		<!-- Content -->
		<template v-else>
			<!-- Recalled banner -->
			<div
				v-if="isRecalled"
				class="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20"
			>
				<svg class="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
				</svg>
				<div class="text-sm text-amber-800 dark:text-amber-200">
					<p class="font-semibold">Thông báo này đã bị thu hồi.</p>
					<p class="text-xs mt-0.5 text-amber-700 dark:text-amber-300">
						Thu hồi bởi
						<span class="font-medium">{{ announcement.recalledBy?.fullName ?? 'HR' }}</span>
						· {{ formatDateTime(announcement.recalledAt) }}
					</p>
				</div>
			</div>

			<!-- Main Card (Sleek unified card giống bên nhân viên) -->
			<div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8 shadow-xs">
				<!-- Header / Sender Info -->
				<div class="flex items-start justify-between gap-4 flex-wrap">
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

					<!-- Admin Action Badges/Buttons (Giữ nguyên badge "Đã gửi" và nút "Thu hồi") -->
					<div class="flex items-center gap-2.5 flex-shrink-0">
						<!-- Reader Badge Button -->
						<button
							type="button"
							class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-sm font-medium transition-colors shadow-2xs cursor-pointer"
							title="Click để xem danh sách người đọc"
							@click="showReadersModal = true"
						>
							<span>Đã gửi</span>
						</button>

						<!-- Recall Button -->
						<button
							v-if="!isRecalled"
							type="button"
							:disabled="recalling"
							class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
							@click="handleRecall"
						>
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m2.25 6.75L4.5 5.25M12 21a9 9 0 100-18 9 9 0 000 18z" />
							</svg>
							{{ recalling ? 'Đang thu hồi…' : 'Thu hồi' }}
						</button>
					</div>
				</div>

				<!-- Title -->
				<h1
					:class="[
						'text-lg md:text-xl font-bold mt-4 leading-tight',
						isRecalled
							? 'text-gray-500 dark:text-gray-500 line-through'
							: 'text-gray-900 dark:text-white',
					]"
				>
					{{ announcement?.title }}
				</h1>

				<!-- Body (auto collapse khi > 4 dòng hoặc > 200 ký tự) -->
				<div class="mt-2">
					<div class="relative">
						<div
							ref="bodyRef"
							class="announcement-body text-gray-800 dark:text-gray-200 text-sm leading-relaxed overflow-hidden transition-[max-height] duration-300"
							:style="{
								maxHeight: isBodyLong && !isBodyExpanded ? collapsedMaxHeight : 'none',
							}"
							v-html="sanitizedBody"
						/>
						<div
							v-if="isBodyLong && !isBodyExpanded"
							class="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white dark:from-gray-900 to-transparent"
						/>
					</div>
					<button
						v-if="isBodyLong"
						type="button"
						class="mt-1 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors cursor-pointer"
						@click="isBodyExpanded = !isBodyExpanded"
					>
						{{ isBodyExpanded ? 'Thu gọn' : 'Xem thêm' }}
						<svg
							class="w-3.5 h-3.5 transition-transform"
							:class="{ 'rotate-180': isBodyExpanded }"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2.5"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
						</svg>
					</button>
				</div>

				<!-- Attachments (ảnh dạng gallery Facebook) & Links -->
				<AnnouncementAttachments
					:attachments="announcement.attachments"
					:links="announcement.links"
				/>

				<!-- Reactions bar -->
				<div class="border-t border-b border-gray-100 dark:border-gray-800 py-3 mt-5">
					<AnnouncementReactions :announcement-id="announcement.id" />
				</div>

				<!-- Comments -->
				<div class="pt-4">
					<AnnouncementComments :announcement-id="announcement.id" />
				</div>
			</div>

			<!-- Readers Modal -->
			<AnnouncementReadersModal
				v-model="showReadersModal"
				:recipients="announcement.recipients"
				:read-count="readCount"
				:total-count="totalCount"
			/>
		</template>
	</div>
</template>
