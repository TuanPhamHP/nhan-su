<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import AssetFormModal from '~/components/modules/asset/AssetFormModal.vue';
	import AssetImportModal from '~/components/modules/asset/AssetImportModal.vue';
	import AssetOverviewPanel from '~/components/modules/asset/AssetOverviewPanel.vue';
	import {
		downloadAssetBlob,
		formatAssetMoney,
		maintenanceDaysLeft,
		maintenanceDueClass,
		ASSET_STATUS_CLASS,
	} from '~/utils/asset.utils';
	import { formatDate } from '~/utils/date';
	import { useAuthStore } from '~/stores/auth';
	import {
		ASSET_KIND_LABELS,
		ASSET_STATUS_LABELS,
		PHYSICAL_STATUSES,
		SERVICE_STATUSES,
		type Asset,
		type AssetCategory,
		type AssetKind,
		type AssetStatus,
	} from '~/types/asset.types';

	definePageMeta({ title: 'Quản lý tài sản' });

	const route = useRoute();
	const router = useRouter();
	const toast = useToast();
	const service = useAssetService();
	const { canWrite } = useModuleAccess();
	const { hasPermission } = usePermissions();
	const directoryStore = useDirectoryStore();
	const { departments } = storeToRefs(directoryStore);

	const canManage = computed(() => canWrite('ASSET') && hasPermission('asset:manage'));

	/**
	 * Trưởng phòng chỉ xem được tài sản của phòng mình (M3). Ô lọc phòng ban với đủ sáu phòng chỉ
	 * dẫn họ vào lỗi 403, nên ẩn ô đó và nói rõ phạm vi đang xem.
	 */
	const authStore = useAuthStore();
	const { user } = storeToRefs(authStore);
	const isDepartmentScoped = computed(() => user.value?.role === 'MANAGER' && !hasPermission('asset:manage'));
	const scopeText = computed(() => {
		if (!isDepartmentScoped.value) return '';
		const dept = user.value?.department?.name;
		return dept
			? `Bạn đang xem tài sản của phòng ${dept}, gồm thiết bị cấp phát cho người trong phòng hoặc cho phòng và dịch vụ do người trong phòng phụ trách.`
			: 'Bạn đang xem tài sản của phòng mình, gồm thiết bị cấp phát cho người trong phòng hoặc cho phòng và dịch vụ do người trong phòng phụ trách.';
	});

	// ─── Bộ lọc ───────────────────────────────────────────────────────────────────
	const search = ref('');
	const filterKind = ref<AssetKind | ''>('');
	const filterStatus = ref<AssetStatus | ''>('');
	const filterCategory = ref<number | undefined>(undefined);
	const filterDept = ref<number | undefined>(undefined);
	const page = ref(1);
	const limit = 20;

	// ─── Hai bộ lọc đến từ thẻ Tổng quan, mang theo trên URL ──────────────────────
	//
	// Khác các ô lọc bên dưới, hai cái này đi qua URL để thẻ ở khối Tổng quan (và cả link
	// dán cho người khác) mở thẳng được đúng danh sách. Chúng hiện ra thành nhãn có nút bỏ
	// chứ không phải ô chọn, vì chỉ có hai giá trị cố định.
	const filterMaintenanceDue = ref<number | undefined>(undefined);
	const filterPendingConfirm = ref(false);
	/** Sửa sau bài nhập vai: tài sản có lần cấp phát người nhận báo chưa đúng. */
	const filterDisputed = ref(false);

	/** `maintenanceDueWithinDays` hợp lệ là số nguyên 1–365; ngoài khoảng đó BE trả 400. */
	function parseDueDays(raw: unknown): number | undefined {
		const n = Number(raw);
		return Number.isInteger(n) && n >= 1 && n <= 365 ? n : undefined;
	}

	/**
	 * Đọc hai tham số từ URL.
	 *
	 * Giá trị hỏng (người dùng gõ tay `?maintenanceDueWithinDays=abc`) thì bỏ qua và dọn
	 * luôn khỏi URL: gửi lên BE chỉ nhận 400 và người dùng mất cả danh sách, trong khi thứ
	 * họ cần là trang vẫn chạy.
	 */
	const QUERY_KEYS = ['maintenanceDueWithinDays', 'pendingConfirmation', 'disputed'];
	const isBoolText = (v: unknown) => v === 'true' || v === 'false';

	function readQueryFilters() {
		const rawDays = route.query.maintenanceDueWithinDays;
		const rawPending = route.query.pendingConfirmation;
		const rawDisputed = route.query.disputed;
		const days = rawDays == null ? undefined : parseDueDays(rawDays);

		filterMaintenanceDue.value = days;
		filterPendingConfirm.value = rawPending === 'true';
		filterDisputed.value = rawDisputed === 'true';

		const badDays = rawDays != null && days === undefined;
		const badBool = [rawPending, rawDisputed].some(v => v != null && !isBoolText(v));
		// Dọn URL ở lượt sau: hàm này chạy ngay trong setup, đổi route giữa lúc đó thì
		// router còn đang xử lý lần điều hướng hiện tại.
		if (badDays || badBool) nextTick(() => writeQueryFilters());
	}

	/** Đẩy trạng thái các bộ lọc thẻ ngược lên URL, giữ nguyên các tham số khác của trang. */
	function writeQueryFilters() {
		const query: Record<string, string> = {};
		for (const [key, value] of Object.entries(route.query)) {
			if (QUERY_KEYS.includes(key)) continue;
			if (typeof value === 'string') query[key] = value;
		}
		if (filterMaintenanceDue.value) {
			query.maintenanceDueWithinDays = String(filterMaintenanceDue.value);
		}
		if (filterPendingConfirm.value) query.pendingConfirmation = 'true';
		if (filterDisputed.value) query.disputed = 'true';
		router.replace({ path: '/management/assets', query });
	}

	type QueryChipKey = 'maintenance' | 'pending' | 'disputed';

	/** Nhãn của các bộ lọc thẻ đang bật, để hiện thành chip có nút bỏ. */
	const activeQueryFilters = computed(() => {
		const chips: { key: QueryChipKey; label: string }[] = [];
		if (filterMaintenanceDue.value) {
			chips.push({
				key: 'maintenance',
				label: `Đến hạn bảo dưỡng trong ${filterMaintenanceDue.value} ngày tới hoặc đã quá hạn`,
			});
		}
		if (filterPendingConfirm.value) chips.push({ key: 'pending', label: 'Chờ người nhận xác nhận' });
		if (filterDisputed.value) chips.push({ key: 'disputed', label: 'Người nhận báo chưa đúng' });
		return chips;
	});

	function clearQueryFilter(key: QueryChipKey) {
		if (key === 'maintenance') filterMaintenanceDue.value = undefined;
		else if (key === 'pending') filterPendingConfirm.value = false;
		else filterDisputed.value = false;
		writeQueryFilters();
	}

	// Đọc ngay trong setup, trước khi đăng ký watcher bên dưới, để lần tải bảng đầu tiên đã
	// mang sẵn bộ lọc thay vì tải một lần không lọc rồi tải lại.
	readQueryFilters();

	const assets = ref<Asset[]>([]);
	const meta = ref<{ page: number; limit: number; total: number; totalPages: number } | null>(null);
	const loading = ref(true);
	const loadError = ref<string | null>(null);
	const categories = ref<AssetCategory[]>([]);
	const exporting = ref(false);

	const showFormModal = ref(false);
	const showImportModal = ref(false);

	function currentQuery() {
		return {
			search: search.value || undefined,
			kind: filterKind.value || undefined,
			status: filterStatus.value || undefined,
			categoryId: filterCategory.value,
			departmentId: isDepartmentScoped.value ? undefined : filterDept.value,
			maintenanceDueWithinDays: filterMaintenanceDue.value,
			pendingConfirmation: filterPendingConfirm.value || undefined,
			disputed: filterDisputed.value || undefined,
		};
	}

	async function loadTable() {
		loading.value = true;
		loadError.value = null;
		try {
			const res = await service.findAll({ ...currentQuery(), page: page.value, limit });
			assets.value = res.data;
			meta.value = res.meta;
		} catch (e) {
			// Công ty chưa mở module hay mất mạng đều rơi vào đây: hiện khung lỗi có nút Thử lại
			// thay vì câu "không có tài sản nào", và KHÔNG để trang trắng.
			assets.value = [];
			meta.value = null;
			loadError.value =
				e instanceof Error ? e.message : 'Chưa tải được danh sách tài sản. Bạn bấm Thử lại.';
		} finally {
			loading.value = false;
		}
	}

	/** Cột hạn bảo dưỡng chỉ có ý nghĩa khi đang lọc theo hạn bảo dưỡng (G2). */
	const showMaintenanceColumn = computed(() => !!filterMaintenanceDue.value);

	/** "Quá hạn 3 ngày", "Đến hạn hôm nay", "Còn 10 ngày" cho cột hạn bảo dưỡng. */
	function maintenanceDueText(date: string | null): string {
		const days = maintenanceDaysLeft(date);
		if (days == null) return '';
		if (days < 0) return `Quá hạn ${Math.abs(days)} ngày`;
		if (days === 0) return 'Đến hạn hôm nay';
		return `Còn ${days} ngày`;
	}

	/** Bấm thẻ ở khối Tổng quan thì cuộn xuống danh sách đã lọc, kẻo người dùng tưởng không có gì đổi (H3). */
	function scrollToList() {
		nextTick(() => document.getElementById('asset-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
	}

	onMounted(async () => {
		try {
			categories.value = await service.findCategories();
		} catch {
			// không chặn bảng chính: thiếu danh mục thì ô lọc loại rỗng thôi
		}
		directoryStore.load().catch(() => {
			/* ô lọc phòng ban rỗng, bảng vẫn chạy */
		});
		await loadTable();
	});

	// Bấm thẻ Tổng quan khi đang đứng sẵn ở trang này chỉ đổi URL chứ không tải lại trang,
	// nên phải nghe query để bảng chạy theo.
	watch(
		() => [route.query.maintenanceDueWithinDays, route.query.pendingConfirmation, route.query.disputed],
		() => {
			readQueryFilters();
			if (activeQueryFilters.value.length) scrollToList();
		},
	);

	watch(
		[
			search,
			filterKind,
			filterStatus,
			filterCategory,
			filterDept,
			filterMaintenanceDue,
			filterPendingConfirm,
			filterDisputed,
		],
		() => {
			page.value = 1;
			loadTable();
		},
	);
	watch(page, () => loadTable());

	// Đổi họ tài sản thì trạng thái và loại đang chọn có thể không còn thuộc họ đó.
	watch(filterKind, kind => {
		if (kind && filterStatus.value) {
			const allowed = kind === 'SERVICE' ? SERVICE_STATUSES : PHYSICAL_STATUSES;
			if (!allowed.includes(filterStatus.value)) filterStatus.value = '';
		}
		if (kind && filterCategory.value) {
			const cat = categories.value.find(c => c.id === filterCategory.value);
			if (cat && cat.kind !== kind) filterCategory.value = undefined;
		}
	});

	let searchTimer: ReturnType<typeof setTimeout> | null = null;
	function onSearchInput(e: Event) {
		const val = (e.target as HTMLInputElement).value;
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			search.value = val;
		}, 300);
	}

	const kindOptions = [
		{ value: '', label: 'Tất cả loại hình' },
		...Object.entries(ASSET_KIND_LABELS).map(([value, label]) => ({ value, label })),
	];

	const statusOptions = computed(() => {
		const codes = filterKind.value
			? filterKind.value === 'SERVICE'
				? SERVICE_STATUSES
				: PHYSICAL_STATUSES
			: [...PHYSICAL_STATUSES, ...SERVICE_STATUSES];
		return [
			{ value: '', label: 'Tất cả trạng thái' },
			...codes.map(code => ({ value: code, label: ASSET_STATUS_LABELS[code] })),
		];
	});

	const categoryOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Tất cả loại tài sản' },
		...categories.value
			.filter(c => !filterKind.value || c.kind === filterKind.value)
			.map(c => ({ value: c.id as number | undefined, label: `${c.groupName} → ${c.name}` })),
	]);

	const deptOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Tất cả phòng ban' },
		...departments.value.map(d => ({ value: d.id as number | undefined, label: d.name })),
	]);

	/**
	 * Câu cho bảng rỗng.
	 *
	 * Người dùng vừa bấm một thẻ ở Tổng quan mà thấy bảng trắng thì phải biết họ đang xem
	 * một lát cắt chứ không phải công ty không có tài sản nào.
	 */
	const hasFieldFilter = computed(
		() =>
			!!filterKind.value || !!filterStatus.value || !!filterCategory.value || (!isDepartmentScoped.value && !!filterDept.value),
	);

	/** Câu trạng thái rỗng phân biệt "chưa có gì" với "lọc không ra" (copy-review mục 50, M6). */
	const emptyText = computed(() => {
		if (activeQueryFilters.value.length) {
			return `Không có tài sản nào thuộc nhóm ${activeQueryFilters.value.map(c => c.label.toLowerCase()).join(' và ')}. Bạn bỏ nhãn lọc để xem đủ danh sách.`;
		}
		if (search.value) {
			const scope = isDepartmentScoped.value
				? ' Tài sản chưa cấp phát cho người trong phòng bạn thì chưa hiện ở đây.'
				: '';
			return `Không tìm thấy tài sản nào khớp "${search.value}". Bạn thử tìm theo mã, tên, serial hoặc tên người đang giữ.${scope}`;
		}
		if (hasFieldFilter.value) return 'Không có tài sản nào khớp bộ lọc. Bạn bỏ bớt điều kiện lọc để xem thêm.';
		if (isDepartmentScoped.value) return 'Phòng bạn chưa được cấp phát tài sản nào.';
		return canManage.value
			? 'Công ty chưa có tài sản nào. Bạn bấm Thêm tài sản hoặc Nhập Excel để bắt đầu.'
			: 'Chưa có tài sản nào trong phạm vi bạn được xem.';
	});

	/** Cột tiền ẩn hẳn khi không ai trong trang này được xem giá trị. */
	const showValueColumn = computed(() => assets.value.some(a => a.canViewValue));

	/**
	 * Bấm một thẻ trạng thái ở khối Tổng quan thì lọc luôn bảng bên dưới.
	 *
	 * Xoá bộ lọc họ tài sản trước: thẻ "Hết hạn" là của dịch vụ, thẻ "Đang bảo dưỡng" là của
	 * thiết bị, giữ nguyên họ đang chọn thì ra bảng rỗng dù số trên thẻ khác 0.
	 */
	function onPickStatus(status: AssetStatus) {
		filterKind.value = '';
		filterStatus.value = status;
		scrollToList();
	}

	/** Chữ cho cờ cảnh báo: nói rõ đang vướng báo hỏng hay báo mất, không chỉ "có việc". */
	function incidentFlagTitle(asset: Asset): string {
		const labels = [...new Set(asset.openIncidents.map(i => i.typeLabel))];
		return `${labels.join(', ')} đang chờ xử lý`;
	}

	function holderLabel(asset: Asset): string {
		if (!asset.holders.length) return '—';
		const first = asset.holders[0]!;
		const name = first.employee?.fullName ?? first.department?.name ?? '—';
		return asset.holders.length > 1 ? `${name} +${asset.holders.length - 1}` : name;
	}

	async function handleExport() {
		exporting.value = true;
		try {
			const blob = await service.exportExcel(currentQuery());
			downloadAssetBlob(blob, 'tai-san.xlsx');
			toast.success('Đã tải file tai-san.xlsx gồm các tài sản khớp bộ lọc đang chọn.');
		} catch (e) {
			toast.error(
				e instanceof Error
					? e.message
					: 'Chưa xuất được file Excel. Bạn thử lại sau ít phút; nếu vẫn lỗi, hãy báo quản trị hệ thống.',
			);
		} finally {
			exporting.value = false;
		}
	}

	async function onSaved() {
		showFormModal.value = false;
		page.value = 1;
		await loadTable();
	}

	async function onImported() {
		showImportModal.value = false;
		page.value = 1;
		await loadTable();
	}
