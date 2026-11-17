<script setup lang="ts">
	import { differenceInCalendarMonths, format, parseISO, startOfMonth, subMonths } from 'date-fns';
	import { useAssetService } from '~/services/asset.service';
	import {
		MAINTENANCE_TYPE_CLASS,
		downloadAssetBlob,
		formatAssetMoney,
		renewalDaysClass,
		renewalDaysLabel,
	} from '~/utils/asset.utils';
	import { formatDate, todayYmd } from '~/utils/date';
	import {
		ASSET_ACCOUNTING_CLASS_LABELS,
		ASSET_MAINTENANCE_TYPE_LABELS,
		type AssetAccountingClass,
		type AssetCategory,
		type AssetDepreciationReport,
		type AssetExpiringRow,
		type AssetMaintenanceCostReport,
		type AssetMaintenanceType,
		type AssetServiceCostReport,
		type AssetVendor,
	} from '~/types/asset.types';

	definePageMeta({ title: 'Báo cáo tài sản' });

	const route = useRoute();
	const router = useRouter();
	const toast = useToast();
	const service = useAssetService();
	const { hasPermission } = usePermissions();

	/**
	 * Mọi báo cáo có tiền, kể cả Khấu hao, cần `asset:value:read`.
	 *
	 * Ẩn hẳn tab thay vì để người dùng bấm vào rồi nhận 403 (M1): trưởng phòng không có quyền
	 * này nên chỉ thấy Sắp hết hạn, và tab mặc định là tab đầu tiên họ xem được.
	 */
	const canViewValue = computed(() => hasPermission('asset:value:read'));

	type ReportTab = 'depreciation' | 'expiring' | 'service-costs' | 'maintenance-costs' | 'accounting';

	const tabItems = computed<{ id: ReportTab; label: string }[]>(() => [
		...(canViewValue.value ? ([{ id: 'depreciation', label: 'Khấu hao' }] as { id: ReportTab; label: string }[]) : []),
		{ id: 'expiring', label: 'Sắp hết hạn' },
		...(canViewValue.value
			? ([
					{ id: 'service-costs', label: 'Chi phí dịch vụ' },
					{ id: 'maintenance-costs', label: 'Chi phí sửa chữa, bảo dưỡng' },
					{ id: 'accounting', label: 'Xuất cho kế toán' },
				] as { id: ReportTab; label: string }[])
			: []),
	]);

	const activeTab = ref<ReportTab>(canViewValue.value ? 'depreciation' : 'expiring');

	/** `YYYY-MM` → `mm/yyyy`, cách ghi tháng ở mọi chỗ khác trên giao diện (G9). */
	function viMonth(ym: string): string {
		const [y, m] = ym.split('-');
		return y && m ? `${m}/${y}` : ym;
	}

	/** Tải xong file thì báo đã tải gì, vì trình duyệt nhiều khi tải ngầm không hiện gì (G12). */
	function exportFailed(e: unknown) {
		toast.error(
			e instanceof Error
				? e.message
				: 'Chưa xuất được file Excel. Bạn thử lại sau ít phút; nếu vẫn lỗi, hãy báo quản trị hệ thống.',
		);
	}

	// ─── Báo cáo khấu hao ─────────────────────────────────────────────────────────
	const asOf = ref(todayYmd());
	const filterCategory = ref<number | undefined>(undefined);
	const filterClass = ref<AssetAccountingClass | ''>('');
	const categories = ref<AssetCategory[]>([]);
	const report = ref<AssetDepreciationReport | null>(null);
	const loadingReport = ref(false);
	const reportError = ref<string | null>(null);
	const exporting = ref(false);

	function depreciationQuery() {
		return {
			asOf: asOf.value || undefined,
			categoryId: filterCategory.value,
			accountingClass: filterClass.value || undefined,
		};
	}

	async function loadReport() {
		loadingReport.value = true;
		reportError.value = null;
		try {
			report.value = await service.depreciationReport(depreciationQuery());
		} catch (e) {
			report.value = null;
			reportError.value = e instanceof Error ? e.message : 'Chưa tải được báo cáo khấu hao. Bạn bấm Thử lại.';
		} finally {
			loadingReport.value = false;
		}
	}

	async function exportReport() {
		exporting.value = true;
		try {
			const blob = await service.exportDepreciationReport(depreciationQuery());
			downloadAssetBlob(blob, 'khau-hao-tai-san.xlsx');
			toast.success(`Đã tải file khau-hao-tai-san.xlsx, khấu hao tính đến ngày ${formatDate(asOf.value)}.`);
		} catch (e) {
			exportFailed(e);
		} finally {
			exporting.value = false;
		}
	}

	// ─── Báo cáo sắp hết hạn ──────────────────────────────────────────────────────
	const withinDays = ref(30);
	const expiringType = ref<'renewal' | 'warranty' | ''>('');
	const expiring = ref<AssetExpiringRow[]>([]);
	const loadingExpiring = ref(false);
	const expiringError = ref<string | null>(null);
	const expiringLoaded = ref(false);

	async function loadExpiring() {
		loadingExpiring.value = true;
		expiringError.value = null;
		try {
			expiring.value = await service.expiringReport({
				withinDays: withinDays.value,
				type: expiringType.value || undefined,
			});
			expiringLoaded.value = true;
		} catch (e) {
			expiring.value = [];
			expiringError.value =
				e instanceof Error ? e.message : 'Chưa tải được danh sách sắp hết hạn. Bạn bấm Thử lại.';
		} finally {
			loadingExpiring.value = false;
		}
	}

	// ─── Chi phí dịch vụ theo tháng (RP-02) ──────────────────────────────────────
	//
	// Mỗi dòng là một lần gia hạn, và cột chính là PHẦN PHÂN BỔ vào tháng đang xem chứ không
	// phải số tiền cả kỳ: gói trả một năm thì mỗi tháng chỉ gánh một phần.

	const now = new Date();
	const costYear = ref(now.getFullYear());
	const costMonth = ref(now.getMonth() + 1);
	const costVendor = ref<number | undefined>(undefined);
	const costCategory = ref<number | undefined>(undefined);
	const costOwner = ref<number | undefined>(undefined);
	const serviceCosts = ref<AssetServiceCostReport | null>(null);
	const loadingServiceCosts = ref(false);
	const serviceCostsError = ref<string | null>(null);
	const exportingServiceCosts = ref(false);
	const vendors = ref<AssetVendor[]>([]);

	const costMonthValue = computed(() => `${costYear.value}-${String(costMonth.value).padStart(2, '0')}`);

	function serviceCostQuery() {
		return {
			month: costMonthValue.value,
			vendorId: costVendor.value,
			categoryId: costCategory.value,
			ownerId: costOwner.value,
		};
	}

	async function loadServiceCosts() {
		loadingServiceCosts.value = true;
		serviceCostsError.value = null;
		try {
			serviceCosts.value = await service.serviceCosts(serviceCostQuery());
		} catch (e) {
			serviceCosts.value = null;
			serviceCostsError.value =
				e instanceof Error ? e.message : 'Chưa tải được chi phí dịch vụ. Bạn bấm Thử lại.';
		} finally {
			loadingServiceCosts.value = false;
		}
	}

	async function exportServiceCosts() {
		exportingServiceCosts.value = true;
		try {
			const name = `chi-phi-dich-vu-${costMonthValue.value}.xlsx`;
			const blob = await service.exportServiceCosts(serviceCostQuery());
			downloadAssetBlob(blob, name);
			toast.success(`Đã tải file ${name}, chi phí dịch vụ phân bổ vào tháng ${viMonth(costMonthValue.value)}.`);
		} catch (e) {
			exportFailed(e);
		} finally {
			exportingServiceCosts.value = false;
		}
	}

	// ─── Chi phí sửa chữa, bảo dưỡng (RP-05) ─────────────────────────────────────

	const MAINTENANCE_RANGE_MAX_MONTHS = 24;

	/**
	 * Kỳ chọn nhanh (G1). Mặc định "3 tháng gần nhất": kỳ 30 ngày cũ ra 0 đồng ngay cả khi tháng
	 * trước vừa sửa xe hết vài triệu, khiến giám đốc tưởng không tốn tiền.
	 */
	type QuickRange = 'this-month' | 'last-month' | 'last-3-months' | 'this-year';
	const QUICK_RANGES: { id: QuickRange; label: string }[] = [
		{ id: 'this-month', label: 'Tháng này' },
		{ id: 'last-month', label: 'Tháng trước' },
		{ id: 'last-3-months', label: '3 tháng gần nhất' },
		{ id: 'this-year', label: 'Năm nay' },
	];

	function quickRange(id: QuickRange): { from: string; to: string } {
		const today = new Date();
		const ymd = (d: Date) => format(d, 'yyyy-MM-dd');
		switch (id) {
			case 'this-month':
				return { from: ymd(startOfMonth(today)), to: todayYmd() };
			case 'last-month': {
				const start = startOfMonth(subMonths(today, 1));
				return { from: ymd(start), to: ymd(new Date(start.getFullYear(), start.getMonth() + 1, 0)) };
			}
			case 'this-year':
				return { from: ymd(new Date(today.getFullYear(), 0, 1)), to: todayYmd() };
			default:
				return { from: ymd(startOfMonth(subMonths(today, 2))), to: todayYmd() };
		}
	}

	const defaultMaintRange = quickRange('last-3-months');
	const maintFrom = ref(defaultMaintRange.from);
	const maintTo = ref(defaultMaintRange.to);
	const maintType = ref<AssetMaintenanceType | ''>('');
	const maintenanceCosts = ref<AssetMaintenanceCostReport | null>(null);
	const loadingMaintenanceCosts = ref(false);
	const maintenanceCostsError = ref<string | null>(null);
	const exportingMaintenanceCosts = ref(false);

	/** Nút chọn nhanh đang khớp với kỳ hiện tại, để tô nổi. */
	const activeQuickRange = computed(() => {
		return QUICK_RANGES.find(r => {
			const range = quickRange(r.id);
			return range.from === maintFrom.value && range.to === maintTo.value;
		})?.id;
	});

	function pickQuickRange(id: QuickRange) {
		const range = quickRange(id);
		maintFrom.value = range.from;
		maintTo.value = range.to;
	}

	/** Kỳ dài bao nhiêu tháng, để báo trước thay vì để BE trả 400. */
	function rangeMonths(from: string, to: string): number {
		if (!from || !to) return 0;
		return differenceInCalendarMonths(parseISO(to), parseISO(from));
	}

	const maintRangeError = computed(() => {
		if (!maintFrom.value || !maintTo.value) return 'Bạn chọn kỳ báo cáo trước.';
		if (maintFrom.value > maintTo.value) return 'Ngày kết thúc không được trước ngày bắt đầu.';
		if (rangeMonths(maintFrom.value, maintTo.value) >= MAINTENANCE_RANGE_MAX_MONTHS) {
			return `Kỳ báo cáo dài tối đa ${MAINTENANCE_RANGE_MAX_MONTHS} tháng, bạn chọn kỳ ngắn hơn.`;
		}
		return '';
	});

	function maintenanceCostQuery() {
		return { from: maintFrom.value, to: maintTo.value, type: maintType.value || undefined };
	}

	async function loadMaintenanceCosts() {
		if (maintRangeError.value) return;
		loadingMaintenanceCosts.value = true;
		maintenanceCostsError.value = null;
		try {
			maintenanceCosts.value = await service.maintenanceCosts(maintenanceCostQuery());
		} catch (e) {
			maintenanceCosts.value = null;
			maintenanceCostsError.value =
				e instanceof Error ? e.message : 'Chưa tải được chi phí sửa chữa, bảo dưỡng. Bạn bấm Thử lại.';
		} finally {
			loadingMaintenanceCosts.value = false;
		}
	}

	async function exportMaintenanceCosts() {
		exportingMaintenanceCosts.value = true;
		try {
			const blob = await service.exportMaintenanceCosts(maintenanceCostQuery());
			downloadAssetBlob(blob, 'chi-phi-sua-chua-bao-duong.xlsx');
			toast.success(
				`Đã tải file chi-phi-sua-chua-bao-duong.xlsx cho kỳ ${formatDate(maintFrom.value)} – ${formatDate(maintTo.value)}.`,
			);
		} catch (e) {
			exportFailed(e);
		} finally {
			exportingMaintenanceCosts.value = false;
		}
	}

	// ─── Excel cho kế toán (F-29) ────────────────────────────────────────────────

	const ACCOUNTING_RANGE_MAX_MONTHS = 12;
	const accFrom = ref(format(new Date(now.getFullYear(), 0, 1), 'yyyy-MM-dd'));
	const accTo = ref(todayYmd());
	const exportingAccounting = ref(false);

	const accRangeError = computed(() => {
		if (!accFrom.value || !accTo.value) return 'Bạn chọn kỳ xuất trước.';
		if (accFrom.value > accTo.value) return 'Ngày kết thúc không được trước ngày bắt đầu.';
		if (rangeMonths(accFrom.value, accTo.value) >= ACCOUNTING_RANGE_MAX_MONTHS) {
			return `Kỳ xuất dài tối đa ${ACCOUNTING_RANGE_MAX_MONTHS} tháng, bạn chọn kỳ ngắn hơn.`;
		}
		return '';
	});

	async function exportAccounting() {
		if (accRangeError.value) return;
		exportingAccounting.value = true;
		try {
			const name = `tai-san-ke-toan-${accFrom.value}-${accTo.value}.xlsx`;
			const blob = await service.exportAccounting({ from: accFrom.value, to: accTo.value });
			downloadAssetBlob(blob, name);
			toast.success(
				`Đã tải file ${name} cho kỳ ${formatDate(accFrom.value)} – ${formatDate(accTo.value)}, gồm ba sheet khấu hao, tăng và giảm trong kỳ.`,
			);
		} catch (e) {
			exportFailed(e);
		} finally {
			exportingAccounting.value = false;
		}
	}

	const directoryStore = useDirectoryStore();
	const { employees } = storeToRefs(directoryStore);

	/** `?tab=` từ thẻ Tổng quan; tab không tồn tại hoặc bị ẩn thì bỏ qua. */
	function applyTabQuery() {
		const wanted = route.query.tab;
		if (typeof wanted !== 'string') return;
		if (tabItems.value.some(t => t.id === wanted)) activeTab.value = wanted as ReportTab;
		router.replace({ path: '/management/assets/reports' });
	}

	onMounted(async () => {
		service
			.findCategories()
			.then(list => {
				categories.value = list;
			})
			.catch(() => {
				/* ô lọc rỗng thôi */
			});
		if (canViewValue.value) {
			service
				.findVendors({ isActive: true })
				.then(list => {
					vendors.value = list;
				})
				.catch(() => {
					/* ô lọc nhà cung cấp rỗng thôi */
				});
			directoryStore.load().catch(() => {
				/* ô lọc người phụ trách rỗng thôi */
			});
		}
		applyTabQuery();
		loadTab(activeTab.value);
	});

	/** Tải dữ liệu của một tab nếu chưa tải, để trang không gọi năm API lúc vào. */
	function loadTab(tab: ReportTab) {
		if (tab === 'depreciation' && !report.value && !loadingReport.value) loadReport();
		if (tab === 'expiring' && !expiringLoaded.value && !loadingExpiring.value) loadExpiring();
		if (tab === 'service-costs' && !serviceCosts.value && !loadingServiceCosts.value) loadServiceCosts();
		if (tab === 'maintenance-costs' && !maintenanceCosts.value && !loadingMaintenanceCosts.value) {
			loadMaintenanceCosts();
		}
	}

	watch([asOf, filterCategory, filterClass], () => {
		if (activeTab.value === 'depreciation') loadReport();
	});
	watch([withinDays, expiringType], () => {
		if (activeTab.value === 'expiring') loadExpiring();
	});
	watch([costYear, costMonth, costVendor, costCategory, costOwner], () => {
		if (activeTab.value === 'service-costs') loadServiceCosts();
	});
	watch([maintFrom, maintTo, maintType], () => {
		if (activeTab.value === 'maintenance-costs') loadMaintenanceCosts();
	});
	// Mỗi tab tự tải lần đầu khi được mở.
	watch(activeTab, loadTab);

	const categoryOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Tất cả loại tài sản' },
		...categories.value
			.filter(c => c.kind === 'PHYSICAL')
			.map(c => ({ value: c.id as number | undefined, label: `${c.groupName} → ${c.name}` })),
	]);
	const classOptions = [
		{ value: '', label: 'Tất cả phân loại' },
		...Object.entries(ASSET_ACCOUNTING_CLASS_LABELS).map(([value, label]) => ({ value, label })),
	];
	const withinOptions = [
		{ value: 7, label: 'Trong 7 ngày' },
		{ value: 30, label: 'Trong 30 ngày' },
		{ value: 90, label: 'Trong 90 ngày' },
		{ value: 180, label: 'Trong 180 ngày' },
	];
	const typeOptions = [
		{ value: '', label: 'Cả gia hạn và bảo hành' },
		{ value: 'renewal', label: 'Gia hạn dịch vụ' },
		{ value: 'warranty', label: 'Hết hạn bảo hành' },
	];

	const monthOptions = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Tháng ${i + 1}` }));
	const yearOptions = Array.from({ length: 5 }, (_, i) => {
		const y = now.getFullYear() - i;
		return { value: y, label: `Năm ${y}` };
	});
	const vendorOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Tất cả nhà cung cấp' },
		...vendors.value.map(v => ({ value: v.id as number | undefined, label: v.name })),
	]);
	const serviceCategoryOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Tất cả loại dịch vụ' },
		...categories.value
			.filter(c => c.kind === 'SERVICE')
			.map(c => ({ value: c.id as number | undefined, label: `${c.groupName} → ${c.name}` })),
	]);
	/**
	 * Danh sách người phụ trách cho ô tìm được (`UiSelectInput`).
	 *
	 * Ô này nhận `string | number` chứ không nhận `undefined`, nên "tất cả" mang giá trị 0 —
	 * cùng quy ước với ô lọc phòng ban ở các màn khác.
	 */
	const ownerSelectOptions = computed(() => [
		{ value: 0, label: 'Tất cả người phụ trách' },
		...employees.value.map(e => ({ value: e.id, label: `${e.fullName} · ${e.employeeCode}` })),
	]);
	const maintTypeOptions = [
		{ value: '', label: 'Sửa chữa và bảo dưỡng' },
		...Object.entries(ASSET_MAINTENANCE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
	];
</script>

<template>
	<div class="space-y-5">
		<div>
			<h1 class="text-xl font-bold text-gray-900 dark:text-white">Báo cáo tài sản</h1>
			<p class="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
				{{ canViewValue ? 'Khấu hao, chi phí và các mốc sắp đến hạn của tài sản' : 'Các mốc gia hạn dịch vụ và hết hạn bảo hành sắp tới' }}
			</p>
		</div>

		<CommonAppModuleNotice module="ASSET" />

		<div class="border-b border-gray-200 dark:border-gray-700">
			<nav class="-mb-px flex flex-wrap gap-1">
				<button
					v-for="tab in tabItems"
					:key="tab.id"
					type="button"
					:class="[
						'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
						activeTab === tab.id
							? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
							: 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400',
					]"
					@click="activeTab = tab.id"
				>
					{{ tab.label }}
				</button>
			</nav>
		</div>

		<!-- ── Khấu hao ─────────────────────────────────────────────────────── -->
		<template v-if="activeTab === 'depreciation'">
			<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-4">
					<label class="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
						Tính đến ngày
						<UiDatePicker v-model="asOf" />
					</label>
					<div class="sm:col-span-1">
						<p class="mb-1 text-xs text-gray-500 dark:text-gray-400">Loại tài sản</p>
						<UiSelect v-model="filterCategory" :options="categoryOptions" />
					</div>
					<div>
						<p class="mb-1 text-xs text-gray-500 dark:text-gray-400">Phân loại kế toán</p>
						<UiSelect v-model="filterClass" :options="classOptions" />
					</div>
					<div class="flex items-end">
						<CommonAppButton variant="outline" :loading="exporting" :disabled="!report" @click="exportReport">
							Xuất Excel
						</CommonAppButton>
					</div>
				</div>
				<p class="mt-2 text-xs text-gray-600 dark:text-gray-400">
					File Excel gồm từng thiết bị có khấu hao với nguyên giá, luỹ kế và giá trị còn lại tính đến ngày đã chọn.
					<template v-if="!report && !loadingReport"> Nút Xuất Excel bật khi bảng đã tải xong.</template>
				</p>
			</div>

			<div v-if="loadingReport" class="space-y-3">
				<div v-for="i in 5" :key="i" class="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
			</div>

			<div
				v-else-if="reportError"
				class="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
			>
				<p>{{ reportError }}</p>
				<CommonAppButton size="sm" variant="outline" @click="loadReport">Thử lại</CommonAppButton>
			</div>

			<template v-else-if="report">
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
					<div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
						<p class="text-xs text-gray-500 dark:text-gray-400">Tổng nguyên giá</p>
						<p class="mt-0.5 text-lg font-bold tabular-nums text-gray-900 dark:text-white">
							{{ formatAssetMoney(report.totals.costVnd) }}
						</p>
					</div>
					<div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
						<p class="text-xs text-gray-500 dark:text-gray-400">Đã trích khấu hao</p>
						<p class="mt-0.5 text-lg font-bold tabular-nums text-gray-900 dark:text-white">
							{{ formatAssetMoney(report.totals.accumulated) }}
						</p>
					</div>
					<div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
						<p class="text-xs text-gray-500 dark:text-gray-400">Giá trị còn lại</p>
						<p class="mt-0.5 text-lg font-bold tabular-nums text-brand-600 dark:text-brand-400">
							{{ formatAssetMoney(report.totals.bookValue) }}
						</p>
					</div>
				</div>

				<div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
					<p v-if="!report.rows.length" class="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
						Không có tài sản nào khớp bộ lọc.
					</p>
					<div v-else class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tài sản</th>
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Loại</th>
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Phân loại</th>
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Bắt đầu / Tháng</th>
									<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Nguyên giá</th>
									<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Luỹ kế</th>
									<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Còn lại</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
								<tr v-for="row in report.rows" :key="row.assetId" class="hover:bg-gray-50 dark:hover:bg-gray-800/40">
									<td class="px-4 py-3">
										<NuxtLink
											:to="`/management/assets/${row.assetId}`"
											class="font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
										>
											{{ row.name }}
										</NuxtLink>
										<p class="font-mono text-xs text-gray-400">{{ row.code }}</p>
									</td>
									<td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ row.categoryName }}</td>
									<td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ row.accountingClassLabel ?? '—' }}</td>
									<td class="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
										<p>{{ row.startDate ? formatDate(row.startDate) : '—' }}</p>
										<p class="text-gray-400">{{ row.months != null ? `${row.months} tháng` : '—' }}</p>
									</td>
									<td class="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
										{{ formatAssetMoney(row.costVnd) }}
									</td>
									<td class="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
										{{ formatAssetMoney(row.accumulated) }}
									</td>
									<td class="px-4 py-3 text-right font-medium tabular-nums text-gray-900 dark:text-white">
										{{ formatAssetMoney(row.bookValue) }}
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			</template>
		</template>

		<!-- ── Sắp hết hạn ──────────────────────────────────────────────────── -->
		<template v-else-if="activeTab === 'expiring'">
			<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<UiSelect v-model="withinDays" :options="withinOptions" />
					<UiSelect v-model="expiringType" :options="typeOptions" />
				</div>
			</div>

			<div v-if="loadingExpiring" class="space-y-3">
				<div v-for="i in 5" :key="i" class="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
			</div>

			<div
				v-else-if="expiringError"
				class="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
			>
				<p>{{ expiringError }}</p>
				<CommonAppButton size="sm" variant="outline" @click="loadExpiring">Thử lại</CommonAppButton>
			</div>

			<div v-else class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
				<p v-if="!expiring.length" class="px-4 py-16 text-center text-sm text-gray-600 dark:text-gray-400">
					Không có dịch vụ nào cần gia hạn hay thiết bị nào hết bảo hành trong khoảng này. Bạn chọn khoảng dài
					hơn để xem các mốc xa hơn.
				</p>
				<div v-else class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tài sản</th>
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Việc</th>
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Người phụ trách</th>
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Ngày</th>
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Còn lại</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr
								v-for="row in expiring"
								:key="`${row.type}-${row.assetId}`"
								class="hover:bg-gray-50 dark:hover:bg-gray-800/40"
							>
								<td class="px-4 py-3">
									<NuxtLink
										:to="`/management/assets/${row.assetId}`"
										class="font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
									>
										{{ row.name }}
									</NuxtLink>
									<p class="font-mono text-xs text-gray-400">{{ row.code }}</p>
								</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-300">
									{{ row.type === 'renewal' ? 'Gia hạn dịch vụ' : 'Hết hạn bảo hành' }}
								</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ row.ownerName ?? '—' }}</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ formatDate(row.date) }}</td>
								<td class="px-4 py-3" :class="renewalDaysClass(row.daysLeft)">
									{{ renewalDaysLabel(row.daysLeft) }}
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</template>

		<!-- ── Chi phí dịch vụ ──────────────────────────────────────────────── -->
		<template v-else-if="activeTab === 'service-costs'">
			<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
					<div>
						<p class="mb-1 text-xs text-gray-500 dark:text-gray-400">Tháng</p>
						<UiSelect v-model="costMonth" :options="monthOptions" />
					</div>
					<div>
						<p class="mb-1 text-xs text-gray-500 dark:text-gray-400">Năm</p>
						<UiSelect v-model="costYear" :options="yearOptions" />
					</div>
					<div>
						<p class="mb-1 text-xs text-gray-500 dark:text-gray-400">Nhà cung cấp</p>
						<UiSelect v-model="costVendor" :options="vendorOptions" />
					</div>
					<div>
						<p class="mb-1 text-xs text-gray-500 dark:text-gray-400">Người phụ trách</p>
						<UiSelectInput
							:model-value="costOwner ?? 0"
							:options="ownerSelectOptions"
							placeholder="Tất cả người phụ trách"
							search-placeholder="Gõ tên hoặc mã nhân viên"
							@update:model-value="costOwner = Number($event) || undefined"
						/>
					</div>
					<div class="flex items-end">
						<CommonAppButton
							variant="outline"
							:loading="exportingServiceCosts"
							:disabled="!serviceCosts"
							@click="exportServiceCosts"
						>
							Xuất Excel
						</CommonAppButton>
					</div>
				</div>
				<div class="mt-3">
					<p class="mb-1 text-xs text-gray-500 dark:text-gray-400">Loại dịch vụ</p>
					<UiSelect v-model="costCategory" :options="serviceCategoryOptions" />
				</div>
				<p class="mt-2 text-xs text-gray-600 dark:text-gray-400">
					File Excel gồm từng lần gia hạn có phần tiền phân bổ vào tháng đang xem. Tiền mỗi kỳ được chia đều cho
					các tháng của kỳ đó, nên khoản trả trước cho kỳ sau tính vào tháng của kỳ đó.
				</p>
			</div>

			<div v-if="loadingServiceCosts" class="space-y-3">
				<div v-for="i in 4" :key="i" class="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
			</div>

			<div
				v-else-if="serviceCostsError"
				class="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
			>
				<p>{{ serviceCostsError }}</p>
				<CommonAppButton size="sm" variant="outline" @click="loadServiceCosts">Thử lại</CommonAppButton>
			</div>

			<template v-else-if="serviceCosts">
				<div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
					<p class="text-xs text-gray-600 dark:text-gray-400">
						Chi phí dịch vụ phân bổ vào tháng {{ viMonth(serviceCosts.month) }}
					</p>
					<p class="mt-0.5 text-lg font-bold tabular-nums text-brand-600 dark:text-brand-400">
						{{ formatAssetMoney(serviceCosts.totalVnd) }}
					</p>
				</div>

				<div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
					<p v-if="!serviceCosts.rows.length" class="px-4 py-16 text-center text-sm text-gray-600 dark:text-gray-400">
						Tháng {{ viMonth(serviceCosts.month) }} không có khoản chi dịch vụ nào được phân bổ. Bạn chọn tháng khác
						hoặc bỏ bớt bộ lọc.
					</p>
					<div v-else class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Dịch vụ</th>
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Loại</th>
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Người phụ trách</th>
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Kỳ</th>
									<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tiền cả kỳ</th>
									<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Phân bổ vào tháng {{ viMonth(serviceCosts.month) }}</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
								<tr v-for="row in serviceCosts.rows" :key="row.renewalId" class="hover:bg-gray-50 dark:hover:bg-gray-800/40">
									<td class="px-4 py-3">
										<NuxtLink
											:to="`/management/assets/${row.assetId}`"
											class="font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
										>
											{{ row.name }}
										</NuxtLink>
										<p class="font-mono text-xs text-gray-400">{{ row.code }}</p>
									</td>
									<td class="px-4 py-3 text-gray-600 dark:text-gray-300">
										{{ row.categoryName }}
										<p v-if="row.vendorName" class="text-xs text-gray-400">{{ row.vendorName }}</p>
									</td>
									<td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ row.ownerName ?? '—' }}</td>
									<td class="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
										{{ formatDate(row.periodStart) }} – {{ formatDate(row.periodEnd) }}
									</td>
									<td class="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-300">
										{{ formatAssetMoney(row.amountVnd) }}
									</td>
									<td class="px-4 py-3 text-right font-medium tabular-nums text-gray-900 dark:text-white">
										{{ formatAssetMoney(row.shareVnd) }}
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			</template>
		</template>

		<!-- ── Chi phí sửa chữa, bảo dưỡng ──────────────────────────────────── -->
		<template v-else-if="activeTab === 'maintenance-costs'">
			<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
				<div class="mb-3 flex flex-wrap gap-2" role="group" aria-label="Chọn nhanh kỳ báo cáo">
					<button
						v-for="r in QUICK_RANGES"
						:key="r.id"
						type="button"
						class="min-h-11 rounded-full border px-3 py-1 text-sm transition-colors sm:min-h-0"
						:class="
							activeQuickRange === r.id
								? 'border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-900/30 dark:text-brand-300'
								: 'border-gray-300 text-gray-700 hover:border-brand-500 dark:border-gray-600 dark:text-gray-300'
						"
						:aria-pressed="activeQuickRange === r.id"
						@click="pickQuickRange(r.id)"
					>
						{{ r.label }}
					</button>
				</div>
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
					<div>
						<p class="mb-1 text-xs text-gray-500 dark:text-gray-400">Kỳ báo cáo</p>
						<UiDateRangePicker
							:from-date="maintFrom"
							:to-date="maintTo"
							@update:from-date="maintFrom = $event"
							@update:to-date="maintTo = $event"
						/>
					</div>
					<div>
						<p class="mb-1 text-xs text-gray-500 dark:text-gray-400">Loại phiếu</p>
						<UiSelect v-model="maintType" :options="maintTypeOptions" />
					</div>
					<div class="flex items-end">
						<CommonAppButton
							variant="outline"
							:loading="exportingMaintenanceCosts"
							:disabled="!maintenanceCosts || !!maintRangeError"
							@click="exportMaintenanceCosts"
						>
							Xuất Excel
						</CommonAppButton>
					</div>
				</div>
				<p v-if="maintRangeError" class="mt-2 text-sm text-rose-600 dark:text-rose-400">{{ maintRangeError }}</p>
				<p v-else class="mt-2 text-xs text-gray-600 dark:text-gray-400">
					Chỉ tính phiếu đã đóng với kết quả Xong hoặc Không sửa được, theo ngày xong. File Excel gồm từng phiếu
					với tài sản, đơn vị sửa chữa, ngày xong và chi phí.
				</p>
			</div>

			<div v-if="loadingMaintenanceCosts" class="space-y-3">
				<div v-for="i in 4" :key="i" class="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
			</div>

			<div
				v-else-if="maintenanceCostsError"
				class="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
			>
				<p>{{ maintenanceCostsError }}</p>
				<CommonAppButton size="sm" variant="outline" @click="loadMaintenanceCosts">Thử lại</CommonAppButton>
			</div>

			<template v-else-if="maintenanceCosts">
				<div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
					<p class="text-xs text-gray-500 dark:text-gray-400">
						Tổng chi phí {{ formatDate(maintenanceCosts.from) }} – {{ formatDate(maintenanceCosts.to) }}
					</p>
					<p class="mt-0.5 text-lg font-bold tabular-nums text-brand-600 dark:text-brand-400">
						{{ formatAssetMoney(maintenanceCosts.totalVnd) }}
					</p>
				</div>

				<div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
					<p v-if="!maintenanceCosts.rows.length" class="px-4 py-16 text-center text-sm text-gray-600 dark:text-gray-400">
						Từ {{ formatDate(maintenanceCosts.from) }} đến {{ formatDate(maintenanceCosts.to) }} chưa có phiếu sửa
						hay phiếu bảo dưỡng nào đóng. Bạn chọn kỳ dài hơn, ví dụ Năm nay, để xem các phiếu cũ hơn.
					</p>
					<div v-else class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tài sản</th>
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Loại</th>
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Đơn vị sửa chữa</th>
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Ngày xong</th>
									<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Chi phí</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
								<tr v-for="row in maintenanceCosts.rows" :key="row.maintenanceId" class="hover:bg-gray-50 dark:hover:bg-gray-800/40">
									<td class="px-4 py-3">
										<NuxtLink
											:to="`/management/assets/${row.assetId}`"
											class="font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
										>
											{{ row.name }}
										</NuxtLink>
										<p class="font-mono text-xs text-gray-400">{{ row.code }}</p>
									</td>
									<td class="px-4 py-3">
										<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="MAINTENANCE_TYPE_CLASS[row.type]">
											{{ row.typeLabel }}
										</span>
										<p v-if="row.underWarranty" class="mt-1 text-xs text-emerald-600 dark:text-emerald-400">Còn bảo hành</p>
									</td>
									<td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ row.vendorName ?? '—' }}</td>
									<td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ formatDate(row.doneAt) }}</td>
									<td class="px-4 py-3 text-right font-medium tabular-nums text-gray-900 dark:text-white">
										{{ formatAssetMoney(row.cost) }}
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			</template>
		</template>

		<!-- ── Xuất cho kế toán ─────────────────────────────────────────────── -->
		<template v-else-if="activeTab === 'accounting'">
			<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
				<h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100">Excel cho kế toán</h2>
				<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
					File gồm ba sheet: khấu hao trong kỳ, tài sản tăng trong kỳ và tài sản giảm trong kỳ. Chỉ tính
					thiết bị có nguyên giá và có khấu hao.
				</p>

				<div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
					<div>
						<p class="mb-1 text-xs text-gray-500 dark:text-gray-400">Kỳ xuất</p>
						<UiDateRangePicker
							:from-date="accFrom"
							:to-date="accTo"
							@update:from-date="accFrom = $event"
							@update:to-date="accTo = $event"
						/>
					</div>
					<div class="flex items-end">
						<CommonAppButton
							variant="primary"
							:loading="exportingAccounting"
							:disabled="!!accRangeError"
							@click="exportAccounting"
						>
							Tải file Excel
						</CommonAppButton>
					</div>
				</div>
				<p v-if="accRangeError" class="mt-2 text-sm text-rose-600 dark:text-rose-400">{{ accRangeError }}</p>
				<p v-else class="mt-2 text-xs text-gray-600 dark:text-gray-400">Kỳ xuất dài tối đa 12 tháng.</p>
			</div>
		</template>
	</div>
</template>
