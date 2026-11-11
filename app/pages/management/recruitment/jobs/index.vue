<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import RecruitChip from '~/components/modules/recruitment/RecruitChip.vue';
	import RecruitJobFormModal from '~/components/modules/recruitment/RecruitJobFormModal.vue';
	import { recruitErrorMessage, JOB_STATUS_CLASS } from '~/utils/recruitment.utils';
	import { formatDate } from '~/utils/date';
	import {
		JOB_STATUS_LABELS,
		type RecruitmentJob,
		type RecruitmentJobStatus,
	} from '~/types/recruitment.types';
	import type { PaginatedMeta } from '~/types/api.types';

	definePageMeta({ title: 'Tin tuyển dụng' });

	const router = useRouter();
	const toast = useToast();
	const service = useRecruitmentService();
	const { canWrite } = useModuleAccess();
	const { hasPermission } = usePermissions();
	const directoryStore = useDirectoryStore();
	const { departments } = storeToRefs(directoryStore);

	const canManage = computed(() => canWrite('RECRUIT') && hasPermission('recruitment:manage'));

	const search = ref('');
	const filterStatus = ref<RecruitmentJobStatus | ''>('');
	const filterDept = ref<number | undefined>(undefined);
	const page = ref(1);
	const limit = 20;

	const rows = ref<RecruitmentJob[]>([]);
	const meta = ref<PaginatedMeta | null>(null);
	const loading = ref(true);
	const showForm = ref(false);

	async function load() {
		loading.value = true;
		try {
			const res = await service.findJobs({
				search: search.value || undefined,
				status: filterStatus.value || undefined,
				departmentId: filterDept.value,
				page: page.value,
				limit,
			});
			rows.value = res.data;
			meta.value = res.meta;
		} catch (e) {
			rows.value = [];
			meta.value = null;
			toast.error(recruitErrorMessage(e, 'Không tải được danh sách tin tuyển dụng'));
		} finally {
			loading.value = false;
		}
	}

	onMounted(async () => {
		directoryStore.load().catch(() => {
			/* ô lọc phòng ban rỗng, bảng vẫn chạy */
		});
		await load();
	});

	watch([search, filterStatus, filterDept], () => {
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
		...Object.entries(JOB_STATUS_LABELS).map(([value, label]) => ({ value, label })),
	];

	const deptOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Tất cả phòng ban' },
		...departments.value.map(d => ({ value: d.id as number | undefined, label: d.name })),
	]);

	/**
	 * Link công khai: BE chỉ trả đường dẫn, FE ghép với domain đang chạy. Tin Nội bộ cũng có
	 * link và mở được, chỉ là không nằm trong danh sách công khai.
	 */
	function publicUrl(job: RecruitmentJob): string {
		return `${window.location.origin}${job.publicPath}`;
	}

	async function copyPublicLink(job: RecruitmentJob) {
		try {
			await navigator.clipboard.writeText(publicUrl(job));
			toast.success('Đã chép link công khai');
		} catch {
			toast.error('Trình duyệt không cho chép tự động, hãy mở tin và chép tay');
		}
	}

	function onCreated(jobId: number) {
		showForm.value = false;
		toast.success('Đã tạo tin ở trạng thái Nháp');
		router.push(`/management/recruitment/jobs/${jobId}`);
	}
</script>

