import { useOfficeService } from '~/services/office.service';
import {
	departmentRegistration,
	downloadOfficeFile,
	groupSummaryRows,
	isDraftDirty,
	isRowUnpriced,
	officeErrorCode,
	officeErrorMessage,
	officeErrorStatus,
	periodNextStep,
	requestStageCounts,
	vnTimeLabel,
	type SummaryRowGroup,
} from '~/utils/office.utils';
import { formatDate } from '~/utils/date';
import { vnSearchText } from '~/utils/vn-text';
import { OFFICE_PERMISSIONS } from '~/utils/permission';
import type { SummaryRow, SupplyPeriodSummary } from '~/types/office.types';

/** Cột nhập của bảng tổng hợp. */
export type SummaryInputColumn = 'reserve' | 'price';

/**
 * Chi tiết một kỳ (`/management/office/supply-periods/:id`): đầu trang theo giai đoạn, phòng đã đăng
 * ký, bảng tổng hợp có dự trù và đơn giá, và các việc của HCNS trên kỳ.
 *
 * Ô dự trù, đơn giá là bản nháp trên màn cho tới khi bấm Lưu: tải lại bảng (sau khi chốt một phiếu,
 * đổi hạn chót…) chỉ thay những ô người dùng chưa sửa, ô đang sửa dở giữ nguyên số đã gõ.
 */
