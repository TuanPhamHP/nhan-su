<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import RecruitChip from '~/components/modules/recruitment/RecruitChip.vue';
	import RecruitRequisitionFormModal from '~/components/modules/recruitment/RecruitRequisitionFormModal.vue';
	import {
		formatRecruitMoney,
		headcountYearOptions,
		recruitErrorMessage,
		REQUISITION_STATUS_CLASS,
	} from '~/utils/recruitment.utils';
	import { formatDate } from '~/utils/date';
	import {
		REQUISITION_STATUS_LABELS,
		type RecruitmentRequisitionStatus,
		type Requisition,
	} from '~/types/recruitment.types';
	import type { PaginatedMeta } from '~/types/api.types';

	definePageMeta({ title: 'Yêu cầu tuyển dụng' });

	const router = useRouter();
	const toast = useToast();
	const service = useRecruitmentService();
	const { canWrite } = useModuleAccess();
	const { hasPermission } = usePermissions();
	const directoryStore = useDirectoryStore();
	const { departments, positions } = storeToRefs(directoryStore);

	const canCreate = computed(
		() => canWrite('RECRUIT') && hasPermission('recruitment:requisition:create'),
	);

	const search = ref('');
	const filterStatus = ref<RecruitmentRequisitionStatus | ''>('');
	const filterDept = ref<number | undefined>(undefined);
	const filterPosition = ref<number | undefined>(undefined);
	const filterYear = ref<number | undefined>(undefined);
	const page = ref(1);
	const limit = 20;

	const rows = ref<Requisition[]>([]);
	const meta = ref<PaginatedMeta | null>(null);
	const loading = ref(true);
	const showForm = ref(false);

	async function load() {
		loading.value = true;
		try {
			const res = await service.findRequisitions({
				search: search.value || undefined,
				status: filterStatus.value || undefined,
				departmentId: filterDept.value,
				positionId: filterPosition.value,
				year: filterYear.value,
				page: page.value,
				limit,
			});
			rows.value = res.data;
			meta.value = res.meta;
		} catch (e) {
			rows.value = [];
			meta.value = null;
			toast.error(recruitErrorMessage(e, 'Không tải được danh sách yêu cầu tuyển dụng'));
		} finally {
			loading.value = false;
		}
	}

	onMounted(async () => {
		directoryStore.load().catch(() => {
			/* ô lọc rỗng, bảng vẫn chạy */
		});
		await load();
	});

	watch([search, filterStatus, filterDept, filterPosition, filterYear], () => {
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

	const statusOptions = [
		{ value: '', label: 'Tất cả trạng thái' },
		...Object.entries(REQUISITION_STATUS_LABELS).map(([value, label]) => ({ value, label })),
	];

	const deptOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Tất cả phòng ban' },
		...departments.value.map(d => ({ value: d.id as number | undefined, label: d.name })),
	]);

	const positionOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Tất cả vị trí' },
		...positions.value.map(p => ({ value: p.id as number | undefined, label: p.name })),
	]);

	const yearOptions = [
		{ value: undefined as number | undefined, label: 'Tất cả năm' },
		...headcountYearOptions().map(o => ({ value: o.value as number | undefined, label: o.label })),
	];

	/** Cột khung lương ẩn hẳn khi không bản ghi nào trong trang cho xem lương. */
	const showSalaryColumn = computed(() => rows.value.some(r => r.canViewSalary));

	function onCreated(created: Requisition) {
		showForm.value = false;
		toast.success(`Đã tạo yêu cầu ${created.code} ở trạng thái Nháp`);
		router.push(`/management/recruitment/requisitions/${created.id}`);
	}
</script>

