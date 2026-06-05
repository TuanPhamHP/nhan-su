<script setup lang="ts">
	import { usePayrollService } from '~/services/payroll.service';
	import PayrollStatusBadge from '~/components/modules/payroll/PayrollStatusBadge.vue';
	import PayrollFormModal from '~/components/modules/payroll/PayrollFormModal.vue';
	import type { PayrollSummary, PayrollStatus, PayrollDetail } from '~/types/payroll.types';
	import type { PaginatedMeta } from '~/types/api.types';
	import AppUnderConstruction from '~/components/common/AppUnderConstruction.vue';

	definePageMeta({ title: 'Bảng lương' });

	const toast = useToast();
	const payrollService = usePayrollService();

	const now = new Date();
	const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

	const filter = reactive({
		month: defaultMonth,
		status: undefined as PayrollStatus | undefined,
		page: 1,
	});

	const payrolls = ref<PayrollSummary[]>([]);
	const loading = ref(false);
	const meta = ref<PaginatedMeta | null>(null);

	const summary = computed(() => {
		const draft = payrolls.value.filter(p => p.status === 'DRAFT').length;
		const published = payrolls.value.filter(p => p.status === 'PUBLISHED').length;
		const totalNet = payrolls.value.reduce((sum, p) => sum + p.netSalary, 0);
		return { total: meta.value?.total ?? payrolls.value.length, draft, published, totalNet };
	});

	async function fetchPayrolls() {
		loading.value = true;
		try {
			const res = await payrollService.findAll({
				month: filter.month || undefined,
				status: filter.status,
				page: filter.page,
				limit: 20,
			});
			payrolls.value = res.data;
			meta.value = res.meta;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi tải dữ liệu bảng lương');
		} finally {
			loading.value = false;
		}
	}

	function applyFilter() {
		filter.page = 1;
		fetchPayrolls();
	}

	// ─── Create / Edit ──────────────────────────────────────────────────────────
	const showForm = ref(false);
	const editTarget = ref<PayrollSummary | undefined>(undefined);

	function openCreate() {
		editTarget.value = undefined;
		showForm.value = true;
	}

	function openEdit(p: PayrollSummary) {
		editTarget.value = p;
		showForm.value = true;
	}

	function onSaved(_payroll: PayrollDetail) {
		showForm.value = false;
		fetchPayrolls();
	}

	// ─── Publish ────────────────────────────────────────────────────────────────
	const publishingId = ref<number | null>(null);

	async function handlePublish(p: PayrollSummary) {
		if (
			!confirm(
				`Phát hành bảng lương của ${p.employee.fullName} tháng ${formatMonth(p.month)}?\n\nNhân viên sẽ có thể xem phiếu lương này sau khi phát hành.`,
			)
		)
			return;
		publishingId.value = p.id;
		try {
			const updated = await payrollService.publish(p.id);
			const idx = payrolls.value.findIndex(x => x.id === p.id);
			if (idx !== -1) payrolls.value[idx].status = updated.status;
			toast.success('Đã phát hành phiếu lương');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
		} finally {
			publishingId.value = null;
		}
	}

	// ─── Export PDF ─────────────────────────────────────────────────────────────
	const exportingId = ref<number | null>(null);

	async function handleExport(p: PayrollSummary) {
		exportingId.value = p.id;
		try {
			const blob = await payrollService.exportPdf(p.id);
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `payslip-${p.employee.employeeCode}-${p.month}.pdf`;
			a.click();
			URL.revokeObjectURL(url);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Xuất PDF thất bại');
		} finally {
			exportingId.value = null;
		}
	}

	// ─── Helpers ────────────────────────────────────────────────────────────────
	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
	}

	function formatMonth(m: string): string {
		const [year, month] = m.split('-');
		return `Tháng ${parseInt(month)}/${year}`;
	}

	const statusOptions: { value: PayrollStatus | undefined; label: string }[] = [
		{ value: undefined, label: 'Tất cả trạng thái' },
		{ value: 'DRAFT', label: 'Nháp' },
		{ value: 'PUBLISHED', label: 'Đã phát hành' },
	];

	onMounted(() => fetchPayrolls());
</script>

