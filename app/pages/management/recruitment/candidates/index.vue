<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import RecruitChip from '~/components/modules/recruitment/RecruitChip.vue';
	import RecruitCandidateFormModal from '~/components/modules/recruitment/RecruitCandidateFormModal.vue';
	import RecruitCandidateImportModal from '~/components/modules/recruitment/RecruitCandidateImportModal.vue';
	import { recruitErrorMessage, APPLICATION_STATUS_CLASS } from '~/utils/recruitment.utils';
	import { formatDate } from '~/utils/date';
	import {
		STAGE_KIND_LABELS,
		type CandidateQueryParams,
		type RecruitmentCandidateDetail,
		type RecruitmentCandidateListItem,
		type RecruitmentSource,
		type RecruitmentStageKind,
		type RecruitmentTag,
	} from '~/types/recruitment.types';
	import type { PaginatedMeta } from '~/types/api.types';

	definePageMeta({ title: 'Kho ứng viên' });

	const router = useRouter();
	const toast = useToast();
	const service = useRecruitmentService();
	const { canWrite } = useModuleAccess();
	const { hasPermission } = usePermissions();

	const canManage = computed(() => canWrite('RECRUIT') && hasPermission('recruitment:manage'));

	/**
	 * Tab "Không tái tuyển" lọc bằng `isBlacklisted`, mà tham số đó CHỈ người có
	 * `recruitment:manage` gửi được — người khác gửi lên nhận 403, đúng theo thiết kế để
	 * không ai dò được ai đang bị đánh dấu. Vì vậy tab này chỉ hiện cho người quản lý.
	 */
	type Tab = 'all' | 'pool' | 'blacklist';
	const tab = ref<Tab>('all');

	const search = ref('');
	const filterSource = ref<number | undefined>(undefined);
	const filterTag = ref<number | undefined>(undefined);
	const filterStageKind = ref<RecruitmentStageKind | ''>('');
	const page = ref(1);
	const limit = 20;

	const rows = ref<RecruitmentCandidateListItem[]>([]);
	const meta = ref<PaginatedMeta | null>(null);
	const loading = ref(true);
	const sources = ref<RecruitmentSource[]>([]);
	const tags = ref<RecruitmentTag[]>([]);

	const showForm = ref(false);
	const showImport = ref(false);

	function currentQuery(): CandidateQueryParams {
		return {
			search: search.value || undefined,
			sourceId: filterSource.value,
			tagId: filterTag.value,
			stageKind: filterStageKind.value || undefined,
			talentPool: tab.value === 'pool' ? true : undefined,
			isBlacklisted: tab.value === 'blacklist' ? true : undefined,
		};
	}

	async function load() {
		loading.value = true;
		try {
			const res = await service.findCandidates({ ...currentQuery(), page: page.value, limit });
			rows.value = res.data;
			meta.value = res.meta;
		} catch (e) {
			rows.value = [];
			meta.value = null;
			toast.error(recruitErrorMessage(e, 'Không tải được kho ứng viên'));
		} finally {
			loading.value = false;
		}
	}

	onMounted(async () => {
		try {
			const [sourceList, tagList] = await Promise.all([
				service.findSources(true),
				service.findTags(true),
			]);
			sources.value = sourceList;
			tags.value = tagList;
		} catch {
			// Ô lọc rỗng thì bảng vẫn chạy bình thường.
		}
		await load();
	});

	watch([search, filterSource, filterTag, filterStageKind, tab], () => {
		page.value = 1;
		load();
	});
	watch(page, () => load());

	let searchTimer: ReturnType<typeof setTimeout> | null = null;
	function onSearchInput(e: Event) {
		const val = (e.target as HTMLInputElement).value;
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			search.value = val;
		}, 300);
	}

	const sourceOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Tất cả nguồn' },
		...sources.value.map(s => ({ value: s.id as number | undefined, label: s.name })),
	]);

	const tagOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Tất cả tag' },
		...tags.value.map(t => ({ value: t.id as number | undefined, label: t.name })),
	]);

	const stageKindOptions = [
		{ value: '', label: 'Mọi vòng' },
		...Object.entries(STAGE_KIND_LABELS).map(([value, label]) => ({ value, label })),
	];

	const tabs = computed(() => {
		const list: { id: Tab; label: string }[] = [
			{ id: 'all', label: 'Tất cả' },
			{ id: 'pool', label: 'Kho tiềm năng' },
		];
		if (canManage.value) list.push({ id: 'blacklist', label: 'Không tái tuyển' });
		return list;
	});

	/** Cột "Không tái tuyển" chỉ có nghĩa khi người xem được thấy cờ đó. */
	const showBlacklistColumn = computed(() => rows.value.some(r => r.isBlacklisted !== null));

	function activeApplication(row: RecruitmentCandidateListItem) {
		return row.applications.find(a => a.status === 'ACTIVE') ?? row.applications[0] ?? null;
	}

	function onCreated(candidate: RecruitmentCandidateDetail) {
		showForm.value = false;
		toast.success('Đã thêm ứng viên');
		router.push(`/management/recruitment/candidates/${candidate.id}`);
	}
</script>

