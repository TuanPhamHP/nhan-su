<script setup lang="ts">
	import DOMPurify from 'dompurify';
	import { format, parseISO } from 'date-fns';
	import AnnouncementComments from '~/components/modules/announcement/AnnouncementComments.vue';
	import AnnouncementReactions from '~/components/modules/announcement/AnnouncementReactions.vue';
	import { useCompanyAnnouncements } from '~/composables/useCompanyAnnouncements';
	import { formatDateTime, formatRelativeTime } from '~/utils/date';
	import {
		ANNOUNCEMENT_TYPE_CONFIG,
		type AnnouncementRecipientStatus,
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
	const activeTab = ref<'content' | 'readers'>('content');
	const readerFilter = ref<'read' | 'unread'>('read');

	const isRecalled = computed(() => !!announcement.value?.recalledAt);

	const sanitizedBody = computed(() =>
		announcement.value ? DOMPurify.sanitize(announcement.value.body) : '',
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

	const readerList = computed<AnnouncementRecipientStatus[]>(() => {
		if (!announcement.value) return [];
		return readerFilter.value === 'read'
			? announcement.value.recipients.filter(r => r.isRead)
			: announcement.value.recipients.filter(r => !r.isRead);
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
			const updated = await recall(announcement.value.id);
			// Merge cập nhật recalledAt/recalledBy vào state hiện tại (giữ recipients + body)
			announcement.value = {
				...announcement.value,
				recalledAt: updated.recalledAt,
				recalledBy: updated.recalledBy,
			};
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

	function attachmentIcon(name: string): string {
		const lower = name.toLowerCase();
		if (lower.endsWith('.pdf')) return '📕';
		if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return '📊';
		if (lower.endsWith('.docx') || lower.endsWith('.doc')) return '📝';
		if (/\.(jpg|jpeg|png|gif|webp)$/.test(lower)) return '🖼️';
		return '📎';
	}

	function initials(name: string): string {
		return name
			.split(/\s+/)
			.filter(Boolean)
			.slice(-2)
			.map(w => w.charAt(0).toUpperCase())
			.join('');
	}

	function formatReadAt(iso: string | null): string {
		if (!iso) return '';
		try {
			return format(parseISO(iso), 'dd/MM HH:mm');
		} catch {
			return iso;
		}
	}

	onMounted(load);
</script>

<template>
	<div class="max-w-5xl mx-auto space-y-4">
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
			class="p-16 text-center bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700"
		>
			<p class="text-4xl mb-2">🔍</p>
			<p class="text-sm text-gray-500 dark:text-gray-400">Không tìm thấy thông báo</p>
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

			<!-- Header card -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
				<div class="px-8 py-6 flex items-start justify-between gap-4 flex-wrap">
					<div class="space-y-2 min-w-0 flex-1">
						<div
							class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold"
						>
							<span>{{ config.icon }}</span>
							<span>{{ config.label }}</span>
						</div>
						<h1
							:class="[
								'text-2xl font-bold leading-tight',
								isRecalled
									? 'text-gray-500 dark:text-gray-500 line-through'
									: 'text-gray-900 dark:text-white',
							]"
						>
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

					<button
						v-if="!isRecalled"
						type="button"
						:disabled="recalling"
						class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 text-sm font-medium transition-colors disabled:opacity-50 flex-shrink-0"
						@click="handleRecall"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m2.25 6.75L4.5 5.25M12 21a9 9 0 100-18 9 9 0 000 18z" />
						</svg>
						{{ recalling ? 'Đang thu hồi…' : 'Thu hồi' }}
					</button>
				</div>

				<!-- Stats summary -->
				<div class="px-8 pb-6 space-y-2">
					<div class="flex items-center justify-between text-sm">
						<span class="text-gray-700 dark:text-gray-300 font-medium">
							{{ readCount }}/{{ totalCount }} người đã đọc
						</span>
						<span class="text-xs text-gray-500 dark:text-gray-400">{{ progressPercent }}%</span>
					</div>
					<div class="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
						<div
							class="h-full bg-brand-500 transition-all duration-300"
							:style="{ width: `${progressPercent}%` }"
						/>
					</div>
				</div>

				<!-- Tabs -->
				<div class="border-t border-gray-100 dark:border-gray-800 px-4 flex items-center gap-1">
					<button
						type="button"
						:class="[
							'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
							activeTab === 'content'
								? 'border-brand-500 text-brand-600 dark:text-brand-400'
								: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
						]"
						@click="activeTab = 'content'"
					>
						Nội dung
					</button>
					<button
						type="button"
						:class="[
							'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
							activeTab === 'readers'
								? 'border-brand-500 text-brand-600 dark:text-brand-400'
								: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
						]"
						@click="activeTab = 'readers'"
					>
						Người nhận ({{ totalCount }})
					</button>
				</div>
			</div>

			<!-- Content tab -->
			<div
				v-if="activeTab === 'content'"
				class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
			>
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

			<!-- Readers tab -->
			<div
				v-else
				class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
			>
				<div class="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
					<button
						type="button"
						:class="[
							'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
							readerFilter === 'read'
								? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
								: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
						]"
						@click="readerFilter = 'read'"
					>
						Đã đọc ({{ readCount }})
					</button>
					<button
						type="button"
						:class="[
							'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
							readerFilter === 'unread'
								? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
								: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
						]"
						@click="readerFilter = 'unread'"
					>
						Chưa đọc ({{ unreadCount }})
					</button>
				</div>

				<div class="px-6 py-4">
					<div v-if="readerList.length === 0" class="py-8 text-center text-sm text-gray-400">
						<template v-if="readerFilter === 'read'">Chưa có ai đọc thông báo này</template>
						<template v-else>Tất cả nhân viên đã đọc thông báo</template>
					</div>

					<div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2">
						<div
							v-for="r in readerList"
							:key="r.employeeId"
							class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
						>
							<div
								:class="[
									'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden',
									readerFilter === 'read'
										? 'bg-brand-100 dark:bg-brand-900'
										: 'bg-gray-200 dark:bg-gray-700',
								]"
							>
								<img v-if="r.avatarUrl" :src="r.avatarUrl" :alt="r.fullName" class="w-full h-full object-cover" />
								<span
									v-else
									:class="[
										'text-xs font-semibold',
										readerFilter === 'read'
											? 'text-brand-700 dark:text-brand-300'
											: 'text-gray-600 dark:text-gray-300',
									]"
								>
									{{ initials(r.fullName) }}
								</span>
							</div>
							<div class="flex-1 min-w-0">
								<p class="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
									{{ r.fullName }}
								</p>
								<p v-if="r.isRead && r.readAt" class="text-xs text-gray-500 dark:text-gray-400">
									Đã đọc lúc {{ formatReadAt(r.readAt) }}
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</template>
	</div>
</template>
