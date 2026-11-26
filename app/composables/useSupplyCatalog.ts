import type { InjectionKey } from 'vue';
import { useOfficeService } from '~/services/office.service';
import {
	downloadOfficeFile,
	filterCatalogSections,
	officeErrorCode,
	officeErrorMessage,
} from '~/utils/office.utils';
import type { SupplyGroup, SupplyImportResult, SupplyItem } from '~/types/office.types';

interface GroupForm {
	name: string;
	hrOnly: boolean;
	sortOrder: number | undefined;
	isActive: boolean;
}

interface ItemForm {
	groupId: number | undefined;
	name: string;
	unit: string;
	unitPrice: number | undefined;
	sortOrder: number | undefined;
	isActive: boolean;
}

interface InlineItemForm {
	name: string;
	unit: string;
	unitPrice: number | undefined;
}

/**
 * Danh mục văn phòng phẩm ở Cài đặt hành chính: nhóm, mặt hàng, tìm lọc, form thêm sửa, thêm nhanh
 * trong nhóm và nhập từ Excel.
 *
 * Trang Cài đặt giữ một bản duy nhất của composable này vì thẻ Định mức cũng đọc danh sách mặt hàng.
 * Quyền: trang đã được `permission-guard` gác bằng `office:manage`, nên ở đây chỉ còn quyền ghi của
 * module (`canEdit`), y như trước khi tách.
 */
