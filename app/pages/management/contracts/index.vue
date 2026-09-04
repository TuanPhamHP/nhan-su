<script setup lang="ts">
	import { formatDate } from '~/utils/date';
	import type { ContractStatus, ContractType } from '~/types/contract.types';
	import { useContractService } from '~/services/contract.service';
	import ContractImportModal from '~/components/modules/contract/ContractImportModal.vue';

	definePageMeta({ title: 'Quản lý hợp đồng' });

	const toast = useToast();
	const authStore = useAuthStore();
	const canImport = computed(() => authStore.user?.role === 'ADMIN' || authStore.user?.role === 'HR');
	const showImportModal = ref(false);
	const { departments, fetchAll: fetchDepts } = useDepartment();

	// ─── Filters ──────────────────────────────────────────────────────────────────
	const search = ref('');
	const filterStatus = ref<ContractStatus | ''>('');
	const filterType = ref<ContractType | ''>('');
	const filterDept = ref<number | undefined>(undefined);
	const page = ref(1);
	const limit = 20;

	// ─── Table data ───────────────────────────────────────────────────────────────
	const service = useContractService();
	const { contracts, meta, loading, fetchAll } = useContracts();

	async function loadTable() {
		await fetchAll({
			search: search.value || undefined,
			status: filterStatus.value || undefined,
			contractType: filterType.value || undefined,
			departmentId: filterDept.value,
			page: page.value,
			limit,
		});
	}

	// ─── Summary counts ───────────────────────────────────────────────────────────
	const summaryLoading = ref(true);
	const countActive = ref(0);
	const countExpiring = ref(0);
	const countTerminated = ref(0);
	const countDraft = ref(0);

	async function loadSummary() {
		summaryLoading.value = true;
		try {
			const [active, terminated, draft] = await Promise.all([
				service.findAll({ status: 'ACTIVE', limit: 500 }),
				service.findAll({ status: 'TERMINATED', limit: 1 }),
				service.findAll({ status: 'DRAFT', limit: 1 }),
			]);
			countActive.value = active.meta.total;
			countExpiring.value = active.data.filter(c => c.isExpiringSoon).length;
			countTerminated.value = terminated.meta.total;
			countDraft.value = draft.meta.total;
		} catch {
			// non-critical
		} finally {
			summaryLoading.value = false;
		}
	}

	onMounted(async () => {
		await Promise.all([fetchDepts(), loadSummary(), loadTable()]);
	});

	// Refetch table when filters change
	watch([search, filterStatus, filterType, filterDept], () => {
		page.value = 1;
		loadTable();
	});

	watch(page, () => loadTable());

	async function onImportSuccess() {
		showImportModal.value = false;
		page.value = 1;
		await Promise.all([loadSummary(), loadTable()]);
	}

	// ─── Debounce search ──────────────────────────────────────────────────────────
	let searchTimer: ReturnType<typeof setTimeout> | null = null;
	function onSearchInput(e: Event) {
		const val = (e.target as HTMLInputElement).value;
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			search.value = val;
		}, 300);
	}

	// ─── Department options ───────────────────────────────────────────────────────
	const deptOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Tất cả phòng ban' },
		...departments.value.map(d => ({ value: d.id as number | undefined, label: d.name })),
	]);

	// ─── Status/type options ──────────────────────────────────────────────────────
	const statusOptions = [
		{ value: '', label: 'Tất cả trạng thái' },
		{ value: 'ACTIVE', label: 'Đang hiệu lực' },
		{ value: 'DRAFT', label: 'Bản nháp' },
		{ value: 'EXPIRED', label: 'Đã hết hạn' },
		{ value: 'TERMINATED', label: 'Đã chấm dứt' },
	];

	const typeOptions = [
		{ value: '', label: 'Tất cả loại HĐ' },
		{ value: 'PROBATION', label: 'Thử việc' },
		{ value: 'FIXED_TERM', label: 'Xác định thời hạn' },
		{ value: 'INDEFINITE', label: 'Không xác định thời hạn' },
		{ value: 'SEASONAL', label: 'Thời vụ' },
	];

	// ─── Style helpers ────────────────────────────────────────────────────────────
	const statusCls: Record<ContractStatus, string> = {
		DRAFT: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
		ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
		EXPIRED: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
		TERMINATED: 'bg-rose-200 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
	};

	const typeCls: Record<ContractType, string> = {
		PROBATION: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
		FIXED_TERM: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
		INDEFINITE: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
		SEASONAL: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
	};

	function formatCurrency(amount: number | null): string {
		if (amount === null) return '—';
		return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
	}
