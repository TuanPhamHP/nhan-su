import { moduleLapsedMessage } from '~/utils/module-expiry';
import type { ModuleCode, ModuleStateReason } from '~/types/entitlement.types';
import type { AppModuleDef, NavItem } from '~/types/navigation.types';

/**
 * Một phân hệ công ty chưa dùng được.
 *
 * Phân hệ như vậy vẫn nằm trong lưới ở trạng thái khoá, vì người dùng cần biết hệ thống có phân
 * hệ đó để còn hỏi mua, còn ô biến mất thì họ chỉ thấy một hệ thống thiếu tính năng.
 */
export interface LockedApp extends AppModuleDef {
	/** Module bán riêng khiến cả phân hệ bị khoá. */
	module: ModuleCode;
	/** Vì sao khoá, để câu trong hộp thoại nói đúng chuyện. */
	lockReason: ModuleStateReason;
	/** Nhãn ngắn hiện ngay trên ô. */
	lockBadge: string;
}

export interface LauncherApps {
	visible: AppModuleDef[];
	locked: LockedApp[];
}

export interface LauncherRules {
	/** Người này xem được mục này, đã tính cả điều kiện module. */
	canSeeItem: (item: NavItem) => boolean;
	/** Người này xem được mục này nếu công ty có module, tức là chỉ xét vai trò và quyền. */
	canSeeItemIgnoringModule: (item: NavItem) => boolean;
	/** `null` khi phân hệ dùng được; có giá trị kèm lý do khi công ty chưa dùng được. */
	moduleLock: (code: ModuleCode) => { reason: ModuleStateReason } | null;
}

/** Nhãn ngắn trên ô khoá, theo lý do công ty chưa dùng được phân hệ. */
export function lockBadgeText(reason: ModuleStateReason): string {
	if (reason === 'SUSPENDED') return 'Tạm ngưng';
	if (reason === 'LAPSED') return 'Đã hết hạn';
	if (reason === 'NOT_SUBSCRIBED') return 'Chưa đăng ký';
	return 'Chưa mở';
}

/** Câu chính trong hộp thoại khi người dùng bấm vào một phân hệ đang khoá. */
export function lockMessage(label: string, reason: ModuleStateReason): string {
	if (reason === 'NOT_SUBSCRIBED') return `Công ty bạn chưa đăng ký phân hệ ${label}.`;
	if (reason === 'SUSPENDED') return `Phân hệ ${label} đang tạm ngưng với công ty bạn.`;
	if (reason === 'LAPSED') return moduleLapsedMessage(label);
	return `Phân hệ ${label} chưa được mở cho công ty bạn.`;
}

/**
 * Câu hướng dẫn trong hộp thoại, đã tách sẵn phần số để template dựng liên kết `tel:`.
 *
 * Tách làm ba mảnh thay vì trả một chuỗi: số hotline phải bấm gọi được trên điện thoại, mà cắt
 * chuỗi trong template thì câu chữ nằm hai nơi. `text` là cả câu, dùng cho test và cho trình đọc
 * màn hình.
 */
export interface LockHint {
	before: string;
	/** `null` khi câu không có số — khi đó cả câu nằm trong `before`. */
	phone: string | null;
	after: string;
	text: string;
}

/** Bỏ chuỗi rỗng hoặc toàn khoảng trắng. BE đã cắt hai đầu, đây là lớp chắn cuối. */
function cleanHotline(raw: string | null | undefined): string | null {
	const value = (raw ?? '').trim();
	return value === '' ? null : value;
}

/**
 * Số để đặt vào `href="tel:"`. Giữ dấu cộng của số quốc tế, bỏ mọi ký tự trình bày, nên người
 * vận hành ghi `0888 888 888` hay `+84 888 888 888` trong env thì vẫn gọi được.
 */
export function hotlineTelHref(phone: string): string {
	return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/**
 * Câu hướng dẫn: ai làm được gì tiếp theo.
 *
 * Chỉ quản trị viên mới thấy hotline, vì họ là người đi đăng ký thêm phân hệ; nhân viên đọc số
 * của nhà cung cấp rồi gọi thẳng thì vừa phiền nhà cung cấp vừa qua mặt người quản trị công ty.
 * Không có hotline thì giữ nguyên câu cũ, không nói nửa vời kiểu "liên hệ hotline" mà thiếu số.
 */
export function lockHint(isAdmin: boolean, hotline: string | null | undefined): LockHint {
	const phone = isAdmin ? cleanHotline(hotline) : null;

	if (!phone) {
		const text = isAdmin
			? 'Liên hệ nhà cung cấp phần mềm để đăng ký thêm phân hệ này.'
			: 'Bạn liên hệ quản trị viên của công ty nếu cần dùng phân hệ này.';
		return { before: text, phone: null, after: '', text };
	}

	const before = 'Liên hệ nhà cung cấp phần mềm qua hotline ';
	const after = ' để đăng ký thêm phân hệ này.';
	return { before, phone, after, text: `${before}${phone}${after}` };
}

/**
 * Chia danh mục phân hệ thành phần dùng được và phần đang khoá.
 *
 * Phân hệ mà mọi màn hình đều thuộc một module bán riêng (`AppModuleDef.module`) thì khoá cả ô,
 * còn phân hệ gộp nhiều thứ vẫn lọc từng mục như cũ: ô của nó chỉ mất đi khi không còn mục nào.
 * Ô khoá chỉ hiện cho người mà nếu công ty mua thì vào được ít nhất một mục, nên nhân viên không
 * thấy ô dẫn vào nơi mà dù có mua họ cũng không được vào.
 */
export function splitLauncherApps(defs: AppModuleDef[], rules: LauncherRules): LauncherApps {
	const visible: AppModuleDef[] = [];
	const locked: LockedApp[] = [];

	for (const app of defs) {
		const lock = app.module ? rules.moduleLock(app.module) : null;

		if (app.module && lock) {
			const items = app.items.filter(rules.canSeeItemIgnoringModule);
			if (items.length === 0) continue;
			locked.push({
				...app,
				module: app.module,
				items,
				lockReason: lock.reason,
				lockBadge: lockBadgeText(lock.reason),
			});
			continue;
		}

		const items = app.items.filter(rules.canSeeItem);
		if (items.length === 0) continue;
		// `home` khai sẵn là màn quản lý, mà nhân viên bị chặn khỏi `/management/**`, nên lấy mục
		// đầu tiên người này xem được làm nơi ô phân hệ dẫn tới.
		const home = items.some(i => i.route === app.home) ? app.home : (items[0]?.route ?? app.home);
		visible.push({ ...app, items, home });
	}

	return { visible, locked };
}
