import { useOfficeService } from '~/services/office.service';
import {
	CUSTOM_GROUP_NAME,
	buildSupplyCatalog,
	copyPreviousSummary,
	officeErrorCode,
	officeErrorMessage,
	officeErrorStatus,
	vnTimeLabel,
	type SupplyCatalogGroup,
	type SupplyCatalogRow,
} from '~/utils/office.utils';
import { formatDateTime } from '~/utils/date';
import { vnSearchText } from '~/utils/vn-text';
import type {
	CopySkippedItem,
	CreateSupplyLineBody,
	SupplyContact,
	SupplyItem,
	SupplyLine,
	SupplyRequest,
	SupplyRequestListItem,
} from '~/types/office.types';

/**
 * Trạng thái lưu của một dòng trên form danh mục.
 *
 * `reason` là dòng đang chờ lý do vượt định mức: số chưa gửi đi, ô lý do mở ngay dưới dòng.
 */
export type SupplyRowStatus = 'idle' | 'saving' | 'error' | 'reason';

/** Dòng người dùng đã chạm vào: số đang gõ chưa khớp với máy chủ, hoặc đang lưu, hoặc lưu lỗi. */
export interface SupplyRowState {
	/** Số trong ô; `undefined` là ô đang trống. */
	draft: number | undefined;
	/** Ô đang giữ chữ không phải số nguyên. */
	invalid: boolean;
	status: SupplyRowStatus;
	error: string;
	/** Lý do vượt định mức đang gõ; gửi kèm lần lưu số kế tiếp. */
	reason: string;
	/** Số đang gửi đi, để biết người dùng có gõ thêm trong lúc chờ máy chủ không. */
	sending?: number;
	/** Ghi chú gửi kèm khi phải tạo lại dòng (Hoàn tác sau khi dòng đã bị xoá). */
	note?: string | null;
}

/** Đủ để thêm lại phần của tôi vừa bỏ, kể cả khi dòng đã bị xoá vì không còn ai đăng ký. */
interface UndoSnapshot {
	qty: number;
	note: string | null;
	reason: string | null;
}

export interface SupplyGroupView extends SupplyCatalogGroup {
	/** Số mặt hàng của nhóm trước khi lọc. */
	total: number;
	/** Số mặt hàng của nhóm có phần của tôi. */
	selected: number;
}

/** Ghi chú của dòng theo đúng giới hạn của API. */
export const SUPPLY_NOTE_MAX = 500;

const SAVED_FLASH_MS = 1500;
const UNDO_MS = 5000;
const HIGHLIGHT_MS = 2200;
/** Bấm − / + liên tục thì gom lại một lần lưu, không gọi API cho từng cú bấm. */
const BUMP_DEBOUNCE_MS = 500;

/**
 * Văn phòng phẩm của phòng tôi (`/office/supplies`): form danh mục cả phòng cùng nhập.
 *
 * Mọi lệnh ghi đi qua một hàng đợi nối tiếp: người dùng gõ số rồi Enter liền mấy dòng, mỗi dòng
 * một lệnh, mà máy chủ trả lại TOÀN BỘ phiếu sau mỗi lệnh. Gửi song song thì phiếu của lệnh về sau
 * có thể đè lên phiếu mới hơn, và con số "Phòng: N" lùi lại mà không ai hiểu vì sao.
 *
 * Quyền sửa lấy từ cờ `canEdit` của máy chủ, không tự suy từ trạng thái, vì còn phụ thuộc chế độ chỉ
 * xem của module.
 */