<template>
	<div class="space-y-5">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h1 class="text-xl font-bold text-gray-900 dark:text-white">Tin tuyển dụng</h1>
				<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
					Tin đăng cho từng yêu cầu, mỗi tin có quy trình và hội đồng riêng
				</p>
			</div>
			<CommonAppButton v-if="canManage" variant="primary" @click="showForm = true">
				Tạo tin
			</CommonAppButton>
		</div>

		<CommonAppModuleNotice module="RECRUIT" />

		<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
						placeholder="Tìm mã hoặc tiêu đề tin..."
						class="block w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						@input="onSearchInput"
					/>
				</div>
				<UiSelect v-model="filterStatus" :options="statusOptions" />
				<UiSelect v-model="filterDept" :options="deptOptions" />
			</div>
		</div>

		<div v-if="loading" class="grid grid-cols-1 gap-3 lg:grid-cols-2">
			<div v-for="i in 4" :key="i" class="h-36 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>

		<div
			v-else-if="!rows.length"
			class="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 text-gray-400 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500"
		>
			<svg class="mb-3 h-10 w-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25M12 12.75h.008v.008H12v-.008z"
				/>
			</svg>
			<p class="text-sm">Không tìm thấy tin tuyển dụng nào</p>
		</div>

		<div v-else class="grid grid-cols-1 gap-3 lg:grid-cols-2">
			<div
				v-for="job in rows"
				:key="job.id"
				class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-brand-600"
			>
				<div class="flex flex-wrap items-start justify-between gap-2">
					<div class="min-w-0">
						<NuxtLink
							:to="`/management/recruitment/jobs/${job.id}`"
							class="font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
						>
							{{ job.title }}
						</NuxtLink>
						<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
							<span class="font-mono">{{ job.code }}</span>
							· {{ job.requisition.department.name }} · {{ job.requisition.position.name }}
						</p>
					</div>
					<div class="flex flex-col items-end gap-1">
						<RecruitChip :label="job.statusLabel" :tone="JOB_STATUS_CLASS[job.status]" />
						<RecruitChip
							v-if="job.visibility === 'INTERNAL'"
							:label="job.visibilityLabel"
							tone="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
						/>
					</div>
				</div>

				<dl class="mt-3 grid grid-cols-3 gap-2 text-center">
					<div class="rounded-lg bg-gray-50 px-2 py-1.5 dark:bg-gray-800/60">
						<dt class="text-xs text-gray-500 dark:text-gray-400">Hồ sơ đang xét</dt>
						<dd class="text-base font-semibold tabular-nums text-gray-900 dark:text-white">
							{{ job.activeApplicationCount }}
						</dd>
					</div>
					<div class="rounded-lg bg-gray-50 px-2 py-1.5 dark:bg-gray-800/60">
						<dt class="text-xs text-gray-500 dark:text-gray-400">Cần tuyển</dt>
						<dd class="text-base font-semibold tabular-nums text-gray-900 dark:text-white">
							{{ job.requisition.quantity }}
						</dd>
					</div>
					<div class="rounded-lg bg-gray-50 px-2 py-1.5 dark:bg-gray-800/60">
						<dt class="text-xs text-gray-500 dark:text-gray-400">Hội đồng</dt>
						<dd class="text-base font-semibold tabular-nums text-gray-900 dark:text-white">
							{{ job.team.length }}
						</dd>
					</div>
				</dl>

				<div class="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
					<p class="text-gray-500 dark:text-gray-400">
						Phụ trách {{ job.owner.fullName }}
						<template v-if="job.deadline"> · hạn nộp {{ formatDate(job.deadline) }}</template>
					</p>
					<div class="flex items-center gap-3">
						<button
							type="button"
							class="text-gray-500 hover:underline dark:text-gray-400"
							@click="copyPublicLink(job)"
						>
							Chép link công khai
						</button>
						<NuxtLink
							:to="`/management/recruitment/jobs/${job.id}`"
							class="text-brand-600 hover:underline dark:text-brand-400"
						>
							Mở bảng hồ sơ
						</NuxtLink>
					</div>
				</div>
			</div>
		</div>

		<div
			v-if="meta && meta.totalPages > 1"
			class="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-900"
		>
			<p class="text-xs text-gray-500 dark:text-gray-400">
				{{ (page - 1) * limit + 1 }}–{{ Math.min(page * limit, meta.total) }} / {{ meta.total }} tin
			</p>
			<CommonAppPagination
				:current-page="page"
				:total-pages="meta.totalPages"
				@update:current-page="page = $event"
			/>
		</div>

		<RecruitJobFormModal v-if="showForm" @created="onCreated" @close="showForm = false" />
	</div>
</template>