<template>
	<div class="space-y-5">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h1 class="text-xl font-bold text-gray-900 dark:text-white">Kho ứng viên</h1>
				<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
					Toàn bộ ứng viên của công ty, gồm cả người đã lưu vào kho tiềm năng
				</p>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<CommonAppButton v-if="canManage" variant="outline" @click="showImport = true">
					Nhập nhiều
				</CommonAppButton>
				<CommonAppButton v-if="canManage" variant="primary" @click="showForm = true">
					Thêm ứng viên
				</CommonAppButton>
			</div>
		</div>

		<CommonAppModuleNotice module="RECRUIT" />

		<div class="border-b border-gray-200 dark:border-gray-700">
			<nav class="-mb-px flex flex-wrap gap-1">
				<button
					v-for="t in tabs"
					:key="t.id"
					type="button"
					class="border-b-2 px-4 py-2.5 text-sm font-medium transition-colors"
					:class="
						tab === t.id
							? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
							: 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
					"
					@click="tab = t.id"
				>
					{{ t.label }}
				</button>
			</nav>
		</div>

		<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<div class="relative">
					<svg
						class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
					</svg>
					<input
						type="text"
						placeholder="Tìm tên, email hoặc số điện thoại..."
						class="block w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						@input="onSearchInput"
					/>
				</div>
				<UiSelect v-model="filterStageKind" :options="stageKindOptions" />
				<UiSelect v-model="filterSource" :options="sourceOptions" />
				<UiSelect v-model="filterTag" :options="tagOptions" />
			</div>
			<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
				Ô tìm kiếm so cả số điện thoại đã chuẩn hoá, nên gõ dạng nào cũng ra, kể cả có dấu chấm hay mã
				vùng quốc tế.
			</p>
		</div>

		<div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
			<div v-if="loading" class="space-y-3 p-6">
				<div v-for="i in 5" :key="i" class="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
			</div>

			<div
				v-else-if="!rows.length"
				class="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500"
			>
				<svg class="mb-3 h-10 w-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
					/>
				</svg>
				<p class="text-sm">Không tìm thấy ứng viên nào</p>
			</div>

			<div v-else class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Ứng viên</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Liên hệ</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Hồ sơ gần nhất</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Nguồn</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tag</th>
							<th v-if="showBlacklistColumn" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Đánh dấu</th>
							<th class="px-4 py-3" />
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
						<tr
							v-for="row in rows"
							:key="row.id"
							class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40"
						>
							<td class="px-4 py-3">
								<NuxtLink
									:to="`/management/recruitment/candidates/${row.id}`"
									class="font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
								>
									{{ row.fullName }}
								</NuxtLink>
								<p v-if="row.currentTitle || row.currentCompany" class="text-xs text-gray-400">
									{{ [row.currentTitle, row.currentCompany].filter(Boolean).join(' · ') }}
								</p>
								<div class="mt-1 flex flex-wrap gap-1">
									<RecruitChip
										v-if="row.isDraft"
										label="Nháp"
										tone="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
									/>
									<RecruitChip
										v-if="row.inTalentPool"
										label="Kho tiềm năng"
										tone="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
									/>
								</div>
							</td>
							<td class="px-4 py-3 text-gray-700 dark:text-gray-300">
								<p class="truncate">{{ row.email ?? '—' }}</p>
								<p class="text-xs text-gray-400">{{ row.phone ?? '—' }}</p>
							</td>
							<td class="px-4 py-3">
								<template v-if="activeApplication(row)">
									<NuxtLink
										:to="`/management/recruitment/jobs/${activeApplication(row)?.jobId}`"
										class="text-gray-700 hover:text-brand-600 dark:text-gray-300 dark:hover:text-brand-400"
									>
										{{ activeApplication(row)?.job.title }}
									</NuxtLink>
									<div class="mt-0.5 flex flex-wrap items-center gap-1">
										<span class="text-xs text-gray-400">{{ activeApplication(row)?.stage.name }}</span>
										<RecruitChip
											:label="activeApplication(row)?.statusLabel ?? ''"
											:tone="APPLICATION_STATUS_CLASS[activeApplication(row)?.status ?? 'ACTIVE']"
										/>
									</div>
								</template>
								<span v-else class="text-xs text-gray-400">Chưa ứng tuyển tin nào</span>
							</td>
							<td class="px-4 py-3 text-gray-700 dark:text-gray-300">{{ row.source?.name ?? '—' }}</td>
							<td class="px-4 py-3">
								<div v-if="row.tags.length" class="flex flex-wrap gap-1">
									<span
										v-for="t in row.tags"
										:key="t.id"
										class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300"
									>
										{{ t.name }}
									</span>
								</div>
								<span v-else class="text-xs text-gray-400">—</span>
							</td>
							<td v-if="showBlacklistColumn" class="px-4 py-3">
								<RecruitChip
									v-if="row.isBlacklisted === true"
									label="Không tái tuyển"
									tone="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
								/>
								<span v-else class="text-xs text-gray-400">—</span>
							</td>
							<td class="px-4 py-3 text-right">
								<NuxtLink
									:to="`/management/recruitment/candidates/${row.id}`"
									class="text-xs text-brand-600 hover:underline dark:text-brand-400"
								>
									Xem hồ sơ
								</NuxtLink>
								<p class="mt-0.5 text-xs text-gray-400">{{ formatDate(row.createdAt) }}</p>
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<div
				v-if="meta && meta.totalPages > 1"
				class="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-800"
			>
				<p class="text-xs text-gray-500 dark:text-gray-400">
					{{ (page - 1) * limit + 1 }}–{{ Math.min(page * limit, meta.total) }} / {{ meta.total }} ứng viên
				</p>
				<CommonAppPagination
					:current-page="page"
					:total-pages="meta.totalPages"
					@update:current-page="page = $event"
				/>
			</div>
		</div>

		<RecruitCandidateFormModal v-if="showForm" @saved="onCreated" @close="showForm = false" />
		<RecruitCandidateImportModal
			v-if="showImport"
			@done="
				showImport = false;
				page = 1;
				load();
			"
			@close="showImport = false"
		/>
	</div>
</template>