<template>
	<div class="space-y-5">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h1 class="text-xl font-bold text-gray-900 dark:text-white">Yêu cầu tuyển dụng</h1>
				<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
					Đề nghị tuyển người của từng phòng, có duyệt trước khi mở tin
				</p>
			</div>
			<CommonAppButton v-if="canCreate" variant="primary" @click="showForm = true">
				Tạo yêu cầu
			</CommonAppButton>
		</div>

		<CommonAppModuleNotice module="RECRUIT" />

		<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
						placeholder="Tìm theo mã yêu cầu..."
						class="block w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						@input="onSearchInput"
					/>
				</div>
				<UiSelect v-model="filterStatus" :options="statusOptions" />
				<UiSelect v-model="filterDept" :options="deptOptions" />
				<UiSelect v-model="filterPosition" :options="positionOptions" />
				<UiSelect v-model="filterYear" :options="yearOptions" />
			</div>
		</div>

		<div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
			<div v-if="loading" class="space-y-3 p-6">
				<div v-for="i in 5" :key="i" class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
			</div>

			<div
				v-else-if="!rows.length"
				class="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500"
			>
				<svg class="mb-3 h-10 w-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
					/>
				</svg>
				<p class="text-sm">Không tìm thấy yêu cầu tuyển dụng nào</p>
			</div>

			<div v-else class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Mã</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Vị trí</th>
							<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Số lượng</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Lý do</th>
							<th v-if="showSalaryColumn" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Khung lương</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Trạng thái</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tin</th>
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
									:to="`/management/recruitment/requisitions/${row.id}`"
									class="font-mono text-xs font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
								>
									{{ row.code }}
								</NuxtLink>
								<p class="mt-0.5 text-xs text-gray-400">{{ formatDate(row.createdAt) }}</p>
							</td>
							<td class="px-4 py-3">
								<p class="font-medium text-gray-900 dark:text-white">{{ row.position.name }}</p>
								<p class="text-xs text-gray-400">{{ row.department.name }}</p>
							</td>
							<td class="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
								{{ row.quantity }}
								<p v-if="row.hiredCount > 0" class="text-xs text-emerald-600 dark:text-emerald-400">
									đã tuyển {{ row.hiredCount }}
								</p>
							</td>
							<td class="px-4 py-3 text-gray-700 dark:text-gray-300">
								{{ row.reasonLabel }}
								<p v-if="row.replacedEmployee" class="text-xs text-gray-400">
									thay {{ row.replacedEmployee.fullName }}
								</p>
							</td>
							<td v-if="showSalaryColumn" class="px-4 py-3 tabular-nums text-gray-700 dark:text-gray-300">
								<template v-if="!row.canViewSalary">—</template>
								<template v-else-if="row.salaryMin == null && row.salaryMax == null">
									<span class="text-gray-400">Chưa nhập</span>
								</template>
								<template v-else>
									{{ formatRecruitMoney(row.salaryMin) }} – {{ formatRecruitMoney(row.salaryMax) }}
								</template>
							</td>
							<td class="px-4 py-3">
								<RecruitChip :label="row.statusLabel" :tone="REQUISITION_STATUS_CLASS[row.status]" />
								<p v-if="row.neededBy" class="mt-0.5 text-xs text-gray-400">
									cần trước {{ formatDate(row.neededBy) }}
								</p>
							</td>
							<td class="px-4 py-3">
								<p v-if="!row.jobs.length" class="text-xs text-gray-400">Chưa có tin</p>
								<NuxtLink
									v-for="job in row.jobs"
									:key="job.id"
									:to="`/management/recruitment/jobs/${job.id}`"
									class="block text-xs text-brand-600 hover:underline dark:text-brand-400"
								>
									{{ job.code }} · {{ job.statusLabel }}
								</NuxtLink>
							</td>
							<td class="px-4 py-3 text-right">
								<NuxtLink
									:to="`/management/recruitment/requisitions/${row.id}`"
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
					{{ (page - 1) * limit + 1 }}–{{ Math.min(page * limit, meta.total) }} / {{ meta.total }} yêu cầu
				</p>
				<CommonAppPagination
					:current-page="page"
					:total-pages="meta.totalPages"
					@update:current-page="page = $event"
				/>
			</div>
		</div>

		<RecruitRequisitionFormModal v-if="showForm" @saved="onCreated" @close="showForm = false" />
	</div>
</template>