export function useSupplyPeriodDetail() {
	const route = useRoute();
	const toast = useToast();
	const service = useOfficeService();
	const { hasPermission } = usePermissions();
	const { canWrite } = useModuleAccess();

	const periodId = computed(() => Number(route.params.id));
	const canManage = computed(() => hasPermission(OFFICE_PERMISSIONS.supplyManage) && canWrite('OFFICE'));

	const summary = ref<SupplyPeriodSummary | null>(null);
	const loading = ref(true);
	const loadError = ref<string | null>(null);
	/** Kỳ không còn hoặc không có quyền: không có gì để thử lại, chỉ quay về danh sách. */
	const notFound = ref(false);

	const now = ref(new Date());
	let ticker: ReturnType<typeof setInterval> | null = null;

	const period = computed(() => summary.value?.period ?? null);
	const departments = computed(() => summary.value?.departments ?? []);
	const rows = computed(() => summary.value?.rows ?? []);

	/**
	 * Trưởng phòng nhận phạm vi `DEPARTMENT`: không có dự trù của cả văn phòng và "Cần mua" chỉ là số
	 * của phòng họ, nên hai cột đó ẩn đi.
	 */
	const departmentScope = computed(() => summary.value?.scope === 'DEPARTMENT');
	const periodClosed = computed(() => period.value?.status === 'CLOSED');
	/** Kỳ đã đóng thì khoá hẳn: mọi nút ghi ẩn, ô nhập thành chữ. */
	const canEditPeriod = computed(() => canManage.value && !periodClosed.value);

	const registration = computed(() => departmentRegistration(departments.value));
	const stageCounts = computed(() => requestStageCounts(departments.value));
	const nextStep = computed(() =>
		canEditPeriod.value && period.value ? periodNextStep(period.value.status, departments.value) : null,
	);

	/** Phòng chưa có dòng nào: khoá sớm là khoá luôn cửa của họ, nên hộp hỏi lại phải nói ra. */
	const departmentsWithoutLines = computed(() => registration.value.total - registration.value.done);
	/** Chưa phòng nào nhập dòng nào thì kỳ mới huỷ được. */
	const periodUntouched = computed(() => registration.value.done === 0);

	// ─── Dự trù và đơn giá đang sửa ───────────────────────────────────────────

	const reserveDraft = reactive<Record<number, number | undefined>>({});
	const priceDraft = reactive<Record<number, number | undefined>>({});
	/** Ô đang giữ chữ không phải số hợp lệ, khoá theo `cột:itemId`. */
	const invalid = reactive<Record<string, true>>({});

	const editableRows = computed(() => rows.value.filter((row): row is SummaryRow & { itemId: number } => row.itemId != null));

	function savedValue(row: SummaryRow, column: SummaryInputColumn): number | null {
		return column === 'reserve' ? row.reserveQty : row.unitPrice;
	}

	function draftOf(itemId: number, column: SummaryInputColumn): number | undefined {
		return column === 'reserve' ? reserveDraft[itemId] : priceDraft[itemId];
	}

	function isDirty(row: SummaryRow, column: SummaryInputColumn): boolean {
		if (row.itemId == null) return false;
		if (column === 'reserve' && departmentScope.value) return false;
		return isDraftDirty(draftOf(row.itemId, column), savedValue(row, column));
	}

	const dirtyCount = computed(
		() => editableRows.value.reduce((sum, row) => sum + Number(isDirty(row, 'reserve')) + Number(isDirty(row, 'price')), 0),
	);
	const invalidCount = computed(() => Object.keys(invalid).length);
	const hasChanges = computed(() => canEditPeriod.value && (dirtyCount.value > 0 || invalidCount.value > 0));

	function setDraft(itemId: number, column: SummaryInputColumn, value: number | undefined, bad: boolean) {
		if (column === 'reserve') reserveDraft[itemId] = value;
		else priceDraft[itemId] = value;
		const key = `${column}:${itemId}`;
		if (bad) invalid[key] = true;
		else delete invalid[key];
	}

	/**
	 * Đưa số của máy chủ vào ô nhập. `force` dùng sau khi lưu hoặc huỷ thay đổi; còn lại chỉ thay ô
	 * chưa sửa, để người khác vừa đăng ký thêm thì cột phòng, "Tổng" đổi mà số đang gõ không mất.
	 */
	function applySummary(data: SupplyPeriodSummary, force: boolean) {
		const keep = new Set<string>();
		if (!force && summary.value) {
			for (const row of editableRows.value) {
				if (isDirty(row, 'reserve') || invalid[`reserve:${row.itemId}`]) keep.add(`reserve:${row.itemId}`);
				if (isDirty(row, 'price') || invalid[`price:${row.itemId}`]) keep.add(`price:${row.itemId}`);
			}
		}
		summary.value = data;
		for (const row of data.rows) {
			if (row.itemId == null) continue;
			if (!keep.has(`reserve:${row.itemId}`)) {
				reserveDraft[row.itemId] = row.reserveQty ?? undefined;
				delete invalid[`reserve:${row.itemId}`];
			}
			if (!keep.has(`price:${row.itemId}`)) {
				priceDraft[row.itemId] = row.unitPrice ?? undefined;
				delete invalid[`price:${row.itemId}`];
			}
		}
	}

	async function load(silent = false) {
		if (!silent) loading.value = true;
		loadError.value = null;
		try {
			applySummary(await service.findPeriodSummary(periodId.value), false);
			notFound.value = false;
		} catch (e) {
			const status = officeErrorStatus(e);
			if (status === 404 || status === 403) {
				summary.value = null;
				notFound.value = true;
				loadError.value =
					status === 404
						? 'Kỳ này không còn, có thể đã bị huỷ.'
						: officeErrorMessage(e, 'Bạn không có quyền xem kỳ này.');
			} else if (!silent) {
				summary.value = null;
				loadError.value = officeErrorMessage(e, 'Chưa mở được kỳ này. Bạn bấm Thử lại.');
			} else {
				toast.error(officeErrorMessage(e, 'Chưa tải lại được bảng tổng hợp. Bạn tải lại trang.'));
			}
		} finally {
			loading.value = false;
		}
	}

	// ─── Lưu dự trù và đơn giá ────────────────────────────────────────────────

	const saving = ref(false);
	const saveError = ref('');
	const lastSavedAt = ref<Date | null>(null);

	/** Gửi lại TOÀN BỘ dòng danh mục như trước: máy chủ thay cả danh sách dự trù, đơn giá của kỳ. */
	async function saveItems(): Promise<boolean> {
		const data = summary.value;
		if (!data || saving.value) return false;
		if (invalidCount.value) {
			saveError.value = `Còn ${invalidCount.value} ô gõ sai. Bạn sửa lại số rồi lưu.`;
			return false;
		}
		saving.value = true;
		saveError.value = '';
		try {
			const items = editableRows.value.map(row => ({
				itemId: row.itemId,
				reserveQty: reserveDraft[row.itemId] ?? 0,
				unitPrice: priceDraft[row.itemId],
			}));
			applySummary(await service.savePeriodItems(data.period.id, items), true);
			lastSavedAt.value = new Date();
			toast.success('Đã lưu dự trù và đơn giá của kỳ này.');
			return true;
		} catch (e) {
			saveError.value = officeErrorMessage(e, 'Chưa lưu được dự trù và đơn giá. Bạn thử lại sau ít phút.');
			return false;
		} finally {
			saving.value = false;
		}
	}

	function discardChanges() {
		if (summary.value) applySummary(summary.value, true);
		saveError.value = '';
	}

	const saveStatus = computed(() => {
		if (saving.value) return 'Đang lưu…';
		if (lastSavedAt.value) return `Đã lưu ${vnTimeLabel(lastSavedAt.value)}`;
		return '';
	});

	// ─── Tìm, lọc ─────────────────────────────────────────────────────────────

	function queryText(value: unknown): string {
		const raw = Array.isArray(value) ? value[0] : value;
		return typeof raw === 'string' ? raw : '';
	}

	const search = ref(queryText(route.query.q));
	const onlyRegistered = ref(queryText(route.query.reg) === '1');
	const onlyUnpriced = ref(queryText(route.query.unpriced) === '1');

	watch([search, onlyRegistered, onlyUnpriced], ([q, reg, unpriced]) => {
		const query = { ...route.query };
		if (q.trim()) query.q = q;
		else delete query.q;
		if (reg) query.reg = '1';
		else delete query.reg;
		if (unpriced) query.unpriced = '1';
		else delete query.unpriced;
		navigateTo({ query }, { replace: true });
	});

	const unpricedRows = computed(() => rows.value.filter(isRowUnpriced));
	const hasFilter = computed(() => !!search.value.trim() || onlyRegistered.value || onlyUnpriced.value);

	function clearFilters() {
		search.value = '';
		onlyRegistered.value = false;
		onlyUnpriced.value = false;
	}

	/** Nhóm giữ số La Mã của cả bảng, nên lọc bớt dòng thì "III." vẫn là nhóm thứ ba của file HCNS. */
	const groups = computed<SummaryRowGroup[]>(() => {
		const q = vnSearchText(search.value);
		return groupSummaryRows(rows.value)
			.map(group => ({
				...group,
				rows: group.rows.filter(
					row =>
						(!q || vnSearchText(row.name).includes(q)) &&
						(!onlyRegistered.value || row.totalQty > 0) &&
						(!onlyUnpriced.value || isRowUnpriced(row)),
				),
			}))
			.filter(group => group.rows.length > 0);
	});

	// ─── Việc trên kỳ ─────────────────────────────────────────────────────────

	const working = ref(false);
	const exporting = ref(false);

	async function exportExcel() {
		const data = period.value;
		if (!data || exporting.value) return;
		exporting.value = true;
		try {
			const file = await service.exportPeriod(data.id);
			// Máy chủ đặt tên theo kỳ và văn phòng; tên dự phòng chỉ dùng khi header không tới nơi.
			const name = file.fileName || `tong-hop-van-phong-pham-${data.month}.xlsx`;
			downloadOfficeFile(file.blob, name);
			toast.success(`Đã tải file ${name}.`);
		} catch (e) {
			toast.error(officeErrorMessage(e, 'Chưa xuất được file Excel. Bạn bấm Xuất Excel lần nữa.'));
		} finally {
			exporting.value = false;
		}
	}

	/** Đổi hạn chót cả hai chiều (Q6). Trả câu lỗi để hộp thoại hiện tại chỗ, hoặc `null` khi xong. */
	async function saveDeadline(deadline: string): Promise<string | null> {
		const data = period.value;
		if (!data || working.value) return null;
		working.value = true;
		try {
			await service.updatePeriod(data.id, { deadline });
			toast.success(`Đã đổi hạn chót thành ngày ${formatDate(deadline)}. Các phòng vừa nhận thông báo.`);
			await load(true);
			return null;
		} catch (e) {
			const code = officeErrorCode(e);
			if (code === 'OFFICE_SUPPLY_DEADLINE_PAST' || code === 'OFFICE_SUPPLY_DEADLINE_INVALID') {
				return officeErrorMessage(e, 'Hạn chót phải là ngày từ hôm nay trở đi.');
			}
			return officeErrorMessage(e, 'Chưa đổi được hạn chót. Bạn thử lại sau ít phút.');
		} finally {
			working.value = false;
		}
	}

	/** Chạy một việc trên kỳ, báo câu thành công, tải lại bảng; trả `true` khi xong. */
	async function runPeriodAction(task: () => Promise<unknown>, success: string, failure: string): Promise<boolean> {
		if (working.value) return false;
		working.value = true;
		try {
			await task();
			toast.success(success);
			await load(true);
			return true;
		} catch (e) {
			toast.error(officeErrorMessage(e, failure));
			return false;
		} finally {
			working.value = false;
		}
	}

	const lockPeriod = () =>
		runPeriodAction(
			() => service.lockPeriod(periodId.value),
			'Đã khoá kỳ. Các phòng không đăng ký thêm được nữa, bạn chốt từng phiếu rồi cấp hàng.',
			'Chưa khoá được kỳ. Bạn thử lại sau ít phút.',
		);

	const closePeriod = () =>
		runPeriodAction(() => service.closePeriod(periodId.value), 'Đã đóng kỳ.', 'Chưa đóng được kỳ. Bạn thử lại sau ít phút.');

	const addDepartments = (departmentIds: number[]) =>
		runPeriodAction(
			() => service.addPeriodDepartments(periodId.value, { departmentIds }),
			`Đã thêm ${departmentIds.length} phòng vào kỳ. Nhân viên các phòng đó vừa nhận thông báo.`,
			'Chưa thêm được phòng vào kỳ. Bạn thử lại sau ít phút.',
		);

	/** Huỷ kỳ mở nhầm: kỳ bị xoá hẳn nên quay về danh sách (Q4). */
	async function cancelPeriod(): Promise<boolean> {
		const data = period.value;
		if (!data || working.value) return false;
		working.value = true;
		try {
			await service.cancelPeriod(data.id);
			toast.success(`Đã huỷ kỳ ${data.title}. Bạn mở lại kỳ của tháng này khi cần.`);
			hasChangesOverride.value = true;
			await navigateTo('/management/office/supply-periods');
			return true;
		} catch (e) {
			toast.error(officeErrorMessage(e, 'Chưa huỷ được kỳ. Bạn thử lại sau ít phút.'));
			return false;
		} finally {
			working.value = false;
		}
	}

	// ─── Rời trang khi còn thay đổi chưa lưu ──────────────────────────────────

	/** Bỏ qua hỏi lại khi chính trang chủ động rời đi (vừa huỷ kỳ). */
	const hasChangesOverride = ref(false);
	/** Đang hỏi người dùng có rời trang không; trả lời qua `answerLeave`. */
	const leavePending = ref(false);
	let leaveResolve: ((leave: boolean) => void) | null = null;

	function answerLeave(leave: boolean) {
		leavePending.value = false;
		leaveResolve?.(leave);
		leaveResolve = null;
	}

	onBeforeRouteLeave(() => {
		if (!hasChanges.value || hasChangesOverride.value) return true;
		leavePending.value = true;
		return new Promise<boolean>(resolve => (leaveResolve = resolve));
	});

	function onBeforeUnload(event: BeforeUnloadEvent) {
		if (!hasChanges.value) return;
		event.preventDefault();
		event.returnValue = '';
	}

	onMounted(() => {
		ticker = setInterval(() => (now.value = new Date()), 60_000);
		window.addEventListener('beforeunload', onBeforeUnload);
		load();
	});

	onUnmounted(() => {
		if (ticker) clearInterval(ticker);
		window.removeEventListener('beforeunload', onBeforeUnload);
	});

	return {
		periodId,
		canManage,
		canEditPeriod,
		departmentScope,
		summary,
		period,
		departments,
		rows,
		loading,
		loadError,
		notFound,
		now,
		registration,
		stageCounts,
		nextStep,
		departmentsWithoutLines,
		periodUntouched,
		reserveDraft,
		priceDraft,
		invalid,
		isDirty,
		setDraft,
		dirtyCount,
		invalidCount,
		hasChanges,
		saving,
		saveError,
		saveStatus,
		saveItems,
		discardChanges,
		search,
		onlyRegistered,
		onlyUnpriced,
		hasFilter,
		clearFilters,
		unpricedRows,
		groups,
		working,
		exporting,
		load,
		exportExcel,
		saveDeadline,
		lockPeriod,
		closePeriod,
		addDepartments,
		cancelPeriod,
		leavePending,
		answerLeave,
	};
}
