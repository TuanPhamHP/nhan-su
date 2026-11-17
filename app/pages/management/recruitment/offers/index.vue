<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import RecruitChip from '~/components/modules/recruitment/RecruitChip.vue';
	import { formatRecruitMoney, recruitErrorMessage, OFFER_STATUS_CLASS } from '~/utils/recruitment.utils';
	import { formatDate } from '~/utils/date';
	import {
		OFFER_STATUS_LABELS,
		type RecruitmentJob,
		type RecruitmentOffer,
		type RecruitmentOfferStatus,
	} from '~/types/recruitment.types';
	import type { PaginatedMeta } from '~/types/api.types';

	definePageMeta({ title: 'Thư mời nhận việc' });

	const toast = useToast();
	const service = useRecruitmentService();

	const filterStatus = ref<RecruitmentOfferStatus | ''>('');
	const filterJob = ref<number | undefined>(undefined);
	/**
	 * Danh sách của API gồm MỌI phiên bản, kể cả bản đã bị thay bằng phiên bản mới. Để mặc
	 * định ẩn những bản đó đi, nếu không mỗi lần sửa điều khoản là danh sách lại dài thêm
	 * một dòng không còn hiệu lực.
	 */
	const includeSuperseded = ref(false);

	const page = ref(1);
	const limit = 20;

	const rows = ref<RecruitmentOffer[]>([]);
	const meta = ref<PaginatedMeta | null>(null);
	const jobs = ref<RecruitmentJob[]>([]);
	const loading = ref(true);

	async function load() {
		loading.value = true;
		try {
			const res = await service.findOffers({
				status: filterStatus.value || undefined,
				jobId: filterJob.value,
				page: page.value,
				limit,
			});
			rows.value = res.data;
			meta.value = res.meta;
		} catch (e) {
			rows.value = [];
			meta.value = null;
			toast.error(recruitErrorMessage(e, 'Không tải được danh sách offer'));
		} finally {
			loading.value = false;
		}
	}

	onMounted(async () => {
		try {
			const res = await service.findJobs({ limit: 100 });
			jobs.value = res.data;
		} catch {
			// Ô lọc tin rỗng thì bảng vẫn chạy.
		}
		await load();
	});

	watch([filterStatus, filterJob], () => {
		page.value = 1;
		load();
	});
	watch(page, () => load());

	const statusOptions = [
		{ value: '', label: 'Tất cả trạng thái' },
		...Object.entries(OFFER_STATUS_LABELS).map(([value, label]) => ({ value, label })),
	];

	const jobOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Tất cả tin' },
		...jobs.value.map(j => ({ value: j.id as number | undefined, label: `${j.code} · ${j.title}` })),
	]);

	const visibleRows = computed(() =>
		includeSuperseded.value ? rows.value : rows.value.filter(r => r.status !== 'SUPERSEDED'),
	);

	const hiddenCount = computed(() => rows.value.filter(r => r.status === 'SUPERSEDED').length);

	/** Cột tiền ẩn hẳn khi không bản ghi nào trong trang cho xem lương. */
	const showSalaryColumn = computed(() => rows.value.some(r => r.canViewSalary));
</script>

<template>
	<div class="space-y-5">
		<div>
			<h1 class="text-xl font-bold text-gray-900 dark:text-white">Thư mời nhận việc</h1>
			<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
				Offer đã tạo cho ứng viên, kèm trạng thái duyệt và phản hồi
			</p>
		</div>

		<CommonAppModuleNotice module="RECRUIT" />

		<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
				<UiSelect v-model="filterStatus" :options="statusOptions" />
				<UiSelect v-model="filterJob" :options="jobOptions" />
				<label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
					<input
						v-model="includeSuperseded"
						type="checkbox"
						class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
					/>
					Hiện cả bản đã có phiên bản mới
					<span v-if="hiddenCount && !includeSuperseded" class="text-xs text-gray-400">
						(đang ẩn {{ hiddenCount }})
					</span>
				</label>
			</div>
		</div>

		<div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
			<div v-if="loading" class="space-y-3 p-6">
				<div v-for="i in 5" :key="i" class="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
			</div>

			<div
				v-else-if="!visibleRows.length"
				class="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500"
			>
				<svg class="mb-3 h-10 w-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
					/>
				</svg>
				<p class="text-sm">Chưa có offer nào</p>
				<p class="mt-1 text-xs">Offer được tạo từ hồ sơ đang ở vòng Offer của một tin tuyển dụng.</p>
			</div>

			<div v-else class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Mã</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Ứng viên</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Vị trí</th>
							<th v-if="showSalaryColumn" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Lương</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Trạng thái</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Mốc thời gian</th>
							<th class="px-4 py-3" />
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
						<tr
							v-for="row in visibleRows"
							:key="row.id"
							class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40"
						>
							<td class="px-4 py-3">
								<NuxtLink
									:to="`/management/recruitment/offers/${row.id}`"
									class="font-mono text-xs font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
								>
									{{ row.code }}
								</NuxtLink>
								<p class="text-xs text-gray-400">phiên bản {{ row.version }}</p>
							</td>
							<td class="px-4 py-3">
								<NuxtLink
									:to="`/management/recruitment/candidates/${row.candidate.id}`"
									class="font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
								>
									{{ row.candidate.fullName }}
								</NuxtLink>
								<p class="truncate text-xs text-gray-400">{{ row.candidate.email ?? '—' }}</p>
							</td>
							<td class="px-4 py-3 text-gray-700 dark:text-gray-300">
								{{ row.position.name }}
								<p class="text-xs text-gray-400">{{ row.job.title }}</p>
							</td>
							<td v-if="showSalaryColumn" class="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
								{{ row.canViewSalary ? formatRecruitMoney(row.baseSalary) : '—' }}
								<p v-if="row.overBand" class="text-xs text-amber-600 dark:text-amber-400">vượt khung</p>
							</td>
							<td class="px-4 py-3">
								<RecruitChip :label="row.statusLabel" :tone="OFFER_STATUS_CLASS[row.status]" />
								<p v-if="row.employee" class="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">
									đã có hồ sơ nhân viên
								</p>
							</td>
							<td class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
								<p>Bắt đầu làm {{ formatDate(row.startDate) }}</p>
								<p v-if="row.status === 'SENT'">Hạn trả lời {{ formatDate(row.responseDeadline) }}</p>
								<p v-else-if="row.respondedAt">Phản hồi {{ formatDate(row.respondedAt) }}</p>
							</td>
							<td class="px-4 py-3 text-right">
								<NuxtLink
									:to="`/management/recruitment/offers/${row.id}`"
									class="text-xs text-brand-600 hover:underline dark:text-brand-400"
								>
									Xem chi tiết
								</NuxtLink>
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
					{{ (page - 1) * limit + 1 }}–{{ Math.min(page * limit, meta.total) }} / {{ meta.total }} offer
				</p>
				<CommonAppPagination
					:current-page="page"
					:total-pages="meta.totalPages"
					@update:current-page="page = $event"
				/>
			</div>
		</div>
	</div>
</template>
