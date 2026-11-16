<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import StocktakeOneOpenHint from '~/components/modules/asset/StocktakeOneOpenHint.vue';
	import StocktakeCheckModal from '~/components/modules/asset/StocktakeCheckModal.vue';
	import StocktakeResolveModal from '~/components/modules/asset/StocktakeResolveModal.vue';
	import {
		STOCKTAKE_RESOLUTION_CLASS,
		STOCKTAKE_RESULT_CLASS,
		STOCKTAKE_STATUS_CLASS,
		downloadAssetBlob,
		scanResultText,
	} from '~/utils/asset.utils';
	import { formatDateTime } from '~/utils/date';
	import {
		ASSET_STOCKTAKE_RESULT_LABELS,
		type AssetStocktake,
		type AssetStocktakeLine,
		type AssetStocktakeRef,
		type AssetStocktakeResult,
	} from '~/types/asset.types';

	definePageMeta({ title: 'Đợt kiểm kê' });

	const route = useRoute();
	const toast = useToast();
	const service = useAssetService();
	const { canWrite } = useModuleAccess();
	const { hasPermission } = usePermissions();

	const stocktakeId = computed(() => Number(route.params.id));
	const canManage = computed(() => canWrite('ASSET') && hasPermission('asset:manage'));

	const stocktake = ref<AssetStocktake | null>(null);
	const openRef = ref<AssetStocktakeRef | null>(null);
	const loading = ref(true);
	const loadError = ref<string | null>(null);

	const isOpen = computed(() => stocktake.value?.status === 'OPEN');
	const isClosed = computed(() => stocktake.value?.status === 'CLOSED');
	/** Ô quét tem chỉ có khi đợt đang mở và người xem ghi được kết quả. */
	const canScan = computed(() => canManage.value && isOpen.value);

	// Ba hộp thoại của trang. Khai ở đầu vì `anyDialogOpen` và watcher của nó đọc cả ba ngay khi
	// dựng trang; khai muộn hơn thì bản build ném "Cannot access … before initialization" (500).
	const checking = ref<AssetStocktakeLine | null>(null);
	const resolving = ref<AssetStocktakeLine | null>(null);
	const confirming = ref<'close' | 'cancel' | null>(null);

	// ─── Danh sách dòng và bộ lọc ─────────────────────────────────────────────────

	const filterResult = ref<AssetStocktakeResult | ''>('');
	const filterScope = ref<'' | 'in' | 'out'>('');
	const onlyDiscrepancy = ref(false);
	const onlyUnresolved = ref(false);
	const search = ref('');
	const page = ref(1);
	const limit = 50;

	const lines = ref<AssetStocktakeLine[]>([]);
	const linesMeta = ref<{ total: number; totalPages: number } | null>(null);
	const linesLoading = ref(false);
	const linesError = ref<string | null>(null);

	async function loadLines() {
		linesLoading.value = true;
		linesError.value = null;
		try {
			const res = await service.findStocktakeLines(stocktakeId.value, {
				page: page.value,
				limit,
				result: filterResult.value || undefined,
				inScope: filterScope.value === '' ? undefined : filterScope.value === 'in',
				discrepancy: onlyDiscrepancy.value || undefined,
				// Từ sửa sau bài nhập vai, `unresolved` đã gồm điều kiện chênh lệch.
				unresolved: onlyUnresolved.value || undefined,
				search: search.value.trim() || undefined,
			});
			lines.value = res.data;
			linesMeta.value = res.meta;
		} catch (e) {
			lines.value = [];
			linesMeta.value = null;
			linesError.value = e instanceof Error ? e.message : 'Chưa tải được danh sách thiết bị của đợt. Bạn bấm Thử lại.';
		} finally {
			linesLoading.value = false;
		}
	}

	async function loadHeader() {
		const [st, open] = await Promise.all([service.findStocktake(stocktakeId.value), service.openStocktake()]);
		stocktake.value = st;
		openRef.value = open;
	}

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			await loadHeader();
		} catch (e) {
			// Trưởng phòng gõ thẳng URL nhận 403 ở đây: hiện câu của BE, không để trang trắng.
			stocktake.value = null;
			loadError.value = e instanceof Error ? e.message : 'Chưa mở được đợt kiểm kê này. Bạn bấm Thử lại.';
			loading.value = false;
			return;
		}
		loading.value = false;
		await loadLines();
		focusScan();
	}

	/** Sau mỗi lần ghi: số liệu đầu trang và danh sách cùng đổi. Lỗi ở đây chỉ báo, không xoá trang. */
	async function refresh() {
		try {
			await loadHeader();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa cập nhật được số liệu của đợt. Bạn tải lại trang.');
		}
		await loadLines();
	}

	onMounted(load);
	watch(stocktakeId, load);

	// Đổi bộ lọc bằng ô chọn, ô đánh dấu hay sang trang thì con trỏ về ô quét, để lần quét kế tiếp
	// không rơi vào ô vừa bấm. Ô tìm kiếm thì không: người dùng đang gõ ở đó.
	watch([filterResult, filterScope, onlyDiscrepancy, onlyUnresolved], () => {
		page.value = 1;
		loadLines();
		focusScan();
	});
	watch(page, () => {
		loadLines();
		focusScan();
	});

	let searchTimer: ReturnType<typeof setTimeout> | null = null;
	function onSearchInput() {
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			page.value = 1;
			loadLines();
		}, 300);
	}

	const resultOptions = [
		{ value: '', label: 'Mọi kết quả' },
		...Object.entries(ASSET_STOCKTAKE_RESULT_LABELS).map(([value, label]) => ({ value, label })),
	];
	const scopeOptions = [
		{ value: '', label: 'Trong và ngoài phạm vi' },
		{ value: 'in', label: 'Trong phạm vi' },
		{ value: 'out', label: 'Ngoài phạm vi' },
	];

	// ─── Ô "Nhập mã hoặc quét tem" ────────────────────────────────────────────────
	//
	// Máy quét cắm USB gõ cả chuỗi rồi nhấn Enter. Enter là gửi, ghi xong thì xoá ô và giữ con trỏ
	// để quét tiếp. Không khoá ô trong lúc gửi: khoá là mất focus và lần quét sau rơi ra ngoài trang.
	// Bài nhập vai cho thấy chỉ cần một hộp thoại vừa đóng là con trỏ rời ô và lần quét kế tiếp mất
	// không báo gì, nên mọi thao tác trên trang đều đưa con trỏ về ô này (`focusScan`), kèm một lớp
	// phòng hờ bắt chuỗi tem gõ ra ngoài ô (`onGlobalKeydown`).

	const scanInput = ref<HTMLInputElement | null>(null);
	const scanCode = ref('');
	const scanning = ref(false);
	/** Kết quả lần quét gần nhất; có `line` thì hiện nút Ghi tay để sửa ngay kết quả của thiết bị đó. */
	const lastScan = ref<{ ok: boolean; text: string; line: AssetStocktakeLine | null } | null>(null);

	async function submitScan() {
		const code = scanCode.value.trim();
		if (!code || scanning.value || !stocktake.value) return;
		scanning.value = true;
		try {
			const line = await service.checkStocktake(stocktake.value.id, { code, result: 'OK', byScan: true });
			scanCode.value = '';
			const text = scanResultText(line);
			if (line.inScope) {
				lastScan.value = { ok: true, text, line };
				toast.success(text);
			} else {
				// Dòng ngoài phạm vi chỉ ghi tham khảo, không ghi tay hay xử lý được.
				lastScan.value = { ok: false, text, line: null };
				toast.warning(text);
			}
			await refresh();
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Chưa ghi được mã vừa quét. Bạn thử quét lại.';
			lastScan.value = { ok: false, text: message, line: null };
			toast.error(message);
			// Bôi đen mã lỗi để lần quét sau ghi đè lên, khỏi phải xoá tay.
			nextTick(() => scanInput.value?.select());
		} finally {
			scanning.value = false;
			focusScan();
		}
	}

	const anyDialogOpen = computed(() => !!checking.value || !!resolving.value || !!confirming.value);

	/** Đưa con trỏ về ô quét khi đợt đang mở và không có hộp thoại nào. */
	function focusScan() {
		if (!canScan.value || anyDialogOpen.value) return;
		nextTick(() => scanInput.value?.focus());
	}

	const SCAN_PREFIX = 'HRM:ASSET:';
	let keyBuffer = '';
	let lastKeyAt = 0;

	function isEditable(el: EventTarget | null): boolean {
		return (
			el instanceof HTMLInputElement ||
			el instanceof HTMLTextAreaElement ||
			el instanceof HTMLSelectElement ||
			(el instanceof HTMLElement && el.isContentEditable)
		);
	}

	/**
	 * Phòng hờ khi con trỏ đang ở ngoài ô quét: máy quét gõ chuỗi tem `HRM:ASSET:…` rồi Enter vào
	 * một nút hay vùng trống thì gom các phím lại, Enter thì chuyển chuỗi vào ô quét và ghi. Gõ lọt
	 * vào một ô chữ khác (ô tìm kiếm) thì cắt phần chuỗi tem ra khỏi ô đó. Chặn Enter để nút đang
	 * được focus không bị bấm nhầm.
	 */
	function onGlobalKeydown(e: KeyboardEvent) {
		if (!canScan.value || anyDialogOpen.value) return;
		const target = e.target;
		if (target === scanInput.value) return;

		if (e.key === 'Enter') {
			let code = '';
			if (keyBuffer.trim().toUpperCase().startsWith(SCAN_PREFIX)) {
				code = keyBuffer.trim();
			} else if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
				const idx = target.value.toUpperCase().lastIndexOf(SCAN_PREFIX);
				if (idx >= 0) {
					code = target.value.slice(idx).trim();
					target.value = target.value.slice(0, idx);
					target.dispatchEvent(new Event('input', { bubbles: true }));
				}
			}
			keyBuffer = '';
			if (!code) return;
			e.preventDefault();
			e.stopPropagation();
			scanCode.value = code;
			submitScan();
			return;
		}

		if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey || isEditable(target)) return;
		const now = Date.now();
		// Máy quét gõ dồn dập; ngừng quá nửa giây là người gõ tay, bắt đầu lại.
		if (now - lastKeyAt > 500) keyBuffer = '';
		lastKeyAt = now;
		keyBuffer += e.key;
	}

	onMounted(() => window.addEventListener('keydown', onGlobalKeydown, true));
	onUnmounted(() => window.removeEventListener('keydown', onGlobalKeydown, true));

	// ─── Ghi tay, xử lý chênh lệch ───────────────────────────────────────────────

	const quickOkId = ref<number | null>(null);

	// Hộp thoại nào đóng (lưu, huỷ hay Esc) thì con trỏ về ô quét.
	watch(anyDialogOpen, open => {
		if (!open) focusScan();
	});

	async function quickOk(line: AssetStocktakeLine) {
		if (!stocktake.value || quickOkId.value) return;
		quickOkId.value = line.id;
		try {
			const saved = await service.checkStocktake(stocktake.value.id, { assetId: line.asset.id, result: 'OK', byScan: false });
			toast.success(`Đã ghi ${saved.asset.code} là ${saved.resultLabel}.`);
			await refresh();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa ghi được kết quả. Bạn thử lại sau ít phút.');
		} finally {
			quickOkId.value = null;
			focusScan();
		}
	}

	async function onChecked() {
		checking.value = null;
		lastScan.value = null;
		await refresh();
		focusScan();
	}

	async function onResolved() {
		resolving.value = null;
		await refresh();
	}

	/** Chênh lệch xử lý được: dòng trong phạm vi, kết quả khác Đúng, chưa xử lý, đợt đã đóng. */
	function canResolve(line: AssetStocktakeLine): boolean {
		return canManage.value && isClosed.value && line.inScope && line.result !== 'OK' && line.result !== 'PENDING' && line.resolution === 'NONE';
	}

	/** Ghi kết quả từng dòng chỉ khi đợt đang mở, và không cho dòng ngoài phạm vi (chỉ ghi tham khảo). */
	function canCheck(line: AssetStocktakeLine): boolean {
		return canScan.value && line.inScope;
	}

	// ─── Đóng, huỷ, xuất biên bản ────────────────────────────────────────────────

	const cancelNote = ref('');
	const busy = ref(false);

	/**
	 * Hộp đóng đợt nêu tên các thiết bị chưa kiểm (tối đa 10 dòng), để người đóng đợt biết đúng máy
	 * nào sẽ tự chuyển sang Không tìm thấy thay vì chỉ thấy một con số.
	 */
	const PENDING_PREVIEW = 10;
	const pendingPreview = ref<AssetStocktakeLine[]>([]);
	const pendingTotal = ref(0);
	const pendingLoading = ref(false);
	const pendingError = ref<string | null>(null);

	async function askClose() {
		confirming.value = 'close';
		pendingPreview.value = [];
		pendingTotal.value = stocktake.value?.summary.pending ?? 0;
		pendingError.value = null;
		if (!stocktake.value || !pendingTotal.value) return;
		pendingLoading.value = true;
		try {
			const res = await service.findStocktakeLines(stocktake.value.id, {
				inScope: true,
				result: 'PENDING',
				page: 1,
				limit: PENDING_PREVIEW,
			});
			pendingPreview.value = res.data;
			pendingTotal.value = res.meta.total;
		} catch (e) {
			pendingError.value =
				e instanceof Error ? e.message : 'Chưa tải được danh sách thiết bị chưa kiểm. Bạn vẫn đóng đợt được.';
		} finally {
			pendingLoading.value = false;
		}
	}

	const pendingMore = computed(() => Math.max(0, pendingTotal.value - pendingPreview.value.length));

	async function closeStocktake() {
		if (!stocktake.value || busy.value) return;
		busy.value = true;
		try {
			const pending = stocktake.value.summary.pending;
			stocktake.value = await service.closeStocktake(stocktake.value.id);
			confirming.value = null;
			toast.success(
				pending
					? `Đã đóng đợt "${stocktake.value.name}". ${pending} thiết bị chưa kiểm đã chuyển sang Không tìm thấy. Bạn xử lý từng chênh lệch ở danh sách bên dưới.`
					: `Đã đóng đợt "${stocktake.value.name}". Bạn xử lý từng chênh lệch ở danh sách bên dưới.`,
			);
			onlyUnresolved.value = true;
			await refresh();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa đóng được đợt kiểm kê. Bạn thử lại sau ít phút.');
		} finally {
			busy.value = false;
		}
	}

	async function cancelStocktake() {
		if (!stocktake.value || busy.value) return;
		busy.value = true;
		try {
			stocktake.value = await service.cancelStocktake(stocktake.value.id, cancelNote.value.trim() || undefined);
			confirming.value = null;
			toast.success(`Đã huỷ đợt "${stocktake.value.name}". Bạn có thể mở đợt kiểm kê mới.`);
			await refresh();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa huỷ được đợt kiểm kê. Bạn thử lại sau ít phút.');
		} finally {
			busy.value = false;
		}
	}

	function askCancel() {
		cancelNote.value = '';
		confirming.value = 'cancel';
	}

	useEscapeKey(
		() => (confirming.value = null),
		() => !!confirming.value && !busy.value,
	);

	const exporting = ref(false);
	async function exportRecord() {
		if (!stocktake.value || exporting.value) return;
		exporting.value = true;
		try {
			const blob = await service.exportStocktake(stocktake.value.id);
			const fileName = `bien-ban-kiem-ke-${stocktake.value.id}.xlsx`;
			downloadAssetBlob(blob, fileName);
			toast.success(`Đã tải file ${fileName} gồm số liệu và danh sách thiết bị của đợt.`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa xuất được biên bản. Bạn thử lại sau ít phút.');
		} finally {
			exporting.value = false;
			focusScan();
		}
	}

	// ─── Hiển thị ────────────────────────────────────────────────────────────────

	const summaryCards = computed(() => {
		const s = stocktake.value?.summary;
		if (!s) return [];
		return [
			{ key: 'total', label: 'Tổng thiết bị', value: s.total, tone: '' },
			{ key: 'checked', label: 'Đã kiểm', value: s.checked, tone: '' },
			{ key: 'pending', label: 'Chưa kiểm', value: s.pending, tone: s.pending ? 'text-amber-600 dark:text-amber-400' : '' },
			{ key: 'ok', label: 'Đúng', value: s.ok, tone: 'text-emerald-600 dark:text-emerald-400' },
			{ key: 'wrongLocation', label: 'Sai vị trí', value: s.wrongLocation, tone: s.wrongLocation ? 'text-amber-600 dark:text-amber-400' : '' },
			{ key: 'wrongHolder', label: 'Sai người giữ', value: s.wrongHolder, tone: s.wrongHolder ? 'text-orange-600 dark:text-orange-400' : '' },
			{ key: 'damaged', label: 'Hỏng', value: s.damaged, tone: s.damaged ? 'text-rose-600 dark:text-rose-400' : '' },
			{
				key: 'notFound',
				label: 'Không tìm thấy',
				value: s.notFound,
				tone: s.notFound ? 'text-rose-600 dark:text-rose-400' : '',
				// `checked` chỉ đếm dòng có người ghi; phần không ai kiểm tự thành Không tìm thấy lúc đóng đợt.
				hint: isClosed.value && s.autoNotFound > 0 ? `trong đó ${s.autoNotFound} thiết bị không ai kiểm` : '',
			},
			{ key: 'outOfScope', label: 'Ngoài phạm vi', value: s.outOfScope, tone: '' },
			{ key: 'unresolved', label: 'Chênh lệch chưa xử lý', value: s.unresolved, tone: s.unresolved ? 'text-amber-600 dark:text-amber-400' : '' },
		];
	});

	const guide = computed(() => {
		const st = stocktake.value;
		if (!st) return '';
		if (st.status === 'OPEN') {
			return canManage.value
				? 'Bạn quét tem hoặc gõ mã tài sản vào ô Nhập mã hoặc quét tem rồi nhấn Enter để ghi Đúng. Thiết bị nào lệch thì bạn bấm Ghi tay ở dòng của thiết bị đó. Kiểm xong thì bấm Đóng đợt để xử lý chênh lệch.'
				: 'Đợt đang kiểm kê. Người quản lý tài sản ghi kết quả và đóng đợt.';
		}
		if (st.status === 'CLOSED') {
			if (!st.summary.unresolved) return 'Đợt đã đóng và mọi chênh lệch đã được xử lý. Bạn bấm Xuất biên bản để lưu hồ sơ.';
			return canManage.value
				? `Đợt đã đóng, còn ${st.summary.unresolved} chênh lệch chưa xử lý. Bạn bấm Xử lý ở từng dòng để cập nhật sổ, tạo phiếu sửa, xác nhận mất hoặc giữ nguyên sổ.`
				: `Đợt đã đóng, còn ${st.summary.unresolved} chênh lệch chưa xử lý. Người quản lý tài sản xử lý từng dòng, bạn bấm Xuất biên bản để xem kết quả.`;
		}
		return 'Đợt đã huỷ, kết quả đã ghi chỉ còn để tham khảo.';
	});

	function expectedText(line: AssetStocktakeLine): string {
		const who = line.expectedHolderName ?? line.expectedDepartmentName ?? 'Chưa cấp phát';
		return line.expectedLocation ? `${who}, ${line.expectedLocation}` : who;
	}

	/** Dòng trong phạm vi có kết quả lệch thì mới có cách xử lý để hiện. */
	const isDiscrepancy = (line: AssetStocktakeLine) => line.inScope && line.result !== 'OK' && line.result !== 'PENDING';

	const inputCls =
		'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
</script>

<template>
	<!-- Khoảng trống cuối trang để nút tròn trợ lý AI không che nút ở dòng cuối. -->
	<div class="space-y-5 pb-44 sm:pb-36">
		<NuxtLink
			to="/management/assets/stocktakes"
			class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
			Danh sách đợt kiểm kê
		</NuxtLink>

		<CommonAppModuleNotice module="ASSET" />

		<div v-if="loading" class="space-y-4">
			<div class="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
			<div class="h-64 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>

		<div
			v-else-if="loadError"
			class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-center dark:border-rose-800 dark:bg-rose-900/20"
		>
			<p class="text-sm text-rose-700 dark:text-rose-300">{{ loadError }}</p>
			<div class="mt-3 flex flex-wrap items-center justify-center gap-3">
				<CommonAppButton size="sm" variant="outline" @click="load">Thử lại</CommonAppButton>
				<NuxtLink to="/management/assets" class="text-sm text-brand-600 hover:underline dark:text-brand-400">Về danh sách tài sản</NuxtLink>
			</div>
		</div>

		<template v-else-if="stocktake">
			<!-- Đầu trang -->
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div class="min-w-0">
					<div class="flex flex-wrap items-center gap-2">
						<h1 class="break-words text-xl font-bold text-gray-900 dark:text-white">{{ stocktake.name }}</h1>
						<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="STOCKTAKE_STATUS_CLASS[stocktake.status]">
							{{ stocktake.statusLabel }}
						</span>
						<StocktakeOneOpenHint :open-name="openRef?.name" />
					</div>
					<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Phạm vi: {{ stocktake.scope.text }}</p>
					<p class="text-xs text-gray-500 dark:text-gray-400">
						{{ stocktake.openedBy.name }} mở {{ formatDateTime(stocktake.openedAt) }}
						<template v-if="stocktake.closedBy && stocktake.closedAt">
							· {{ stocktake.closedBy.name }} {{ stocktake.status === 'CANCELLED' ? 'huỷ' : 'đóng' }} {{ formatDateTime(stocktake.closedAt) }}
						</template>
					</p>
					<p v-if="stocktake.note" class="mt-1 whitespace-pre-line text-sm text-gray-600 dark:text-gray-300">{{ stocktake.note }}</p>
				</div>
				<div class="flex w-full flex-wrap gap-2 sm:w-auto">
					<CommonAppButton variant="outline" class="min-h-11 flex-1 sm:min-h-0 sm:flex-none" :loading="exporting" @click="exportRecord">
						Xuất biên bản
					</CommonAppButton>
					<template v-if="canScan">
						<CommonAppButton variant="primary" class="min-h-11 flex-1 sm:min-h-0 sm:flex-none" @click="askClose">
							Đóng đợt
						</CommonAppButton>
						<CommonAppButton variant="danger_outline" class="min-h-11 flex-1 sm:min-h-0 sm:flex-none" @click="askCancel">
							Huỷ đợt
						</CommonAppButton>
					</template>
				</div>
			</div>

			<p class="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
				{{ guide }}
			</p>

			<!-- Số liệu -->
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
				<div v-for="card in summaryCards" :key="card.key" class="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
					<p class="text-xs text-gray-600 dark:text-gray-400">{{ card.label }}</p>
					<p class="text-lg font-bold tabular-nums" :class="card.tone || 'text-gray-900 dark:text-white'">{{ card.value }}</p>
					<p v-if="'hint' in card && card.hint" class="text-xs text-gray-500 dark:text-gray-400">{{ card.hint }}</p>
				</div>
			</div>

			<!-- Ô quét tem -->
			<section v-if="canScan" class="rounded-xl border border-brand-200 bg-brand-50/50 p-4 dark:border-brand-800 dark:bg-brand-900/10">
				<label for="stocktake-scan" class="block text-sm font-semibold text-gray-800 dark:text-gray-100">Nhập mã hoặc quét tem</label>
				<p class="mb-2 text-xs text-gray-600 dark:text-gray-400">
					Bạn quét tem bằng máy quét cắm vào máy tính, hoặc gõ mã tài sản rồi nhấn Enter. Mỗi mã ghi ở đây được tính
					là Đúng. Thiết bị nào lệch thì bạn bấm Ghi tay ở dòng của thiết bị đó.
				</p>
				<form class="flex gap-2" @submit.prevent="submitScan">
					<input
						id="stocktake-scan"
						ref="scanInput"
						v-model="scanCode"
						type="text"
						autocomplete="off"
						autocapitalize="off"
						spellcheck="false"
						:class="`${inputCls} font-mono`"
						placeholder="VD: CTA000001"
						autofocus
					/>
					<CommonAppButton variant="primary" type="submit" class="min-h-11 flex-shrink-0 sm:min-h-0" :loading="scanning">Ghi</CommonAppButton>
				</form>
				<div v-if="lastScan" class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1" role="status">
					<p class="text-sm" :class="lastScan.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'">
						{{ lastScan.text }}
					</p>
					<button
						v-if="lastScan.line"
						type="button"
						class="min-h-11 text-sm font-medium text-brand-700 underline hover:no-underline sm:min-h-0 dark:text-brand-300"
						@click="checking = lastScan.line"
					>
						Ghi tay
					</button>
				</div>
			</section>

			<!-- Bộ lọc dòng -->
			<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
					<input
						v-model="search"
						type="text"
						:class="inputCls"
						placeholder="Tìm mã, tên hoặc số serial"
						aria-label="Tìm thiết bị trong đợt"
						@input="onSearchInput"
					/>
					<UiSelect v-model="filterResult" :options="resultOptions" />
					<UiSelect v-model="filterScope" :options="scopeOptions" />
				</div>
				<div class="mt-3 flex flex-wrap gap-x-5 gap-y-1">
					<label class="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-gray-700 sm:min-h-0 dark:text-gray-300">
						<input v-model="onlyDiscrepancy" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
						Chỉ chênh lệch
					</label>
					<label class="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-gray-700 sm:min-h-0 dark:text-gray-300">
						<input v-model="onlyUnresolved" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
						Chỉ chênh lệch chưa xử lý
					</label>
				</div>
			</div>

			<!-- Danh sách dòng -->
			<div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
				<div v-if="linesLoading && !lines.length" class="space-y-3 p-6">
					<div v-for="i in 5" :key="i" class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
				</div>
				<div v-else-if="linesError" class="flex flex-col items-center gap-3 px-4 py-12 text-center">
					<p class="text-sm text-rose-700 dark:text-rose-300">{{ linesError }}</p>
					<CommonAppButton variant="outline" class="min-h-11 sm:min-h-0" @click="loadLines">Thử lại</CommonAppButton>
				</div>
				<p v-else-if="!lines.length" class="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
					Không có thiết bị nào khớp bộ lọc. Bạn bỏ bớt điều kiện lọc để xem thêm.
				</p>

				<template v-else>
					<ul class="divide-y divide-gray-100 sm:hidden dark:divide-gray-800">
						<li v-for="line in lines" :key="line.id" class="space-y-2 p-4" :data-line-id="line.id">
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0">
									<NuxtLink :to="`/management/assets/${line.asset.id}`" class="font-medium text-gray-900 hover:text-brand-600 dark:text-white">
										{{ line.asset.name }}
									</NuxtLink>
									<p class="font-mono text-xs text-gray-600 dark:text-gray-400">{{ line.asset.code }}</p>
								</div>
								<span
									v-if="line.inScope"
									class="inline-flex flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
									:class="STOCKTAKE_RESULT_CLASS[line.result]"
								>
									{{ line.resultLabel }}
								</span>
								<span v-else class="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">Ngoài phạm vi, ghi tham khảo</span>
							</div>
							<p class="text-xs text-gray-600 dark:text-gray-400">Theo sổ: {{ expectedText(line) }}</p>
							<p v-if="line.observedLocation || line.observedNote" class="text-xs text-gray-700 dark:text-gray-300">
								Thực tế: {{ [line.observedLocation, line.observedNote].filter(Boolean).join('. ') }}
							</p>
							<span
								v-if="isDiscrepancy(line)"
								class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
								:class="STOCKTAKE_RESOLUTION_CLASS[line.resolution]"
							>
								{{ line.resolutionLabel }}
							</span>
							<p v-if="line.resolutionNote" class="text-xs text-gray-600 dark:text-gray-400">Ghi chú xử lý: {{ line.resolutionNote }}</p>
							<div v-if="canCheck(line) || canResolve(line)" class="flex gap-2">
								<template v-if="canCheck(line)">
									<CommonAppButton
										size="sm"
										variant="outline"
										class="min-h-11 flex-1"
										:loading="quickOkId === line.id"
										@click="quickOk(line)"
									>
										Đúng
									</CommonAppButton>
									<CommonAppButton size="sm" variant="outline" class="min-h-11 flex-1" @click="checking = line">Ghi tay</CommonAppButton>
								</template>
								<CommonAppButton v-else size="sm" variant="primary" class="min-h-11 w-full" @click="resolving = line">Xử lý</CommonAppButton>
							</div>
						</li>
					</ul>

					<div class="hidden overflow-x-auto sm:block">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Thiết bị</th>
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Theo sổ</th>
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Kết quả</th>
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Xử lý</th>
									<th class="px-4 py-3" />
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
								<tr v-for="line in lines" :key="line.id" :data-line-id="line.id" class="align-top">
									<td class="px-4 py-3">
										<NuxtLink
											:to="`/management/assets/${line.asset.id}`"
											class="font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
										>
											{{ line.asset.name }}
										</NuxtLink>
										<p class="font-mono text-xs text-gray-500">{{ line.asset.code }}</p>
										<p class="text-xs text-gray-500">{{ line.asset.categoryName }} · {{ line.asset.statusLabel }}</p>
									</td>
									<td class="max-w-[14rem] px-4 py-3 text-gray-700 dark:text-gray-300">{{ expectedText(line) }}</td>
									<td class="max-w-[16rem] px-4 py-3">
										<template v-if="line.inScope">
											<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="STOCKTAKE_RESULT_CLASS[line.result]">
												{{ line.resultLabel }}
											</span>
											<p v-if="line.observedLocation" class="mt-1 text-xs text-gray-700 dark:text-gray-300">Vị trí thực tế: {{ line.observedLocation }}</p>
											<p v-if="line.observedNote" class="text-xs text-gray-700 dark:text-gray-300">{{ line.observedNote }}</p>
										</template>
										<p v-else class="text-sm text-gray-500 dark:text-gray-400">Ngoài phạm vi, ghi tham khảo</p>
										<p v-if="line.checkedBy && line.checkedAt" class="text-xs text-gray-500">
											{{ line.checkedBy.name }}, {{ formatDateTime(line.checkedAt) }}{{ line.checkedByScan ? ', quét tem' : '' }}
										</p>
									</td>
									<td class="max-w-[14rem] px-4 py-3">
										<template v-if="isDiscrepancy(line)">
											<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="STOCKTAKE_RESOLUTION_CLASS[line.resolution]">
												{{ line.resolutionLabel }}
											</span>
											<p v-if="line.resolvedBy && line.resolvedAt" class="text-xs text-gray-500">
												{{ line.resolvedBy.name }}, {{ formatDateTime(line.resolvedAt) }}
											</p>
											<p v-if="line.resolutionNote" class="text-xs text-gray-600 dark:text-gray-400">{{ line.resolutionNote }}</p>
										</template>
										<span v-else class="text-gray-400">—</span>
									</td>
									<td class="whitespace-nowrap px-4 py-3 text-right">
										<div v-if="canCheck(line)" class="flex justify-end gap-2">
											<CommonAppButton size="sm" variant="outline" :loading="quickOkId === line.id" @click="quickOk(line)">Đúng</CommonAppButton>
											<CommonAppButton size="sm" variant="outline" @click="checking = line">Ghi tay</CommonAppButton>
										</div>
										<CommonAppButton v-else-if="canResolve(line)" size="sm" variant="primary" @click="resolving = line">Xử lý</CommonAppButton>
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</template>

				<div
					v-if="linesMeta && linesMeta.totalPages > 1"
					class="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-4 py-3 dark:border-gray-800"
				>
					<p class="text-xs text-gray-600 dark:text-gray-400">{{ linesMeta.total }} dòng</p>
					<CommonAppPagination :current-page="page" :total-pages="linesMeta.totalPages" @update:current-page="page = $event" />
				</div>
			</div>

			<StocktakeCheckModal
				v-if="checking"
				:stocktake-id="stocktake.id"
				:line="checking"
				@saved="onChecked"
				@close="checking = null"
			/>
			<StocktakeResolveModal
				v-if="resolving"
				:stocktake="stocktake"
				:line="resolving"
				@resolved="onResolved"
				@stale="onResolved"
				@close="resolving = null"
			/>

			<!-- Xác nhận đóng, huỷ đợt -->
			<Teleport to="body">
				<div
					v-if="confirming"
					class="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-4"
					role="alertdialog"
					aria-modal="true"
					:aria-label="confirming === 'close' ? 'Đóng đợt kiểm kê' : 'Huỷ đợt kiểm kê'"
				>
					<div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
						<template v-if="confirming === 'close'">
							<h2 class="text-base font-semibold text-gray-900 dark:text-white">Đóng đợt "{{ stocktake.name }}"</h2>
							<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
								<template v-if="pendingTotal">
									Còn <strong>{{ pendingTotal }} thiết bị chưa ai kiểm</strong>. Khi đóng đợt, các thiết bị này tự chuyển
									sang Không tìm thấy và vào danh sách chênh lệch:
								</template>
								<template v-else>Mọi thiết bị trong đợt đã được kiểm.</template>
							</p>
							<div v-if="pendingTotal" class="mt-2">
								<div v-if="pendingLoading" class="space-y-1.5">
									<div v-for="i in 3" :key="i" class="h-5 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
								</div>
								<p v-else-if="pendingError" class="text-sm text-amber-700 dark:text-amber-400">{{ pendingError }}</p>
								<ul v-else class="max-h-56 space-y-1 overflow-y-auto rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800">
									<li v-for="l in pendingPreview" :key="l.id" class="break-words text-gray-800 dark:text-gray-200">
										<span class="font-mono">{{ l.asset.code }}</span> · {{ l.asset.name }}
									</li>
									<li v-if="pendingMore" class="text-gray-600 dark:text-gray-400">và {{ pendingMore }} thiết bị khác</li>
								</ul>
							</div>
							<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
								Sau khi đóng, bạn không ghi thêm kết quả được mà chỉ xử lý từng chênh lệch.
							</p>
						</template>
						<template v-else>
							<h2 class="text-base font-semibold text-gray-900 dark:text-white">Huỷ đợt "{{ stocktake.name }}"</h2>
							<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
								Kết quả đã ghi giữ lại để tham khảo nhưng không xử lý chênh lệch được nữa. Thao tác này không hoàn tác được.
							</p>
							<div class="mt-3 space-y-1">
								<label for="stocktake-cancel-note" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Lý do huỷ</label>
								<textarea
									id="stocktake-cancel-note"
									v-model="cancelNote"
									rows="2"
									maxlength="1000"
									:class="`${inputCls} resize-none`"
									placeholder="Không bắt buộc"
								/>
							</div>
						</template>
						<div class="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
							<CommonAppButton variant="secondary" class="min-h-11 sm:min-h-0" :disabled="busy" @click="confirming = null">Quay lại</CommonAppButton>
							<CommonAppButton
								:variant="confirming === 'close' ? 'primary' : 'danger'"
								class="min-h-11 sm:min-h-0"
								:loading="busy"
								@click="confirming === 'close' ? closeStocktake() : cancelStocktake()"
							>
								{{ confirming === 'close' ? 'Đóng đợt' : 'Huỷ đợt' }}
							</CommonAppButton>
						</div>
					</div>
				</div>
			</Teleport>
		</template>
	</div>
</template>