export function useSupplyCatalog() {
	const route = useRoute();
	const router = useRouter();
	const toast = useToast();
	const service = useOfficeService();
	const { canWrite } = useModuleAccess();

	/** Công ty đang ở chế độ chỉ xem thì mọi nút ghi tắt, nhưng vẫn đọc và tải file được. */
	const canEdit = computed(() => canWrite('OFFICE'));

	const groups = ref<SupplyGroup[]>([]);
	const items = ref<SupplyItem[]>([]);
	const loadingSupplies = ref(false);
	const suppliesLoaded = ref(false);
	const loadError = ref<string | null>(null);

	/**
	 * `silent` nạp lại mà không hiện khung chờ: thêm nhanh từng mặt hàng trong một nhóm mà cả danh
	 * sách nháy thành khung xám sau mỗi lần lưu thì người dùng mất chỗ đang gõ.
	 */
	async function loadSupplies(options: { silent?: boolean } = {}) {
		if (!options.silent) loadingSupplies.value = true;
		loadError.value = null;
		try {
			const [groupList, itemList] = await Promise.all([
				service.findSupplyGroups({ includeInactive: true }),
				service.findSupplyItems({ includeInactive: true }),
			]);
			groups.value = groupList;
			items.value = itemList;
			suppliesLoaded.value = true;
		} catch (e) {
			loadError.value = officeErrorMessage(e, 'Chưa tải được danh mục văn phòng phẩm. Bạn bấm Thử lại.');
		} finally {
			loadingSupplies.value = false;
		}
	}

	const groupOptions = computed(() => groups.value.filter(g => g.isActive).map(g => ({ value: g.id, label: g.name })));
	/** Đơn vị tính đã có, để gợi ý khi gõ mặt hàng mới (cùng một chữ "Chiếc", không phải "chiếc", "cái"). */
	const unitSuggestions = computed(() => [...new Set(items.value.map(i => i.unit.trim()).filter(Boolean))].sort());

	// ─── Tìm, lọc ─────────────────────────────────────────────────────────────

	function queryText(value: unknown): string {
		const raw = Array.isArray(value) ? value[0] : value;
		return typeof raw === 'string' ? raw : '';
	}

	const search = ref(queryText(route.query.q));
	const filterGroupId = ref<number | undefined>(Number(queryText(route.query.group)) || undefined);
	const onlyUnpriced = ref(false);
	const showInactive = ref(false);

	/** Từ khoá và nhóm đang lọc nằm trên địa chỉ trang, cạnh `?tab=`, để gửi link vẫn ra đúng chỗ. */
	watch([search, filterGroupId], ([q, group]) => {
		const query = { ...route.query };
		if (q.trim()) query.q = q;
		else delete query.q;
		if (group) query.group = String(group);
		else delete query.group;
		router.replace({ query });
	});

	const hasFilter = computed(() => !!search.value.trim() || !!filterGroupId.value || onlyUnpriced.value);

	function clearFilters() {
		search.value = '';
		filterGroupId.value = undefined;
		onlyUnpriced.value = false;
	}

	const catalog = computed(() =>
		filterCatalogSections(groups.value, items.value, {
			search: search.value,
			groupId: filterGroupId.value,
			onlyUnpriced: onlyUnpriced.value,
			showInactive: showInactive.value,
		}),
	);

	/** Mặt hàng đang dùng mà chưa có đơn giá: cùng tiêu chí với "N mặt hàng chưa có đơn giá" của kỳ. */
	const unpricedCount = computed(() => catalog.value.unpriced);
	const inactiveCount = computed(() => items.value.filter(i => !i.isActive).length + groups.value.filter(g => !g.isActive).length);

	// ─── Nhóm đang mở ─────────────────────────────────────────────────────────

	/** Nhóm người dùng đã thu gọn; mặc định mọi nhóm mở vì danh sách đã có ô tìm và chip lọc. */
	const collapsedGroupIds = ref(new Set<number>());

	function isGroupOpen(groupId: number): boolean {
		return !collapsedGroupIds.value.has(groupId) || !!search.value.trim();
	}

	function setGroupOpen(groupId: number, open: boolean) {
		const next = new Set(collapsedGroupIds.value);
		if (open) next.delete(groupId);
		else next.add(groupId);
		collapsedGroupIds.value = next;
	}

	function setAllOpen(open: boolean) {
		collapsedGroupIds.value = open ? new Set() : new Set(groups.value.map(g => g.id));
	}

	// ─── Form nhóm ────────────────────────────────────────────────────────────

	const showGroupForm = ref(false);
	const editingGroup = ref<SupplyGroup | null>(null);
	const savingGroup = ref(false);
	const groupNameError = ref('');
	const groupForm = reactive<GroupForm>({ name: '', hrOnly: false, sortOrder: undefined, isActive: true });

	function openGroupCreate() {
		editingGroup.value = null;
		groupNameError.value = '';
		Object.assign(groupForm, { name: '', hrOnly: false, sortOrder: undefined, isActive: true });
		showGroupForm.value = true;
	}

	function openGroupEdit(group: SupplyGroup) {
		editingGroup.value = group;
		groupNameError.value = '';
		Object.assign(groupForm, {
			name: group.name,
			hrOnly: group.hrOnly,
			sortOrder: group.sortOrder,
			isActive: group.isActive,
		});
		showGroupForm.value = true;
	}

	async function saveGroup() {
		if (!groupForm.name.trim() || savingGroup.value) return;
		savingGroup.value = true;
		groupNameError.value = '';
		try {
			if (editingGroup.value) {
				await service.updateSupplyGroup(editingGroup.value.id, {
					name: groupForm.name.trim(),
					hrOnly: groupForm.hrOnly,
					sortOrder: groupForm.sortOrder,
					isActive: groupForm.isActive,
				});
			} else {
				await service.createSupplyGroup({
					name: groupForm.name.trim(),
					hrOnly: groupForm.hrOnly,
					sortOrder: groupForm.sortOrder,
				});
			}
			toast.success(`Đã lưu nhóm ${groupForm.name.trim()}.`);
			showGroupForm.value = false;
			await loadSupplies({ silent: true });
		} catch (e) {
			if (officeErrorCode(e) === 'OFFICE_SUPPLY_GROUP_EXISTS') {
				groupNameError.value = officeErrorMessage(e, 'Nhóm này đã có.');
			} else {
				toast.error(officeErrorMessage(e, 'Chưa lưu được nhóm. Bạn thử lại sau ít phút.'));
			}
		} finally {
			savingGroup.value = false;
		}
	}

	// ─── Form mặt hàng ────────────────────────────────────────────────────────

	const showItemForm = ref(false);
	const editingItem = ref<SupplyItem | null>(null);
	const savingItem = ref(false);
	const itemNameError = ref('');
	const itemForm = reactive<ItemForm>({
		groupId: undefined,
		name: '',
		unit: '',
		unitPrice: undefined,
		sortOrder: undefined,
		isActive: true,
	});

	/** Thêm mặt hàng; đang lọc một nhóm (hoặc bấm từ một nhóm) thì chọn sẵn nhóm đó. */
	function openItemCreate(groupId?: number) {
		editingItem.value = null;
		itemNameError.value = '';
		const preferred = groupId ?? filterGroupId.value;
		const usable = groupOptions.value.some(option => option.value === preferred) ? preferred : undefined;
		Object.assign(itemForm, {
			groupId: usable ?? groupOptions.value[0]?.value,
			name: '',
			unit: '',
			unitPrice: undefined,
			sortOrder: undefined,
			isActive: true,
		});
		showItemForm.value = true;
	}

	function openItemEdit(item: SupplyItem) {
		editingItem.value = item;
		itemNameError.value = '';
		Object.assign(itemForm, {
			groupId: item.groupId,
			name: item.name,
			unit: item.unit,
			unitPrice: item.unitPrice ?? undefined,
			sortOrder: item.sortOrder,
			isActive: item.isActive,
		});
		showItemForm.value = true;
	}

	async function saveItem() {
		if (!itemForm.groupId || !itemForm.name.trim() || !itemForm.unit.trim() || savingItem.value) return;
		savingItem.value = true;
		itemNameError.value = '';
		try {
			if (editingItem.value) {
				await service.updateSupplyItem(editingItem.value.id, {
					groupId: itemForm.groupId,
					name: itemForm.name.trim(),
					unit: itemForm.unit.trim(),
					unitPrice: itemForm.unitPrice,
					sortOrder: itemForm.sortOrder,
					isActive: itemForm.isActive,
				});
			} else {
				await service.createSupplyItem({
					groupId: itemForm.groupId,
					name: itemForm.name.trim(),
					unit: itemForm.unit.trim(),
					unitPrice: itemForm.unitPrice,
					sortOrder: itemForm.sortOrder,
				});
			}
			toast.success(`Đã lưu mặt hàng ${itemForm.name.trim()}.`);
			showItemForm.value = false;
			await loadSupplies({ silent: true });
		} catch (e) {
			if (officeErrorCode(e) === 'OFFICE_SUPPLY_ITEM_EXISTS') {
				itemNameError.value = officeErrorMessage(e, 'Mặt hàng này đã có trong nhóm.');
			} else {
				toast.error(officeErrorMessage(e, 'Chưa lưu được mặt hàng. Bạn thử lại sau ít phút.'));
			}
		} finally {
			savingItem.value = false;
		}
	}

	// ─── Thêm nhanh trong một nhóm ────────────────────────────────────────────

	/**
	 * Dòng thêm nhanh ngay trong khối của một nhóm, nên không phải chọn lại nhóm như ở form chung.
	 *
	 * Lưu xong dòng vẫn mở và xoá trắng để gõ tiếp mặt hàng sau, vì người dùng thường thêm một loạt
	 * mặt hàng vào cùng một nhóm. Thứ tự hiện và trạng thái thì vẫn sửa ở form chung.
	 */
	const inlineGroupId = ref<number | null>(null);
	const inlineItem = reactive<InlineItemForm>({ name: '', unit: '', unitPrice: undefined });
	const savingInline = ref(false);
	const inlineNameError = ref('');

	function focusInlineName() {
		nextTick(() => document.getElementById('inline-item-name')?.focus());
	}

	function toggleInlineAdd(groupId: number) {
		if (inlineGroupId.value === groupId) {
			inlineGroupId.value = null;
			return;
		}
		inlineGroupId.value = groupId;
		inlineNameError.value = '';
		Object.assign(inlineItem, { name: '', unit: '', unitPrice: undefined });
		setGroupOpen(groupId, true);
		focusInlineName();
	}

	async function saveInlineItem() {
		const groupId = inlineGroupId.value;
		const name = inlineItem.name.trim();
		const unit = inlineItem.unit.trim();
		if (!groupId || !name || !unit || savingInline.value) return;
		savingInline.value = true;
		inlineNameError.value = '';
		try {
			await service.createSupplyItem({ groupId, name, unit, unitPrice: inlineItem.unitPrice });
			toast.success(`Đã thêm mặt hàng ${name}.`);
			Object.assign(inlineItem, { name: '', unit: '', unitPrice: undefined });
			await loadSupplies({ silent: true });
			focusInlineName();
		} catch (e) {
			if (officeErrorCode(e) === 'OFFICE_SUPPLY_ITEM_EXISTS') {
				inlineNameError.value = officeErrorMessage(e, 'Mặt hàng này đã có trong nhóm.');
			} else {
				toast.error(officeErrorMessage(e, 'Chưa lưu được mặt hàng. Bạn thử lại sau ít phút.'));
			}
		} finally {
			savingInline.value = false;
		}
	}

	// ─── Sửa nhanh đơn giá, ngừng dùng ngay trên dòng ─────────────────────────

	/** Dòng vừa lưu, tô nền trong chốc lát (sửa giá, ngừng dùng, mặt hàng mới sau khi nhập file). */
	const flashed = ref(new Set<number>());
	let flashTimer: ReturnType<typeof setTimeout> | null = null;

	function flash(ids: number[]) {
		flashed.value = new Set(ids);
		if (flashTimer) clearTimeout(flashTimer);
		flashTimer = setTimeout(() => (flashed.value = new Set()), 2200);
	}

	function replaceItem(updated: SupplyItem) {
		items.value = items.value.map(item => (item.id === updated.id ? updated : item));
		flash([updated.id]);
	}

	/**
	 * Đổi đơn giá bằng đúng API sửa mặt hàng. Trả câu lỗi để ô giữ số đã gõ, hoặc `null` khi xong.
	 * Ô trống không gửi gì: form sửa mặt hàng cũng không xoá được giá đã có.
	 */
	async function savePrice(item: SupplyItem, unitPrice: number): Promise<string | null> {
		try {
			replaceItem(await service.updateSupplyItem(item.id, { unitPrice }));
			toast.success(`Đã lưu đơn giá ${item.name}.`);
			return null;
		} catch (e) {
			return officeErrorMessage(e, 'Chưa lưu được đơn giá. Bạn thử lại sau ít phút.');
		}
	}

	const togglingItemId = ref<number | null>(null);

	/** Ngừng dùng hay dùng lại một mặt hàng, như ô "Đang dùng" của form sửa. */
	async function toggleItemActive(item: SupplyItem) {
		if (togglingItemId.value) return;
		togglingItemId.value = item.id;
		try {
			replaceItem(await service.updateSupplyItem(item.id, { isActive: !item.isActive }));
			toast.success(item.isActive ? `Đã ngừng dùng ${item.name}.` : `Đã dùng lại ${item.name}.`);
		} catch (e) {
			toast.error(officeErrorMessage(e, 'Chưa đổi được trạng thái mặt hàng. Bạn thử lại sau ít phút.'));
		} finally {
			togglingItemId.value = null;
		}
	}

	// ─── Nhập danh mục từ Excel ───────────────────────────────────────────────

	const importOpen = ref(false);
	const importFile = ref<File | null>(null);
	const importing = ref(false);
	const downloadingTemplate = ref(false);
	const importResult = ref<SupplyImportResult | null>(null);

	/**
	 * Số dòng thật sự không vào được danh mục.
	 *
	 * `skipped` của máy chủ chỉ đếm dòng bỏ qua CÓ CHỦ Ý (dòng tổng, nhóm ngoài danh sách), còn
	 * dòng bị bỏ vì lỗi thì chỉ nằm trong danh sách câu lỗi. Lấy riêng `skipped` thì màn hình ghi
	 * "0 dòng được bỏ qua" ngay trên năm câu "bỏ qua dòng này", và người đọc không tin con số nào.
	 */
	const importSkippedRows = computed(() => {
		const result = importResult.value;
		if (!result) return 0;
		return result.skipped + result.errors.filter(issue => /bỏ qua/i.test(issue.message)).length;
	});

	function openImport() {
		importResult.value = null;
		importFile.value = null;
		importOpen.value = true;
	}

	async function downloadTemplate() {
		downloadingTemplate.value = true;
		try {
			const file = await service.downloadItemTemplate();
			// Tên của máy chủ là tên đúng; chỉ khi header không tới được trình duyệt mới tự đặt.
			const name = file.fileName || 'mau-van-phong-pham.xlsx';
			downloadOfficeFile(file.blob, name);
			toast.success(`Đã tải file mẫu ${name}.`);
		} catch (e) {
			toast.error(officeErrorMessage(e, 'Chưa tải được file mẫu. Bạn thử lại sau ít phút.'));
		} finally {
			downloadingTemplate.value = false;
		}
	}

	/** Nhập file; xong thì làm mới danh mục tại chỗ, tô các mặt hàng mới, còn chỗ cần xem lại thì giữ hộp mở. */
	async function runImport() {
		const file = importFile.value;
		if (!file || importing.value) return;
		importing.value = true;
		const before = new Set(items.value.map(i => i.id));
		try {
			importResult.value = await service.importSupplyItems(file);
			importFile.value = null;
			const result = importResult.value;
			toast.success(`Đã nhập xong: thêm ${result.createdItems} mặt hàng và ${result.createdGroups.length} nhóm mới.`);
			await loadSupplies({ silent: true });
			flash(items.value.filter(i => !before.has(i.id)).map(i => i.id));
			if (!result.errors.length) importOpen.value = false;
		} catch (e) {
			toast.error(officeErrorMessage(e, 'Chưa nhập được danh mục từ file này. Bạn kiểm tra lại file.'));
		} finally {
			importing.value = false;
		}
	}

	onUnmounted(() => {
		if (flashTimer) clearTimeout(flashTimer);
	});

	return {
		canEdit,
		groups,
		items,
		loadingSupplies,
		suppliesLoaded,
		loadError,
		loadSupplies,
		groupOptions,
		unitSuggestions,
		search,
		filterGroupId,
		onlyUnpriced,
		showInactive,
		hasFilter,
		clearFilters,
		catalog,
		unpricedCount,
		inactiveCount,
		isGroupOpen,
		setGroupOpen,
		setAllOpen,
		showGroupForm,
		editingGroup,
		savingGroup,
		groupNameError,
		groupForm,
		openGroupCreate,
		openGroupEdit,
		saveGroup,
		showItemForm,
		editingItem,
		savingItem,
		itemNameError,
		itemForm,
		openItemCreate,
		openItemEdit,
		saveItem,
		inlineGroupId,
		inlineItem,
		savingInline,
		inlineNameError,
		toggleInlineAdd,
		saveInlineItem,
		flashed,
		savePrice,
		togglingItemId,
		toggleItemActive,
		importOpen,
		importFile,
		importing,
		downloadingTemplate,
		importResult,
		importSkippedRows,
		openImport,
		downloadTemplate,
		runImport,
	};
}

export type SupplyCatalogState = ReturnType<typeof useSupplyCatalog>;

/** Trang Cài đặt `provide` bản danh mục của nó; các khối của thẻ Văn phòng phẩm `inject` lại. */
export const SUPPLY_CATALOG_KEY: InjectionKey<SupplyCatalogState> = Symbol('supply-catalog');

export function useInjectedSupplyCatalog(): SupplyCatalogState {
	const state = inject(SUPPLY_CATALOG_KEY);
	if (!state) throw new Error('Thiếu danh mục văn phòng phẩm: trang Cài đặt phải provide SUPPLY_CATALOG_KEY.');
	return state;
}
