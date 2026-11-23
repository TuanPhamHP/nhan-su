<script setup lang="ts">
	import RoomFormModal from '~/components/modules/office/RoomFormModal.vue';
	import SiteFormModal from '~/components/modules/office/SiteFormModal.vue';
	import type { DropdownMenuItem } from '~/components/ui/DropdownMenu.vue';
	import { useOfficeService } from '~/services/office.service';
	import { downloadOfficeFile, officeErrorCode, officeErrorMessage, officeMoney } from '~/utils/office.utils';
	import type {
		MeetingRoom,
		OfficeSite,
		SupplyGroup,
		SupplyImportResult,
		SupplyItem,
		SupplyQuota,
	} from '~/types/office.types';

	/**
	 * Cài đặt hành chính (UI-09): văn phòng cùng phòng họp của nó, danh mục văn phòng phẩm, và định
	 * mức theo phòng ban.
	 *
	 * Ba thẻ nằm chung một trang vì chúng là danh mục nền của cả module: mở kỳ đăng ký cần văn
	 * phòng và danh mục mặt hàng, còn lịch phòng họp cần văn phòng và phòng. Trang đã được
	 * `permission-guard` gác bằng `office:manage`, nên ở đây chỉ còn kiểm quyền ghi của module.
	 */
	definePageMeta({ title: 'Cài đặt hành chính' });

	const toast = useToast();
	const service = useOfficeService();
	const { canWrite } = useModuleAccess();
	const directoryStore = useDirectoryStore();
	const { departments } = storeToRefs(directoryStore);

	/** Công ty đang ở chế độ chỉ xem thì mọi nút ghi tắt, nhưng vẫn đọc và tải file được. */
	const canEdit = computed(() => canWrite('OFFICE'));

	/**
	 * Văn phòng và phòng họp nằm CHUNG một thẻ.
	 *
	 * Tách làm hai thẻ như trước khiến người dùng hiểu sai: muốn thêm bốn phòng họp cho một văn
	 * phòng thì họ phải sang thẻ khác và chọn lại văn phòng bốn lần, và có người đã gõ "Tầng 4 -
	 * Phòng 1" vào ô Địa chỉ của một văn phòng thứ hai vì tưởng mỗi phòng là một văn phòng. Gộp lại
	 * thì phòng họp hiện ngay trong thẻ của văn phòng chứa nó, nên quan hệ "phòng nằm trong văn
	 * phòng" đọc được bằng mắt.
	 */
	type SettingsTab = 'places' | 'supplies' | 'quotas';
	const TABS: { id: SettingsTab; label: string }[] = [
		{ id: 'places', label: 'Văn phòng và phòng họp' },
		{ id: 'supplies', label: 'Văn phòng phẩm' },
		{ id: 'quotas', label: 'Định mức theo phòng' },
	];
	const activeTab = ref<SettingsTab>('places');

	/**
	 * Mở thẻ theo `?tab=` của liên kết cũ.
	 *
	 * Liên kết `?tab=sites` và `?tab=rooms` đã nằm trong lịch sử trò chuyện, trong ghi chú của
	 * người dùng, nên cả hai vẫn phải mở được, nay cùng về thẻ gộp.
	 */
	const route = useRoute();
	const TAB_ALIASES: Record<string, SettingsTab> = {
		places: 'places',
		sites: 'places',
		rooms: 'places',
		supplies: 'supplies',
		quotas: 'quotas',
	};

	const inputCls =
		'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
	const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300';

	// ─── Văn phòng ────────────────────────────────────────────────────────────────

	const sites = ref<OfficeSite[]>([]);
	const loadingSites = ref(true);
	/** Hộp thoại thêm, sửa văn phòng đang mở hay không. */
	const showSiteForm = ref(false);
	const editingSite = ref<OfficeSite | null>(null);
	/** Thẻ văn phòng được tô sáng và cuộn tới: sau khi lưu, hoặc khi người dùng gõ trùng tên. */
	const highlightSiteId = ref<number | null>(null);

	async function loadSites() {
		loadingSites.value = true;
		try {
			sites.value = await service.findSites({ includeInactive: true });
		} catch (e) {
			sites.value = [];
			toast.error(officeErrorMessage(e, 'Chưa tải được danh sách văn phòng. Bạn tải lại trang.'));
		} finally {
			loadingSites.value = false;
		}
	}

	function openSiteCreate() {
		editingSite.value = null;
		showSiteForm.value = true;
	}

	function openSiteEdit(site: OfficeSite) {
		editingSite.value = site;
		showSiteForm.value = true;
	}

	/** Cuộn tới một thẻ văn phòng và tô viền nó, để mắt người dùng tìm thấy ngay. */
	function spotlightSite(siteId: number) {
		highlightSiteId.value = siteId;
		nextTick(() => {
			document.getElementById(`site-card-${siteId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		});
	}

	/** Lưu xong trong hộp thoại: đóng hộp, nạp lại danh sách rồi chỉ vào thẻ vừa lưu. */
	async function onSiteSaved(saved: OfficeSite) {
		showSiteForm.value = false;
		editingSite.value = null;
		await loadSites();
		spotlightSite(saved.id);
	}

	/** Người dùng bấm "Đi tới thẻ …" ở câu lỗi trùng tên trong hộp thoại. */
	function onGoToSite(siteId: number) {
		showSiteForm.value = false;
		editingSite.value = null;
		spotlightSite(siteId);
	}

	// ─── Văn phòng phẩm: nhóm và mặt hàng ─────────────────────────────────────────

	const groups = ref<SupplyGroup[]>([]);
	const items = ref<SupplyItem[]>([]);
	const loadingSupplies = ref(false);
	const suppliesLoaded = ref(false);

	const showGroupForm = ref(false);
	const editingGroup = ref<SupplyGroup | null>(null);
	const savingGroup = ref(false);
	const groupNameError = ref('');
	const groupForm = reactive({ name: '', hrOnly: false, sortOrder: undefined as number | undefined, isActive: true });

	const showItemForm = ref(false);
	const editingItem = ref<SupplyItem | null>(null);
	const savingItem = ref(false);
	const itemNameError = ref('');
	const itemForm = reactive({
		groupId: undefined as number | undefined,
		name: '',
		unit: '',
		unitPrice: undefined as number | undefined,
		sortOrder: undefined as number | undefined,
		isActive: true,
	});

	const filterGroupId = ref<number | undefined>(undefined);

	/**
	 * `silent` nạp lại mà không hiện khung chờ: thêm nhanh từng mặt hàng trong một nhóm mà cả danh
	 * sách nháy thành khung xám sau mỗi lần lưu thì người dùng mất chỗ đang gõ.
	 */
	async function loadSupplies(options: { silent?: boolean } = {}) {
		if (!options.silent) loadingSupplies.value = true;
		try {
			const [groupList, itemList] = await Promise.all([
				service.findSupplyGroups({ includeInactive: true }),
				service.findSupplyItems({ includeInactive: true }),
			]);
			groups.value = groupList;
			items.value = itemList;
			suppliesLoaded.value = true;
		} catch (e) {
			toast.error(officeErrorMessage(e, 'Chưa tải được danh mục văn phòng phẩm. Bạn tải lại trang.'));
		} finally {
			loadingSupplies.value = false;
		}
	}

	const groupOptions = computed(() => groups.value.filter(g => g.isActive).map(g => ({ value: g.id, label: g.name })));

	/** Ô lọc mặt hàng: thêm lựa chọn xem tất cả ở đầu danh sách. */
	const groupFilterOptions = computed(() => [
		{ value: 0, label: 'Tất cả nhóm' },
		...groups.value.map(g => ({ value: g.id, label: g.name })),
	]);

	/**
	 * Mặt hàng xếp theo nhóm, theo thứ tự nhóm và thứ tự mặt hàng máy chủ trả về.
	 *
	 * Nhóm chưa có mặt hàng nào vẫn hiện, vì nút thêm mặt hàng của nhóm nằm ngay trên khối của nó.
	 */
	const itemsByGroup = computed(() => {
		const byGroup = new Map<number, SupplyItem[]>();
		for (const item of items.value) {
			const list = byGroup.get(item.groupId) ?? [];
			list.push(item);
			byGroup.set(item.groupId, list);
		}
		const sections = groups.value.map(g => ({
			groupId: g.id,
			groupName: g.name,
			isActive: g.isActive,
			items: byGroup.get(g.id) ?? [],
		}));
		return filterGroupId.value ? sections.filter(s => s.groupId === filterGroupId.value) : sections;
	});

	/**
	 * Nhóm mặt hàng đang mở. Mặc định mọi nhóm đóng: danh mục có hàng chục mặt hàng, mở hết thì
	 * người dùng phải cuộn qua cả trang mới tới được nhóm mình cần.
	 */
	const expandedGroupIds = ref(new Set<number>());

	function isGroupOpen(groupId: number): boolean {
		return expandedGroupIds.value.has(groupId);
	}

	function setGroupOpen(groupId: number, open: boolean) {
		const next = new Set(expandedGroupIds.value);
		if (open) next.add(groupId);
		else next.delete(groupId);
		expandedGroupIds.value = next;
	}

	/** Chọn một nhóm ở ô lọc là muốn xem nhóm đó, nên mở luôn nó. */
	function onFilterGroup(value: unknown) {
		filterGroupId.value = Number(value) || undefined;
		if (filterGroupId.value) setGroupOpen(filterGroupId.value, true);
	}

	/**
	 * Dòng thêm nhanh ngay trong khối của một nhóm, nên không phải chọn lại nhóm như ở form chung.
	 *
	 * Lưu xong dòng vẫn mở và xoá trắng để gõ tiếp mặt hàng sau, vì người dùng thường thêm một loạt
	 * mặt hàng vào cùng một nhóm. Thứ tự hiện và trạng thái thì vẫn sửa ở form chung.
	 */
	const inlineGroupId = ref<number | null>(null);
	const inlineItem = reactive({ name: '', unit: '', unitPrice: undefined as number | undefined });
	const savingInline = ref(false);
	const inlineNameError = ref('');
	const inlineInputCls =
		'w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

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
			await loadSupplies();
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

	function openItemCreate() {
		editingItem.value = null;
		itemNameError.value = '';
		Object.assign(itemForm, {
			groupId: filterGroupId.value || groupOptions.value[0]?.value,
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
			await loadSupplies();
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

	// ─── Nhập danh mục từ Excel ───────────────────────────────────────────────────

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

	async function runImport() {
		const file = importFile.value;
		if (!file || importing.value) return;
		importing.value = true;
		try {
			importResult.value = await service.importSupplyItems(file);
			importFile.value = null;
			const result = importResult.value;
			toast.success(`Đã nhập xong: thêm ${result.createdItems} mặt hàng và ${result.createdGroups.length} nhóm mới.`);
			await loadSupplies();
		} catch (e) {
			toast.error(officeErrorMessage(e, 'Chưa nhập được danh mục từ file này. Bạn kiểm tra lại file.'));
		} finally {
			importing.value = false;
		}
	}

	// ─── Định mức theo phòng ──────────────────────────────────────────────────────

	const quotaDepartmentId = ref<number | undefined>(undefined);
	const quotas = ref<SupplyQuota[]>([]);
	const loadingQuotas = ref(false);
	const savingQuotas = ref(false);
	/** Dòng đang sửa trên màn: `itemId` và số mỗi tháng, chưa gửi lên máy chủ. */
	const quotaRows = ref<Array<{ itemId: number | undefined; monthlyQty: number | undefined }>>([]);

	const departmentOptions = computed(() => departments.value.map(d => ({ value: d.id, label: d.name })));

	/**
	 * Nhãn mặt hàng: TÊN đứng trước, nhóm đứng sau.
	 *
	 * Ô chọn chỉ hiện một dòng và cắt phần đuôi, nên để nhóm lên trước thì trên điện thoại người
	 * dùng đọc được "Bút (Note màu) & các loại g…" mà không biết đó là mặt hàng nào.
	 */
	const quotaItemOptions = computed(() =>
		items.value.filter(i => i.isActive).map(i => ({ value: i.id, label: `${i.name} (${i.unit}) · ${i.groupName}` })),
	);

	async function loadQuotas() {
		const departmentId = quotaDepartmentId.value;
		if (!departmentId) return;
		loadingQuotas.value = true;
		try {
			quotas.value = await service.findQuotas(departmentId);
			quotaRows.value = quotas.value.map(q => ({ itemId: q.itemId, monthlyQty: q.monthlyQty }));
		} catch (e) {
			quotas.value = [];
			quotaRows.value = [];
			toast.error(officeErrorMessage(e, 'Chưa tải được định mức của phòng này.'));
		} finally {
			loadingQuotas.value = false;
		}
	}

	function addQuotaRow() {
		quotaRows.value = [...quotaRows.value, { itemId: undefined, monthlyQty: undefined }];
	}

	function removeQuotaRow(index: number) {
		quotaRows.value = quotaRows.value.filter((_, i) => i !== index);
	}

	async function saveQuotas() {
		const departmentId = quotaDepartmentId.value;
		if (!departmentId || savingQuotas.value) return;
		const filled = quotaRows.value.filter(r => r.itemId != null && r.monthlyQty != null);
		savingQuotas.value = true;
		try {
			quotas.value = await service.replaceQuotas({
				departmentId,
				quotas: filled.map(r => ({ itemId: r.itemId as number, monthlyQty: r.monthlyQty as number })),
			});
			quotaRows.value = quotas.value.map(q => ({ itemId: q.itemId, monthlyQty: q.monthlyQty }));
			toast.success(`Đã lưu ${quotas.value.length} định mức cho phòng này.`);
		} catch (e) {
			toast.error(officeErrorMessage(e, 'Chưa lưu được định mức. Bạn thử lại sau ít phút.'));
		} finally {
			savingQuotas.value = false;
		}
	}

	// ─── Phòng họp ────────────────────────────────────────────────────────────────

	const rooms = ref<MeetingRoom[]>([]);
	const loadingRooms = ref(false);
	const roomsLoaded = ref(false);
	/**
	 * Hộp thoại thêm, sửa phòng: văn phòng chứa phòng, và phòng đang sửa nếu là sửa.
	 *
	 * Văn phòng lấy theo khối mà người dùng bấm thêm, nên hộp thoại không có ô chọn văn phòng và
	 * không ai tạo nhầm phòng sang văn phòng khác. Việc lưu nằm trong `RoomFormModal`.
	 */
	const roomFormSite = ref<OfficeSite | null>(null);
	const editingRoom = ref<MeetingRoom | null>(null);

	/**
	 * Phòng đã ngừng dùng có hiện hay không.
	 *
	 * Mặc định ẩn: danh sách phòng đang dùng là thứ người dùng vào đây để xem, còn phòng đã ngừng
	 * chỉ cần tới lúc muốn dùng lại. Số phòng đang ẩn vẫn ghi ngay cạnh công tắc để không ai tưởng
	 * mình mất phòng.
	 */
	const showInactiveRooms = ref(false);

	async function loadRooms() {
		loadingRooms.value = true;
		try {
			rooms.value = await service.findRooms({ includeInactive: true });
			roomsLoaded.value = true;
		} catch (e) {
			rooms.value = [];
			toast.error(officeErrorMessage(e, 'Chưa tải được danh sách phòng họp. Bạn tải lại trang.'));
		} finally {
			loadingRooms.value = false;
		}
	}

	/**
	 * Thiết bị gợi ý sẵn, để mọi phòng gọi cùng một thứ bằng cùng một tên.
	 *
	 * Danh sách mẫu là những thứ phòng họp nào cũng có; phần sau là thiết bị các phòng của công ty
	 * đang dùng, lấy từ dữ liệu trang đã tải nên không gọi thêm API. Ô chip tự bỏ mục đã chọn và tự
	 * bỏ trùng, nên ở đây chỉ cần gộp lại.
	 */
	const EQUIPMENT_SAMPLES = [
		'Bảng trắng',
		'Máy chiếu',
		'Màn hình TV',
		'Camera & mic',
		'Cáp HDMI & bộ chuyển đổi',
		'Loa',
		'Điện thoại hội nghị',
		'Bút trình chiếu',
	];

	const equipmentSuggestions = computed(() => [
		...EQUIPMENT_SAMPLES,
		...rooms.value.flatMap(room => room.equipment ?? []),
	]);

	/** Phòng họp của một văn phòng, theo ID chứ không theo tên: tên văn phòng có thể đổi. */
	function roomsOf(siteId: number): MeetingRoom[] {
		return rooms.value.filter(room => room.officeSiteId === siteId);
	}

	/** Phòng hiện trên lưới của một văn phòng: bỏ phòng đã ngừng khi công tắc đang tắt. */
	function visibleRoomsOf(siteId: number): MeetingRoom[] {
		const all = roomsOf(siteId);
		return showInactiveRooms.value ? all : all.filter(room => room.isActive);
	}

	/** Số phòng đã ngừng đang bị ẩn ở một văn phòng, để ghi cạnh lưới. */
	function hiddenRoomCount(siteId: number): number {
		return showInactiveRooms.value ? 0 : roomsOf(siteId).filter(room => !room.isActive).length;
	}

	/** Tổng số phòng đã ngừng của cả công ty, để ghi cạnh công tắc. */
	const inactiveRoomTotal = computed(() => rooms.value.filter(room => !room.isActive).length);

	/**
	 * Câu tóm tắt dưới tên văn phòng, ví dụ "3 phòng · tối đa 34 người".
	 *
	 * Chỉ đếm phòng đang dùng và chỉ lấy sức chứa lớn nhất: người đọc dòng này đang muốn biết văn
	 * phòng có chỗ họp hay không và phòng lớn nhất ngồi được bao nhiêu người.
	 */
	function siteSummary(siteId: number): string {
		const active = roomsOf(siteId).filter(room => room.isActive);
		if (!active.length) return 'Chưa có phòng họp';
		const capacities = active.map(room => room.capacity).filter((c): c is number => c != null);
		const roomCount = `${active.length} phòng`;
		return capacities.length ? `${roomCount} · tối đa ${Math.max(...capacities)} người` : roomCount;
	}

	/** Mở hộp thoại thêm phòng, văn phòng chọn sẵn theo khối người dùng đang bấm. */
	function openRoomCreate(site: OfficeSite) {
		editingRoom.value = null;
		roomFormSite.value = site;
	}

	function openRoomEdit(room: MeetingRoom) {
		const site = sites.value.find(s => s.id === room.officeSiteId);
		if (!site) return;
		editingRoom.value = room;
		roomFormSite.value = site;
	}

	function closeRoomForm() {
		roomFormSite.value = null;
		editingRoom.value = null;
	}

	/**
	 * Lưu xong trong hộp thoại: nạp lại danh sách, và chỉ đóng hộp khi người dùng không chọn thêm
	 * phòng nữa. Hộp tự xoá trắng các ô cho lượt gõ sau, nên ở đây không chạm vào nó.
	 */
	async function onRoomSaved(_saved: MeetingRoom, keepOpen: boolean) {
		await loadRooms();
		if (!keepOpen) closeRoomForm();
	}

	/**
	 * Việc ít dùng của một văn phòng hay một phòng nằm trong menu dấu ba chấm.
	 *
	 * Vì sao không để sẵn mấy nút cạnh nhau như trước: mỗi văn phòng có hai nút và mỗi phòng có hai
	 * nút nữa, nên một công ty bốn phòng họp hiện ra mười cái nút xám giống nhau, và tên phòng —
	 * thứ người dùng thực sự tìm — chìm giữa chúng. Nay thẻ chỉ còn thông tin, việc nằm sau dấu ba
	 * chấm. Đường vẽ của icon là `d` của heroicons, đúng dạng `DropdownMenuItem` chờ.
	 */
	const ICON_PENCIL =
		'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z';
	const ICON_PLUS = 'M12 4v16m8-8H4';
	const ICON_BAN = 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636';
	const ICON_CHECK = 'M4.5 12.75l6 6 9-13.5';

	function siteActions(site: OfficeSite): DropdownMenuItem[] {
		return [
			{ label: 'Sửa văn phòng', icon: ICON_PENCIL, action: () => openSiteEdit(site) },
			{
				label: 'Thêm phòng họp',
				icon: ICON_PLUS,
				action: () => openRoomCreate(site),
				hidden: !site.isActive,
			},
			{
				label: site.isActive ? 'Ngừng dùng' : 'Dùng lại',
				icon: site.isActive ? ICON_BAN : ICON_CHECK,
				variant: site.isActive ? 'danger' : undefined,
				action: () => toggleSite(site),
			},
		];
	}

	function roomActions(room: MeetingRoom): DropdownMenuItem[] {
		return [
			{ label: 'Sửa phòng', icon: ICON_PENCIL, action: () => openRoomEdit(room) },
			{
				label: room.isActive ? 'Ngừng dùng' : 'Dùng lại',
				icon: room.isActive ? ICON_BAN : ICON_CHECK,
				variant: room.isActive ? 'danger' : undefined,
				action: () => toggleRoom(room),
			},
		];
	}

	/** Phòng nào đang chờ máy chủ trả lời cho nút Ngừng dùng hoặc Dùng lại. */
	const togglingRoomId = ref<number | null>(null);

	/**
	 * Ngừng dùng hoặc dùng lại một phòng họp.
	 *
	 * Phòng còn lượt đặt sắp tới thì máy chủ trả 409 `OFFICE_ROOM_HAS_BOOKINGS` kèm số lượt, nên
	 * hiện nguyên văn câu đó: người dùng cần biết còn mấy lượt phải dời.
	 */
	async function toggleRoom(room: MeetingRoom) {
		if (togglingRoomId.value) return;
		togglingRoomId.value = room.id;
		try {
			await service.updateRoom(room.id, { isActive: !room.isActive });
			toast.success(room.isActive ? `Đã ngừng dùng phòng ${room.name}.` : `Đã dùng lại phòng ${room.name}.`);
			await loadRooms();
		} catch (e) {
			toast.error(officeErrorMessage(e, 'Chưa đổi được trạng thái phòng họp. Bạn thử lại sau ít phút.'));
		} finally {
			togglingRoomId.value = null;
		}
	}

	const togglingSiteId = ref<number | null>(null);

	/** Ngừng dùng hoặc dùng lại một văn phòng; còn lượt sắp tới thì máy chủ cũng trả 409. */
	async function toggleSite(site: OfficeSite) {
		if (togglingSiteId.value) return;
		togglingSiteId.value = site.id;
		try {
			await service.updateSite(site.id, { isActive: !site.isActive });
			toast.success(site.isActive ? `Đã ngừng dùng ${site.name}.` : `Đã dùng lại ${site.name}.`);
			await loadSites();
		} catch (e) {
			toast.error(officeErrorMessage(e, 'Chưa đổi được trạng thái văn phòng. Bạn thử lại sau ít phút.'));
		} finally {
			togglingSiteId.value = null;
		}
	}

	// ─── Nạp dữ liệu theo thẻ đang mở ─────────────────────────────────────────────

	onMounted(() => {
		// Thẻ đầu tiên hiện cả văn phòng và phòng họp, nên nạp cả hai ngay từ đầu.
		loadSites();
		loadRooms();
		const wanted = TAB_ALIASES[String(route.query.tab ?? '')];
		if (wanted) activeTab.value = wanted;
		directoryStore.load().catch(() => {
			toast.error('Chưa tải được danh sách phòng ban, nên thẻ Định mức tạm thời chưa chọn được phòng.');
		});
	});

	/** Nạp lười phần còn lại: danh mục văn phòng phẩm chỉ gọi API khi người dùng mở thẻ của nó. */
	watch(activeTab, tab => {
		if ((tab === 'supplies' || tab === 'quotas') && !suppliesLoaded.value && !loadingSupplies.value) loadSupplies();
	});

	watch(quotaDepartmentId, () => loadQuotas());
</script>

<template>
	<div class="space-y-5">
		<UiPageHeader
			title="Cài đặt hành chính"
			description="Nơi dựng những thứ nền của phân hệ: văn phòng cùng các phòng họp trong đó, danh mục văn phòng phẩm và định mức của từng phòng ban. Mở kỳ đăng ký cần có văn phòng và danh mục mặt hàng, còn đặt phòng họp cần văn phòng và phòng, nên bạn dựng ở đây trước."
		/>

		<CommonAppModuleNotice module="OFFICE" />

		<div class="border-b border-gray-200 dark:border-gray-700">
			<nav class="-mb-px flex flex-wrap gap-1">
				<button
					v-for="tab in TABS"
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

		<!-- ── Văn phòng và phòng họp ──────────────────────────────────────── -->
		<template v-if="activeTab === 'places'">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<p class="max-w-2xl text-sm text-gray-600 dark:text-gray-400">
					Văn phòng là toà nhà hay địa điểm làm việc của công ty.
				</p>
				<CommonAppButton v-if="canEdit" variant="primary" @click="openSiteCreate">Thêm văn phòng</CommonAppButton>
			</div>

			<!-- Công tắc chỉ hiện khi có phòng đã ngừng: không có thì nó là một dòng vô nghĩa. -->
			<label
				v-if="inactiveRoomTotal > 0"
				class="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
			>
				<input
					v-model="showInactiveRooms"
					type="checkbox"
					class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
				/>
				Hiện {{ inactiveRoomTotal }} phòng đã ngừng dùng
			</label>

			<div v-if="loadingSites || loadingRooms" class="space-y-3">
				<div v-for="i in 3" :key="i" class="h-32 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
			</div>

			<!--
				Chưa có văn phòng nào: nói văn phòng là gì và phòng họp nằm ở đâu, vì đây là lúc người
				dùng dễ nhầm nhất — có người đã tạo mỗi phòng họp thành một văn phòng.
			-->
			<div
				v-else-if="!sites.length"
				class="rounded-xl border border-gray-200 bg-white px-6 py-14 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
			>
				<p class="font-medium text-gray-700 dark:text-gray-200">Công ty chưa có văn phòng nào.</p>
				<p class="mx-auto mt-2 max-w-xl leading-relaxed">
					Văn phòng là toà nhà hay địa điểm làm việc của công ty, ví dụ Văn phòng Hà Nội. Phòng họp nằm trong một văn
					phòng, nên bạn tạo văn phòng trước rồi thêm từng phòng họp vào đó.
				</p>
				<CommonAppButton v-if="canEdit" class="mt-4" variant="primary" @click="openSiteCreate">
					Thêm văn phòng đầu tiên
				</CommonAppButton>
			</div>

			<div v-else class="space-y-4">
				<!--
					Mỗi văn phòng là một khối, phòng họp của nó là các thẻ trong lưới bên trong khối. Người
					dùng thấy quan hệ "phòng nằm trong văn phòng" bằng mắt, và thêm phòng không phải chọn
					lại văn phòng. Lưới cho bốn phòng cạnh nhau đọc nhanh hơn bốn dòng xếp dọc, vì mỗi thẻ
					là một phòng có hình khối riêng chứ không phải một dòng chữ nữa trong danh sách.
				-->
				<section
					v-for="site in sites"
					:id="`site-card-${site.id}`"
					:key="site.id"
					:class="[
						'overflow-hidden rounded-xl border bg-white shadow-sm transition-colors dark:bg-gray-900',
						highlightSiteId === site.id
							? 'border-brand-500 ring-2 ring-brand-200 dark:border-brand-500 dark:ring-brand-900'
							: 'border-gray-200 dark:border-gray-700',
						site.isActive ? '' : 'opacity-70',
					]"
				>
					<div class="flex items-start justify-between gap-3 border-b border-gray-200 p-4 dark:border-gray-700">
						<div class="flex items-center gap-3">
							<div
								class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400"
							>
								<Icon name="heroicons:building-office-2" class="h-6 w-6" aria-hidden="true" />
							</div>
							<div class="min-w-0">
								<div class="flex flex-wrap items-center gap-2">
									<h3 class="font-semibold text-gray-900 dark:text-white">{{ site.name }}</h3>
									<p
										class="mt-0.5 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 px-2 py-0.5 dark:bg-gray-700 rounded-lg"
									>
										{{ siteSummary(site.id) }}
									</p>
									<span
										v-if="!site.isActive"
										class="inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
									>
										Ngừng dùng
									</span>
								</div>
								<div class="flex items-center gap-1">
									<Icon name="heroicons:map-pin" class="h-4 w-4 text-gray-500" aria-hidden="true" />
									<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
										{{ site.address || 'Chưa ghi địa chỉ' }}
									</p>
								</div>
							</div>
						</div>
						<!-- Một nút ba chấm thay cho hai nút: tên văn phòng là thứ cần nổi, không phải các nút. -->
						<UiDropdownMenu v-if="canEdit" :items="siteActions(site)" />
					</div>

					<!-- Phòng họp của văn phòng này, mỗi phòng một thẻ trong lưới. -->
					<div class="p-4">
						<p v-if="!roomsOf(site.id).length && !canEdit" class="py-2 text-sm text-gray-500 dark:text-gray-400">
							Văn phòng này chưa có phòng họp nào.
						</p>

						<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
							<article
								v-for="room in visibleRoomsOf(site.id)"
								:key="room.id"
								:class="[
									'flex flex-col gap-2 rounded-xl border p-3 transition-colors hover:border-brand-400 hover:shadow-md cursor-pointer',
									room.isActive
										? 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
										: 'border-dashed border-gray-300 bg-gray-50 opacity-60 dark:border-gray-600 dark:bg-gray-800/50',
								]"
								@click="openRoomEdit(room)"
							>
								<div class="flex items-start justify-between gap-2 border-b border-gray-200 pb-1 dark:border-gray-700">
									<div class="min-w-0">
										<div class="flex items-center gap-2">
											<div
												class="mx-auto flex h-5 w-5 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400"
											>
												<Icon
													name="fluent:conference-room-28-regular"
													class="h-4 w-4 flex-shrink-0 text-gray-600"
													aria-hidden="true"
												/>
											</div>

											<p class="truncate font-medium text-gray-900 dark:text-white">{{ room.name }}</p>
										</div>
										<span
											v-if="!room.isActive"
											class="mt-1 inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
										>
											Ngừng dùng
										</span>
									</div>
									<div @click.stop>
										<UiDropdownMenu v-if="canEdit" :items="roomActions(room)" />
									</div>
								</div>

								<!-- Sức chứa đi với icon người, nên đọc được mà không cần nhãn "Sức chứa". -->
								<p class="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
									<Icon name="heroicons:user-group" class="h-5 w-5 flex-shrink-0 text-gray-400" aria-hidden="true" />-
									Tối đa {{ room.capacity != null ? `${room.capacity} người` : 'Chưa ghi sức chứa' }}
								</p>

								<div v-if="room.equipment.length" class="flex flex-wrap gap-1.5">
									<span class="text-xs font-medium text-gray-500 dark:text-gray-400 block">
										<Icon
											name="energy-icons:control-room-20"
											class="h-5 w-5 flex-shrink-0 text-gray-400"
											aria-hidden="true"
										/> </span
									>-
									<span
										v-for="item in room.equipment"
										:key="item"
										class="inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
									>
										{{ item }}
									</span>
								</div>
								<p v-else class="text-xs text-gray-400 dark:text-gray-500">Chưa ghi thiết bị</p>

								<p v-if="room.note" class="text-xs text-gray-500 dark:text-gray-400">{{ room.note }}</p>
							</article>

							<!--
								Thẻ cuối lưới là chỗ thêm phòng, nên việc "thêm phòng" nằm đúng nơi các phòng đang
								hiện chứ không phải một cái nút rời ở đáy khối.
							-->
							<button
								v-if="canEdit && site.isActive"
								type="button"
								class="flex min-h-[7rem] flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-300 p-3 text-sm font-medium text-gray-500 transition-colors hover:border-brand-400 hover:text-brand-600 dark:border-gray-600 dark:text-gray-400 dark:hover:border-brand-500 dark:hover:text-brand-400"
								@click="openRoomCreate(site)"
							>
								<Icon name="fluent:conference-room-28-regular" class="h-5 w-5" aria-hidden="true" />
								Thêm phòng họp
							</button>
						</div>

						<p v-if="hiddenRoomCount(site.id)" class="mt-3 text-xs text-gray-500 dark:text-gray-400">
							{{ hiddenRoomCount(site.id) }} phòng đã ngừng dùng đang ẩn.
						</p>
					</div>
				</section>
			</div>
		</template>

		<!-- ── Văn phòng phẩm ──────────────────────────────────────────────── -->
		<template v-else-if="activeTab === 'supplies'">
			<!-- Nhập từ Excel -->
			<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
				<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">Nhập danh mục từ Excel</h3>
				<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
					Bạn nhập được cả file mẫu và chính file đăng ký văn phòng phẩm hằng tháng đang dùng. Dòng số La Mã là tên
					nhóm, nhóm ghi "(HCNS đặt)" thành nhóm chỉ HCNS đặt, còn nhóm ngoài danh sách thì bỏ qua. Mặt hàng trùng tên
					không bị tạo lại, chỉ điền đơn giá khi danh mục đang để trống.
				</p>
				<div class="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
					<UiFileDropzone v-model="importFile" accept=".xlsx" :max-size-mb="10" :disabled="!canEdit || importing" />
					<div class="flex flex-wrap gap-3">
						<CommonAppButton variant="outline" :loading="downloadingTemplate" @click="downloadTemplate">
							Tải file mẫu
						</CommonAppButton>
						<CommonAppButton
							v-if="canEdit"
							variant="primary"
							:disabled="!importFile"
							:loading="importing"
							@click="runImport"
						>
							Nhập danh mục
						</CommonAppButton>
					</div>
				</div>

				<div
					v-if="importResult"
					class="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-800 dark:bg-emerald-900/20"
				>
					<p class="font-medium text-emerald-800 dark:text-emerald-300">
						Thêm {{ importResult.createdItems }} mặt hàng, {{ importResult.createdGroups.length }} nhóm mới; điền đơn
						giá cho {{ importResult.updatedPrices }} mặt hàng; {{ importResult.existingItems }} mặt hàng đã có từ trước.
						<template v-if="importSkippedRows > 0">
							{{ importSkippedRows }} dòng không được nhập, bạn xem danh sách dưới.
						</template>
					</p>
					<p v-if="importResult.createdGroups.length" class="mt-1 text-emerald-700 dark:text-emerald-400">
						Nhóm mới: {{ importResult.createdGroups.join(', ') }}.
					</p>
					<!--
						`errors` gồm cả lỗi (dòng bị bỏ) lẫn cảnh báo (dòng vẫn tạo, ví dụ không hiểu được
						đơn giá nên để trống), nên tiêu đề nói chung là "chỗ cần xem lại" và danh sách hiện
						nguyên văn câu của máy chủ, mỗi câu đã có số dòng.
					-->
					<div v-if="importResult.errors.length" class="mt-2">
						<p class="font-medium text-amber-700 dark:text-amber-400">
							{{ importResult.errors.length }} chỗ cần bạn xem lại:
						</p>
						<ul class="mt-1 list-inside list-disc text-amber-700 dark:text-amber-400">
							<li v-for="(issue, idx) in importResult.errors" :key="idx">{{ issue.message }}</li>
						</ul>
					</div>
				</div>
			</div>

			<div v-if="loadingSupplies" class="space-y-3">
				<div v-for="i in 4" :key="i" class="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
			</div>

			<template v-else>
				<!-- Nhóm -->
				<div class="flex flex-wrap items-center justify-between gap-3">
					<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">
						Nhóm văn phòng phẩm
						<span class="ml-1 text-xs font-normal text-gray-400">{{ groups.length }} nhóm</span>
					</h3>
					<CommonAppButton v-if="canEdit" size="sm" variant="outline" @click="openGroupCreate"
						>Thêm nhóm</CommonAppButton
					>
				</div>

				<div
					v-if="showGroupForm"
					class="rounded-xl border border-brand-200 bg-white p-4 shadow-sm dark:border-brand-700 dark:bg-gray-900"
				>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div class="space-y-1">
							<label :class="labelCls">Tên nhóm <span class="text-red-500">*</span></label>
							<input v-model="groupForm.name" type="text" maxlength="200" :class="inputCls" placeholder="VD: Đồ uống" />
							<p v-if="groupNameError" class="text-xs text-red-500">{{ groupNameError }}</p>
						</div>
						<div class="space-y-1">
							<label :class="labelCls">Thứ tự hiện</label>
							<UiNumberInput
								v-model="groupForm.sortOrder"
								:min="0"
								:input-class="inputCls"
								placeholder="Bỏ trống thì xếp cuối"
							/>
						</div>
						<label class="flex items-center gap-2">
							<input
								v-model="groupForm.hrOnly"
								type="checkbox"
								class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
							/>
							<span class="text-sm text-gray-700 dark:text-gray-300">Chỉ HCNS đặt</span>
						</label>
						<label v-if="editingGroup" class="flex items-center gap-2">
							<input
								v-model="groupForm.isActive"
								type="checkbox"
								class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
							/>
							<span class="text-sm text-gray-700 dark:text-gray-300">Đang dùng</span>
						</label>
					</div>
					<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
						Nhóm chỉ HCNS đặt không hiện trong ô chọn của nhân viên phòng ban, chỉ HCNS thêm được khi làm phiếu bổ sung.
					</p>
					<div class="mt-4 flex justify-end gap-3">
						<CommonAppButton variant="secondary" @click="showGroupForm = false">Đóng</CommonAppButton>
						<CommonAppButton
							variant="primary"
							:disabled="!groupForm.name.trim()"
							:loading="savingGroup"
							@click="saveGroup"
						>
							Lưu
						</CommonAppButton>
					</div>
				</div>

				<div
					v-if="groups.length"
					class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
				>
					<table class="w-full text-sm">
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr v-for="group in groups" :key="group.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/40">
								<td class="px-4 py-1.5 font-medium text-gray-900 dark:text-white">{{ group.name }}</td>
								<td class="px-4 py-1.5">
									<span
										v-if="group.hrOnly"
										data-testid="hr-only-badge"
										class="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
									>
										Chỉ HCNS đặt
									</span>
								</td>
								<td class="px-4 py-1.5">
									<span
										v-if="!group.isActive"
										class="inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
									>
										Ngừng dùng
									</span>
								</td>
								<td class="px-4 py-1.5 text-right">
									<button
										v-if="canEdit"
										type="button"
										class="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
										@click="openGroupEdit(group)"
									>
										Sửa
									</button>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
				<p
					v-else
					class="rounded-xl border border-gray-200 bg-white py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
				>
					Chưa có nhóm nào. Bạn nhập file đăng ký ở trên, hoặc bấm Thêm nhóm.
				</p>

				<!-- Mặt hàng -->
				<div class="flex flex-wrap items-end justify-between gap-3 pt-2">
					<div>
						<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">
							Mặt hàng
							<span class="ml-1 text-xs font-normal text-gray-400">{{ items.length }} mặt hàng</span>
						</h3>
						<div class="mt-1 w-64">
							<UiSelectInput
								:model-value="filterGroupId ?? 0"
								:options="groupFilterOptions"
								placeholder="Tất cả nhóm"
								search-placeholder="Tìm nhóm"
								@update:model-value="onFilterGroup"
							/>
						</div>
					</div>
					<CommonAppButton v-if="canEdit && groupOptions.length" size="sm" variant="outline" @click="openItemCreate">
						Thêm mặt hàng
					</CommonAppButton>
				</div>

				<div
					v-if="showItemForm"
					class="rounded-xl border border-brand-200 bg-white p-4 shadow-sm dark:border-brand-700 dark:bg-gray-900"
				>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div class="space-y-1">
							<label :class="labelCls">Nhóm <span class="text-red-500">*</span></label>
							<UiSelectInput
								:model-value="itemForm.groupId ?? null"
								:options="groupOptions"
								placeholder="Chọn nhóm"
								search-placeholder="Tìm nhóm"
								@update:model-value="itemForm.groupId = Number($event)"
							/>
						</div>
						<div class="space-y-1">
							<label :class="labelCls">Tên mặt hàng <span class="text-red-500">*</span></label>
							<input
								v-model="itemForm.name"
								type="text"
								maxlength="255"
								:class="inputCls"
								placeholder="VD: Giấy in A4 IK Plus"
							/>
							<p v-if="itemNameError" class="text-xs text-red-500">{{ itemNameError }}</p>
						</div>
						<div class="space-y-1">
							<label :class="labelCls">Đơn vị tính <span class="text-red-500">*</span></label>
							<input v-model="itemForm.unit" type="text" maxlength="50" :class="inputCls" placeholder="VD: Tập" />
						</div>
						<div class="space-y-1">
							<label :class="labelCls">Đơn giá gồm VAT</label>
							<UiNumberInput
								v-model="itemForm.unitPrice"
								:min="0"
								:input-class="inputCls"
								placeholder="Bỏ trống nếu chưa có giá"
							/>
						</div>
						<div class="space-y-1">
							<label :class="labelCls">Thứ tự hiện</label>
							<UiNumberInput
								v-model="itemForm.sortOrder"
								:min="0"
								:input-class="inputCls"
								placeholder="Bỏ trống thì xếp cuối"
							/>
						</div>
						<label v-if="editingItem" class="flex items-center gap-2">
							<input
								v-model="itemForm.isActive"
								type="checkbox"
								class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
							/>
							<span class="text-sm text-gray-700 dark:text-gray-300">Đang dùng</span>
						</label>
					</div>
					<div class="mt-4 flex justify-end gap-3">
						<CommonAppButton variant="secondary" @click="showItemForm = false">Đóng</CommonAppButton>
						<CommonAppButton
							variant="primary"
							:disabled="!itemForm.groupId || !itemForm.name.trim() || !itemForm.unit.trim()"
							:loading="savingItem"
							@click="saveItem"
						>
							Lưu
						</CommonAppButton>
					</div>
				</div>

				<div v-if="itemsByGroup.length" class="space-y-3">
					<section
						v-for="group in itemsByGroup"
						:key="group.groupId"
						class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
					>
						<!-- Cả dòng tiêu đề là nút đóng mở, nút thêm mặt hàng đứng riêng ở bên phải. -->
						<div
							:class="[
								'flex items-center justify-between gap-2 pr-3',
								isGroupOpen(group.groupId) ? 'border-b border-gray-200 dark:border-gray-700' : '',
							]"
						>
							<button
								type="button"
								class="flex min-w-0 flex-1 items-center gap-2 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/40"
								:aria-expanded="isGroupOpen(group.groupId)"
								@click="setGroupOpen(group.groupId, !isGroupOpen(group.groupId))"
							>
								<Icon
									name="heroicons:chevron-right"
									:class="[
										'h-4 w-4 flex-shrink-0 text-gray-400 transition-transform',
										isGroupOpen(group.groupId) ? 'rotate-90' : '',
									]"
									aria-hidden="true"
								/>
								<span class="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{{
									group.groupName
								}}</span>
								<span class="flex-shrink-0 text-xs text-gray-400">{{ group.items.length }} mặt hàng</span>
								<span
									v-if="!group.isActive"
									class="inline-flex flex-shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
								>
									Ngừng dùng
								</span>
							</button>
							<!-- Nhóm ngừng dùng không nhận mặt hàng mới, giống ô chọn nhóm của form chung. -->
							<button
								v-if="canEdit && group.isActive"
								type="button"
								:class="[
									'inline-flex flex-shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
									inlineGroupId === group.groupId
										? 'bg-brand-600 text-white hover:bg-brand-700'
										: 'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-300 dark:hover:bg-brand-900/50',
								]"
								@click="toggleInlineAdd(group.groupId)"
							>
								<Icon name="heroicons:plus" class="h-3.5 w-3.5" aria-hidden="true" />
								Thêm mặt hàng
							</button>
						</div>

						<div v-if="isGroupOpen(group.groupId)" class="overflow-x-auto">
							<table class="w-full min-w-[40rem] table-fixed text-sm">
								<colgroup>
									<col />
									<col class="w-28" />
									<col class="w-36" />
									<col class="w-28" />
									<col class="w-24" />
								</colgroup>
								<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
									<!-- Enter là lưu, Esc là đóng dòng, để gõ liền một loạt mặt hàng không cần chuột. -->
									<tr
										v-if="inlineGroupId === group.groupId"
										class="bg-brand-50/60 dark:bg-brand-900/10"
										@keydown.enter.prevent="saveInlineItem"
										@keydown.esc="inlineGroupId = null"
									>
										<td class="px-4 py-1.5 align-top">
											<input
												id="inline-item-name"
												v-model="inlineItem.name"
												type="text"
												maxlength="255"
												:class="inlineInputCls"
												placeholder="Tên mặt hàng"
											/>
											<p v-if="inlineNameError" class="mt-1 text-xs text-red-500">{{ inlineNameError }}</p>
										</td>
										<td class="px-2 py-1.5 align-top">
											<input
												v-model="inlineItem.unit"
												type="text"
												maxlength="50"
												:class="inlineInputCls"
												placeholder="Đơn vị"
											/>
										</td>
										<td class="px-2 py-1.5 align-top">
											<UiNumberInput
												v-model="inlineItem.unitPrice"
												:min="0"
												:input-class="inlineInputCls"
												placeholder="Đơn giá"
											/>
										</td>
										<td colspan="2" class="px-4 py-1.5 text-right align-top">
											<div class="flex justify-end gap-2">
												<CommonAppButton size="sm" variant="ghost" @click="inlineGroupId = null">Huỷ</CommonAppButton>
												<CommonAppButton
													size="sm"
													variant="primary"
													:disabled="!inlineItem.name.trim() || !inlineItem.unit.trim()"
													:loading="savingInline"
													@click="saveInlineItem"
												>
													Lưu
												</CommonAppButton>
											</div>
										</td>
									</tr>
									<tr v-for="item in group.items" :key="item.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/40">
										<td class="truncate px-4 py-1.5 text-gray-900 dark:text-white">{{ item.name }}</td>
										<td class="px-4 py-1.5 text-gray-600 dark:text-gray-300">{{ item.unit }}</td>
										<td class="px-4 py-1.5 text-right text-gray-600 dark:text-gray-300">
											{{ officeMoney(item.unitPrice) }}
										</td>
										<td class="px-4 py-1.5">
											<span
												v-if="!item.isActive"
												class="inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
											>
												Ngừng dùng
											</span>
										</td>
										<td class="px-4 py-1.5 text-right">
											<button
												v-if="canEdit"
												type="button"
												class="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
												@click="openItemEdit(item)"
											>
												Sửa
											</button>
										</td>
									</tr>
									<tr v-if="!group.items.length && inlineGroupId !== group.groupId">
										<td colspan="5" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">
											Nhóm này chưa có mặt hàng nào.
										</td>
									</tr>
								</tbody>
							</table>
						</div>
					</section>
				</div>
				<p
					v-else
					class="rounded-xl border border-gray-200 bg-white py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
				>
					Chưa có mặt hàng nào trong danh mục.
				</p>
			</template>
		</template>

		<!-- ── Định mức theo phòng ─────────────────────────────────────────── -->
		<template v-else-if="activeTab === 'quotas'">
			<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
				<p class="text-sm text-gray-600 dark:text-gray-400">
					Định mức là số tối đa mỗi tháng của một phòng cho một mặt hàng. Nhân viên xin quá số này vẫn gửi được nhưng
					phải ghi lý do, và HCNS thấy ngay dòng vượt định mức khi chốt phiếu.
				</p>
				<div class="mt-3 max-w-md">
					<label :class="labelCls">Phòng ban</label>
					<UiSelectInput
						:model-value="quotaDepartmentId ?? null"
						:options="departmentOptions"
						placeholder="Chọn phòng ban"
						search-placeholder="Tìm phòng ban"
						@update:model-value="quotaDepartmentId = Number($event)"
					/>
				</div>
			</div>

			<p
				v-if="!quotaDepartmentId"
				class="rounded-xl border border-gray-200 bg-white py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
			>
				Bạn chọn một phòng ban để xem và sửa định mức của phòng đó.
			</p>

			<div v-else-if="loadingQuotas" class="space-y-3">
				<div v-for="i in 3" :key="i" class="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
			</div>

			<div
				v-else
				class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
			>
				<div class="space-y-3">
					<!--
						Trên điện thoại ba phần xếp dọc, và ô số có nhãn riêng: một ô số đứng dưới tên mặt hàng
						với chữ mờ "Số mỗi tháng" bên trong thì người dùng không biết đang nhập định mức.
					-->
					<div
						v-for="(row, index) in quotaRows"
						:key="index"
						class="grid grid-cols-1 gap-2 rounded-lg border border-gray-100 p-3 sm:grid-cols-[1fr_160px_auto] sm:items-end sm:border-0 sm:p-0 dark:border-gray-800"
					>
						<div class="space-y-1">
							<label class="block text-xs font-medium text-gray-600 dark:text-gray-400">Mặt hàng</label>
							<UiSelectInput
								:model-value="row.itemId ?? null"
								:options="quotaItemOptions"
								placeholder="Chọn mặt hàng"
								search-placeholder="Tìm mặt hàng"
								:disabled="!canEdit"
								@update:model-value="row.itemId = Number($event)"
							/>
						</div>
						<UiNumberInput
							v-model="row.monthlyQty"
							:min="0"
							:disabled="!canEdit"
							label="Định mức mỗi tháng"
							placeholder="VD: 10"
						/>
						<CommonAppButton v-if="canEdit" size="sm" variant="ghost" @click="removeQuotaRow(index)"
							>Bỏ dòng</CommonAppButton
						>
					</div>
					<p v-if="!quotaRows.length" class="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
						Phòng này chưa có định mức nào.
					</p>
				</div>
				<div v-if="canEdit" class="mt-4 flex flex-wrap justify-between gap-3">
					<CommonAppButton variant="outline" :disabled="!quotaItemOptions.length" @click="addQuotaRow"
						>Thêm dòng</CommonAppButton
					>
					<CommonAppButton variant="primary" :loading="savingQuotas" @click="saveQuotas">Lưu định mức</CommonAppButton>
				</div>
				<p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
					Lưu là thay toàn bộ định mức của phòng bằng các dòng đang hiện, nên dòng bạn bỏ đi sẽ không còn định mức.
				</p>
			</div>
		</template>

		<!--
			Thêm và sửa văn phòng đi qua hộp thoại: form chen trong trang mở ra ngay phía trên các thẻ
			nên trông như đang dựng thêm một thẻ văn phòng nữa.
		-->
		<SiteFormModal
			v-if="showSiteForm"
			:site="editingSite"
			:sites="sites"
			@saved="onSiteSaved"
			@go-to-site="onGoToSite"
			@close="showSiteForm = false"
		/>

		<!-- Phòng họp cũng đi qua hộp thoại, mở từ thẻ nét đứt trong lưới của văn phòng. -->
		<RoomFormModal
			v-if="roomFormSite"
			:room="editingRoom"
			:site="roomFormSite"
			:equipment-suggestions="equipmentSuggestions"
			@saved="onRoomSaved"
			@close="closeRoomForm"
		/>
	</div>
</template>