<template>
	<div>
		<AppUnderConstruction
			title="Quản lý bảng lương"
			description="Module tính lương và phát lương đang được xây dựng."
		/>
		<template v-if="false">
			<div class="space-y-5">
				<!-- Page header -->
				<div>
					<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Bảng lương</h1>
					<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Quản lý và phát hành phiếu lương nhân viên</p>
				</div>

				<!-- Filter bar -->
				<div class="flex flex-col sm:flex-row flex-wrap gap-3 items-start sm:items-center">
					<input
						v-model="filter.month"
						type="month"
						class="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
						@change="applyFilter"
					/>
					<div class="w-full sm:w-44">
						<UiSelect
							:model-value="filter.status"
							:options="statusOptions"
							placeholder="Tất cả trạng thái"
							@update:model-value="
								filter.status = $event as PayrollStatus | undefined;
								applyFilter();
							"
						/>
					</div>
					<CommonAppButton :loading="loading" @click="applyFilter">
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
							/>
						</svg>
						Tìm kiếm
					</CommonAppButton>
					<div class="sm:ml-auto">
						<CommonAppButton @click="openCreate">
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
							</svg>
							Tạo bảng lương
						</CommonAppButton>
					</div>
				</div>

				<!-- Summary cards -->
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
					<div
						class="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700"
					>
						<div
							class="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0"
						>
							<svg
								class="w-4 h-4 text-blue-600 dark:text-blue-400"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
								/>
							</svg>
						</div>
						<div>
							<p class="text-xs text-gray-500 dark:text-gray-400">Tổng nhân viên</p>
							<p class="text-lg font-bold text-gray-900 dark:text-white leading-tight">{{ summary.total }}</p>
						</div>
					</div>

					<div
						class="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700"
					>
						<div class="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
							<svg
								class="w-4 h-4 text-gray-500 dark:text-gray-400"
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
							<p class="text-xs text-gray-500 dark:text-gray-400">Nháp</p>
							<p class="text-lg font-bold text-gray-900 dark:text-white leading-tight">{{ summary.draft }}</p>
						</div>
					</div>

					<div
						class="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700"
					>
						<div
							class="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0"
						>
							<svg
								class="w-4 h-4 text-green-600 dark:text-green-400"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
						</div>
						<div>
							<p class="text-xs text-gray-500 dark:text-gray-400">Đã phát hành</p>
							<p class="text-lg font-bold text-gray-900 dark:text-white leading-tight">{{ summary.published }}</p>
						</div>
					</div>

					<div
						class="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700"
					>
						<div
							class="w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0"
						>
							<svg
								class="w-4 h-4 text-brand-600 dark:text-brand-400"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
						</div>
						<div>
							<p class="text-xs text-gray-500 dark:text-gray-400">Tổng lương thực lĩnh</p>
							<p class="text-sm font-bold text-gray-900 dark:text-white leading-tight">
								{{ formatCurrency(summary.totalNet) }}
							</p>
						</div>
					</div>
				</div>

				<!-- Table -->
				<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
									<th
										class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
									>
										Nhân viên
									</th>
									<th
										class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
									>
										Tháng
									</th>
									<th
										class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
									>
										Lương CB
									</th>
									<th
										class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
									>
										Phụ cấp
									</th>
									<th
										class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
									>
										Khấu trừ
									</th>
									<th
										class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
									>
										Thưởng
									</th>
									<th
										class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
									>
										Thực lĩnh
									</th>
									<th
										class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
									>
										Trạng thái
									</th>
									<th
										class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
									>
										Thao tác
									</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
								<tr v-if="loading">
									<td colspan="9" class="px-4 py-8 text-center">
										<svg class="animate-spin w-5 h-5 mx-auto text-brand-500" fill="none" viewBox="0 0 24 24">
											<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
											<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
										</svg>
									</td>
								</tr>
								<tr v-else-if="payrolls.length === 0">
									<td colspan="9" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
										Không có dữ liệu bảng lương cho tháng này
									</td>
								</tr>
								<tr
									v-for="p in payrolls"
									:key="p.id"
									class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
								>
									<!-- Employee -->
									<td class="px-4 py-3">
										<p class="font-medium text-gray-900 dark:text-white">{{ p.employee.fullName }}</p>
										<p class="text-xs text-gray-400 dark:text-gray-500">{{ p.employee.department?.name ?? '—' }}</p>
									</td>

									<!-- Month -->
									<td class="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
										{{ formatMonth(p.month) }}
									</td>

									<!-- Base salary -->
									<td class="px-4 py-3 text-right text-gray-700 dark:text-gray-300 tabular-nums whitespace-nowrap">
										{{ formatCurrency(p.baseSalary) }}
									</td>

									<!-- Allowances -->
									<td class="px-4 py-3 text-right text-green-600 dark:text-green-400 tabular-nums whitespace-nowrap">
										{{ p.allowances > 0 ? '+' + formatCurrency(p.allowances) : '—' }}
									</td>

									<!-- Deductions -->
									<td class="px-4 py-3 text-right text-red-500 dark:text-red-400 tabular-nums whitespace-nowrap">
										{{ p.deductions > 0 ? '-' + formatCurrency(p.deductions) : '—' }}
									</td>

									<!-- Bonus -->
									<td class="px-4 py-3 text-right text-blue-600 dark:text-blue-400 tabular-nums whitespace-nowrap">
										{{ p.bonus > 0 ? '+' + formatCurrency(p.bonus) : '—' }}
									</td>

									<!-- Net salary -->
									<td
										class="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white tabular-nums whitespace-nowrap"
									>
										{{ formatCurrency(p.netSalary) }}
									</td>

									<!-- Status -->
									<td class="px-4 py-3">
										<PayrollStatusBadge :status="p.status" />
									</td>

									<!-- Actions -->
									<td class="px-4 py-3">
										<div class="flex items-center justify-end gap-1">
											<!-- Edit (DRAFT only) -->
											<button
												v-if="p.status === 'DRAFT'"
												class="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
												title="Chỉnh sửa"
												@click="openEdit(p)"
											>
												<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
													/>
												</svg>
											</button>

											<!-- Publish (DRAFT only) -->
											<button
												v-if="p.status === 'DRAFT'"
												class="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
												:class="{ 'opacity-50 cursor-wait': publishingId === p.id }"
												:disabled="publishingId === p.id"
												title="Phát hành"
												@click="handlePublish(p)"
											>
												<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
													/>
												</svg>
											</button>

											<!-- Export PDF -->
											<button
												class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
												:class="{ 'opacity-50 cursor-wait': exportingId === p.id }"
												:disabled="exportingId === p.id"
												title="Xuất PDF"
												@click="handleExport(p)"
											>
												<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
													/>
												</svg>
											</button>
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
						Tổng <strong class="text-gray-700 dark:text-gray-300">{{ meta.total }}</strong> phiếu lương
					</p>
					<CommonAppPagination
						:current-page="filter.page"
						:total-pages="meta.totalPages"
						@update:current-page="
							p => {
								filter.page = p;
								fetchPayrolls();
							}
						"
					/>
				</div>
			</div>

			<!-- Modals -->
			<Teleport to="body">
				<PayrollFormModal v-if="showForm" :edit-target="editTarget" @saved="onSaved" @close="showForm = false" />
			</Teleport>
		</template>
	</div>
</template>