</script>

<template>
	<div class="space-y-5 pb-40 sm:pb-24">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h1 class="text-xl font-bold text-gray-900 dark:text-white">Quản lý tài sản</h1>
				<p class="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
					{{ isDepartmentScoped ? 'Thiết bị và dịch vụ thuê bao của phòng bạn' : 'Thiết bị và dịch vụ thuê bao của công ty' }}
				</p>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<CommonAppButton
					variant="outline"
					:loading="exporting"
					title="Tải file Excel danh sách tài sản khớp bộ lọc đang chọn, kèm hạn bảo dưỡng"
					@click="handleExport"
				>
					Xuất Excel
				</CommonAppButton>
				<CommonAppButton v-if="canManage" variant="outline" @click="showImportModal = true">
					Nhập Excel
				</CommonAppButton>
				<CommonAppButton v-if="canManage" variant="primary" @click="showFormModal = true">
					Thêm tài sản
				</CommonAppButton>
			</div>
		</div>

		<CommonAppModuleNotice module="ASSET" />

		<AssetOverviewPanel @pick-status="onPickStatus" />

		<!-- Bộ lọc -->
		<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
			<p v-if="scopeText" class="mb-3 text-sm text-gray-600 dark:text-gray-400">{{ scopeText }}</p>
			<div
				class="grid grid-cols-1 gap-3 sm:grid-cols-2"
				:class="isDepartmentScoped ? 'lg:grid-cols-4' : 'lg:grid-cols-5'"
			>
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
						placeholder="Tìm mã, tên, serial hoặc người đang giữ"
						aria-label="Tìm tài sản"
						class="block w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						@input="onSearchInput"
					/>
				</div>
				<UiSelect v-model="filterKind" :options="kindOptions" />
				<UiSelect v-model="filterStatus" :options="statusOptions" />
				<UiSelect v-model="filterCategory" :options="categoryOptions" />
				<UiSelect v-if="!isDepartmentScoped" v-model="filterDept" :options="deptOptions" />
			</div>

			<!-- Nhãn của bộ lọc đến từ thẻ Tổng quan, mỗi nhãn bỏ được bằng dấu x. -->
			<div v-if="activeQueryFilters.length" class="mt-3 flex flex-wrap items-center gap-2">
				<span class="text-xs text-gray-500 dark:text-gray-400">Đang lọc:</span>
				<span
					v-for="chip in activeQueryFilters"
					:key="chip.key"
					class="inline-flex max-w-full items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-1 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
				>
					<span class="min-w-0 break-words">{{ chip.label }}</span>
					<button
						type="button"
						class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:bg-brand-100 dark:hover:bg-brand-800"
						:aria-label="`Bỏ lọc ${chip.label}`"
						@click="clearQueryFilter(chip.key)"
					>
						<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</span>
			</div>
		</div>

		<!-- Bảng -->
		<div
			id="asset-list"
			class="scroll-mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
		>
			<div v-if="loading" class="space-y-3 p-6">
				<div v-for="i in 5" :key="i" class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
			</div>

			<div v-else-if="loadError" class="flex flex-col items-center gap-3 px-4 py-12 text-center">
				<p class="text-sm text-rose-700 dark:text-rose-300">{{ loadError }}</p>
				<CommonAppButton variant="outline" class="min-h-11 sm:min-h-0" @click="loadTable">Thử lại</CommonAppButton>
			</div>

			<div
				v-else-if="!assets.length"
				class="flex flex-col items-center justify-center px-4 py-16 text-center text-gray-500 dark:text-gray-400"
			>
				<svg class="mb-3 h-10 w-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25M12 12.75h.008v.008H12v-.008z"
					/>
				</svg>
				<p class="max-w-md text-sm">{{ emptyText }}</p>
			</div>

			<!-- Thẻ trên điện thoại: bảng bảy cột bóp vào 390 px thì chữ bẻ vụn và phải vuốt ngang (M4). -->
			<ul v-else class="divide-y divide-gray-100 sm:hidden dark:divide-gray-800">
				<li v-for="asset in assets" :key="asset.id">
					<NuxtLink :to="`/management/assets/${asset.id}`" class="block space-y-1.5 p-4 active:bg-gray-50 dark:active:bg-gray-800/40">
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0">
								<p class="font-medium text-gray-900 dark:text-white">{{ asset.name }}</p>
								<p class="font-mono text-xs text-gray-600 dark:text-gray-400">{{ asset.code }}</p>
							</div>
							<span class="inline-flex flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium" :class="ASSET_STATUS_CLASS[asset.status]">
								{{ asset.statusLabel }}
							</span>
						</div>
						<p class="text-sm text-gray-600 dark:text-gray-400">{{ asset.category.groupName }} → {{ asset.category.name }}</p>
						<p class="text-sm text-gray-700 dark:text-gray-300">Đang giữ: {{ holderLabel(asset) }}</p>
						<p v-if="asset.openIncidents.length" class="text-sm text-amber-700 dark:text-amber-400">{{ incidentFlagTitle(asset) }}</p>
						<p
							v-if="showMaintenanceColumn && asset.physical?.nextMaintenanceDate"
							class="text-sm"
							:class="maintenanceDueClass(asset.physical.nextMaintenanceDate)"
						>
							Hạn bảo dưỡng {{ formatDate(asset.physical.nextMaintenanceDate) }}, {{ maintenanceDueText(asset.physical.nextMaintenanceDate).toLowerCase() }}
						</p>
						<p v-if="showValueColumn && asset.canViewValue" class="text-sm tabular-nums text-gray-700 dark:text-gray-300">
							Nguyên giá {{ formatAssetMoney(asset.costVnd ?? asset.cost, asset.costVnd != null ? 'VND' : asset.currency) }}
						</p>
					</NuxtLink>
				</li>
			</ul>

			<div v-if="!loading && !loadError && assets.length" class="hidden overflow-x-auto sm:block">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Mã tài sản</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tên</th>
							<th v-if="showMaintenanceColumn" class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Hạn bảo dưỡng</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Loại</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Đang giữ</th>
							<th v-if="showValueColumn" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Nguyên giá</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Trạng thái</th>
							<th class="px-4 py-3" />
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
						<tr
							v-for="asset in assets"
							:key="asset.id"
							class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40"
						>
							<td class="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{{ asset.code }}</td>
							<td class="px-4 py-3">
								<div class="flex items-center gap-1.5">
									<!-- Cờ báo hỏng, báo mất đang chờ: người quản lý nhìn bảng là thấy ngay
									     tài sản nào có việc, không phải mở từng cái. -->
									<svg
										v-if="asset.openIncidents.length"
										class="h-4 w-4 flex-shrink-0 text-amber-500"
										:aria-label="incidentFlagTitle(asset)"
										role="img"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<title>{{ incidentFlagTitle(asset) }}</title>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
										/>
									</svg>
									<NuxtLink
										:to="`/management/assets/${asset.id}`"
										class="font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
									>
										{{ asset.name }}
									</NuxtLink>
								</div>
								<p v-if="asset.physical?.serialNumber" class="font-mono text-xs text-gray-500">
									Số serial {{ asset.physical.serialNumber }}
								</p>
								<p v-else-if="asset.service?.plan" class="text-xs text-gray-500">{{ asset.service.plan }}</p>
							</td>
							<td v-if="showMaintenanceColumn" class="whitespace-nowrap px-4 py-3">
								<template v-if="asset.physical?.nextMaintenanceDate">
									<p class="text-gray-700 dark:text-gray-300">{{ formatDate(asset.physical.nextMaintenanceDate) }}</p>
									<p class="text-xs" :class="maintenanceDueClass(asset.physical.nextMaintenanceDate)">
										{{ maintenanceDueText(asset.physical.nextMaintenanceDate) }}
									</p>
								</template>
								<span v-else class="text-gray-400">—</span>
							</td>
							<td class="px-4 py-3">
								<p class="text-gray-700 dark:text-gray-300">{{ asset.category.name }}</p>
								<p class="text-xs text-gray-400">{{ asset.category.groupName }} · {{ asset.kindLabel }}</p>
							</td>
							<td class="px-4 py-3 text-gray-700 dark:text-gray-300">
								{{ holderLabel(asset) }}
								<p
									v-if="asset.kind === 'SERVICE' && asset.service?.seatCount != null"
									class="text-xs"
									:class="
										asset.service.seatsUsed > asset.service.seatCount
											? 'text-amber-600 dark:text-amber-400'
											: 'text-gray-400'
									"
								>
									{{ asset.service.seatsUsed }}/{{ asset.service.seatCount }} ghế
								</p>
							</td>
							<td v-if="showValueColumn" class="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
								{{ formatAssetMoney(asset.costVnd ?? asset.cost, asset.costVnd != null ? 'VND' : asset.currency) }}
							</td>
							<td class="px-4 py-3">
								<span
									class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
									:class="ASSET_STATUS_CLASS[asset.status]"
								>
									{{ asset.statusLabel }}
								</span>
								<p v-if="asset.purchaseDate" class="mt-0.5 text-xs text-gray-400">
									Mua {{ formatDate(asset.purchaseDate) }}
								</p>
							</td>
							<td class="px-4 py-3 text-right">
								<NuxtLink
									:to="`/management/assets/${asset.id}`"
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
				class="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-4 py-3 dark:border-gray-800"
			>
				<p class="text-xs text-gray-600 dark:text-gray-400">
					{{ (page - 1) * limit + 1 }}–{{ Math.min(page * limit, meta.total) }} / {{ meta.total }} tài sản
				</p>
				<CommonAppPagination
					:current-page="page"
					:total-pages="meta.totalPages"
					@update:current-page="page = $event"
				/>
			</div>
		</div>

		<AssetFormModal v-if="showFormModal" @saved="onSaved" @close="showFormModal = false" />
		<AssetImportModal v-if="showImportModal" @imported="onImported" @close="showImportModal = false" />
	</div>
</template>
