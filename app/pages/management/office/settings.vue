<script setup lang="ts">
	import RoomFormModal from '~/components/modules/office/RoomFormModal.vue';
	import SiteFormModal from '~/components/modules/office/SiteFormModal.vue';
	import SupplyCatalogTab from '~/components/modules/office/SupplyCatalogTab.vue';
	import { SUPPLY_CATALOG_KEY, useSupplyCatalog } from '~/composables/useSupplyCatalog';
	import type { DropdownMenuItem } from '~/components/ui/DropdownMenu.vue';
	import { useOfficeService } from '~/services/office.service';
	import { officeErrorMessage } from '~/utils/office.utils';
	import { officeSupplyCatalogTour, officeSupplyQuotaTour, type OfficeSettingsTourContext } from '~/tours/office-settings';
	import type {
		MeetingRoom,
		OfficeSite,
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

	// ─── Văn phòng phẩm: danh mục ─────────────────────────────────────────────────

	/**
	 * Một bản danh mục cho cả trang: thẻ Văn phòng phẩm `inject` nó, thẻ Định mức đọc danh sách mặt
	 * hàng từ chính bản này.
	 */
	const supplyCatalog = useSupplyCatalog();
	provide(SUPPLY_CATALOG_KEY, supplyCatalog);
	const { groups, items, loadingSupplies, suppliesLoaded, loadSupplies } = supplyCatalog;

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

	// ─── Hướng dẫn theo tính năng ─────────────────────────────────────────────────
	// Mở từ nút Hướng dẫn nổi bên phải, không tự hiện.
	const tourContext: OfficeSettingsTourContext = {
		showTab: tab => (activeTab.value = tab),
		canEdit: () => canEdit.value,
		hasGroups: () => groups.value.length > 0,
		hasQuotaDepartment: () => !!quotaDepartmentId.value,
	};
	useGuideTour('office-supply-catalog', () => officeSupplyCatalogTour(tourContext));
	useGuideTour('office-supply-quota', () => officeSupplyQuotaTour(tourContext));

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
			description="Nơi dựng những thứ nền của phân hệ: văn phòng cùng các phòng họp trong đó, danh mục văn phòng phẩm và định mức của từng phòng ban. Mở kỳ đăng ký cần có văn phòng và danh mục mặt hàng, còn đặt phòng họp cần văn phòng và phòng, nên bạn dựng ở đây trước. Ở thẻ Văn phòng phẩm, danh mục hiện ngay đầu để tìm, lọc và sửa giá; nhập từ Excel nằm ở nút Nhập từ Excel."
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
		<SupplyCatalogTab v-else-if="activeTab === 'supplies'" />

		<!-- ── Định mức theo phòng ─────────────────────────────────────────── -->
		<template v-else-if="activeTab === 'quotas'">
			<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
				<p class="text-sm text-gray-600 dark:text-gray-400">
					Định mức là số tối đa mỗi tháng của một phòng cho một mặt hàng. Nhân viên xin quá số này vẫn gửi được nhưng
					phải ghi lý do, và HCNS thấy ngay dòng vượt định mức khi chốt phiếu.
				</p>
				<div data-tour="quota-department" class="mt-3 max-w-md">
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
				data-tour="quota-rows"
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