</script>

<template>
	<div class="space-y-6">
		<!-- Page header -->
		<div class="flex items-start justify-between gap-3 flex-wrap">
			<div>
				<h1 class="text-xl font-bold text-gray-900 dark:text-white">Quản lý hợp đồng</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Hợp đồng lao động toàn công ty</p>
			</div>
			<CommonAppButton v-if="canImport" variant="primary" @click="showImportModal = true">
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
					/>
				</svg>
				Import Excel
			</CommonAppButton>
		</div>

		<!-- Summary cards -->
		<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
			<!-- Active -->
			<div
				class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 flex items-center gap-3"
			>
				<div
					class="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0"
				>
					<svg
						class="w-5 h-5 text-green-600 dark:text-green-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</div>
				<div>
					<p class="text-xs text-gray-500 dark:text-gray-400">Đang hiệu lực</p>
					<p class="text-xl font-bold text-gray-900 dark:text-white">
						<span
							v-if="summaryLoading"
							class="inline-block w-8 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
						/>
						<span v-else>{{ countActive }}</span>
					</p>
				</div>
			</div>

			<!-- Expiring soon -->
			<div
				class="bg-white dark:bg-gray-900 rounded-xl border border-amber-200 dark:border-amber-700/50 shadow-sm p-4 flex items-center gap-3"
			>
				<div
					class="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0"
				>
					<svg
						class="w-5 h-5 text-amber-600 dark:text-amber-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
						/>
					</svg>
				</div>
				<div>
					<p class="text-xs text-gray-500 dark:text-gray-400">Hết hạn trong 30 ngày</p>
					<p class="text-xl font-bold text-amber-600 dark:text-amber-400">
						<span
							v-if="summaryLoading"
							class="inline-block w-8 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
						/>
						<span v-else>{{ countExpiring }}</span>
					</p>
				</div>
			</div>

			<!-- Terminated -->
			<div
				class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 flex items-center gap-3"
			>
				<div
					class="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center flex-shrink-0"
				>
					<svg
						class="w-5 h-5 text-rose-600 dark:text-rose-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</div>
				<div>
					<p class="text-xs text-gray-500 dark:text-gray-400">Đã chấm dứt</p>
					<p class="text-xl font-bold text-gray-900 dark:text-white">
						<span
							v-if="summaryLoading"
							class="inline-block w-8 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
						/>
						<span v-else>{{ countTerminated }}</span>
					</p>
				</div>
			</div>

			<!-- Draft -->
			<div
				class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 flex items-center gap-3"
			>
				<div class="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
					<svg
						class="w-5 h-5 text-gray-500 dark:text-gray-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
						/>
					</svg>
				</div>
				<div>
					<p class="text-xs text-gray-500 dark:text-gray-400">Bản nháp</p>
					<p class="text-xl font-bold text-gray-900 dark:text-white">
						<span
							v-if="summaryLoading"
							class="inline-block w-8 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
						/>
						<span v-else>{{ countDraft }}</span>
					</p>
				</div>
			</div>
		</div>

		<!-- Filters -->
		<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
				<!-- Search -->
				<div class="relative">
					<svg
						class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
					</svg>
					<input
						type="text"
						placeholder="Tìm theo tên nhân viên..."
						class="block w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
						@input="onSearchInput"
					/>
				</div>

				<!-- Contract type -->
				<UiSelect v-model="filterType" :options="typeOptions" />

				<!-- Status -->
				<UiSelect v-model="filterStatus" :options="statusOptions" />

				<!-- Department -->
				<UiSelect v-model="filterDept" :options="deptOptions" />
			</div>
		</div>

		<!-- Table -->
		<div
			class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
		>
			<!-- Loading skeleton -->
			<div v-if="loading" class="p-6 space-y-3">
				<div v-for="i in 5" :key="i" class="h-10 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
			</div>

			<!-- Empty state -->
			<div
				v-else-if="!contracts.length"
				class="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500"
			>
				<svg class="w-10 h-10 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
					/>
				</svg>
				<p class="text-sm">Không tìm thấy hợp đồng nào</p>
			</div>

			<!-- Table content -->
			<div v-else class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
							<th
								class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
							>
								Nhân viên
							</th>
							<th
								class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
							>
								Số HĐ
							</th>
							<th
								class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
							>
								Loại
							</th>
							<th
								class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
							>
								Ngày bắt đầu
							</th>
							<th
								class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
							>
								Ngày kết thúc
							</th>
							<th
								class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
							>
								Lương CB
							</th>
							<th
								class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
							>
								Trạng thái
							</th>
							<th class="px-4 py-3" />
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
						<tr
							v-for="c in contracts"
							:key="c.id"
							class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40"
							:class="c.isExpiringSoon ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''"
						>
							<td class="px-4 py-3">
								<NuxtLink
									:to="`/management/employees/${c.employee.id}`"
									class="font-medium text-gray-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400"
								>
									{{ c.employee.fullName }}
								</NuxtLink>
								<p class="text-xs text-gray-400 font-mono">{{ c.employee.employeeCode }}</p>
								<p v-if="c.employee.department" class="text-xs text-gray-400">{{ c.employee.department }}</p>
							</td>
							<td class="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">
								<div class="flex items-center gap-1.5">
									{{ c.contractNumber }}
									<svg
										v-if="c.isExpiringSoon"
										class="w-3.5 h-3.5 text-amber-500 flex-shrink-0"
										fill="currentColor"
										viewBox="0 0 20 20"
									>
										<path
											fill-rule="evenodd"
											d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
											clip-rule="evenodd"
										/>
									</svg>
								</div>
								<p
									v-if="c.isExpiringSoon && c.daysUntilExpiry !== null"
									class="text-xs text-amber-600 dark:text-amber-400 mt-0.5"
								>
									Còn {{ c.daysUntilExpiry }} ngày
								</p>
							</td>
							<td class="px-4 py-3">
								<span
									class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
									:class="typeCls[c.contractType]"
								>
									{{ c.contractTypeLabel }}
								</span>
							</td>
							<td class="px-4 py-3 text-gray-700 dark:text-gray-300">{{ formatDate(c.startDate) }}</td>
							<td class="px-4 py-3 text-gray-700 dark:text-gray-300">
								{{ c.endDate ? formatDate(c.endDate) : '—' }}
							</td>
							<td class="px-4 py-3 text-gray-700 dark:text-gray-300">{{ formatCurrency(c.baseSalary) }}</td>
							<td class="px-4 py-3">
								<span
									class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
									:class="statusCls[c.status]"
								>
									{{ c.statusLabel }}
								</span>
							</td>
							<td class="px-4 py-3 text-right">
								<NuxtLink
									:to="`/management/employees/${c.employee.id}?tab=contracts`"
									class="text-xs text-brand-600 dark:text-brand-400 hover:underline"
								>
									Xem chi tiết
								</NuxtLink>
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<!-- Pagination -->
			<div
				v-if="meta && meta.totalPages > 1"
				class="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800"
			>
				<p class="text-xs text-gray-500 dark:text-gray-400">
					{{ (page - 1) * limit + 1 }}–{{ Math.min(page * limit, meta.total) }} / {{ meta.total }} hợp đồng
				</p>
				<div class="flex items-center gap-1">
					<CommonAppButton size="sm" variant="outline" :disabled="page <= 1" @click="page--"> ‹ </CommonAppButton>
					<span class="px-3 py-1 text-xs text-gray-600 dark:text-gray-400">{{ page }} / {{ meta.totalPages }}</span>
					<CommonAppButton size="sm" variant="outline" :disabled="page >= meta.totalPages" @click="page++">
						›
					</CommonAppButton>
				</div>
			</div>
		</div>

		<ContractImportModal v-if="showImportModal" @close="showImportModal = false" @imported="onImportSuccess" />
	</div>
</template>
