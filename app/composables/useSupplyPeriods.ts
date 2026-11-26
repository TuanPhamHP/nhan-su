import { useOfficeService } from '~/services/office.service';
import {
	groupSupplyPeriods,
	monthLabel,
	nextPeriodSuggestions,
	officeErrorMessage,
	vnMonthValue,
} from '~/utils/office.utils';
import { OFFICE_PERMISSIONS } from '~/utils/permission';
import type {
	CreateSupplyPeriodBody,
	OfficeSite,
	SupplyPeriod,
	SupplyPeriodStatus,
} from '~/types/office.types';

const STATUSES: SupplyPeriodStatus[] = ['OPEN', 'LOCKED', 'CLOSED'];

/** Gợi ý mở kỳ hiện tối đa chừng này dòng; nhiều hơn thì gộp "Còn N văn phòng nữa". */
export const MAX_PERIOD_SUGGESTIONS = 3;

/** Giá trị điền sẵn khi mở hộp Mở kỳ từ một gợi ý. */
export interface PeriodCreatePreset {
	siteId: number;
	month: string;
}

/**
 * Danh sách kỳ đăng ký văn phòng phẩm (`/management/office/supply-periods`).
 *
 * Tải MỘT lần toàn bộ kỳ người xem được thấy rồi lọc ngay trên trang: mỗi văn phòng chỉ một kỳ mỗi
 * tháng nên danh sách rất ngắn, và hộp Mở kỳ cần đủ kỳ của mọi văn phòng, mọi trạng thái để tính
 * tháng, hạn chót mặc định và chặn mở trùng. Lọc ở máy chủ thì đang lọc "Đã đóng" là hộp Mở kỳ
 * không thấy kỳ đang mở của tháng sau và gợi ý sai.
 */
