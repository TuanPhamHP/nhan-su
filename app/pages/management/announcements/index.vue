<script setup lang="ts">
	import { format, parseISO } from 'date-fns';
	import { useCompanyAnnouncements } from '~/composables/useCompanyAnnouncements';
	import type { DropdownMenuItem } from '~/components/ui/DropdownMenu.vue';
	import {
		ANNOUNCEMENT_TYPE_CONFIG,
		type CompanyAnnouncementSummary,
	} from '~/types/announcement.types';
	import type { PaginatedMeta } from '~/types/api.types';

	definePageMeta({ title: 'Quản lý thông báo công ty' });

	const toast = useToast();
	const router = useRouter();
	const route = useRoute();
	const { user } = useAuth();
	const { fetchAll, recall } = useCompanyAnnouncements();

	const canSend = computed(() =>
		user.value ? user.value.role === 'ADMIN' || user.value.role === 'HR' : false,
	);

	// ─── Filter (khởi tạo từ URL query để refresh giữ nguyên state) ───────────────
	const filter = reactive({
		search: getQueryString('search'),
		createdAtFrom: getQueryString('created_at_from'),
		createdAtTo: getQueryString('created_at_to'),
		page: Math.max(1, Number(getQueryString('page')) || 1),
	});
	const PAGE_LIMIT = 20;

	function getQueryString(key: string): string {
		const v = route.query[key];
		if (Array.isArray(v)) return v[0] ?? '';
		return typeof v === 'string' ? v : '';
	}

	const dateRangeError = computed(() => {
		if (filter.createdAtFrom && filter.createdAtTo) {
			if (filter.createdAtFrom > filter.createdAtTo) {
				return 'Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc';
			}
		}
		return '';
	});

	// ─── Data ────────────────────────────────────────────────────────────────────
	const items = ref<CompanyAnnouncementSummary[]>([]);
	const meta = ref<PaginatedMeta | null>(null);
	const loading = ref(false);
	const recallingId = ref<number | null>(null);

	function syncUrl() {
		const query: Record<string, string> = {};
		if (filter.search.trim()) query.search = filter.search.trim();
		if (filter.createdAtFrom) query.created_at_from = filter.createdAtFrom;
		if (filter.createdAtTo) query.created_at_to = filter.createdAtTo;
		if (filter.page > 1) query.page = String(filter.page);
		router.replace({ path: route.path, query });
	}

	async function load() {
		loading.value = true;
		try {
			const res = await fetchAll({
				page: filter.page,
				limit: PAGE_LIMIT,
				search: filter.search.trim() || undefined,
				created_at_from: filter.createdAtFrom || undefined,
				created_at_to: filter.createdAtTo || undefined,
			});
			items.value = res.data;
			meta.value = res.meta;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi tải danh sách thông báo');
		} finally {
			loading.value = false;
		}
	}

	function applyFilter() {
		filter.page = 1;
		syncUrl();
		load();
	}

	function resetFilter() {
		filter.search = '';
		filter.createdAtFrom = '';
		filter.createdAtTo = '';
		filter.page = 1;
		syncUrl();
		load();
	}

	function changePage(p: number) {
		filter.page = p;
		syncUrl();
		load();
	}

	// ─── Debounced search ────────────────────────────────────────────────────────
	let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
	watch(
		() => filter.search,
		() => {
			if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
			searchDebounceTimer = setTimeout(() => {
				filter.page = 1;
				syncUrl();
				load();
			}, 300);
		},
	);

	watch([() => filter.createdAtFrom, () => filter.createdAtTo], () => {
		if (dateRangeError.value) return;
		filter.page = 1;
		syncUrl();
		load();
	});

	onBeforeUnmount(() => {
		if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
	});

	// ─── Recall ──────────────────────────────────────────────────────────────────
	async function handleRecall(item: CompanyAnnouncementSummary) {
		if (item.status === 'RECALLED' || item.recalledAt) return;
		if (
			!confirm(
				`Thu hồi thông báo "${item.title}"? Sau khi thu hồi, nhân viên sẽ không còn thấy thông báo này. Không thể hoàn tác.`,
			)
		)
			return;
		recallingId.value = item.id;
		try {
			const updated = await recall(item.id);
			const idx = items.value.findIndex(i => i.id === updated.id);
			if (idx !== -1) items.value[idx] = { ...items.value[idx]!, ...updated };
			toast.success('Đã thu hồi thông báo');
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Đã có lỗi xảy ra';
			// BE 400 khi đã thu hồi trước đó → refetch để đồng bộ
			if (/thu hồi|BAD_REQUEST|đã được thu hồi/i.test(msg)) {
				toast.error('Thông báo đã bị thu hồi trước đó, tải lại danh sách.');
				load();
			} else {
				toast.error(msg);
			}
		} finally {
			recallingId.value = null;
		}
	}

	function buildActions(item: CompanyAnnouncementSummary): DropdownMenuItem[] {
		return [
			{
				label: 'Xem chi tiết',
				icon: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
				action: () => router.push(`/management/announcements/${item.id}`),
			},
			{
				label: 'Thu hồi',
				icon: 'M9 12h6m2.25 6.75L4.5 5.25M12 21a9 9 0 100-18 9 9 0 000 18z',
				variant: 'danger',
				hidden: item.status === 'RECALLED',
				action: () => handleRecall(item),
			},
		];
	}

	// ─── Helpers ─────────────────────────────────────────────────────────────────
	function stt(index: number): number {
		const page = meta.value?.page ?? filter.page;
		return (page - 1) * PAGE_LIMIT + index + 1;
	}

	function formatDateTime(iso: string | undefined | null): string {
		if (!iso) return '—';
		try {
			return format(parseISO(iso), 'dd/MM/yyyy HH:mm');
		} catch {
			return '—';
		}
	}

	// ─── Lifecycle ───────────────────────────────────────────────────────────────
	onMounted(load);
