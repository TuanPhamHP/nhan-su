<script setup lang="ts">
	import { useOfficeService } from '~/services/office.service';
	import { downloadOfficeFile, officeErrorCode, officeErrorMessage, officeMoney } from '~/utils/office.utils';
	import { vnSearchText } from '~/utils/vn-text';
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
	const showSiteForm = ref(false);
	const editingSite = ref<OfficeSite | null>(null);
	const savingSite = ref(false);
	const siteNameError = ref('');
	/** Câu gợi ý khi tên văn phòng đã có: chỉ người dùng sang thẻ của văn phòng đó mà thêm phòng. */
	const siteNameHint = ref('');
	/** Thẻ văn phòng được tô sáng và cuộn tới, sau khi người dùng gõ trùng tên. */
	const highlightSiteId = ref<number | null>(null);
	const siteForm = reactive({ name: '', address: '', isActive: true });

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
		siteNameError.value = '';
		siteNameHint.value = '';
		Object.assign(siteForm, { name: '', address: '', isActive: true });
		showSiteForm.value = true;
	}

	function openSiteEdit(site: OfficeSite) {
		editingSite.value = site;
		siteNameError.value = '';
		siteNameHint.value = '';
		Object.assign(siteForm, { name: site.name, address: site.address ?? '', isActive: site.isActive });
		showSiteForm.value = true;
	}

	/**
	 * Người dùng gõ trùng tên văn phòng: đưa họ tới đúng thẻ của văn phòng đã có.
	 *
	 * Người gặp lỗi này thường đang muốn thêm một PHÒNG HỌP mới cho văn phòng đó, nên chỉ nói
	 * "tên đã có" là bỏ họ lại giữa đường; cuộn tới thẻ và tô sáng nó thì việc cần làm nằm ngay
	 * trước mắt.
	 */
	function pointToExistingSite(name: string) {
		const target = sites.value.find(site => vnSearchText(site.name) === vnSearchText(name));
		if (!target) return;
		siteNameHint.value = `Văn phòng này đã có trong danh sách. Bạn bấm "Thêm phòng họp" trong thẻ ${target.name} để thêm phòng cho nó.`;
		highlightSiteId.value = target.id;
		nextTick(() => {
			document.getElementById(`site-card-${target.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		});
	}

	async function saveSite() {
		if (!siteForm.name.trim() || savingSite.value) return;
		savingSite.value = true;
		siteNameError.value = '';
		siteNameHint.value = '';
		highlightSiteId.value = null;
		try {
			if (editingSite.value) {
				await service.updateSite(editingSite.value.id, {
					name: siteForm.name.trim(),
					address: siteForm.address.trim() || undefined,
					isActive: siteForm.isActive,
				});
			} else {
				await service.createSite({ name: siteForm.name.trim(), address: siteForm.address.trim() || undefined });
			}
			toast.success(`Đã lưu văn phòng ${siteForm.name.trim()}.`);
			showSiteForm.value = false;
			await loadSites();
		} catch (e) {
			// Trùng tên là lỗi của ĐÚNG một ô, nên câu lỗi phải nằm ngay dưới ô tên chứ không
			// chỉ thoáng qua ở toast rồi người dùng không biết sửa chỗ nào.
			if (officeErrorCode(e) === 'OFFICE_SITE_NAME_EXISTS') {
				siteNameError.value = officeErrorMessage(e, 'Tên văn phòng này đã có.');
				pointToExistingSite(siteForm.name.trim());
			} else {
				// Ngừng văn phòng còn lượt đặt sắp tới: câu của máy chủ nêu rõ còn bao nhiêu lượt.
				toast.error(officeErrorMessage(e, 'Chưa lưu được văn phòng. Bạn thử lại sau ít phút.'));
			}
		} finally {
			savingSite.value = false;
		}
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

	async function loadSupplies() {
		loadingSupplies.value = true;
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

	const visibleItems = computed(() =>
		filterGroupId.value ? items.value.filter(i => i.groupId === filterGroupId.value) : items.value,
	);

	/** Mặt hàng xếp theo nhóm, giữ thứ tự máy chủ trả về trong từng nhóm. */
	const itemsByGroup = computed(() => {
		const map = new Map<string, SupplyItem[]>();
		for (const item of visibleItems.value) {
			const list = map.get(item.groupName) ?? [];
			list.push(item);
			map.set(item.groupName, list);
		}
		return [...map.entries()].map(([groupName, groupItems]) => ({ groupName, items: groupItems }));
	});

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
			toast.success(
				`Đã nhập xong: thêm ${result.createdItems} mặt hàng và ${result.createdGroups.length} nhóm mới.`,
			);
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
	 * Văn phòng nào đang mở form thêm hoặc sửa phòng; `null` là không mở ở đâu cả.
	 *
	 * Form nằm TRONG thẻ của văn phòng, nên nó không cần ô chọn văn phòng nữa: người dùng bấm
	 * "Thêm phòng họp" ở thẻ nào thì phòng mới thuộc văn phòng đó.
	 */
	const roomFormSiteId = ref<number | null>(null);
	const editingRoom = ref<MeetingRoom | null>(null);
	const savingRoom = ref(false);
	const roomNameError = ref('');
	/**
	 * Ô Tên phòng, để sau khi lưu con trỏ về đây cho người dùng gõ liền phòng kế tiếp.
	 *
	 * Gán bằng HÀM chứ không bằng `ref="..."`: ô nằm trong `v-for` của các thẻ văn phòng, mà ref
	 * dạng chuỗi trong `v-for` cho ra một MẢNG phần tử, nên `.focus()` gọi thẳng sẽ ném lỗi. Mỗi
	 * lúc chỉ có một form mở, nên giữ đúng một phần tử là đủ.
	 */
	const roomNameInput = ref<HTMLInputElement | null>(null);

	function setRoomNameInput(el: unknown) {
		roomNameInput.value = el instanceof HTMLInputElement ? el : null;
	}
	const roomForm = reactive({
		officeSiteId: undefined as number | undefined,
		name: '',
		capacity: undefined as number | undefined,
		/** Thiết bị gõ bằng dấu phẩy, vì danh sách thiết bị không có danh mục riêng. */
		equipment: '',
		note: '',
		sortOrder: undefined as number | undefined,
		isActive: true,
	});

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

	/** Phòng họp của một văn phòng, theo ID chứ không theo tên: tên văn phòng có thể đổi. */
	function roomsOf(siteId: number): MeetingRoom[] {
		return rooms.value.filter(room => room.officeSiteId === siteId);
	}

	/** Mở form thêm phòng ngay trong thẻ của văn phòng, văn phòng đã chọn sẵn. */
	function openRoomCreate(site: OfficeSite) {
		editingRoom.value = null;
		roomNameError.value = '';
		Object.assign(roomForm, {
			officeSiteId: site.id,
			name: '',
			capacity: undefined,
			equipment: '',
			note: '',
			sortOrder: undefined,
			isActive: true,
		});
		roomFormSiteId.value = site.id;
		nextTick(() => roomNameInput.value?.focus());
	}

	function openRoomEdit(room: MeetingRoom) {
		editingRoom.value = room;
		roomNameError.value = '';
		Object.assign(roomForm, {
			officeSiteId: room.officeSiteId,
			name: room.name,
			capacity: room.capacity ?? undefined,
			equipment: room.equipment.join(', '),
			note: room.note ?? '',
			sortOrder: room.sortOrder,
			isActive: room.isActive,
		});
		roomFormSiteId.value = room.officeSiteId;
		nextTick(() => roomNameInput.value?.focus());
	}

	function closeRoomForm() {
		roomFormSiteId.value = null;
		editingRoom.value = null;
		roomNameError.value = '';
	}

	function equipmentList(): string[] {
		return roomForm.equipment
			.split(',')
			.map(part => part.trim())
			.filter(Boolean);
	}

	async function saveRoom() {
		if (!roomForm.officeSiteId || !roomForm.name.trim() || savingRoom.value) return;
		savingRoom.value = true;
		roomNameError.value = '';
		try {
			if (editingRoom.value) {
				await service.updateRoom(editingRoom.value.id, {
					officeSiteId: roomForm.officeSiteId,
					name: roomForm.name.trim(),
					capacity: roomForm.capacity,
					equipment: equipmentList(),
					note: roomForm.note.trim(),
					sortOrder: roomForm.sortOrder,
					isActive: roomForm.isActive,
				});
			} else {
				await service.createRoom({
					officeSiteId: roomForm.officeSiteId,
					name: roomForm.name.trim(),
					capacity: roomForm.capacity,
					equipment: equipmentList(),
					note: roomForm.note.trim() || undefined,
					sortOrder: roomForm.sortOrder,
				});
			}
			const justSaved = roomForm.name.trim();
			const wasEditing = !!editingRoom.value;
			toast.success(`Đã lưu phòng họp ${justSaved}.`);
			await loadRooms();
			if (wasEditing) {
				closeRoomForm();
			} else {
				// Thêm xong thì GIỮ FORM MỞ, xoá trắng các ô và đưa con trỏ về ô Tên: một văn phòng
				// thường có vài phòng họp, và bắt người dùng bấm "Thêm phòng họp" lại cho từng phòng
				// là bắt họ làm cùng một việc bốn lần.
				Object.assign(roomForm, {
					name: '',
					capacity: undefined,
					equipment: '',
					note: '',
					sortOrder: undefined,
					isActive: true,
				});
				nextTick(() => roomNameInput.value?.focus());
			}
		} catch (e) {
			if (officeErrorCode(e) === 'OFFICE_ROOM_NAME_EXISTS') {
				roomNameError.value = officeErrorMessage(e, 'Văn phòng này đã có phòng họp tên như vậy.');
			} else {
				// `OFFICE_ROOM_HAS_BOOKINGS` khi ngừng phòng còn lượt sắp tới: câu của máy chủ nêu
				// số lượt, nên hiện nguyên văn thay vì câu chung của trang.
				toast.error(officeErrorMessage(e, 'Chưa lưu được phòng họp. Bạn thử lại sau ít phút.'));
			}
		} finally {
			savingRoom.value = false;
		}
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
				<p class="text-sm text-gray-600 dark:text-gray-400">
					Văn phòng là toà nhà hay địa điểm làm việc của công ty. Phòng họp nằm trong một văn phòng, và bạn thêm
					phòng ngay trong thẻ của văn phòng đó.
				</p>
				<CommonAppButton v-if="canEdit" variant="primary" @click="openSiteCreate">Thêm văn phòng</CommonAppButton>
			</div>

			<div
				v-if="showSiteForm"
				class="rounded-xl border border-brand-200 bg-white p-4 shadow-sm dark:border-brand-700 dark:bg-gray-900"
			>
				<h3 class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
					{{ editingSite ? `Sửa văn phòng ${editingSite.name}` : 'Thêm văn phòng' }}
				</h3>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div class="space-y-1">
						<label :class="labelCls">Tên văn phòng <span class="text-red-500">*</span></label>
						<input v-model="siteForm.name" type="text" maxlength="200" :class="inputCls" placeholder="VD: Văn phòng Hữu Nghị" />
						<p v-if="siteNameError" class="text-xs text-red-500">{{ siteNameError }}</p>
					</div>
					<div class="space-y-1">
						<label :class="labelCls">Địa chỉ</label>
						<!-- Địa chỉ là địa chỉ của TOÀ NHÀ: ví dụ phải là đường phố, không phải tầng và số phòng. -->
						<input
							v-model="siteForm.address"
							type="text"
							maxlength="255"
							:class="inputCls"
							placeholder="VD: 25 Lý Thường Kiệt, Hoàn Kiếm"
						/>
					</div>
					<label v-if="editingSite" class="flex items-center gap-2">
						<input v-model="siteForm.isActive" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
						<span class="text-sm text-gray-700 dark:text-gray-300">Đang dùng</span>
					</label>
				</div>
				<!-- Nhắc trước điều người dùng hay nhầm: tầng và số phòng là phòng họp, không phải văn phòng. -->
				<p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
					Tầng, số phòng là phòng họp: bạn thêm vào văn phòng ở bước sau.
				</p>
				<p v-if="siteNameHint" class="mt-2 text-sm text-amber-700 dark:text-amber-300">{{ siteNameHint }}</p>
				<div class="mt-4 flex justify-end gap-3">
					<CommonAppButton variant="secondary" @click="showSiteForm = false">Đóng</CommonAppButton>
					<CommonAppButton variant="primary" :disabled="!siteForm.name.trim()" :loading="savingSite" @click="saveSite">
						Lưu
					</CommonAppButton>
				</div>
			</div>

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
					Văn phòng là toà nhà hay địa điểm làm việc của công ty, ví dụ Văn phòng Hà Nội. Phòng họp nằm trong một
					văn phòng, nên bạn tạo văn phòng trước rồi thêm từng phòng họp vào đó.
				</p>
				<CommonAppButton v-if="canEdit" class="mt-4" variant="primary" @click="openSiteCreate">
					Thêm văn phòng đầu tiên
				</CommonAppButton>
			</div>

			<div v-else class="space-y-4">
				<!--
					Mỗi văn phòng là một thẻ, phòng họp của nó nằm ngay trong thẻ. Người dùng thấy quan hệ
					"phòng nằm trong văn phòng" bằng mắt, và thêm phòng không phải chọn lại văn phòng.
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
					<div class="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 p-4 dark:border-gray-700">
						<div class="min-w-0">
							<div class="flex flex-wrap items-center gap-2">
								<h3 class="font-semibold text-gray-900 dark:text-white">{{ site.name }}</h3>
								<span
									v-if="!site.isActive"
									class="inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
								>
									Ngừng dùng
								</span>
							</div>
							<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
								{{ site.address || 'Chưa ghi địa chỉ' }}
							</p>
							<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
								{{ roomsOf(site.id).length }} phòng họp
							</p>
						</div>
						<div v-if="canEdit" class="flex flex-wrap gap-2">
							<CommonAppButton size="sm" variant="outline" @click="openSiteEdit(site)">Sửa</CommonAppButton>
							<CommonAppButton
								size="sm"
								:variant="site.isActive ? 'ghost' : 'outline'"
								:loading="togglingSiteId === site.id"
								@click="toggleSite(site)"
							>
								{{ site.isActive ? 'Ngừng dùng' : 'Dùng lại' }}
							</CommonAppButton>
						</div>
					</div>

					<!-- Phòng họp của văn phòng này -->
					<div class="divide-y divide-gray-100 dark:divide-gray-800">
						<p v-if="!roomsOf(site.id).length" class="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
							Văn phòng này chưa có phòng họp nào.
						</p>
						<div
							v-for="room in roomsOf(site.id)"
							:key="room.id"
							:class="[
								'flex flex-wrap items-start justify-between gap-3 px-4 py-3',
								room.isActive ? '' : 'opacity-60',
							]"
						>
							<div class="min-w-0">
								<div class="flex flex-wrap items-center gap-2">
									<p class="font-medium text-gray-900 dark:text-white">{{ room.name }}</p>
									<span
										v-if="!room.isActive"
										class="inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
									>
										Ngừng dùng
									</span>
								</div>
								<p class="mt-0.5 text-sm text-gray-600 dark:text-gray-300">
									{{ room.capacity != null ? `${room.capacity} người` : 'Chưa ghi sức chứa' }} ·
									{{ room.equipment.length ? room.equipment.join(', ') : 'Chưa ghi thiết bị' }}
								</p>
								<p v-if="room.note" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ room.note }}</p>
							</div>
							<div v-if="canEdit" class="flex flex-wrap gap-2">
								<CommonAppButton size="sm" variant="outline" @click="openRoomEdit(room)">Sửa</CommonAppButton>
								<CommonAppButton
									size="sm"
									:variant="room.isActive ? 'ghost' : 'outline'"
									:loading="togglingRoomId === room.id"
									@click="toggleRoom(room)"
								>
									{{ room.isActive ? 'Ngừng dùng' : 'Dùng lại' }}
								</CommonAppButton>
							</div>
						</div>
					</div>

					<!-- Form thêm, sửa phòng: mở NGAY TRONG thẻ nên không cần ô chọn văn phòng. -->
					<div
						v-if="roomFormSiteId === site.id"
						class="border-t border-brand-200 bg-brand-50/40 p-4 dark:border-brand-800 dark:bg-brand-900/10"
					>
						<h4 class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
							{{ editingRoom ? `Sửa phòng ${editingRoom.name}` : `Thêm phòng họp cho ${site.name}` }}
						</h4>
						<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div class="space-y-1">
								<label :class="labelCls">Tên phòng <span class="text-red-500">*</span></label>
								<!-- Enter là lưu: người dùng gõ liền vài phòng thì không phải rời tay khỏi bàn phím. -->
								<input
									:ref="setRoomNameInput"
									v-model="roomForm.name"
									type="text"
									maxlength="200"
									:class="inputCls"
									placeholder="VD: Phòng họp tầng 3"
									@keydown.enter.prevent="saveRoom"
								/>
								<p v-if="roomNameError" class="text-xs text-red-500">{{ roomNameError }}</p>
							</div>
							<div class="space-y-1">
								<label :class="labelCls">Sức chứa</label>
								<UiNumberInput v-model="roomForm.capacity" :min="1" :input-class="inputCls" placeholder="Số người" />
							</div>
							<div class="space-y-1">
								<label :class="labelCls">Thiết bị</label>
								<input v-model="roomForm.equipment" type="text" :class="inputCls" placeholder="Máy chiếu, Bảng trắng" />
								<p class="text-xs text-gray-500 dark:text-gray-400">Mỗi thiết bị cách nhau một dấu phẩy.</p>
							</div>
							<div class="space-y-1">
								<label :class="labelCls">Ghi chú</label>
								<input v-model="roomForm.note" type="text" maxlength="255" :class="inputCls" placeholder="VD: Mượn chìa khoá ở lễ tân" />
							</div>
							<div class="space-y-1">
								<label :class="labelCls">Thứ tự hiện</label>
								<UiNumberInput v-model="roomForm.sortOrder" :min="0" :input-class="inputCls" placeholder="Bỏ trống thì xếp cuối" />
							</div>
							<label v-if="editingRoom" class="flex items-center gap-2">
								<input v-model="roomForm.isActive" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
								<span class="text-sm text-gray-700 dark:text-gray-300">Đang dùng</span>
							</label>
						</div>
						<div class="mt-4 flex flex-wrap justify-end gap-3">
							<CommonAppButton variant="secondary" @click="closeRoomForm">Đóng</CommonAppButton>
							<CommonAppButton variant="primary" :disabled="!roomForm.name.trim()" :loading="savingRoom" @click="saveRoom">
								{{ editingRoom ? 'Lưu' : 'Lưu và thêm phòng nữa' }}
							</CommonAppButton>
						</div>
					</div>

					<div v-else-if="canEdit && site.isActive" class="border-t border-gray-100 p-4 dark:border-gray-800">
						<CommonAppButton size="sm" variant="outline" @click="openRoomCreate(site)">Thêm phòng họp</CommonAppButton>
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
					Bạn nhập được cả file mẫu và chính file đăng ký văn phòng phẩm hằng tháng đang dùng. Dòng số La Mã là
					tên nhóm, nhóm ghi "(HCNS đặt)" thành nhóm chỉ HCNS đặt, còn nhóm ngoài danh sách thì bỏ qua. Mặt hàng
					trùng tên không bị tạo lại, chỉ điền đơn giá khi danh mục đang để trống.
				</p>
				<div class="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
					<UiFileDropzone v-model="importFile" accept=".xlsx" :max-size-mb="10" :disabled="!canEdit || importing" />
					<div class="flex flex-wrap gap-3">
						<CommonAppButton variant="outline" :loading="downloadingTemplate" @click="downloadTemplate">
							Tải file mẫu
						</CommonAppButton>
						<CommonAppButton v-if="canEdit" variant="primary" :disabled="!importFile" :loading="importing" @click="runImport">
							Nhập danh mục
						</CommonAppButton>
					</div>
				</div>

				<div
					v-if="importResult"
					class="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-800 dark:bg-emerald-900/20"
				>
					<p class="font-medium text-emerald-800 dark:text-emerald-300">
						Thêm {{ importResult.createdItems }} mặt hàng, {{ importResult.createdGroups.length }} nhóm mới; điền
						đơn giá cho {{ importResult.updatedPrices }} mặt hàng; {{ importResult.existingItems }} mặt hàng đã
						có từ trước.
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
					<CommonAppButton v-if="canEdit" size="sm" variant="outline" @click="openGroupCreate">Thêm nhóm</CommonAppButton>
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
							<UiNumberInput v-model="groupForm.sortOrder" :min="0" :input-class="inputCls" placeholder="Bỏ trống thì xếp cuối" />
						</div>
						<label class="flex items-center gap-2">
							<input v-model="groupForm.hrOnly" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
							<span class="text-sm text-gray-700 dark:text-gray-300">Chỉ HCNS đặt</span>
						</label>
						<label v-if="editingGroup" class="flex items-center gap-2">
							<input v-model="groupForm.isActive" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
							<span class="text-sm text-gray-700 dark:text-gray-300">Đang dùng</span>
						</label>
					</div>
					<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
						Nhóm chỉ HCNS đặt không hiện trong ô chọn của nhân viên phòng ban, chỉ HCNS thêm được khi làm phiếu bổ sung.
					</p>
					<div class="mt-4 flex justify-end gap-3">
						<CommonAppButton variant="secondary" @click="showGroupForm = false">Đóng</CommonAppButton>
						<CommonAppButton variant="primary" :disabled="!groupForm.name.trim()" :loading="savingGroup" @click="saveGroup">
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
								<td class="px-4 py-3 font-medium text-gray-900 dark:text-white">{{ group.name }}</td>
								<td class="px-4 py-3">
									<span
										v-if="group.hrOnly"
										data-testid="hr-only-badge"
										class="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
									>
										Chỉ HCNS đặt
									</span>
								</td>
								<td class="px-4 py-3">
									<span
										v-if="!group.isActive"
										class="inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
									>
										Ngừng dùng
									</span>
								</td>
								<td class="px-4 py-3 text-right">
									<CommonAppButton v-if="canEdit" size="sm" variant="outline" @click="openGroupEdit(group)">Sửa</CommonAppButton>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
				<p v-else class="rounded-xl border border-gray-200 bg-white py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
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
								@update:model-value="filterGroupId = Number($event) || undefined"
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
							<input v-model="itemForm.name" type="text" maxlength="255" :class="inputCls" placeholder="VD: Giấy in A4 IK Plus" />
							<p v-if="itemNameError" class="text-xs text-red-500">{{ itemNameError }}</p>
						</div>
						<div class="space-y-1">
							<label :class="labelCls">Đơn vị tính <span class="text-red-500">*</span></label>
							<input v-model="itemForm.unit" type="text" maxlength="50" :class="inputCls" placeholder="VD: Tập" />
						</div>
						<div class="space-y-1">
							<label :class="labelCls">Đơn giá gồm VAT</label>
							<UiNumberInput v-model="itemForm.unitPrice" :min="0" :input-class="inputCls" placeholder="Bỏ trống nếu chưa có giá" />
						</div>
						<div class="space-y-1">
							<label :class="labelCls">Thứ tự hiện</label>
							<UiNumberInput v-model="itemForm.sortOrder" :min="0" :input-class="inputCls" placeholder="Bỏ trống thì xếp cuối" />
						</div>
						<label v-if="editingItem" class="flex items-center gap-2">
							<input v-model="itemForm.isActive" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
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

				<div v-if="itemsByGroup.length" class="space-y-4">
					<section
						v-for="group in itemsByGroup"
						:key="group.groupName"
						class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
					>
						<h4 class="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800 dark:border-gray-700 dark:text-gray-100">
							{{ group.groupName }}
							<span class="ml-1 text-xs font-normal text-gray-400">{{ group.items.length }} mặt hàng</span>
						</h4>
						<table class="w-full text-sm">
							<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
								<tr v-for="item in group.items" :key="item.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/40">
									<td class="px-4 py-2.5 text-gray-900 dark:text-white">{{ item.name }}</td>
									<td class="px-4 py-2.5 text-gray-600 dark:text-gray-300">{{ item.unit }}</td>
									<td class="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">
										{{ officeMoney(item.unitPrice) }}
									</td>
									<td class="px-4 py-2.5">
										<span
											v-if="!item.isActive"
											class="inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
										>
											Ngừng dùng
										</span>
									</td>
									<td class="px-4 py-2.5 text-right">
										<CommonAppButton v-if="canEdit" size="sm" variant="outline" @click="openItemEdit(item)">Sửa</CommonAppButton>
									</td>
								</tr>
							</tbody>
						</table>
					</section>
				</div>
				<p v-else class="rounded-xl border border-gray-200 bg-white py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
					Chưa có mặt hàng nào trong danh mục.
				</p>
			</template>
		</template>

		<!-- ── Định mức theo phòng ─────────────────────────────────────────── -->
		<template v-else-if="activeTab === 'quotas'">
			<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
				<p class="text-sm text-gray-600 dark:text-gray-400">
					Định mức là số tối đa mỗi tháng của một phòng cho một mặt hàng. Nhân viên xin quá số này vẫn gửi được
					nhưng phải ghi lý do, và HCNS thấy ngay dòng vượt định mức khi chốt phiếu.
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

			<p v-if="!quotaDepartmentId" class="rounded-xl border border-gray-200 bg-white py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
				Bạn chọn một phòng ban để xem và sửa định mức của phòng đó.
			</p>

			<div v-else-if="loadingQuotas" class="space-y-3">
				<div v-for="i in 3" :key="i" class="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
			</div>

			<div v-else class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
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
							<label class="block text-xs font-medium text-gray-600 sm:hidden dark:text-gray-400">Mặt hàng</label>
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
						<CommonAppButton v-if="canEdit" size="sm" variant="ghost" @click="removeQuotaRow(index)">Bỏ dòng</CommonAppButton>
					</div>
					<p v-if="!quotaRows.length" class="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
						Phòng này chưa có định mức nào.
					</p>
				</div>
				<div v-if="canEdit" class="mt-4 flex flex-wrap justify-between gap-3">
					<CommonAppButton variant="outline" :disabled="!quotaItemOptions.length" @click="addQuotaRow">Thêm dòng</CommonAppButton>
					<CommonAppButton variant="primary" :loading="savingQuotas" @click="saveQuotas">Lưu định mức</CommonAppButton>
				</div>
				<p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
					Lưu là thay toàn bộ định mức của phòng bằng các dòng đang hiện, nên dòng bạn bỏ đi sẽ không còn định mức.
				</p>
			</div>
		</template>
	</div>
</template>