export function useSupplyPeriods() {
	const route = useRoute();
	const router = useRouter();
	const toast = useToast();
	const service = useOfficeService();
	const { hasPermission } = usePermissions();
	const { canWrite } = useModuleAccess();

	const canManage = computed(() => hasPermission(OFFICE_PERMISSIONS.supplyManage) && canWrite('OFFICE'));
	/** Quyền tạo văn phòng nằm ở Cài đặt hành chính, khác quyền mở kỳ. */
	const canSetUpOffice = computed(() => hasPermission(OFFICE_PERMISSIONS.manage) && canWrite('OFFICE'));

	const periods = ref<SupplyPeriod[]>([]);
	const sites = ref<OfficeSite[]>([]);
	const loading = ref(true);
	const loadError = ref<string | null>(null);
	const loadingSites = ref(true);
	const sitesError = ref<string | null>(null);

	/** Mốc đếm ngược tới giờ khoá; nhịp một phút là đủ cho câu "Còn 3 ngày 14 giờ". */
	const now = ref(new Date());
	let ticker: ReturnType<typeof setInterval> | null = null;

	// ─── Bộ lọc trên địa chỉ trang: `?office=&status=` ────────────────────────

	function queryString(value: unknown): string {
		const raw = Array.isArray(value) ? value[0] : value;
		return typeof raw === 'string' ? raw : '';
	}

	function parseSite(value: unknown): number | undefined {
		const id = Number(queryString(value));
		return Number.isInteger(id) && id > 0 ? id : undefined;
	}

	function parseStatus(value: unknown): SupplyPeriodStatus | undefined {
		const raw = queryString(value);
		return STATUSES.find(s => s === raw);
	}

	const filterSiteId = ref<number | undefined>(parseSite(route.query.office));
	const filterStatus = ref<SupplyPeriodStatus | undefined>(parseStatus(route.query.status));

	watch([filterSiteId, filterStatus], ([siteId, status]) => {
		const query = { ...route.query };
		if (siteId) query.office = String(siteId);
		else delete query.office;
		if (status) query.status = status;
		else delete query.status;
		router.replace({ query });
	});

	const hasFilter = computed(() => !!filterSiteId.value || !!filterStatus.value);

	function clearFilters() {
		filterSiteId.value = undefined;
		filterStatus.value = undefined;
	}

	const filtered = computed(() =>
		periods.value.filter(
			p =>
				(!filterSiteId.value || p.officeSite.id === filterSiteId.value) &&
				(!filterStatus.value || p.status === filterStatus.value),
		),
	);

	const groups = computed(() => groupSupplyPeriods(filtered.value));

	/**
	 * Văn phòng nên mở kỳ tiếp theo. Chỉ người mở được kỳ mới thấy, và theo bộ lọc văn phòng đang
	 * chọn: đang xem một văn phòng thì nhắc văn phòng khác là nhiễu.
	 */
	const suggestions = computed(() => {
		if (!canManage.value) return [];
		const scope = filterSiteId.value ? sites.value.filter(s => s.id === filterSiteId.value) : sites.value;
		return nextPeriodSuggestions(scope, periods.value, vnMonthValue(now.value));
	});

	// ─── Nạp dữ liệu ──────────────────────────────────────────────────────────

	async function loadPeriods(silent = false) {
		if (!silent) loading.value = true;
		loadError.value = null;
		try {
			periods.value = await service.findPeriods();
		} catch (e) {
			if (!silent) periods.value = [];
			loadError.value = officeErrorMessage(e, 'Chưa tải được danh sách kỳ đăng ký. Bạn bấm Thử lại.');
		} finally {
			loading.value = false;
		}
	}

	async function loadSites() {
		loadingSites.value = true;
		sitesError.value = null;
		try {
			sites.value = await service.findSites();
		} catch (e) {
			// Thiếu danh sách văn phòng thì chỉ mất ô lọc và nút mở kỳ, danh sách kỳ vẫn đọc được.
			sites.value = [];
			sitesError.value = officeErrorMessage(e, 'Chưa tải được danh sách văn phòng.');
		} finally {
			loadingSites.value = false;
		}
	}

	async function init() {
		ticker = setInterval(() => (now.value = new Date()), 60_000);
		await Promise.all([loadSites(), loadPeriods()]);
	}

	onUnmounted(() => {
		if (ticker) clearInterval(ticker);
	});

	// ─── Mở kỳ ────────────────────────────────────────────────────────────────

	const createOpen = ref(false);
	const createPreset = ref<PeriodCreatePreset | null>(null);

	function openCreate(preset: PeriodCreatePreset | null = null) {
		createPreset.value = preset;
		createOpen.value = true;
	}

	function closeCreate() {
		createOpen.value = false;
		createPreset.value = null;
	}

	/**
	 * Mở kỳ rồi cập nhật danh sách tại chỗ. Lỗi của máy chủ ném ra cho hộp Mở kỳ đặt vào đúng ô, hộp
	 * không đóng và giữ nguyên những gì người dùng đã nhập.
	 */
	async function createPeriod(body: CreateSupplyPeriodBody): Promise<SupplyPeriod> {
		const created = await service.createPeriod(body);
		const count = body.departmentIds.length;
		toast.success(`Đã mở kỳ ${monthLabel(created.month).toLocaleLowerCase('vi')} cho ${count} phòng.`);
		closeCreate();
		periods.value = [created, ...periods.value.filter(p => p.id !== created.id)];
		// Danh sách tải lại ngầm để có đủ số phòng, người mở như máy chủ tính, không hiện khung chờ.
		loadPeriods(true);
		return created;
	}

	return {
		canManage,
		canSetUpOffice,
		periods,
		sites,
		loading,
		loadError,
		loadingSites,
		sitesError,
		now,
		filterSiteId,
		filterStatus,
		hasFilter,
		clearFilters,
		filtered,
		groups,
		suggestions,
		init,
		loadPeriods,
		loadSites,
		createOpen,
		createPreset,
		openCreate,
		closeCreate,
		createPeriod,
	};
}
