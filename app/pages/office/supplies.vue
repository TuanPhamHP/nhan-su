<script setup lang="ts">
	import QtyInput from '~/components/modules/office/QtyInput.vue';
	import SupplyReceiveModal from '~/components/modules/office/SupplyReceiveModal.vue';
	import { useOfficeService } from '~/services/office.service';
	import {
		QTY_INTEGER_MESSAGE,
		copyPreviousSummary,
		lockCountdown,
		monthLabel,
		officeErrorCode,
		officeErrorMessage,
		officeErrorStatus,
		officeMoney,
	} from '~/utils/office.utils';
	import { formatDate, formatDateTime } from '~/utils/date';
	import { OFFICE_PERMISSIONS } from '~/utils/permission';
	import type {
		CopySkippedItem,
		SupplyContact,
		SupplyItem,
		SupplyLine,
		SupplyRequest,
		SupplyRequestListItem,
		SupplyRequestStatus,
	} from '~/types/office.types';

	/**
	 * Văn phòng phẩm của phòng tôi (UI-01), trang dùng chung cho mọi nhân viên.
	 *
	 * Cả phòng cùng nhập vào MỘT phiếu và không có nút nộp: phiếu tự khoá lúc `period.lockAt`, nên
	 * trang đếm ngược tới mốc đó và mỗi dòng ghi rõ ai sửa cuối. Quyền thêm, sửa, xoá lấy từ cờ
	 * `canEdit` của máy chủ, không tự suy từ trạng thái, vì còn phụ thuộc chế độ chỉ xem của module.
	 */
	definePageMeta({ title: 'Văn phòng phẩm' });

	const route = useRoute();
	const router = useRouter();
	const toast = useToast();
	const service = useOfficeService();
	const { user } = useAuth();
	const directoryStore = useDirectoryStore();
	const { employees } = storeToRefs(directoryStore);

	const requests = ref<SupplyRequestListItem[]>([]);
	const loadingList = ref(true);
	const listError = ref<string | null>(null);

	const current = ref<SupplyRequest | null>(null);
	const loadingDetail = ref(false);
	const working = ref(false);

	const items = ref<SupplyItem[]>([]);
	const contact = ref<SupplyContact | null>(null);
	const showContactForm = ref(false);
	const contactEmployeeId = ref<number | null>(null);
	const savingContact = ref(false);
	const showReceive = ref(false);

	/** Mốc thời gian để đếm ngược; nhịp một phút là đủ cho câu "Còn 2 ngày 5 giờ". */
	const now = ref(new Date());
	let ticker: ReturnType<typeof setInterval> | null = null;

	const STATUS_CLASS: Record<SupplyRequestStatus, string> = {
		OPEN: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
		LOCKED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
		FINALIZED: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
		ISSUED: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400',
		RECEIVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
	};

	// ─── Thêm dòng ────────────────────────────────────────────────────────────────

	const addItemId = ref<number | null>(null);
	const addQty = ref<number | undefined>(undefined);
	const addReason = ref('');
	const addNote = ref('');
	/** Hiện ô lý do khi máy chủ báo dòng vượt định mức mà chưa có lý do. */
	const addNeedsReason = ref(false);
	const addError = ref('');
	/** Câu chỉ đường khi người dùng chọn một mặt hàng đã có dòng trong phiếu. */
	const addItemNotice = ref('');

	/** Ô số đang giữ chữ gõ sai, ví dụ "2,5" hay "5 hộp": chặn thêm dòng tới khi người dùng gõ lại. */
	const addQtyInvalid = ref(false);

	const showCustomForm = ref(false);
	const customName = ref('');
	const customUnit = ref('');
	const customQty = ref<number | undefined>(undefined);
	const customQtyInvalid = ref(false);
	const customError = ref('');
	/** Câu nhắc thiếu tên hoặc thiếu đơn vị, để nút không chỉ nằm im màu xám. */
	const customNameError = ref('');
	const customUnitError = ref('');

	/** Dòng chờ xoá: hộp xác nhận nêu tên, số và người nhập trước khi xoá thật. */
	const deleteTarget = ref<SupplyLine | null>(null);

	/** Dòng kỳ trước không chép được, giữ trên màn vì toast tắt mất mà người dùng còn phải nhập lại. */
	const copySkipped = ref<CopySkippedItem[]>([]);

	/** Dòng đang sửa: số và lý do theo `lineId`, cùng cờ "đã sửa" để chỉ hiện nút Lưu khi cần. */
	const editQty = reactive<Record<number, number | undefined>>({});
	const editReason = reactive<Record<number, string>>({});
	const lineError = reactive<Record<number, string>>({});
	/** Ô số của dòng đang giữ chữ gõ sai. */
	const lineQtyInvalid = reactive<Record<number, boolean>>({});
	/**
	 * Dòng cần ghi lý do vượt định mức.
	 *
	 * Tách khỏi `lineError`: trước đây ô lý do hiện mỗi khi dòng có BẤT KỲ câu lỗi nào, nên xoá
	 * trắng ô số (lỗi "ô số lượng đang trống") cũng làm mọc thêm ô "Lý do vượt định mức" chẳng liên
	 * quan gì.
	 */
	const lineNeedsReason = reactive<Record<number, boolean>>({});

	/**
	 * Mặt hàng còn chọn được, kèm định mức ngay trên nhãn.
	 *
	 * Định mức nằm ở ô chọn chứ không chỉ ở dòng đã thêm, vì người dùng cần biết trần của phòng
	 * TRƯỚC khi gõ số, không phải sau khi bị máy chủ từ chối. Danh mục của màn này không có đơn
	 * giá: nhân viên thường nhận `unitPrice` rỗng và giá không phải việc của họ.
	 */
	/** Mặt hàng đã có trong phiếu: vẫn hiện trong ô chọn, nhưng chọn vào thì chỉ được nhắc. */
	const usedItemIds = computed(() => new Set((current.value?.lines ?? []).map(line => line.itemId).filter(Boolean)));

	const itemOptions = computed(() =>
		items.value.map(item => {
			// TÊN MẶT HÀNG ĐỨNG TRƯỚC tên nhóm: ô chọn chỉ hiện một dòng và cắt phần đuôi, nên để
			// nhóm lên trước thì trên điện thoại người dùng đọc được tên nhóm mà không thấy mặt hàng.
			const parts = [`${item.name} (${item.unit})`];
			if (item.quota != null) parts.push(`định mức ${item.quota} ${item.unit} mỗi tháng`);
			if (usedItemIds.value.has(item.id)) parts.push('đã có trong phiếu, sửa số ở dòng bên dưới');
			if (item.groupName) parts.push(item.groupName);
			return { value: item.id, label: parts.join(' · ') };
		}),
	);

	/** Mặt hàng đang chọn ở form thêm dòng, để biết định mức và nhắc lý do ngay khi gõ vượt. */
	const addItem = computed(() => items.value.find(item => item.id === addItemId.value) ?? null);

	/**
	 * Chọn mặt hàng ở ô danh mục.
	 *
	 * Mặt hàng đã có trong phiếu vẫn nằm trong danh sách để người dùng tìm thấy nó, nhưng chọn vào
	 * thì chỉ nhận câu chỉ đường xuống dòng đang có: trước đây danh sách lọc chúng ra nên tìm một
	 * mặt hàng vừa thêm lại ra "Không tìm thấy kết quả".
	 */
	function pickItem(value: string | number) {
		const id = Number(value);
		const line = (current.value?.lines ?? []).find(l => l.itemId === id);
		if (line) {
			addItemId.value = null;
			addItemNotice.value = `${line.name} đã có trong phiếu, bạn sửa số ở dòng bên dưới.`;
			return;
		}
		addItemNotice.value = '';
		addItemId.value = id;
		addError.value = '';
	}

	const addOverQuota = computed(() => {
		const quota = addItem.value?.quota;
		return quota != null && addQty.value != null && addQty.value > quota;
	});

	const canEdit = computed(() => !!current.value?.canEdit);

	/** Người có quyền mở và theo dõi kỳ: dùng để chỉ đường cho HCNS không thuộc phòng ban nào. */
	const { hasPermission } = usePermissions();
	const canManagePeriods = computed(() => hasPermission(OFFICE_PERMISSIONS.supplyReport));

	/**
	 * Đếm ngược chỉ có nghĩa khi kỳ còn nhận đăng ký.
	 *
	 * Kỳ đã khoá rồi mà màn hình vẫn đếm "Còn 4 ngày" thì người đọc tưởng mình còn kịp sửa, trong
	 * khi phiếu đã sang tay HCNS.
	 */
	const countdown = computed(() => {
		const period = current.value?.period;
		if (!period || period.status !== 'OPEN') return '';
		return lockCountdown(period.lockAt, now.value);
	});

	/** Tên kỳ thường đã là "Tháng 12/2026", nên chỉ nhắc lại tháng khi tiêu đề kỳ khác đi. */
	const monthSuffix = computed(() => {
		const period = current.value?.period;
		if (!period) return '';
		const label = monthLabel(period.month);
		return period.title.trim() === label ? '' : label;
	});

	/** Nhóm của các dòng tự gõ; luôn ở cuối phiếu, giống file đăng ký của HCNS. */
	const CUSTOM_GROUP = 'Mặt hàng ngoài danh mục';

	/**
	 * Dòng xếp theo nhóm, giữ thứ tự máy chủ trả về, riêng nhóm ngoài danh mục xuống cuối.
	 *
	 * Thứ tự máy chủ là thứ tự thêm dòng, nên một mặt hàng tự gõ thêm giữa buổi sẽ chen vào giữa
	 * các nhóm của danh mục và người đọc tưởng nó thuộc nhóm phía trên.
	 */
	const groupedLines = computed(() => {
		const map = new Map<string, SupplyLine[]>();
		for (const line of current.value?.lines ?? []) {
			const key = line.groupName || CUSTOM_GROUP;
			const list = map.get(key) ?? [];
			list.push(line);
			map.set(key, list);
		}
		const groups = [...map.entries()].map(([groupName, lines]) => ({ groupName, lines }));
		return groups.sort((a, b) => Number(a.groupName === CUSTOM_GROUP) - Number(b.groupName === CUSTOM_GROUP));
	});

	/**
	 * Câu giải thích khi phiếu không sửa được nữa.
	 *
	 * Kỳ bị HCNS khoá sớm thì hạn chót trên phiếu vẫn là ngày cũ, nên người dùng mở ra thấy "Hạn
	 * chót 24/11" mà không nhập được gì và tưởng hệ thống lỗi. Mốc khoá thật nằm ở `lockedAt`.
	 */
	const lockedNotice = computed(() => {
		const request = current.value;
		const period = request?.period;
		if (!request || !period || canEdit.value || request.status === 'OPEN') return '';
		if (period.status === 'CLOSED') {
			return 'Kỳ này đã đóng nên phiếu chỉ còn để xem. Phòng còn thiếu thì báo HCNS tạo phiếu bổ sung.';
		}
		// Câu khoá sớm chỉ đúng khi phiếu đang CHỜ HCNS CHỐT. Phiếu đã chốt, đã cấp hay đã nhận thì
		// việc của phòng không còn là "nhập cho kịp hạn" nữa, mà là nhận hàng và đối chiếu số, nên
		// nhắc lại chuyện khoá kỳ chỉ làm người đọc tưởng mình vừa mất lượt đăng ký.
		if (request.status !== 'LOCKED') return '';
		const at = period.lockedAt ?? period.lockAt;
		return `HCNS đã khoá kỳ này lúc ${formatDateTime(at)}, phiếu không sửa được nữa. Phòng còn thiếu thì báo HCNS tạo phiếu bổ sung.`;
	});

	/** Người dùng vừa sửa ô thì câu nhắc cũ hết đúng; câu vượt định mức thì ở lại cho tới khi số hạ. */
	watch([addItemId, addQty], () => {
		if (!addOverQuota.value) addError.value = '';
	});

	/** Người của phòng tôi, để trưởng phòng chọn đầu mối. */
	const departmentEmployees = computed(() => {
		const departmentId = contact.value?.departmentId;
		if (!departmentId) return [];
		return employees.value.filter(e => e.department?.id === departmentId && e.status === 'ACTIVE');
	});

	const contactOptions = computed(() => departmentEmployees.value.map(e => ({ value: e.id, label: e.fullName })));

	/** Chỉ trưởng phòng đổi được đầu mối, nên nút chỉ hiện với chính họ. */
	const isDepartmentManager = computed(() => !!contact.value?.manager && contact.value.manager.id === user.value?.id);

	// ─── Nạp dữ liệu ──────────────────────────────────────────────────────────────

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

	function fillEdits(data: SupplyRequest) {
		current.value = data;
		for (const line of data.lines) {
			editQty[line.id] = line.requestedQty;
			editReason[line.id] = line.overQuotaReason ?? '';
			delete lineError[line.id];
			delete lineNeedsReason[line.id];
			delete lineQtyInvalid[line.id];
		}
	}

	async function openRequest(id: number): Promise<boolean> {
		loadingDetail.value = true;
		try {
			fillEdits(await service.myRequest(id));
			return true;
		} catch (e) {
			// Mở phiếu phòng khác (link cũ, link của người khác) thì nói rõ và ở lại danh sách.
			// Phiếu đã biến mất (kỳ bị HCNS huỷ) là chuyện khác: nói thẳng là nó không còn, đừng
			// bảo người dùng thử lại một việc không bao giờ chạy được nữa.
			const message =
				officeErrorCode(e) === 'OFFICE_SUPPLY_NOT_YOUR_DEPARTMENT'
					? officeErrorMessage(e, 'Phiếu này không phải của phòng bạn.')
					: officeErrorStatus(e) === 404
						? 'Phiếu này không còn, có thể kỳ đã bị HCNS huỷ.'
						: officeErrorMessage(e, 'Chưa mở được phiếu này. Bạn thử lại sau ít phút.');
			current.value = null;
			toast.error(message);
			return false;
		} finally {
			loadingDetail.value = false;
		}
	}

	async function loadItems() {
		try {
			items.value = await service.mySupplyItems();
		} catch {
			// Thiếu danh mục thì chỉ mất ô chọn mặt hàng, phiếu vẫn đọc và sửa số được.
			items.value = [];
		}
	}

	async function loadContact() {
		try {
			contact.value = await service.mySupplyContact();
			contactEmployeeId.value = contact.value.contact?.id ?? null;
		} catch {
			// Người không thuộc phòng nào nhận 403 ở đây; thẻ đầu mối đơn giản là không hiện.
			contact.value = null;
		}
	}

	/**
	 * Mở sẵn phiếu theo `?request_id=` của thông báo; không có thì mở phiếu đầu danh sách.
	 *
	 * Thông báo trỏ tới một phiếu đã mất thì DỪNG ở danh sách, không mở phiếu khác: mở kỳ khác ra
	 * làm người dùng tưởng mình đang xem kỳ trong thông báo và sửa số của một kỳ không liên quan.
	 */
	async function openInitial() {
		const raw = route.query.request_id;
		if (raw) {
			const id = Number(raw);
			// Dọn query trước khi gọi API: lỗi thì URL vẫn sạch, bấm F5 không mở lại.
			router.replace({ path: '/office/supplies' });
			if (id && !Number.isNaN(id)) {
				await openRequest(id);
				return;
			}
			toast.error('Đường dẫn thông báo không mang đúng mã phiếu.');
		}
		const first = requests.value[0];
		if (first) await openRequest(first.id);
	}

	onMounted(async () => {
		ticker = setInterval(() => (now.value = new Date()), 60_000);
		await loadList();
		await Promise.all([loadItems(), loadContact()]);
		directoryStore.load().catch(() => {
			// Không có danh sách nhân viên thì trưởng phòng tạm chưa chọn được đầu mối.
		});
		await openInitial();
	});

	onUnmounted(() => {
		if (ticker) clearInterval(ticker);
	});

	/** Rời trang khi còn số chưa lưu thì lưu trước, không để số biến mất lặng lẽ. */
	onBeforeRouteLeave(async () => {
		await flushDirtyLines();
	});

	// ─── Thao tác trên dòng ───────────────────────────────────────────────────────

	function afterWrite(data: SupplyRequest) {
		fillEdits(data);
		// Danh sách mang số dòng của từng phiếu, nên nó cũng cũ sau mỗi lần ghi.
		loadList();
	}

	/**
	 * Thêm dòng. Nút luôn bấm được, thiếu gì thì nói ra ngay dưới ô đó.
	 *
	 * Nút xám không giải thích là thứ bốn người dùng UAT đều kẹt lại: họ bấm vài lần, không có gì
	 * xảy ra, rồi kết luận là trang bị treo.
	 */
	async function addLine() {
		const requestId = current.value?.id;
		if (!requestId || working.value) return;
		if (addQtyInvalid.value) {
			addError.value = QTY_INTEGER_MESSAGE;
			return;
		}
		if (!addItemId.value) {
			addError.value = 'Bạn chọn mặt hàng trong danh mục trước, hoặc dùng ô mặt hàng ngoài danh mục ở dưới.';
			return;
		}
		if (addQty.value == null) {
			addError.value = 'Bạn nhập số lượng cần xin, ví dụ 2.';
			return;
		}
		// Biết định mức từ danh mục thì nhắc ngay tại chỗ, khỏi phải gửi lên mới biết thiếu lý do.
		if (addOverQuota.value && !addReason.value.trim()) {
			addNeedsReason.value = true;
			// Định mức luôn ghi kèm ĐƠN VỊ: "vượt định mức 10" không nói 10 cái hay 10 hộp.
			addError.value = `Số này vượt định mức ${addItem.value?.quota} ${addItem.value?.unit} mỗi tháng của phòng, bạn ghi lý do.`;
			return;
		}
		working.value = true;
		addError.value = '';
		try {
			afterWrite(
				await service.addLine(requestId, {
					itemId: addItemId.value,
					requestedQty: addQty.value,
					overQuotaReason: addReason.value.trim() || undefined,
					note: addNote.value.trim() || undefined,
				}),
			);
			addItemId.value = null;
			addQty.value = undefined;
			addReason.value = '';
			addNote.value = '';
			addNeedsReason.value = false;
			toast.success('Đã thêm dòng vào phiếu.');
		} catch (e) {
			const code = officeErrorCode(e);
			if (code === 'OFFICE_SUPPLY_OVER_QUOTA_REASON_REQUIRED') {
				// Định mức tính cho cả tháng và cộng cả số phòng đã xin ở văn phòng khác, nên dù
				// ô chọn nói chưa vượt, máy chủ vẫn có thể bắt ghi lý do: mở ô lý do kèm câu của nó.
				addNeedsReason.value = true;
				addError.value = officeErrorMessage(e, 'Số này vượt định mức của phòng, bạn ghi lý do.');
			} else if (code === 'OFFICE_SUPPLY_LINE_EXISTS') {
				// Người khác trong phòng vừa thêm đúng mặt hàng này: tải lại phiếu để dòng của họ
				// hiện ra, nếu không thì câu "đã có trong phiếu" trỏ tới một dòng người dùng không
				// thấy đâu cả. Câu nhắc đi vào `addItemNotice` vì nó ở lại sau khi ô chọn được dọn,
				// còn `addError` thì tự tắt ngay khi ô chọn đổi giá trị.
				addItemNotice.value = officeErrorMessage(
					e,
					'Mặt hàng này đã có trong phiếu, bạn sửa số ở dòng đang có.',
				);
				addItemId.value = null;
				await openRequest(requestId);
			} else if (code === 'OFFICE_SUPPLY_LINE_IN_CATALOG') {
				// Người dùng gõ tay một thứ đã có sẵn: nói tên đúng và đẩy họ về ô chọn danh mục.
				customError.value = officeErrorMessage(e, 'Mặt hàng này đã có trong danh mục, bạn chọn trong danh sách.');
			} else if (code === 'OFFICE_SUPPLY_PERIOD_LOCKED') {
				toast.warning(officeErrorMessage(e, 'Kỳ đã đóng, bạn liên hệ HCNS.'));
				await openRequest(requestId);
			} else {
				toast.error(officeErrorMessage(e, 'Chưa thêm được dòng. Bạn thử lại sau ít phút.'));
			}
		} finally {
			working.value = false;
		}
	}

	async function addCustomLine() {
		const requestId = current.value?.id;
		if (!requestId || working.value) return;
		customNameError.value = '';
		customUnitError.value = '';
		customError.value = '';
		if (customQtyInvalid.value) {
			customError.value = QTY_INTEGER_MESSAGE;
			return;
		}
		if (!customName.value.trim()) {
			customNameError.value = 'Bạn ghi tên mặt hàng, ví dụ Pin 3A.';
			return;
		}
		if (!customUnit.value.trim()) {
			customUnitError.value = 'Bạn ghi đơn vị, ví dụ Đôi, Hộp, Chiếc.';
			return;
		}
		if (customQty.value == null) {
			customError.value = 'Bạn nhập số lượng cần xin, ví dụ 2.';
			return;
		}
		working.value = true;
		try {
			afterWrite(
				await service.addLine(requestId, {
					customName: customName.value.trim(),
					customUnit: customUnit.value.trim(),
					requestedQty: customQty.value,
				}),
			);
			customName.value = '';
			customUnit.value = '';
			customQty.value = undefined;
			showCustomForm.value = false;
			toast.success('Đã thêm mặt hàng ngoài danh mục.');
		} catch (e) {
			const code = officeErrorCode(e);
			if (code === 'OFFICE_SUPPLY_LINE_IN_CATALOG' || code === 'OFFICE_SUPPLY_LINE_EXISTS') {
				// Câu của máy chủ nêu tên đúng trong danh mục, nên để ngay dưới ô tên tự gõ. Dòng đã
				// có thì tải lại phiếu để người dùng thấy nó, giống đường thêm từ danh mục.
				customError.value = officeErrorMessage(e, 'Mặt hàng này đã có, bạn chọn trong danh sách ở trên.');
				if (code === 'OFFICE_SUPPLY_LINE_EXISTS') await openRequest(requestId);
			} else {
				toast.error(
					officeErrorMessage(e, 'Chưa thêm được mặt hàng ngoài danh mục. Bạn kiểm tra lại tên và đơn vị.'),
				);
			}
		} finally {
			working.value = false;
		}
	}

	function lineDirty(line: SupplyLine): boolean {
		return editQty[line.id] !== line.requestedQty || (editReason[line.id] ?? '') !== (line.overQuotaReason ?? '');
	}

	async function saveLine(line: SupplyLine) {
		const requestId = current.value?.id;
		const qty = editQty[line.id];
		if (!requestId || working.value) return;
		if (lineQtyInvalid[line.id]) {
			lineError[line.id] = QTY_INTEGER_MESSAGE;
			return;
		}
		if (qty == null) {
			lineError[line.id] = 'Ô số lượng đang trống. Bạn nhập số, hoặc bấm Xoá nếu phòng không cần mặt hàng này.';
			return;
		}
		// Định mức của dòng thì máy chủ đã gửi kèm, nên chỗ này chặn được ngay không cần gọi API.
		if (line.quota != null && qty > line.quota && !editReason[line.id]?.trim()) {
			lineNeedsReason[line.id] = true;
			lineError[line.id] = `Số này vượt định mức ${line.quota} ${line.unit || 'đơn vị'} mỗi tháng của phòng, bạn ghi lý do.`;
			return;
		}
		working.value = true;
		delete lineError[line.id];
		try {
			afterWrite(
				await service.updateLine(requestId, line.id, {
					requestedQty: qty,
					overQuotaReason: editReason[line.id]?.trim() || undefined,
				}),
			);
			toast.success(`Đã lưu dòng ${line.name}.`);
		} catch (e) {
			const code = officeErrorCode(e);
			if (code === 'OFFICE_SUPPLY_OVER_QUOTA_REASON_REQUIRED') {
				lineNeedsReason[line.id] = true;
				lineError[line.id] = officeErrorMessage(e, 'Số này vượt định mức của phòng, bạn ghi lý do.');
			} else if (code === 'OFFICE_SUPPLY_PERIOD_LOCKED') {
				toast.warning(officeErrorMessage(e, 'Kỳ đã đóng, bạn liên hệ HCNS.'));
				await openRequest(requestId);
			} else if (await reloadIfStale(e, requestId)) {
				return;
			} else {
				toast.error(officeErrorMessage(e, 'Chưa lưu được dòng này. Bạn thử lại sau ít phút.'));
			}
		} finally {
			working.value = false;
		}
	}

	/**
	 * Cả phòng nhập cùng một phiếu, nên người này lưu lúc người kia vừa xoá dòng là chuyện thường.
	 *
	 * Gặp 404 (dòng không còn) hoặc 409 (mặt hàng đã có dòng khác) thì tải lại phiếu: giữ màn hình
	 * cũ rồi báo lỗi sẽ khiến người dùng bấm Lưu mãi vào một dòng không còn tồn tại.
	 */
	async function reloadIfStale(error: unknown, requestId: number): Promise<boolean> {
		const stale = officeErrorStatus(error) === 404 || officeErrorCode(error) === 'OFFICE_SUPPLY_LINE_EXISTS';
		if (!stale) return false;
		toast.warning(
			officeErrorMessage(error, 'Người khác trong phòng vừa sửa phiếu này, nên phiếu đã được tải lại.'),
		);
		await openRequest(requestId);
		return true;
	}

	/** Nhịp lưu khi rời ô hoặc bấm Enter: số đã gõ không được mất khi chuyển thẻ tháng hay rời trang. */
	function saveLineIfDirty(line: SupplyLine) {
		if (!canEdit.value || working.value) return;
		if (lineQtyInvalid[line.id] || editQty[line.id] == null) return;
		if (!lineDirty(line)) return;
		saveLine(line);
	}

	/**
	 * Lưu mọi dòng còn số chưa lưu, rồi mới đi chỗ khác.
	 *
	 * Người dùng gõ 12 vào một dòng rồi bấm sang thẻ tháng khác: trước đây số đó mất không một lời
	 * nào, và họ chỉ phát hiện khi HCNS chốt thiếu.
	 */
	async function flushDirtyLines() {
		if (!canEdit.value) return;
		for (const line of current.value?.lines ?? []) {
			if (lineQtyInvalid[line.id] || editQty[line.id] == null || !lineDirty(line)) continue;
			await saveLine(line);
		}
	}

	/** Chuyển sang phiếu khác: lưu số đang gõ trước đã. */
	async function selectRequest(id: number) {
		if (current.value && id !== current.value.id) await flushDirtyLines();
		await openRequest(id);
	}

	async function deleteLine(line: SupplyLine) {
		const requestId = current.value?.id;
		if (!requestId || working.value) return;
		working.value = true;
		try {
			afterWrite(await service.deleteLine(requestId, line.id));
			deleteTarget.value = null;
			toast.success(`Đã xoá dòng ${line.name}.`);
		} catch (e) {
			if (officeErrorCode(e) === 'OFFICE_SUPPLY_PERIOD_LOCKED') {
				toast.warning(officeErrorMessage(e, 'Kỳ đã đóng, bạn liên hệ HCNS.'));
				deleteTarget.value = null;
				await openRequest(requestId);
			} else if (await reloadIfStale(e, requestId)) {
				deleteTarget.value = null;
			} else {
				toast.error(officeErrorMessage(e, 'Chưa xoá được dòng này. Bạn thử lại sau ít phút.'));
			}
		} finally {
			working.value = false;
		}
	}

	async function copyPrevious() {
		const requestId = current.value?.id;
		if (!requestId || working.value) return;
		working.value = true;
		try {
			const result = await service.copyPrevious(requestId);
			afterWrite(result.request);
			copySkipped.value = result.skippedItems;
			const message = copyPreviousSummary(result);
			// Câu có danh sách dòng bỏ qua thì dài, nên giữ toast lâu hơn mặc định ba giây.
			if (result.skippedItems.length || !result.previousTitle) {
				toast.warning(message, { duration: 12000 });
			} else {
				toast.success(message);
			}
		} catch (e) {
			toast.error(officeErrorMessage(e, 'Chưa lấy được số của kỳ trước. Bạn thử lại sau ít phút.'));
		} finally {
			working.value = false;
		}
	}

	/** Câu nhắc khi bấm "Lưu đầu mối" mà chưa chọn ai. */
	const contactError = ref('');

	async function saveContact() {
		if (savingContact.value) return;
		// Chưa chọn ai mà vẫn gửi thì máy chủ hiểu là BỎ đầu mối, nên người dùng vô tình xoá đầu
		// mối đang có; nói ra thay vì gửi một `null` mà họ không chủ ý.
		if (contactEmployeeId.value == null) {
			contactError.value = 'Bạn chọn một nhân viên của phòng, hoặc bấm Bỏ đầu mối nếu muốn trả việc nhận hàng về trưởng phòng.';
			return;
		}
		contactError.value = '';
		savingContact.value = true;
		try {
			contact.value = await service.setSupplyContact({ employeeId: contactEmployeeId.value });
			showContactForm.value = false;
			toast.success(
				contact.value.contact
					? `Đã chỉ định ${contact.value.contact.fullName} làm đầu mối nhận văn phòng phẩm của phòng.`
					: 'Đã bỏ đầu mối, việc nhận hàng trở về trưởng phòng.',
			);
			// Cờ `canReceive` của phiếu phụ thuộc đầu mối, nên phiếu đang mở cũng phải tải lại.
			if (current.value) await openRequest(current.value.id);
		} catch (e) {
			toast.error(officeErrorMessage(e, 'Chưa lưu được đầu mối. Bạn thử lại sau ít phút.'));
		} finally {
			savingContact.value = false;
		}
	}

	/** Bỏ đầu mối: việc nhận hàng trở về trưởng phòng. */
	async function clearContact() {
		if (savingContact.value) return;
		contactEmployeeId.value = null;
		contactError.value = '';
		savingContact.value = true;
		try {
			contact.value = await service.setSupplyContact({ employeeId: null });
			showContactForm.value = false;
			toast.success('Đã bỏ đầu mối, việc nhận hàng trở về trưởng phòng.');
			if (current.value) await openRequest(current.value.id);
		} catch (e) {
			toast.error(officeErrorMessage(e, 'Chưa bỏ được đầu mối. Bạn thử lại sau ít phút.'));
		} finally {
			savingContact.value = false;
		}
	}

	function onReceived(updated: SupplyRequest) {
		showReceive.value = false;
		afterWrite(updated);
	}