</script>

<template>
	<div class="space-y-5">
		<!-- Page header -->
		<div class="flex items-start justify-between flex-wrap gap-3">
			<div>
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Quản lý thông báo công ty</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
					Danh sách thông báo đã gửi, xem trạng thái đọc từng người nhận
				</p>
			</div>
			<NuxtLink
				v-if="canSend"
				to="/management/announcements/create"
				class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
				</svg>
				Tạo thông báo
			</NuxtLink>
		</div>

		<!-- Filter bar -->
		<div class="flex flex-col sm:flex-row flex-wrap gap-3 items-end">
			<div class="w-full sm:flex-1 sm:min-w-[240px] space-y-1.5">
				<label class="block text-xs font-medium text-gray-700 dark:text-gray-300">
					Tìm kiếm
				</label>
				<div class="relative">
					<svg
						class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
						/>
					</svg>
					<input
						v-model="filter.search"
						type="search"
						placeholder="Tìm theo tiêu đề, nội dung..."
						class="w-full h-10 pl-9 pr-3 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
					/>
				</div>
			</div>
			<div class="w-full sm:w-72 space-y-1.5">
				<label class="block text-xs font-medium text-gray-700 dark:text-gray-300">
					Ngày tạo
				</label>
				<UiDateRangePicker
					:from-date="filter.createdAtFrom"
					:to-date="filter.createdAtTo"
					placeholder="Chọn khoảng ngày"
					@update:from-date="filter.createdAtFrom = $event"
					@update:to-date="filter.createdAtTo = $event"
				/>
				<p v-if="dateRangeError" class="text-xs text-red-500">{{ dateRangeError }}</p>
			</div>
			<div class="flex items-center gap-3">
				<CommonAppButton variant="outline" @click="resetFilter">Xoá lọc</CommonAppButton>
			</div>
		</div>

		<!-- Table -->
		<div
			class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
		>
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-14">
								STT
							</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								Tiêu đề
							</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
								Người gửi
							</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
								Thời điểm gửi
							</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
								Trạng thái
							</th>
							<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-20">
								Tác vụ
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
						<tr v-if="loading">
							<td colspan="6" class="px-4 py-10 text-center">
								<svg class="animate-spin w-5 h-5 mx-auto text-brand-500" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
								</svg>
							</td>
						</tr>
						<tr v-else-if="items.length === 0">
							<td colspan="6" class="px-4 py-12 text-center text-sm text-gray-400 dark:text-gray-500">
								<p class="text-2xl mb-1">📤</p>
								Chưa có thông báo nào
							</td>
						</tr>
						<tr
							v-for="(item, idx) in items"
							:key="item.id"
							:class="[
								'hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
								item.status === 'RECALLED' ? 'opacity-60' : '',
							]"
						>
							<td class="px-4 py-3 text-gray-500 dark:text-gray-400">{{ stt(idx) }}</td>
							<td class="px-4 py-3 min-w-[240px] max-w-md">
								<div class="flex items-center gap-2">
									<span class="flex-shrink-0 text-base">
										{{ ANNOUNCEMENT_TYPE_CONFIG[item.announcementType].icon }}
									</span>
									<NuxtLink
										:to="`/management/announcements/${item.id}`"
										:class="[
											'text-sm font-medium truncate hover:text-brand-600 dark:hover:text-brand-400 transition-colors',
											item.status === 'RECALLED'
												? 'text-gray-500 dark:text-gray-500 line-through'
												: 'text-gray-900 dark:text-white',
										]"
									>
										{{ item.title }}
									</NuxtLink>
								</div>
							</td>
							<td class="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
								{{ item.createdBy.fullName }}
							</td>
							<td class="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
								{{ formatDateTime(item.sentAt) }}
							</td>
							<td class="px-4 py-3 whitespace-nowrap">
								<span
									v-if="item.status === 'RECALLED'"
									:title="item.recalledAt ? `Thu hồi lúc ${formatDateTime(item.recalledAt)}` : 'Đã thu hồi'"
									class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
								>
									🚫 Đã thu hồi
								</span>
								<span
									v-else
									class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
								>
									● Đang hiển thị
								</span>
							</td>
							<td class="px-4 py-3">
								<div class="flex justify-end">
									<UiDropdownMenu :items="buildActions(item)" />
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>

		<!-- Pagination -->
		<div v-if="meta && meta.totalPages > 1" class="flex items-center justify-between pt-1">
			<p class="text-sm text-gray-500 dark:text-gray-400">
				Tổng <strong class="text-gray-700 dark:text-gray-300">{{ meta.total }}</strong> thông báo
			</p>
			<CommonAppPagination
				:current-page="filter.page"
				:total-pages="meta.totalPages"
				@update:current-page="changePage"
			/>
		</div>
	</div>
</template>
