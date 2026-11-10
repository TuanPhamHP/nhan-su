import { APP_MODULES } from '~/config/app-modules';
import type { AppGroup, AppModuleDef, NavItem } from '~/types/navigation.types';
import { isManagementRole } from '~/utils/role';

const RECENT_KEY = 'app.recent-modules';
const RECENT_MAX = 4;

/** Thứ tự nhóm trong lưới chọn phân hệ — theo đúng thứ tự A–D của bức tranh tổng thể. */
const GROUP_ORDER: AppGroup[] = [
	'Quản trị nhân sự',
	'Thu hút & Phát triển',
	'Hành chính & Vận hành',
	'Quản trị & Phân tích',
	'Hệ thống',
];

/**
 * Lọc app + mục theo vai trò, quyền và gói module của công ty; cho biết đang đứng ở app nào.
 *
 * App rỗng sau khi lọc thì biến mất khỏi lưới — người dùng không thấy ô dẫn vào nơi họ
 * không vào được. Đây chỉ là lớp cho gọn mắt, chặn thật vẫn là `permission-guard.global.ts`
 * và API.
 */
export function useAppModules() {
	const { user } = useAuth();
	const { hasPermission } = usePermissions();
	const { canUse } = useModuleAccess();
	const route = useRoute();

	function canSeeItem(item: NavItem): boolean {
		const u = user.value;
		if (!u) return false;
		if (item.roles && !item.roles.includes(u.role)) return false;
		if (item.management && !item.roles && !isManagementRole(u.role)) return false;
		if (item.permission && !hasPermission(item.permission)) return false;
		if (item.module && !canUse(item.module)) return false;
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
	const visibleApps = computed<AppModuleDef[]>(() => {
		if (!user.value) return [];
		return APP_MODULES.map(app => {
			const items = app.items.filter(canSeeItem);
			const home = items.some(i => i.route === app.home) ? app.home : (items[0]?.route ?? app.home);
			return { ...app, items, home };
		}).filter(app => app.items.length > 0);
	});

	const appsByGroup = computed(() =>
		GROUP_ORDER.map(group => ({
			group,
			apps: visibleApps.value.filter(a => a.group === group),
		})).filter(g => g.apps.length > 0),
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

	return { visibleApps, appsByGroup, currentApp, recentApps, canSeeItem };
}
