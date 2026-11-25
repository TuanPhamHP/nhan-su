import { APP_MODULES } from '~/config/app-modules';
import type { AppModuleDef, NavItem } from '~/types/navigation.types';
import type { UserRole } from '~/types/auth.types';
import { isManagementRole } from '~/utils/role';
import { appsWithoutCatalog, mergeAppCatalog, splitLauncherApps, type LockedApp } from '~/utils/app-launcher';

const RECENT_KEY = 'app.recent-modules';
const RECENT_MAX = 4;

/**
 * Lọc app + mục theo vai trò, quyền và gói module của công ty; cho biết đang đứng ở app nào.
 *
 * App rỗng sau khi lọc thì biến mất khỏi lưới — người dùng không thấy ô dẫn vào nơi họ
 * không vào được. Đây chỉ là lớp cho gọn mắt, chặn thật vẫn là `permission-guard.global.ts`
 * và API.
 *
 * Riêng phân hệ bán riêng mà công ty chưa dùng được thì không biến mất mà sang danh sách
 * `lockedApps`: lưới vẫn hiện ô đó ở trạng thái khoá để người dùng biết hệ thống có phân hệ ấy.
 */
export function useAppModules() {
	const { user } = useAuth();
	const { hasPermission } = usePermissions();
	const { canUse, moduleEntitlement } = useModuleAccess();
	const { apps: catalogApps, appGroups } = storeToRefs(useAuthStore());
	const route = useRoute();

	/**
	 * Danh mục đã ghép. Chưa có danh mục thì dựng từ khai báo tĩnh: thiếu tên và icon, nhưng
	 * `currentApp` và mục menu con vẫn còn nên người dùng không bị kẹt giữa trang.
	 */
	const catalog = computed<AppModuleDef[]>(() =>
		catalogApps.value.length > 0 ? mergeAppCatalog(APP_MODULES, catalogApps.value) : appsWithoutCatalog(APP_MODULES),
	);

	const { scope: taskScope, hasDepartmentView, hasReportScope } = useTaskScope();
	const { reviewsAny: kpiReviewsAny } = useKpiScope();
	const { counts: approvalCounts } = storeToRefs(useApprovalStore());

	/** Đánh giá nhân viên: có phiếu chờ chấm, đã từng chấm, hoặc là quản lý, trưởng phòng, giám đốc. */
	const isKpiReviewer = computed(() => {
		const role = user.value?.role;
		return (
			(approvalCounts.value.kpiReviews ?? 0) > 0 ||
			kpiReviewsAny.value ||
			role === 'MANAGER' ||
			role === 'CHIEF' ||
			role === 'DIRECTOR' ||
			(taskScope.value?.managedDepartments.length ?? 0) > 0
		);
	});
	/** Kết quả KPI: giám đốc, ADMIN, trưởng phòng; người có `kpi:manage` đã xem trong Kỳ đánh giá. */
	const seesKpiResults = computed(() => {
		if (hasPermission('kpi:manage')) return false;
		const role = user.value?.role;
		return role === 'DIRECTOR' || (taskScope.value?.managedDepartments.length ?? 0) > 0;
	});

	function canSeeItem(item: NavItem): boolean {
		if (item.module && !canUse(item.module)) return false;
		// Việc của phòng chỉ có nghĩa với trưởng phòng và người xem mọi việc (`NavItem.showWhen`).
		if (item.showWhen === 'taskDepartments' && !hasDepartmentView.value) return false;
		if (item.showWhen === 'taskReports' && !hasReportScope.value && !hasPermission('task:report')) return false;
		if (item.showWhen === 'kpiReviewer' && !isKpiReviewer.value) return false;
		if (item.showWhen === 'kpiResults' && !seesKpiResults.value) return false;
		return canSeeItemIgnoringModule(item);
	}

	/** Chỉ xét vai trò và quyền: dùng cho ô khoá, tức là "nếu công ty mua thì có vào được không". */
	function canSeeItemIgnoringModule(item: NavItem): boolean {
		const u = user.value;
		if (!u) return false;
		if (passesMainRule(item, u.role)) return true;
		// Lối vào thứ hai, cho người chỉ xem (xem `NavItem.alsoFor`).
		return !!item.alsoFor && item.alsoFor.roles.includes(u.role) && hasPermission(item.alsoFor.permission);
	}

	function passesMainRule(item: NavItem, role: UserRole): boolean {
		if (item.roles && !item.roles.includes(role)) return false;
		if (item.management && !item.roles && !isManagementRole(role)) return false;
		if (item.permission && !hasPermission(item.permission)) return false;
		return true;
	}

	/**
	 * Các phân hệ còn ít nhất một mục xem được, kèm danh sách mục đã lọc.
	 *
	 * `home` được tính lại theo mục ĐẦU TIÊN người này xem được, không dùng cứng giá trị
	 * khai trong cấu hình: `home` khai sẵn là màn hình quản lý (VD `/management/attendance`),
	 * mà nhân viên thường bị middleware chặn khỏi `/management/**`. Để nguyên thì ô phân hệ
	 * của họ dẫn thẳng vào chỗ bị đá ngược về trang chủ.
	 */
	const split = computed(() => {
		if (!user.value) return { visible: [] as AppModuleDef[], locked: [] as LockedApp[] };
		return splitLauncherApps(catalog.value, {
			canSeeItem,
			canSeeItemIgnoringModule,
			moduleLock: code => (canUse(code) ? null : { reason: moduleEntitlement(code)?.reason ?? null }),
		});
	});

	const visibleApps = computed<AppModuleDef[]>(() => split.value.visible);

	/**
	 * Phân hệ công ty chưa dùng được, để lưới và sidebar hiện ô khoá.
	 *
	 * Cố tình KHÔNG gộp vào `visibleApps`: `currentApp`, "Gần đây" và nút mở lưới ở header đều
	 * tính trên `visibleApps`, mà ô khoá thì không dẫn đi đâu nên không được lọt vào mấy chỗ đó.
	 */
	const lockedApps = computed<LockedApp[]>(() => split.value.locked);

	/**
	 * Lưới chia theo nhóm, thứ tự nhóm lấy từ `groups` của máy chủ.
	 *
	 * Nhóm không còn ô nào sau khi lọc theo vai trò thì biến mất, nên không ai thấy một tên nhóm
	 * trống. `label` dùng để hiện, `code` chỉ để ghép và làm khoá `v-for`.
	 */
	const appsByGroup = computed(() =>
		appGroups.value
			.map(group => ({
				group: group.label,
				code: group.code,
				apps: visibleApps.value.filter(a => a.group === group.code),
				lockedApps: lockedApps.value.filter(a => a.group === group.code),
			}))
			.filter(g => g.apps.length > 0 || g.lockedApps.length > 0),
	);

	/**
	 * App ứng với route hiện tại. Khớp theo tiền tố DÀI NHẤT để `/management/assets/reports`
	 * không bị `/management/reports` của app Phân tích cướp mất.
	 */
	const currentApp = computed<AppModuleDef | null>(() => {
		let best: { app: AppModuleDef; len: number } | null = null;
		for (const app of visibleApps.value) {
			for (const prefix of app.routes) {
				const hit = route.path === prefix || route.path.startsWith(`${prefix}/`);
				if (hit && (!best || prefix.length > best.len)) best = { app, len: prefix.length };
			}
		}
		return best?.app ?? null;
	});

	/** App mở gần đây, để lưới chọn app có mục "Gần đây" như các hệ nhiều module khác. */
	const recentCodes = ref<string[]>([]);

	function readRecent(): string[] {
		if (!import.meta.client) return [];
		try {
			const raw = localStorage.getItem(RECENT_KEY);
			return raw ? (JSON.parse(raw) as string[]).filter(c => typeof c === 'string') : [];
		} catch {
			// Chế độ ẩn danh / chặn site data: coi như chưa có gì, không làm hỏng điều hướng.
			return [];
		}
	}

	function rememberApp(code: string): void {
		if (!import.meta.client) return;
		const next = [code, ...readRecent().filter(c => c !== code)].slice(0, RECENT_MAX);
		recentCodes.value = next;
		try {
			localStorage.setItem(RECENT_KEY, JSON.stringify(next));
		} catch {
			// Không ghi được thì thôi — "gần đây" là tiện ích, không phải dữ liệu nghiệp vụ.
		}
	}

	const recentApps = computed(() =>
		recentCodes.value
			.map(code => visibleApps.value.find(a => a.code === code))
			.filter((a): a is AppModuleDef => !!a),
	);

	onMounted(() => {
		recentCodes.value = readRecent();
	});

	// Vào app nào thì nhớ app đó, kể cả khi người dùng đi thẳng bằng URL chứ không qua lưới.
	watch(
		currentApp,
		app => {
			if (app) rememberApp(app.code);
		},
		{ immediate: true },
	);

	return { visibleApps, lockedApps, appsByGroup, currentApp, recentApps, canSeeItem };
}