</script>

<template>
	<!-- `pb-24`: chừa chỗ cho nút trợ lý nổi ở góc dưới phải, nếu không nó đè lên dòng cuối trang. -->
	<div class="space-y-5 pb-24">
		<UiPageHeader
			title="Văn phòng phẩm của phòng"
			description="Cả phòng cùng nhập vào một phiếu cho mỗi kỳ và không có nút nộp: tới hạn chót phiếu tự khoá, nên bạn nhập sớm rồi vẫn sửa lại được."
		/>

		<CommonAppModuleNotice module="OFFICE" />

		<!-- Đầu mối của phòng -->
		<section
			v-if="contact"
			class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
		>
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100">Đầu mối nhận hàng</h2>
					<p class="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
						Phòng {{ contact.departmentName }} ·
						{{
							contact.contact
								? `đầu mối là ${contact.contact.fullName}`
								: contact.manager
									? `chưa chỉ định đầu mối, việc nhận hàng thuộc trưởng phòng ${contact.manager.fullName}`
									: 'chưa chỉ định đầu mối và phòng chưa có trưởng phòng'
						}}
					</p>
				</div>
				<CommonAppButton
					v-if="isDepartmentManager"
					size="sm"
					variant="outline"
					@click="showContactForm = !showContactForm"
				>
					Chọn đầu mối
				</CommonAppButton>
			</div>

			<div v-if="showContactForm" class="mt-3">
				<div class="flex flex-wrap items-end gap-3">
					<div class="w-full max-w-xs">
						<UiSelectInput
							:model-value="contactEmployeeId"
							:options="contactOptions"
							placeholder="Chọn nhân viên của phòng"
							search-placeholder="Tìm nhân viên"
							@update:model-value="
								contactEmployeeId = Number($event);
								contactError = '';
							"
						/>
					</div>
					<CommonAppButton variant="primary" size="sm" :loading="savingContact" @click="saveContact">Lưu đầu mối</CommonAppButton>
					<!-- Chưa có đầu mối thì không có gì để bỏ, nên nút cũng không hiện. -->
					<CommonAppButton
						v-if="contact.contact"
						variant="ghost"
						size="sm"
						:loading="savingContact"
						@click="clearContact"
					>
						Bỏ đầu mối
					</CommonAppButton>
				</div>
				<p v-if="contactError" class="mt-2 text-sm text-red-500">{{ contactError }}</p>
			</div>
		</section>

		<!-- Danh sách phiếu -->
		<div v-if="loadingList" class="space-y-3">
			<div v-for="i in 2" :key="i" class="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>

		<div
			v-else-if="listError"
			class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300"
		>
			<p>{{ listError }}</p>
			<CommonAppButton class="mt-3" size="sm" variant="outline" @click="loadList">Thử lại</CommonAppButton>
		</div>

		<!--
			Người không thuộc phòng ban nào (giám đốc, nhân sự ở một số công ty) không bao giờ có phiếu,
			nên câu "chờ HCNS mở kỳ" là lời hứa sai: họ chờ mãi cũng không thấy gì.
		-->
		<p
			v-else-if="!requests.length"
			class="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
		>
			<!--
				Người có quyền quản lý kỳ thì chính họ là HCNS, nên bảo "báo HCNS" là bảo họ đi tìm
				chính mình; chỉ đường sang trang Kỳ văn phòng phẩm là việc họ thật sự cần làm.
			-->
			<template v-if="!user?.department">
				Bạn chưa thuộc phòng ban nào nên không có phiếu văn phòng phẩm.
				<template v-if="canManagePeriods">
					Bạn mở và theo dõi kỳ đăng ký của các phòng ở
					<NuxtLink
						to="/management/office/supply-periods"
						class="text-brand-600 hover:underline dark:text-brand-400"
						>Kỳ văn phòng phẩm</NuxtLink
					>.
				</template>
				<template v-else>Cần gì bạn báo HCNS.</template>
			</template>
			<template v-else>
				Phòng bạn chưa có kỳ đăng ký nào. Khi HCNS mở kỳ, bạn sẽ nhận thông báo và phiếu hiện ở đây.
			</template>
		</p>

		<template v-else>
			<div class="flex flex-wrap gap-2">
				<button
					v-for="req in requests"
					:key="req.id"
					type="button"
					:class="[
						'rounded-xl border px-3 py-2 text-left text-sm transition-colors',
						current?.id === req.id
							? 'border-brand-500 bg-brand-50 dark:border-brand-500 dark:bg-brand-900/20'
							: 'border-gray-200 bg-white hover:border-brand-300 dark:border-gray-700 dark:bg-gray-900',
					]"
					@click="selectRequest(req.id)"
				>
					<span class="block font-medium text-gray-900 dark:text-white">
						{{ req.period.title }}
						<template v-if="req.isSupplement"> · bổ sung {{ req.sequence }}</template>
					</span>
					<!--
						Tên văn phòng nằm ngay trên thẻ: phòng làm việc ở hai văn phòng thì cùng một tháng có
						hai phiếu trùng tên, và không có cách nào biết thẻ nào của văn phòng nào.
					-->
					<span class="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
						{{ req.period.officeSite.name }} · {{ req.statusLabel }} · {{ req.lineCount }} dòng
					</span>
				</button>
			</div>

			<div v-if="loadingDetail" class="space-y-3">
				<div v-for="i in 3" :key="i" class="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
			</div>

			<template v-else-if="current">
				<!-- Thông tin phiếu -->
				<section class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div>
							<h2 class="font-semibold text-gray-900 dark:text-white">
								{{ current.period.title }}
								<span class="text-sm font-normal text-gray-500 dark:text-gray-400">
									· {{ current.period.officeSite.name }}
									<template v-if="monthSuffix"> · {{ monthSuffix }}</template>
								</span>
							</h2>
							<p class="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
								Hạn chót {{ formatDate(current.period.deadline) }}
								<template v-if="countdown">
									·
									<span class="text-amber-600 dark:text-amber-400">{{ countdown }}</span>
								</template>
							</p>
							<p v-if="current.note" class="mt-1 text-sm text-gray-700 dark:text-gray-300">
								Ghi chú phiếu: {{ current.note }}
							</p>
						</div>
						<div class="flex flex-wrap items-center gap-2">
							<span :class="['inline-flex rounded-full px-2.5 py-1 text-xs font-medium', STATUS_CLASS[current.status]]">
								{{ current.statusLabel }}
							</span>
							<CommonAppButton v-if="canEdit" size="sm" variant="outline" :loading="working" @click="copyPrevious">
								Lấy số tháng trước
							</CommonAppButton>
							<CommonAppButton v-if="current.canReceive" size="sm" variant="primary" @click="showReceive = true">
								Đã nhận
							</CommonAppButton>
						</div>
					</div>
					<p v-if="!canEdit && current.status === 'OPEN'" class="mt-2 text-sm text-amber-600 dark:text-amber-400">
						Phiếu này đang ở chế độ chỉ xem.
					</p>
					<!-- Kỳ bị khoá: nói rõ khoá lúc nào và làm gì tiếp, vì hạn chót ghi ở trên vẫn là ngày cũ. -->
					<p
						v-if="lockedNotice"
						class="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
					>
						{{ lockedNotice }}
					</p>
					<p v-if="current.receivedAt" class="mt-2 text-sm text-emerald-600 dark:text-emerald-400">
						{{ current.receivedByProxy ? 'HCNS ghi đã giao' : 'Phòng đã nhận' }} lúc
						{{ formatDateTime(current.receivedAt) }}
						<template v-if="current.receiverName"> cho {{ current.receiverName }}</template>
						<template v-else-if="current.receivedBy"> bởi {{ current.receivedBy.fullName }}</template>.
					</p>
				</section>

				<!-- Thêm dòng -->
				<section
					v-if="canEdit"
					class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
				>
					<h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100">Thêm mặt hàng</h2>
					<div class="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_120px_1fr_auto] lg:items-start">
						<UiSelectInput
							:model-value="addItemId"
							:options="itemOptions"
							placeholder="Chọn mặt hàng"
							search-placeholder="Tìm mặt hàng, gõ không dấu cũng được"
							@update:model-value="pickItem($event)"
						/>
						<QtyInput
							v-model="addQty"
							v-model:invalid="addQtyInvalid"
							placeholder="Số lượng"
							aria-label="Số lượng cần xin"
							@save="addLine"
						/>
						<input
							v-model="addNote"
							type="text"
							maxlength="500"
							class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							placeholder="Ghi chú (không bắt buộc)"
						/>
						<!-- Nút không bị xám: thiếu mặt hàng hay thiếu số thì câu nhắc hiện ngay dưới form. -->
						<CommonAppButton variant="primary" :loading="working" @click="addLine">Thêm dòng</CommonAppButton>
					</div>
					<p v-if="addItem" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
						<template v-if="addItem.quota != null">
							Định mức của phòng là {{ addItem.quota }} {{ addItem.unit }} mỗi tháng.
							<span v-if="addOverQuota" class="text-amber-600 dark:text-amber-400">
								Số bạn gõ vượt định mức nên cần ghi lý do.
							</span>
						</template>
						<template v-else>Mặt hàng này không giới hạn định mức.</template>
					</p>
					<div v-if="addNeedsReason || addOverQuota" class="mt-3">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
							Lý do vượt định mức <span class="text-red-500">*</span>
						</label>
						<input
							v-model="addReason"
							type="text"
							maxlength="500"
							class="mt-1 w-full max-w-xl rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:border-amber-700 dark:bg-gray-800 dark:text-gray-100"
							placeholder="VD: Tháng này quyết toán, in nhiều"
						/>
					</div>
					<p v-if="addItemNotice" class="mt-2 text-sm text-amber-700 dark:text-amber-300">{{ addItemNotice }}</p>
					<p v-if="addError" class="mt-2 text-sm text-red-500">{{ addError }}</p>

					<div class="mt-3">
						<!-- `py-2`: chữ nhỏ mà không có đệm thì ô bấm chỉ cao hai mươi pixel, ngón tay không trúng. -->
						<button
							type="button"
							class="py-2 text-sm text-brand-600 hover:underline dark:text-brand-400"
							@click="showCustomForm = !showCustomForm"
						>
							{{ showCustomForm ? 'Thôi, không thêm mặt hàng ngoài danh mục' : 'Mặt hàng không có trong danh mục' }}
						</button>
						<div v-if="showCustomForm" class="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_120px_auto] lg:items-start">
							<div>
								<!-- `maxlength` theo đúng giới hạn của API: 200 cho tên, 30 cho đơn vị. -->
								<input
									v-model="customName"
									type="text"
									maxlength="200"
									class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
									placeholder="Tên mặt hàng, VD: Pin 3A"
									@input="customNameError = ''"
								/>
								<p v-if="customNameError" class="mt-1 text-xs text-red-500">{{ customNameError }}</p>
							</div>
							<div>
								<input
									v-model="customUnit"
									type="text"
									maxlength="30"
									class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
									placeholder="Đơn vị, VD: Đôi"
									@input="customUnitError = ''"
								/>
								<p v-if="customUnitError" class="mt-1 text-xs text-red-500">{{ customUnitError }}</p>
							</div>
							<QtyInput
								v-model="customQty"
								v-model:invalid="customQtyInvalid"
								placeholder="Số lượng"
								aria-label="Số lượng mặt hàng ngoài danh mục"
								@save="addCustomLine"
							/>
							<CommonAppButton variant="outline" :loading="working" @click="addCustomLine">Thêm</CommonAppButton>
						</div>
						<p v-if="customError" class="mt-2 text-sm text-red-500">{{ customError }}</p>
					</div>

					<!-- Dòng kỳ trước không chép được: người dùng phải tự nhập lại nên danh sách ở lại trên màn. -->
					<div
						v-if="copySkipped.length"
						class="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-900/20"
					>
						<div class="flex items-start justify-between gap-3">
							<p class="font-medium text-amber-800 dark:text-amber-300">
								{{ copySkipped.length }} dòng của kỳ trước chưa được thêm, bạn nhập lại nếu còn cần:
							</p>
							<button
								type="button"
								class="px-2 py-2 text-xs text-amber-700 hover:underline dark:text-amber-400"
								@click="copySkipped = []"
							>
								Ẩn
							</button>
						</div>
						<ul class="mt-1 list-inside list-disc text-amber-700 dark:text-amber-400">
							<li v-for="item in copySkipped" :key="item.name">{{ item.name }} — {{ item.reason }}</li>
						</ul>
					</div>
				</section>

				<!-- Dòng của phiếu -->
				<p
					v-if="!current.lines.length"
					class="rounded-xl border border-gray-200 bg-white py-12 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
				>
					Phiếu chưa có dòng nào. Bạn thêm mặt hàng ở trên, hoặc bấm Lấy số tháng trước.
				</p>

				<section
					v-for="group in groupedLines"
					:key="group.groupName"
					class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
				>
					<h3 class="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800 dark:border-gray-700 dark:text-gray-100">
						{{ group.groupName }}
					</h3>
					<div class="divide-y divide-gray-100 dark:divide-gray-800">
						<div v-for="line in group.lines" :key="line.id" class="p-4">
							<div class="flex flex-wrap items-start justify-between gap-3">
								<div class="min-w-0">
									<p class="font-medium text-gray-900 dark:text-white">
										{{ line.name }}
										<span class="text-sm font-normal text-gray-500 dark:text-gray-400">· {{ line.unit || '—' }}</span>
									</p>
									<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
										<!-- Định mức phải có đơn vị: "Định mức 10" không nói 10 cái hay 10 hộp. -->
										<template v-if="line.quota != null">
											Định mức {{ line.quota }} {{ line.unit || 'đơn vị' }} mỗi tháng ·
										</template>
										<template v-if="line.previousQty != null">kỳ trước {{ line.previousQty }} · </template>
										sửa cuối bởi {{ line.updatedBy.fullName }} lúc {{ formatDateTime(line.updatedAt) }}
									</p>
									<p v-if="line.note" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Ghi chú: {{ line.note }}</p>

									<!--
										Ba con số của một dòng đi theo thứ tự việc đã xảy ra: phòng xin, HCNS chốt, phòng
										nhận. Số nào đang quyết định thì nổi nhất, và thành tiền đứng cạnh ĐÚNG số dùng
										để tính nó — trước đây thành tiền nằm cạnh số chốt dù tiền tính theo số đã nhận.
									-->
									<!--
										Phiếu không còn sửa được thì "Số xin" nằm NGAY TRƯỚC số chốt và số nhận, trong cùng
										một khối, để đọc từ trên xuống là đúng thứ tự việc đã xảy ra. Trước đây nó ở cột
										bên phải nên trên điện thoại rơi xuống dưới cùng, sau cả "Đã nhận".
									-->
									<p v-if="!canEdit" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
										Số xin
										<span class="font-medium text-gray-700 dark:text-gray-300">
											{{ line.requestedQty }} {{ line.unit }}
										</span>
									</p>
									<p v-if="line.finalQty != null" class="mt-1 text-sm">
										<span
											:class="[
												'text-indigo-700 dark:text-indigo-300',
												line.receivedQty == null ? 'font-semibold' : '',
											]"
										>
											HCNS chốt {{ line.finalQty }} {{ line.unit }}
										</span>
										<span v-if="line.finalNote" class="text-xs text-gray-500 dark:text-gray-400">
											· {{ line.finalNote }}
										</span>
										<span
											v-if="line.amount != null && line.receivedQty == null"
											class="text-xs text-gray-600 dark:text-gray-300"
										>
											· thành tiền {{ officeMoney(line.amount) }}
										</span>
									</p>
									<p v-if="line.receivedQty != null" class="mt-1 text-sm">
										<span class="font-semibold text-emerald-700 dark:text-emerald-300">
											Đã nhận {{ line.receivedQty }} {{ line.unit }}
										</span>
										<span v-if="line.receivedNote" class="text-xs text-gray-500 dark:text-gray-400">
											· {{ line.receivedNote }}
										</span>
										<span v-if="line.amount != null" class="text-xs text-gray-600 dark:text-gray-300">
											· thành tiền {{ officeMoney(line.amount) }}
										</span>
									</p>
								</div>

								<div v-if="canEdit" class="flex flex-wrap items-start gap-2">
									<div class="w-28">
										<QtyInput
											v-model="editQty[line.id]"
											:max="100000"
											:aria-label="`Số xin của ${line.name}`"
											@update:invalid="lineQtyInvalid[line.id] = $event"
											@save="saveLine(line)"
											@leave="saveLineIfDirty(line)"
										/>
									</div>
									<CommonAppButton
										v-if="lineDirty(line)"
										size="sm"
										variant="primary"
										:loading="working"
										@click="saveLine(line)"
									>
										Lưu
									</CommonAppButton>
									<!-- Xoá luôn hỏi lại: nút Xoá nằm sát nút Lưu, trên điện thoại rất dễ bấm trượt. -->
									<CommonAppButton size="sm" variant="ghost" :loading="working" @click="deleteTarget = line">
										Xoá
									</CommonAppButton>
								</div>
							</div>

							<!--
								Ô lý do chỉ mọc ra khi dòng THẬT SỰ cần lý do vượt định mức, không mọc theo mọi câu
								lỗi của dòng: xoá trắng ô số là lỗi của ô số, chẳng liên quan gì tới định mức.
							-->
							<div
								v-if="canEdit && (line.overQuota || lineNeedsReason[line.id] || editReason[line.id])"
								class="mt-2"
							>
								<label class="block text-xs font-medium text-amber-700 dark:text-amber-400">
									Lý do vượt định mức
								</label>
								<input
									v-model="editReason[line.id]"
									type="text"
									maxlength="500"
									class="mt-1 w-full max-w-xl rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:border-amber-700 dark:bg-gray-800 dark:text-gray-100"
									placeholder="VD: Tháng này quyết toán, in nhiều"
								/>
							</div>
							<p v-else-if="line.overQuota" class="mt-2 text-xs text-amber-600 dark:text-amber-400">
								Vượt định mức: {{ line.overQuotaReason || 'chưa ghi lý do' }}
							</p>
							<!-- Câu lỗi của dòng đứng riêng, nên nó không kéo theo ô lý do nào. -->
							<p v-if="lineError[line.id]" class="mt-2 text-xs text-red-500">{{ lineError[line.id] }}</p>
						</div>
					</div>
				</section>

				<p v-if="current.totalAmount != null" class="text-right text-sm font-semibold text-gray-900 dark:text-white">
					Tổng tiền phiếu: {{ officeMoney(current.totalAmount) }}
				</p>
			</template>
		</template>

		<SupplyReceiveModal
			v-if="showReceive && current"
			:request="current"
			@received="onReceived"
			@close="showReceive = false"
		/>

		<!--
			Hỏi lại trước khi xoá, nêu đủ tên, số và người nhập: cả phòng cùng nhập một phiếu, nên dòng
			bị xoá có thể là dòng của người khác và không có cách nào lấy lại.
		-->
		<Teleport to="body">
			<div
				v-if="deleteTarget"
				class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
				role="dialog"
				aria-modal="true"
				aria-label="Xác nhận xoá dòng"
				@click.self="deleteTarget = null"
			>
				<div class="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
					<h3 class="font-semibold text-gray-900 dark:text-white">Xoá dòng khỏi phiếu</h3>
					<p class="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
						Bạn xoá {{ deleteTarget.name }}, số đang xin {{ deleteTarget.requestedQty }}
						{{ deleteTarget.unit || '' }}, do {{ deleteTarget.updatedBy.fullName }} nhập lần cuối. Dòng đã xoá thì
						không lấy lại được, nhưng bạn thêm lại mặt hàng này khi kỳ còn mở.
					</p>
					<div class="mt-6 flex justify-end gap-3">
						<CommonAppButton variant="outline" @click="deleteTarget = null">Thôi</CommonAppButton>
						<CommonAppButton variant="danger" :loading="working" @click="deleteLine(deleteTarget)">Xoá dòng</CommonAppButton>
					</div>
				</div>
			</div>
		</Teleport>
	</div>
</template>