export function useMySupplies() {
	const route = useRoute();
	const router = useRouter();
	const toast = useToast();
	const service = useOfficeService();
	const { user } = useAuth();
	const directoryStore = useDirectoryStore();
	const { employees } = storeToRefs(directoryStore);

	// ─── Dữ liệu ──────────────────────────────────────────────────────────────

	const requests = ref<SupplyRequestListItem[]>([]);
	const loadingList = ref(true);
	const listError = ref<string | null>(null);

	const current = ref<SupplyRequest | null>(null);
	const loadingDetail = ref(false);
	const detailError = ref<string | null>(null);
	/** Phiếu người dùng định mở mà chưa mở được, để nút Thử lại biết mở lại phiếu nào. */
	const pendingRequestId = ref<number | null>(null);

	const items = ref<SupplyItem[]>([]);
	const loadingItems = ref(true);
	const itemsError = ref<string | null>(null);

	const contact = ref<SupplyContact | null>(null);
	const savingContact = ref(false);

	const copying = ref(false);
	/** Dòng kỳ trước không chép được, giữ trên màn vì toast tắt mất mà người dùng còn phải nhập lại. */
	const copySkipped = ref<CopySkippedItem[]>([]);

	/** Mốc đếm ngược; nhịp một phút là đủ cho câu "Còn 2 ngày 5 giờ". */
	const now = ref(new Date());
	let ticker: ReturnType<typeof setInterval> | null = null;

	const canEdit = computed(() => !!current.value?.canEdit);
	const me = computed(() => user.value?.id ?? null);

	// ─── Trạng thái từng dòng ─────────────────────────────────────────────────

	const rowState = reactive<Record<string, SupplyRowState>>({});
	/** Dòng vừa lưu xong, hiện dấu ✓ rồi mờ dần. */
	const savedFlash = reactive<Record<string, true>>({});
	const undo = reactive<Record<string, UndoSnapshot>>({});
	/**
	 * Dòng ngoài danh mục vừa bị xoá vì tôi rút phần cuối cùng. Danh mục không có mặt hàng này nên
	 * dòng sẽ biến mất cùng nút Hoàn tác; giữ một bản trống của nó cho tới hết hạn hoàn tác.
	 */
	const ghosts = reactive<Record<string, SupplyCatalogRow>>({});
	/** Câu báo ngắn dưới dòng khi ô số bị trả về số đã lưu vì gõ sai. */
	const notices = reactive<Record<string, string>>({});
	/** Dòng vừa đổi sau "Lấy số tháng trước", tô nền trong chốc lát để người dùng thấy dòng nào mới. */
	const highlighted = ref(new Set<string>());

	const inflight = ref(0);
	const lastSavedAt = ref<Date | null>(null);
	const timers = new Map<string, ReturnType<typeof setTimeout>>();

	function later(key: string, ms: number, fn: () => void) {
		const old = timers.get(key);
		if (old) clearTimeout(old);
		timers.set(
			key,
			setTimeout(() => {
				timers.delete(key);
				fn();
			}, ms),
		);
	}

	let queue: Promise<unknown> = Promise.resolve();

	/** Chạy lệnh ghi sau mọi lệnh đang chờ; lệnh trước lỗi thì lệnh sau vẫn chạy. */
	function enqueue<T>(task: () => Promise<T>): Promise<T> {
		inflight.value++;
		const run = queue.then(task, task).finally(() => inflight.value--);
		queue = run.catch(() => undefined);
		return run;
	}

	// ─── Danh mục và bộ lọc ───────────────────────────────────────────────────

	/** Phiếu chỉ xem thì danh mục đầy số 0 chẳng nói gì, nên chỉ còn những dòng phòng đã đăng ký. */
	const catalog = computed(() => {
		const groups = buildSupplyCatalog(items.value, current.value?.lines ?? [], !canEdit.value);
		const extra = Object.values(ghosts);
		if (!extra.length) return groups;
		const custom = groups.find(group => group.isCustom);
		if (custom) return groups.map(group => (group === custom ? { ...group, rows: [...group.rows, ...extra] } : group));
		return [...groups, { name: CUSTOM_GROUP_NAME, isCustom: true, rows: extra }];
	});

	const rowsByKey = computed(() => {
		const map = new Map<string, SupplyCatalogRow>();
		for (const group of catalog.value) for (const row of group.rows) map.set(row.key, row);
		return map;
	});

	function firstQuery(value: unknown): string {
		const raw = Array.isArray(value) ? value[0] : value;
		return typeof raw === 'string' ? raw : '';
	}

	const search = ref(firstQuery(route.query.q));
	const groupFilter = ref<string | null>(firstQuery(route.query.group) || null);
	const onlySelected = ref(false);

	/** Bộ lọc nằm trên địa chỉ trang, để gửi link hay bấm F5 vẫn ra đúng nhóm đang xem. */
	watch([search, groupFilter], ([q, group]) => {
		const query = { ...route.query };
		if (q.trim()) query.q = q;
		else delete query.q;
		if (group) query.group = group;
		else delete query.group;
		router.replace({ query });
	});

	function mineOf(row: SupplyCatalogRow): number {
		return row.line?.myQty ?? 0;
	}

	/** Số đang hiện trong ô: số đang gõ nếu dòng đã chạm vào, không thì phần của tôi trên máy chủ. */
	function shownQty(row: SupplyCatalogRow): number | undefined {
		const st = rowState[row.key];
		return st ? st.draft : mineOf(row);
	}

	function isChosen(row: SupplyCatalogRow): boolean {
		return mineOf(row) > 0 || (shownQty(row) ?? 0) > 0;
	}

	const groupChips = computed(() => catalog.value.map(group => ({ name: group.name, count: group.rows.length })));

	const totalRows = computed(() => catalog.value.reduce((sum, group) => sum + group.rows.length, 0));

	const filteredGroups = computed<SupplyGroupView[]>(() => {
		const q = vnSearchText(search.value);
		return catalog.value
			.filter(group => !groupFilter.value || group.name === groupFilter.value)
			.map(group => ({
				...group,
				total: group.rows.length,
				selected: group.rows.filter(row => mineOf(row) > 0).length,
				// Dòng vừa bỏ chọn vẫn ở lại khi đang lọc "Chỉ đã chọn", để người dùng còn bấm Hoàn tác.
				rows: group.rows.filter(
					row =>
						(!q || row.searchText.includes(q)) &&
						(!onlySelected.value || isChosen(row) || !!undo[row.key] || !!rowState[row.key]),
				),
			}))
			.filter(group => group.rows.length > 0);
	});

	const myCount = computed(() => (current.value?.lines ?? []).filter(line => line.myQty > 0).length);
	const roomCount = computed(() => current.value?.lines.length ?? 0);

	const errorKeys = computed(() =>
		Object.entries(rowState)
			.filter(([, st]) => st.status === 'error' || st.status === 'reason')
			.map(([key]) => key),
	);

	/** Một câu cho thanh dưới; đọc được qua `aria-live` nên phải là câu hoàn chỉnh. */
	const saveStatus = computed<{ tone: 'saving' | 'error' | 'saved' | 'idle'; text: string }>(() => {
		if (inflight.value > 0) return { tone: 'saving', text: 'Đang lưu…' };
		if (errorKeys.value.length) {
			return { tone: 'error', text: `Lưu lỗi ${errorKeys.value.length} dòng` };
		}
		if (lastSavedAt.value) return { tone: 'saved', text: `Đã lưu ${vnTimeLabel(lastSavedAt.value)}` };
		return { tone: 'idle', text: '' };
	});

	// ─── Nạp dữ liệu ──────────────────────────────────────────────────────────

	function syncListItem(data: SupplyRequest) {
		const item = requests.value.find(r => r.id === data.id);
		if (!item) return;
		item.lineCount = data.lines.length;
		item.status = data.status;
		item.statusLabel = data.statusLabel;
	}

	/** Thay phiếu bằng bản máy chủ vừa trả; dòng đang gõ dở hoặc đang lỗi giữ nguyên số đã gõ. */
	function apply(data: SupplyRequest) {
		current.value = data;
		syncListItem(data);
	}

	function resetRowState() {
		for (const key of Object.keys(rowState)) delete rowState[key];
		for (const key of Object.keys(undo)) delete undo[key];
		for (const key of Object.keys(savedFlash)) delete savedFlash[key];
		for (const key of Object.keys(ghosts)) delete ghosts[key];
		for (const key of Object.keys(notices)) delete notices[key];
		copySkipped.value = [];
	}

	async function loadList() {
		loadingList.value = true;
		listError.value = null;
		try {
			requests.value = await service.myRequests();
		} catch (e) {
			requests.value = [];
			listError.value = officeErrorMessage(e, 'Chưa tải được phiếu của phòng bạn. Bạn bấm Thử lại.');
		} finally {
			loadingList.value = false;
		}
	}

	async function openRequest(id: number): Promise<boolean> {
		loadingDetail.value = true;
		detailError.value = null;
		pendingRequestId.value = id;
		try {
			const data = await service.myRequest(id);
			if (current.value?.id !== data.id) resetRowState();
			apply(data);
			pendingRequestId.value = null;
			return true;
		} catch (e) {
			// Phiếu phòng khác (link cũ, link của người khác) hoặc phiếu đã mất (kỳ bị HCNS huỷ) thì nói
			// thẳng, đừng bảo người dùng thử lại một việc không bao giờ chạy được nữa.
			const code = officeErrorCode(e);
			const message =
				code === 'OFFICE_SUPPLY_NOT_YOUR_DEPARTMENT'
					? officeErrorMessage(e, 'Phiếu này không phải của phòng bạn.')
					: officeErrorStatus(e) === 404
						? 'Phiếu này không còn, có thể kỳ đã bị HCNS huỷ.'
						: officeErrorMessage(e, 'Chưa mở được phiếu này. Bạn thử lại sau ít phút.');
			current.value = null;
			if (code === 'OFFICE_SUPPLY_NOT_YOUR_DEPARTMENT' || officeErrorStatus(e) === 404) {
				pendingRequestId.value = null;
				toast.error(message);
			} else {
				detailError.value = message;
			}
			return false;
		} finally {
			loadingDetail.value = false;
		}
	}

	/** Tải lại phiếu đang mở mà không hiện khung chờ, để danh sách không giật khi người khác vừa sửa. */
	async function refresh() {
		const id = current.value?.id;
		if (!id) return;
		try {
			apply(await service.myRequest(id));
		} catch {
			// Không tải lại được thì giữ phiếu đang có; lần lưu kế tiếp sẽ báo lỗi cụ thể.
		}
	}

	async function loadItems() {
		loadingItems.value = true;
		itemsError.value = null;
		try {
			items.value = await service.mySupplyItems();
		} catch (e) {
			// Thiếu danh mục thì vẫn còn các dòng phòng đã đăng ký, sửa số được; chỉ thiếu mặt hàng mới.
			items.value = [];
			itemsError.value = officeErrorMessage(e, 'Chưa tải được danh mục mặt hàng.');
		} finally {
			loadingItems.value = false;
		}
	}

	async function loadContact() {
		try {
			contact.value = await service.mySupplyContact();
		} catch {
			// Người không thuộc phòng nào nhận 403 ở đây; dòng đầu mối đơn giản là không hiện.
			contact.value = null;
		}
	}

	/**
	 * Mở sẵn phiếu theo `?request_id=` của thông báo; không có thì mở phiếu đầu danh sách.
	 *
	 * Thông báo trỏ tới một phiếu đã mất thì DỪNG lại, không mở phiếu khác: mở kỳ khác ra làm người
	 * dùng tưởng mình đang xem kỳ trong thông báo và sửa số của một kỳ không liên quan.
	 */
	async function openInitial() {
		const raw = route.query.request_id;
		if (raw) {
			const id = Number(raw);
			// Dọn query trước khi gọi API: lỗi thì URL vẫn sạch, bấm F5 không mở lại.
			const query = { ...route.query };
			delete query.request_id;
			router.replace({ query });
			if (id && !Number.isNaN(id)) {
				await openRequest(id);
				return;
			}
			toast.error('Đường dẫn thông báo không mang đúng mã phiếu.');
		}
		const first = requests.value[0];
		if (first) await openRequest(first.id);
	}

	async function init() {
		ticker = setInterval(() => (now.value = new Date()), 60_000);
		await loadList();
		await Promise.all([loadItems(), loadContact()]);
		directoryStore.load().catch(() => {
			// Không có danh sách nhân viên thì trưởng phòng tạm chưa chọn được đầu mối.
		});
		await openInitial();
	}

	onUnmounted(() => {
		if (ticker) clearInterval(ticker);
		for (const timer of timers.values()) clearTimeout(timer);
		timers.clear();
	});

	// ─── Lưu số của một dòng ──────────────────────────────────────────────────

	function ensureState(row: SupplyCatalogRow): SupplyRowState {
		const existing = rowState[row.key];
		if (existing) return existing;
		const fresh: SupplyRowState = {
			draft: mineOf(row),
			invalid: false,
			status: 'idle',
			error: '',
			reason: row.line?.overQuotaReason ?? '',
		};
		rowState[row.key] = fresh;
		// Trả bản trong `reactive` chứ không phải `fresh`, để sửa trên nó thì giao diện cập nhật.
		return rowState[row.key] ?? fresh;
	}

	/** Người dùng gõ vào ô: chỉ ghi nhận, lưu khi rời ô hoặc bấm Enter. */
	function setDraft(row: SupplyCatalogRow, value: number | undefined, invalid: boolean) {
		const st = ensureState(row);
		st.draft = value;
		st.invalid = invalid;
		delete notices[row.key];
		if (st.status === 'error') {
			st.status = 'idle';
			st.error = '';
		}
	}

	function setReason(row: SupplyCatalogRow, value: string) {
		ensureState(row).reason = value;
	}

	/** Bấm − hoặc +: đổi số ngay trên ô, gom các cú bấm liền nhau thành một lần lưu. */
	function bump(row: SupplyCatalogRow, delta: number) {
		if (!canEdit.value) return;
		const st = ensureState(row);
		if (st.status === 'saving') return;
		const base = st.invalid || st.draft == null ? mineOf(row) : st.draft;
		st.draft = Math.max(0, base + delta);
		st.invalid = false;
		st.error = '';
		if (st.status === 'error') st.status = 'idle';
		later(`bump:${row.key}`, BUMP_DEBOUNCE_MS, () => commit(row.key));
	}

	function unitWord(unit: string | null | undefined): string {
		return (unit ?? '').toLocaleLowerCase('vi');
	}

	/** Dòng của phiếu hiện tại cho một dòng form, đọc lại lúc lệnh thật sự chạy vì phiếu có thể đã đổi. */
	function liveLine(row: SupplyCatalogRow): SupplyLine | null {
		const lines = current.value?.lines ?? [];
		if (row.itemId != null) return lines.find(l => l.itemId === row.itemId) ?? null;
		return lines.find(l => l.id === row.line?.id) ?? null;
	}

	/**
	 * Lưu số đang gõ của một dòng, nếu nó khác số trên máy chủ.
	 *
	 * Ba việc của ô số đi đúng ba lệnh đang có: 0 lên số dương là thêm dòng (máy chủ cộng vào dòng
	 * đang có nếu người khác vừa thêm), đổi số là đặt phần của tôi, về 0 là rút phần của tôi. Rút phần
	 * KHÔNG bao giờ xoá phần của người khác: dòng chỉ biến mất khi không còn ai đăng ký.
	 */
	async function commit(key: string) {
		const row = rowsByKey.value.get(key);
		const st = rowState[key];
		if (!row || !st || !canEdit.value || st.status === 'saving') return;
		const mine = mineOf(row);
		// Ô trống hay gõ sai ("abc", "-3", "2,5", số quá 100.000) thì trả lại số đã lưu, KHÔNG coi là 0:
		// coi là 0 thì một cú xoá nhầm rút mất phần của người dùng mà họ không hề định bỏ.
		if (st.invalid || st.draft == null) {
			delete rowState[key];
			if (st.invalid) {
				notices[key] = `Số lượng là số nguyên từ 0 tới 100.000, ô đã trả về ${mine}.`;
				later(`notice:${key}`, 5000, () => delete notices[key]);
			}
			return;
		}
		const qty = st.draft;
		const reason = st.reason.trim();
		const reasonChanged = !!row.line && !!reason && reason !== (row.line.overQuotaReason ?? '');
		if (qty === mine && !reasonChanged) {
			delete rowState[key];
			return;
		}
		// Biết định mức thì nhắc ngay, khỏi gửi lên mới biết thiếu lý do. Dòng đã có lý do thì máy chủ
		// giữ lý do đó, không bắt gõ lại.
		const total = (row.line?.requestedQty ?? 0) - mine + qty;
		if (qty > 0 && row.quota != null && total > row.quota && !reason && !row.line?.overQuotaReason) {
			st.status = 'reason';
			st.error = `Tổng của phòng sẽ là ${total}, vượt định mức ${row.quota} ${unitWord(row.unit)} mỗi tháng. Bạn ghi lý do rồi bấm Enter để lưu.`;
			return;
		}
		await save(row, qty, reason || undefined, st.note);
	}

	async function save(row: SupplyCatalogRow, qty: number, reason: string | undefined, note?: string | null) {
		const requestId = current.value?.id;
		const meId = me.value;
		if (!requestId || !meId) return;
		const st = ensureState(row);
		const before = row.line;
		const mine = mineOf(row);
		st.status = 'saving';
		st.error = '';
		st.sending = qty;
		delete undo[row.key];
		try {
			const data = await enqueue(async () => {
				const line = liveLine(row);
				if (!line) {
					if (qty === 0) return null;
					const body: CreateSupplyLineBody =
						row.itemId != null
							? { itemId: row.itemId, requestedQty: qty }
							: { customName: row.name, customUnit: row.unit ?? '', requestedQty: qty };
					if (reason) body.overQuotaReason = reason;
					if (note) body.note = note;
					return service.addLine(requestId, body);
				}
				if (qty === line.myQty) return service.updateLine(requestId, line.id, { overQuotaReason: reason });
				return service.setLineShare(requestId, line.id, meId, { qty, overQuotaReason: reason });
			});
			if (data) apply(data);
			lastSavedAt.value = new Date();
			// Người dùng gõ thêm trong lúc chờ thì giữ số mới để lần rời ô sau lưu tiếp.
			if (st.draft === qty) delete rowState[row.key];
			else {
				st.status = 'idle';
				st.sending = undefined;
			}
			savedFlash[row.key] = true;
			later(`flash:${row.key}`, SAVED_FLASH_MS, () => delete savedFlash[row.key]);
			delete ghosts[row.key];
			// Rút phần cuối cùng thì máy chủ xoá cả dòng, mất luôn ghi chú và lý do vượt định mức: giữ
			// lại cả hai để Hoàn tác tạo lại dòng y như cũ.
			if (qty === 0 && mine > 0 && before) {
				undo[row.key] = { qty: mine, note: before.note, reason: before.overQuotaReason };
				if (row.itemId == null && !liveLine(row)) ghosts[row.key] = { ...row, line: null };
				later(`undo:${row.key}`, UNDO_MS, () => {
					delete undo[row.key];
					if (!rowState[row.key]) delete ghosts[row.key];
				});
			}
		} catch (e) {
			st.sending = undefined;
			await handleSaveError(e, row, st);
		}
	}

	async function handleSaveError(e: unknown, row: SupplyCatalogRow, st: SupplyRowState) {
		const code = officeErrorCode(e);
		if (code === 'OFFICE_SUPPLY_OVER_QUOTA_REASON_REQUIRED') {
			// Định mức tính cả số phòng đã xin ở văn phòng khác trong tháng, nên dù trang tính chưa
			// vượt, máy chủ vẫn có thể bắt ghi lý do: mở ô lý do kèm câu của nó.
			st.status = 'reason';
			st.error = officeErrorMessage(e, 'Tổng của dòng vượt định mức của phòng, bạn ghi lý do.');
		} else if (code === 'OFFICE_SUPPLY_LINE_INVALID') {
			st.status = 'error';
			st.error = officeErrorMessage(e, 'Số này chưa hợp lệ, bạn kiểm tra lại.');
		} else if (
			code === 'OFFICE_SUPPLY_PERIOD_LOCKED' ||
			code === 'OFFICE_SUPPLY_SHARE_FORBIDDEN' ||
			code === 'OFFICE_SUPPLY_LINE_HAS_OTHER_SHARES'
		) {
			delete rowState[row.key];
			toast.warning(officeErrorMessage(e, 'Phiếu đã khoá hoặc bạn không sửa được dòng này.'));
			await refresh();
		} else if (
			code === 'OFFICE_SUPPLY_LINE_BUSY' ||
			code === 'OFFICE_SUPPLY_LINE_EXISTS' ||
			officeErrorStatus(e) === 404
		) {
			// Người khác trong phòng vừa sửa đúng dòng này: tải lại để "Phòng: N" đúng, số đã gõ ở lại.
			st.status = 'error';
			st.error = 'Người khác trong phòng vừa sửa mặt hàng này. Số của phòng đã được tải lại, bạn bấm Thử lại.';
			await refresh();
		} else {
			st.status = 'error';
			st.error = officeErrorMessage(e, 'Chưa lưu được. Bạn kiểm tra mạng rồi bấm Thử lại.');
		}
	}

	function retry(key: string) {
		const st = rowState[key];
		if (st && st.status !== 'reason') st.status = 'idle';
		return commit(key);
	}

	function retryAll() {
		return Promise.all(errorKeys.value.map(key => retry(key)));
	}

	/** Thêm lại phần vừa bỏ, kèm ghi chú và lý do cũ vì dòng có thể đã bị xoá cùng chúng. */
	async function restore(key: string) {
		const row = rowsByKey.value.get(key);
		const snap = undo[key];
		if (!row || !snap) return;
		delete undo[key];
		const st = ensureState(row);
		st.draft = snap.qty;
		st.invalid = false;
		st.reason = snap.reason ?? '';
		// Dòng còn (người khác vẫn có phần) thì ghi chú vẫn ở trên dòng, không gửi lại kẻo bị nối đôi.
		st.note = row.line ? undefined : snap.note;
		await save(row, snap.qty, snap.reason ?? undefined, st.note);
	}

	/** Lưu mọi dòng còn số chưa lưu rồi chờ hàng đợi xong, trước khi rời trang hay đổi phiếu. */
	async function flush() {
		if (!canEdit.value) return;
		for (const [key, st] of Object.entries(rowState)) {
			if (st.status === 'idle' && !st.invalid) {
				const timer = timers.get(`bump:${key}`);
				if (timer) clearTimeout(timer);
				timers.delete(`bump:${key}`);
				await commit(key);
			}
		}
		await queue;
	}

	async function selectRequest(id: number) {
		if (current.value && id === current.value.id) return;
		await flush();
		await openRequest(id);
	}

	// ─── Ghi chú, phần của người khác, xoá cả dòng ────────────────────────────

	/** Ghi chú là của cả dòng, ai trong phòng cũng sửa được. Trả câu lỗi, hoặc `null` khi đã lưu. */
	async function saveNote(row: SupplyCatalogRow, note: string): Promise<string | null> {
		const requestId = current.value?.id;
		const line = row.line;
		if (!requestId || !line) return 'Bạn chọn số lượng trước rồi mới ghi chú.';
		try {
			apply(await enqueue(() => service.updateLine(requestId, line.id, { note: note.trim() })));
			lastSavedAt.value = new Date();
			savedFlash[row.key] = true;
			later(`flash:${row.key}`, SAVED_FLASH_MS, () => delete savedFlash[row.key]);
			return null;
		} catch (e) {
			if (officeErrorStatus(e) === 404 || officeErrorCode(e) === 'OFFICE_SUPPLY_PERIOD_LOCKED') await refresh();
			return officeErrorMessage(e, 'Chưa lưu được ghi chú. Bạn thử lại sau ít phút.');
		}
	}

	/**
	 * Trưởng phòng, đầu mối (`canEditAllShares`) đặt phần của một người đã có phần; 0 là rút phần của
	 * người đó. Trả câu lỗi, hoặc `null` khi đã lưu.
	 */
	async function saveShare(row: SupplyCatalogRow, employeeId: number, qty: number): Promise<string | null> {
		const requestId = current.value?.id;
		const line = row.line;
		if (!requestId || !line) return null;
		const reason = rowState[row.key]?.reason.trim() || undefined;
		const old = line.shares.find(s => s.employee.id === employeeId)?.qty ?? 0;
		const total = line.requestedQty - old + qty;
		if (line.quota != null && total > line.quota && !reason && !line.overQuotaReason) {
			const st = ensureState(row);
			st.status = 'reason';
			st.error = `Tổng của dòng sẽ là ${total}, vượt định mức ${line.quota} ${unitWord(line.unit)} mỗi tháng. Bạn ghi lý do ở dưới dòng rồi lưu lại.`;
			return st.error;
		}
		try {
			apply(
				await enqueue(() => service.setLineShare(requestId, line.id, employeeId, { qty, overQuotaReason: reason })),
			);
			lastSavedAt.value = new Date();
			return null;
		} catch (e) {
			const code = officeErrorCode(e);
			if (code === 'OFFICE_SUPPLY_OVER_QUOTA_REASON_REQUIRED') {
				const st = ensureState(row);
				st.status = 'reason';
				st.error = officeErrorMessage(e, 'Tổng của dòng vượt định mức của phòng, bạn ghi lý do.');
			} else if (code === 'OFFICE_SUPPLY_PERIOD_LOCKED' || officeErrorStatus(e) === 404) {
				await refresh();
			}
			return officeErrorMessage(e, 'Chưa lưu được phần này. Bạn thử lại sau ít phút.');
		}
	}

	/** Xoá cả dòng, gồm phần của mọi người; chỉ gọi sau hộp xác nhận. */
	async function deleteLine(row: SupplyCatalogRow): Promise<boolean> {
		const requestId = current.value?.id;
		const line = row.line;
		if (!requestId || !line) return false;
		try {
			apply(await enqueue(() => service.deleteLine(requestId, line.id)));
			delete rowState[row.key];
			lastSavedAt.value = new Date();
			toast.success(`Đã xoá dòng ${line.name}.`);
			return true;
		} catch (e) {
			const code = officeErrorCode(e);
			if (code === 'OFFICE_SUPPLY_PERIOD_LOCKED' || code === 'OFFICE_SUPPLY_LINE_HAS_OTHER_SHARES') {
				toast.warning(officeErrorMessage(e, 'Kỳ đã đóng, bạn liên hệ HCNS.'));
				await refresh();
				return true;
			}
			if (officeErrorStatus(e) === 404) {
				toast.warning('Người khác trong phòng vừa sửa phiếu này, nên phiếu đã được tải lại.');
				await refresh();
				return true;
			}
			toast.error(officeErrorMessage(e, 'Chưa xoá được dòng này. Bạn thử lại sau ít phút.'));
			return false;
		}
	}

	// ─── Mặt hàng ngoài danh mục ──────────────────────────────────────────────

	/**
	 * Thêm mặt hàng ngoài danh mục. Cùng tên và đơn vị với một dòng đang có thì máy chủ cộng vào dòng
	 * đó. Ném lỗi của máy chủ để hộp thoại đặt câu lỗi vào đúng ô.
	 */
	async function addCustom(body: { name: string; unit: string; qty: number; note?: string }) {
		const requestId = current.value?.id;
		if (!requestId) return;
		const data = await enqueue(() =>
			service.addLine(requestId, {
				customName: body.name,
				customUnit: body.unit,
				requestedQty: body.qty,
				note: body.note || undefined,
			}),
		);
		apply(data);
		lastSavedAt.value = new Date();
	}

	// ─── Lấy số tháng trước ───────────────────────────────────────────────────

	async function copyPrevious() {
		const requestId = current.value?.id;
		if (!requestId || copying.value) return;
		await flush();
		copying.value = true;
		const before = new Map((current.value?.lines ?? []).map(line => [line.id, line.requestedQty]));
		try {
			const result = await enqueue(() => service.copyPrevious(requestId));
			apply(result.request);
			lastSavedAt.value = new Date();
			copySkipped.value = result.skippedItems;
			const changed = new Set<string>();
			for (const line of result.request.lines) {
				if (before.get(line.id) === line.requestedQty) continue;
				changed.add(line.itemId != null ? `i${line.itemId}` : `c${line.id}`);
			}
			highlighted.value = changed;
			later('highlight', HIGHLIGHT_MS, () => (highlighted.value = new Set()));
			const message = copyPreviousSummary(result);
			// Câu có danh sách dòng bỏ qua thì dài, nên giữ toast lâu hơn mặc định.
			if (result.skippedItems.length || !result.previousTitle) toast.warning(message, { duration: 12000 });
			else toast.success(message);
		} catch (e) {
			toast.error(officeErrorMessage(e, 'Chưa lấy được số của kỳ trước. Bạn thử lại sau ít phút.'));
		} finally {
			copying.value = false;
		}
	}

	// ─── Đầu mối nhận hàng ────────────────────────────────────────────────────

	/** Người của phòng tôi, để trưởng phòng chọn đầu mối. */
	const contactOptions = computed(() => {
		const departmentId = contact.value?.departmentId;
		if (!departmentId) return [];
		return employees.value
			.filter(e => e.department?.id === departmentId && e.status === 'ACTIVE')
			.map(e => ({ value: e.id, label: e.fullName }));
	});

	/** Chỉ trưởng phòng đổi được đầu mối. */
	const isDepartmentManager = computed(() => !!contact.value?.manager && contact.value.manager.id === me.value);

	/** `null` là bỏ đầu mối, việc nhận hàng trở về trưởng phòng. Trả `true` khi đã lưu. */
	async function saveContact(employeeId: number | null): Promise<boolean> {
		if (savingContact.value) return false;
		savingContact.value = true;
		try {
			contact.value = await service.setSupplyContact({ employeeId });
			toast.success(
				contact.value.contact
					? `Đã chỉ định ${contact.value.contact.fullName} làm đầu mối nhận văn phòng phẩm của phòng.`
					: 'Đã bỏ đầu mối, việc nhận hàng trở về trưởng phòng.',
			);
			// Cờ `canReceive` của phiếu phụ thuộc đầu mối, nên phiếu đang mở cũng phải tải lại.
			await refresh();
			return true;
		} catch (e) {
			toast.error(officeErrorMessage(e, 'Chưa lưu được đầu mối. Bạn thử lại sau ít phút.'));
			return false;
		} finally {
			savingContact.value = false;
		}
	}

	// ─── Thanh kỳ ─────────────────────────────────────────────────────────────

	/** Đếm ngược chỉ có nghĩa khi phiếu còn nhận đăng ký; qua mốc khoá mà chưa khoá thì nói đã quá hạn. */
	const lockPassed = computed(() => {
		const lockAt = current.value?.period.lockAt;
		return !!lockAt && new Date(lockAt).getTime() <= now.value.getTime();
	});

	/**
	 * Câu giải thích khi phiếu không sửa được nữa, theo đúng bước phiếu đang ở.
	 *
	 * Kỳ bị HCNS khoá sớm thì hạn chót trên phiếu vẫn là ngày cũ, nên người dùng thấy "Hạn chót 24/11"
	 * mà không nhập được gì và tưởng hệ thống lỗi. Mốc khoá thật nằm ở `lockedAt`.
	 */
	const readOnlyNotice = computed(() => {
		const request = current.value;
		if (!request || request.canEdit) return '';
		const period = request.period;
		if (period.status === 'CLOSED') {
			return 'Kỳ này đã đóng nên phiếu chỉ còn để xem. Phòng còn thiếu thì báo HCNS tạo phiếu bổ sung.';
		}
		switch (request.status) {
			case 'OPEN':
				// Phiếu còn mở mà máy chủ không cho sửa là chế độ chỉ xem của module; lý do nằm ở
				// thông báo module phía trên.
				return 'Phiếu này đang ở chế độ chỉ xem.';
			case 'LOCKED': {
				const at = period.lockedAt ?? period.lockAt;
				return `Phiếu đã khoá lúc ${formatDateTime(at)}, đang chờ HCNS chốt số. Phòng còn thiếu thì báo HCNS tạo phiếu bổ sung.`;
			}
			case 'FINALIZED':
				return 'HCNS đã chốt số của phiếu, đang chờ cấp hàng.';
			case 'ISSUED':
				return 'HCNS đã cấp hàng, trưởng phòng hoặc đầu mối bấm Đã nhận khi nhận đủ.';
			default:
				return '';
		}
	});

	const hasFinalQty = computed(() => (current.value?.lines ?? []).some(l => l.finalQty != null));
	const hasReceivedQty = computed(() => (current.value?.lines ?? []).some(l => l.receivedQty != null));

	return {
		// dữ liệu
		requests,
		loadingList,
		listError,
		current,
		loadingDetail,
		detailError,
		pendingRequestId,
		items,
		loadingItems,
		itemsError,
		contact,
		savingContact,
		copying,
		copySkipped,
		now,
		canEdit,
		// danh mục
		catalog,
		filteredGroups,
		groupChips,
		totalRows,
		search,
		groupFilter,
		onlySelected,
		myCount,
		roomCount,
		saveStatus,
		errorKeys,
		rowState,
		savedFlash,
		undo,
		notices,
		highlighted,
		shownQty,
		// thao tác
		init,
		loadList,
		loadItems,
		openRequest,
		refresh,
		apply,
		selectRequest,
		setDraft,
		setReason,
		bump,
		commit,
		retry,
		retryAll,
		restore,
		flush,
		saveNote,
		saveShare,
		deleteLine,
		addCustom,
		copyPrevious,
		// đầu mối
		contactOptions,
		isDepartmentManager,
		saveContact,
		// thanh kỳ
		lockPassed,
		readOnlyNotice,
		hasFinalQty,
		hasReceivedQty,
	};
}
