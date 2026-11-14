import * as z from 'zod';
import {
	ASSET_ACCOUNTING_CLASS_LABELS,
	ASSET_BILLING_CYCLE_LABELS,
	ASSET_CONDITION_LABELS,
	ASSET_KIND_LABELS,
	ASSET_MAINTENANCE_STATUS_LABELS,
	ASSET_MAINTENANCE_TYPE_LABELS,
	ASSET_PRICING_UNIT_LABELS,
	ASSET_STATUS_LABELS,
	type AssetAssignment,
	type AssetAssignmentConfirmation,
	type AssetCondition,
	type AssetIncidentStatus,
	type AssetIncidentType,
	type AssetMaintenanceStatus,
	type AssetMaintenanceType,
	type AssetStatus,
} from '~/types/asset.types';
import { formatDate, todayYmd, vnCalendarDaysBetween } from '~/utils/date';

/**
 * Tải blob về máy.
 *
 * BE có gửi `Content-Disposition` nhưng `$fetch` với `responseType: 'blob'` không đưa
 * header ra, nên tên file do nơi gọi đặt — cùng cách trang Hợp đồng và Vi phạm đang làm.
 */
export function downloadAssetBlob(blob: Blob, fileName: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = fileName;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

const MONEY = new Intl.NumberFormat('vi-VN');

/**
 * Hiện tiền, hoặc dấu gạch khi người xem không có `asset:value:read`.
 *
 * `null` ở trường tiền nghĩa là "bạn không được xem", KHÔNG phải "bằng 0" — hai thứ này
 * mà hiển thị giống nhau thì người dùng tưởng tài sản không có giá.
 */
export function formatAssetMoney(value: number | null | undefined, currency = 'VND'): string {
	if (value == null) return '—';
	return currency === 'VND' ? `${MONEY.format(value)} ₫` : `${MONEY.format(value)} ${currency}`;
}

/** Màu chip trạng thái tài sản, dùng chung cho mọi bảng trong module. */
export const ASSET_STATUS_CLASS: Record<AssetStatus, string> = {
	AVAILABLE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
	IN_USE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
	IN_REPAIR: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
	// Đang bảo dưỡng là việc theo lịch, không phải hỏng hóc, nên tách màu khỏi Đang sửa.
	IN_MAINTENANCE: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
	BROKEN: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
	// Chờ xác minh mất là việc cần người xử lý, khác hẳn Mất đã chốt (màu xám, đã xong).
	LOSS_REPORTED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
	LOST: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
	DISPOSED: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
	ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
	EXPIRED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
	CANCELLED: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

export const MAINTENANCE_STATUS_CLASS: Record<AssetMaintenanceStatus, string> = {
	OPEN: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
	IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
	DONE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
	UNREPAIRABLE: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
	CANCELLED: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

export const MAINTENANCE_TYPE_CLASS: Record<AssetMaintenanceType, string> = {
	REPAIR: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
	MAINTENANCE: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
};

export const INCIDENT_STATUS_CLASS: Record<AssetIncidentStatus, string> = {
	OPEN: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
	REPAIR_OPENED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
	LOSS_CONFIRMED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
	CLOSED: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
	RESOLVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

/**
 * Tên người giữ của một lần cấp phát, dùng chung cho bảng người dùng, hộp thu hồi và toast.
 * Giao cho phòng ban thì kèm người chịu trách nhiệm.
 */
export function assignmentHolderName(a: {
	employee: { fullName: string } | null;
	department: { name: string } | null;
	responsible: { fullName: string } | null;
}): string {
	if (a.employee) return a.employee.fullName;
	if (a.department) {
		return a.responsible ? `${a.department.name} (${a.responsible.fullName})` : a.department.name;
	}
	return '—';
}

/**
 * Viết thường chữ cái đầu để ghép vào giữa câu. Chỉ chữ đầu: câu có tên người phía sau
 * ("Điều chuyển sang Ngô Thị Hương") mà hạ cả câu thì tên người cũng thành chữ thường.
 */
export function lowerFirst(text: string): string {
	return text ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

/**
 * Câu nói vì sao một lần cấp phát đã kết thúc.
 *
 * Điều chuyển thì gọi tên người nhận mới thay vì chỉ ghi "Điều chuyển"; dữ liệu cũ trước 14/11
 * không nối được hai lần (`transferredTo` null) nên rơi về nhãn của BE.
 */
export function assignmentEndText(a: {
	endReason: AssetAssignment['endReason'];
	endReasonLabel: string | null;
	transferredTo: AssetAssignment['transferredTo'];
}): string {
	if (a.endReason === 'TRANSFERRED' && a.transferredTo) {
		return `Điều chuyển sang ${a.transferredTo.holderName}`;
	}
	return a.endReasonLabel ?? 'Thu hồi';
}

export const INCIDENT_TYPE_CLASS: Record<AssetIncidentType, string> = {
	DAMAGE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
	LOSS: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

/**
 * Trạng thái mà nhân viên còn báo hỏng, báo mất được.
 *
 * Thiết bị đang sửa, đang bảo dưỡng hay đã báo mất thì BE trả 409
 * `ASSET_INCIDENT_NOT_ALLOWED`: đã có người đang xử lý, báo thêm chỉ gây trùng.
 */
export const INCIDENT_REPORTABLE_STATUSES: AssetStatus[] = ['IN_USE', 'AVAILABLE', 'BROKEN'];

/** Trạng thái đang có người xử lý — hiện nhãn trạng thái thay cho nút báo. */
export const INCIDENT_BLOCKED_STATUSES: AssetStatus[] = [
	'IN_REPAIR',
	'IN_MAINTENANCE',
	'LOSS_REPORTED',
];

/**
 * Còn báo được loại này không.
 *
 * `hasOpenSameType` là "mình đã có báo cáo CÙNG LOẠI đang chờ": báo hỏng đang chờ không
 * chặn báo mất và ngược lại, đúng như luật 409 `ASSET_INCIDENT_OPEN` của BE.
 */
export function canReportIncident(status: AssetStatus, hasOpenSameType: boolean): boolean {
	return INCIDENT_REPORTABLE_STATUSES.includes(status) && !hasOpenSameType;
}

/** Người tạo phiếu; `null` là phiếu bảo dưỡng do việc định kỳ tự mở. */
export function maintenanceCreatorName(createdBy: { name: string } | null): string {
	return createdBy?.name ?? 'Hệ thống';
}

/**
 * Hạn bảo dưỡng còn bao nhiêu ngày. `null` khi tài sản không có lịch.
 *
 * Đếm theo lịch Việt Nam chứ không theo giờ máy, để máy đặt múi giờ khác không làm lệch
 * một ngày quanh nửa đêm — cùng cách các mốc hạn khác trong app đang tính.
 */
export function maintenanceDaysLeft(nextMaintenanceDate: string | null): number | null {
	if (!nextMaintenanceDate) return null;
	return vnCalendarDaysBetween(todayYmd(), nextMaintenanceDate);
}

/** Màu của hạn bảo dưỡng: đỏ khi quá hạn, hổ phách khi còn 30 ngày trở xuống. */
export function maintenanceDueClass(nextMaintenanceDate: string | null): string {
	const days = maintenanceDaysLeft(nextMaintenanceDate);
	if (days == null) return 'text-gray-400 dark:text-gray-500';
	if (days < 0) return 'text-rose-600 dark:text-rose-400 font-semibold';
	if (days <= 30) return 'text-amber-600 dark:text-amber-400 font-semibold';
	return 'text-gray-700 dark:text-gray-200';
}

/** Chữ đi kèm hạn bảo dưỡng, VD "còn 10 ngày" hay "quá hạn 3 ngày". */
export function maintenanceDueLabel(nextMaintenanceDate: string | null): string {
	const days = maintenanceDaysLeft(nextMaintenanceDate);
	if (days == null) return '';
	if (days < 0) return `quá hạn ${Math.abs(days)} ngày`;
	if (days === 0) return 'đến hạn hôm nay';
	return `còn ${days} ngày`;
}

export const CONFIRMATION_CLASS: Record<AssetAssignmentConfirmation, string> = {
	PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
	CONFIRMED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
	DISPUTED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
	NOT_REQUIRED: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

/**
 * Màu của cột "Còn N ngày". Số âm là đã quá hạn.
 *
 * Mốc 7 và 30 ngày trùng với mốc BE gửi thông báo nhắc hạn, để người đọc bảng thấy đúng
 * thứ mà hộp thư của họ đang báo.
 */
export function renewalDaysClass(days: number | null): string {
	if (days == null) return 'text-gray-400 dark:text-gray-500';
	if (days < 0) return 'text-rose-600 dark:text-rose-400 font-semibold';
	if (days <= 7) return 'text-amber-600 dark:text-amber-400 font-semibold';
	if (days <= 30) return 'text-amber-600 dark:text-amber-400';
	return 'text-gray-600 dark:text-gray-300';
}

/** Chữ của cột "Còn N ngày". */
export function renewalDaysLabel(days: number | null): string {
	if (days == null) return '—';
	if (days < 0) return `Quá hạn ${Math.abs(days)} ngày`;
	if (days === 0) return 'Hết hạn hôm nay';
	return `Còn ${days} ngày`;
}

/** Kích thước file cho bảng giấy tờ. */
export function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Giá trị của ô `<select>` về lại kiểu enum.
 *
 * Ô chọn trả chuỗi rỗng khi người dùng chọn "không ghi"; hàm này đổi thành `undefined`
 * mà vẫn giữ kiểu, thay vì ép bừa bằng `as` — ép bừa thì sau này đổi tên mã enum sẽ
 * không có chỗ nào báo lỗi.
 */
export function asAssetEnum<T extends string>(
	value: string | undefined,
	allowed: readonly T[],
): T | undefined {
	return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

/** Danh sách mã tình trạng, để truyền vào `asAssetEnum`. */
export const ASSET_CONDITION_CODES: AssetCondition[] = [
	'NEW',
	'GOOD',
	'SCRATCHED',
	'FAULTY',
	'BROKEN',
];

/**
 * Schema cho ô số.
 *
 * `<input type="number">` qua vee-validate trả về SỐ, không phải chuỗi, nên khai
 * `z.string()` là form tự chặn mình với thông báo tiếng Anh "Expected string, received
 * number" — người dùng không hiểu và cũng không sửa được. Nhận cả hai kiểu rồi quy đổi
 * lúc gửi đi bằng `toAssetNumber`.
 */
export const assetNumberField = z.union([z.string(), z.number()]).optional();

/** Giá trị ô số về `number | undefined`, bỏ qua chuỗi rỗng và giá trị không phải số. */
export function toAssetNumber(v: string | number | null | undefined): number | undefined {
	if (v == null || v === '') return undefined;
	const n = typeof v === 'number' ? v : Number(v);
	return Number.isFinite(n) ? n : undefined;
}

/** Giá trị ô chữ về `string | undefined`, bỏ qua chuỗi rỗng. */
export function toAssetText(v: string | number | null | undefined): string | undefined {
	if (v == null) return undefined;
	const s = String(v).trim();
	return s === '' ? undefined : s;
}

// ─── Diễn giải sự kiện trong tab Lịch sử ──────────────────────────────────────
//
// `payload` của mỗi sự kiện là dữ liệu kỹ thuật do BE ghi lại (`employeeId`,
// `maintenanceId`, `statusAfter`...). Đổ thẳng ra màn hình thì người dùng đọc không hiểu,
// nên ở đây dịch sang câu tiếng Việt và BỎ HẲN những khoá chỉ có nghĩa với lập trình
// viên. Không dựng được câu thì thà không hiện gì còn hơn hiện mã.

/** Nhãn tiếng Việt cho các trường có thể đổi (sự kiện `UPDATED`, `VALUE_CHANGED`). */
const FIELD_LABELS: Record<string, string> = {
	name: 'Tên tài sản',
	code: 'Mã tài sản',
	note: 'Ghi chú',
	purchaseDate: 'Ngày mua',
	cost: 'Nguyên giá',
	currency: 'Tiền tệ',
	exchangeRate: 'Tỷ giá',
	costVnd: 'Nguyên giá quy đổi',
	categoryId: 'Loại tài sản',
	category: 'Loại tài sản',
	vendorId: 'Nhà cung cấp',
	vendor: 'Nhà cung cấp',
	maintenanceVendor: 'Đơn vị sửa chữa của phiếu',
	manufacturer: 'Hãng',
	model: 'Model',
	serialNumber: 'Số serial',
	location: 'Vị trí',
	condition: 'Tình trạng',
	warrantyMonths: 'Số tháng bảo hành',
	warrantyEndDate: 'Hết hạn bảo hành',
	depreciationStartDate: 'Bắt đầu khấu hao',
	depreciationMonths: 'Số tháng khấu hao',
	depreciationStopDate: 'Dừng khấu hao',
	salvageValue: 'Giá trị thanh lý ước tính',
	accountingClass: 'Phân loại kế toán',
	plan: 'Gói',
	billingCycle: 'Chu kỳ thanh toán',
	nextRenewalDate: 'Hạn gia hạn kế tiếp',
	anchorDay: 'Ngày neo',
	seatCount: 'Số ghế',
	unitPrice: 'Đơn giá',
	pricingUnit: 'Cách tính giá',
	autoRenew: 'Tự động gia hạn',
	ownerId: 'Người phụ trách',
	adminAccount: 'Tài khoản quản trị',
	adminUrl: 'Trang quản trị',
	passwordManagerUrl: 'Đường dẫn trình quản lý mật khẩu',
	paymentMethodNote: 'Ghi chú thanh toán',
	technicalInfo: 'Thông tin kỹ thuật',
	intervalMonths: 'Chu kỳ bảo dưỡng',
	nextMaintenanceDate: 'Hạn bảo dưỡng kế tiếp',
};

const DATE_FIELDS = new Set([
	'purchaseDate', 'warrantyEndDate', 'depreciationStartDate', 'depreciationStopDate',
	'nextRenewalDate', 'assignedAt', 'returnedAt', 'doneAt', 'date', 'periodStart', 'periodEnd',
	'nextMaintenanceDate', 'occurredOn', 'lostOn',
]);
const MONEY_FIELDS = new Set(['cost', 'costVnd', 'salvageValue', 'unitPrice', 'amount', 'amountVnd']);

/** Kết quả đóng phiếu. "Xong" dùng chung cho phiếu sửa và phiếu bảo dưỡng. */
const OUTCOME_LABELS: Record<string, string> = {
	DONE: 'Xong',
	UNREPAIRABLE: 'Không sửa được',
	CANCELLED: 'Huỷ phiếu',
};
const SOURCE_LABELS: Record<string, string> = {
	MANUAL: 'Tạo thủ công',
	IMPORT: 'Nhập từ file Excel',
};
/** Cách một báo hỏng, báo mất được xử lý (`INCIDENT_HANDLED`). */
const INCIDENT_OUTCOME_LABELS: Record<string, string> = {
	REPAIR_OPENED: 'Đã tạo phiếu sửa',
	LOSS_CONFIRMED: 'Đã xác nhận mất',
	FOUND: 'Đã tìm thấy tài sản',
	CLOSED: 'Đóng, không cần sửa',
	RESOLVED: 'Phiếu sửa tạo từ báo hỏng đã đóng',
};

/**
 * Trường lưu mã enum trong sự kiện sửa thông tin. Đổ mã thô ra màn hình thì người đọc thấy
 * "Chu kỳ thanh toán: MONTHLY → YEARLY", nên dịch qua đúng bộ nhãn của ô chọn.
 */
const ENUM_FIELD_LABELS: Record<string, Record<string, string>> = {
	condition: ASSET_CONDITION_LABELS,
	billingCycle: ASSET_BILLING_CYCLE_LABELS,
	pricingUnit: ASSET_PRICING_UNIT_LABELS,
	accountingClass: ASSET_ACCOUNTING_CLASS_LABELS,
	kind: ASSET_KIND_LABELS,
	status: ASSET_STATUS_LABELS,
};

const isDateString = (v: unknown): v is string =>
	typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);

/** Một giá trị trong payload → chuỗi đọc được, theo tên trường mà nó thuộc về. */
function fieldValue(field: string, value: unknown): string {
	if (value === null || value === undefined || value === '') return 'để trống';
	if (typeof value === 'boolean') return value ? 'Có' : 'Không';
	if (MONEY_FIELDS.has(field) && typeof value === 'number') return formatAssetMoney(value);
	if (DATE_FIELDS.has(field) && isDateString(value)) return formatDate(value);
	const enumLabels = ENUM_FIELD_LABELS[field];
	if (enumLabels && typeof value === 'string') return enumLabels[value] ?? value;
	if ((field === 'from' || field === 'to' || field === 'statusAfter') && typeof value === 'string') {
		return ASSET_STATUS_LABELS[value as AssetStatus] ?? value;
	}
	return String(value);
}

/** Nhánh `{ field: { from, to } }` của `UPDATED` / `VALUE_CHANGED`. */
function diffLines(payload: Record<string, unknown>): string[] {
	const out: string[] = [];
	for (const [field, change] of Object.entries(payload)) {
		if (!change || typeof change !== 'object' || Array.isArray(change)) continue;
		const c = change as { from?: unknown; to?: unknown };
		if (!('from' in c) && !('to' in c)) continue;
		const label = FIELD_LABELS[field] ?? field;
		// Trường khoá ngoại chỉ có số id, nói ra cũng không ai tra được: chỉ báo là có đổi.
		if (field.endsWith('Id')) {
			out.push(`${label}: đã thay đổi`);
			continue;
		}
		const from = fieldValue(field, c.from);
		const to = fieldValue(field, c.to);
		// BE ghi cả những trường gửi lên mà giá trị y như cũ; "X → X" chỉ làm rối mắt.
		if (from === to) continue;
		out.push(`${label}: ${from} → ${to}`);
	}
	return out;
}

/**
 * Sự kiện → vài dòng mô tả cho người đọc. Trả mảng rỗng khi không có gì đáng nói;
 * nơi gọi chỉ hiện nhãn loại sự kiện và thời điểm.
 */
export function describeAssetEvent(type: string, payload: Record<string, unknown>): string[] {
	const p = payload ?? {};
	const str = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : null);
	const num = (k: string) => (typeof p[k] === 'number' ? (p[k] as number) : null);
	const who = str('employeeName') ?? str('departmentName');
	const lines: string[] = [];

	switch (type) {
		case 'CREATED': {
			const src = str('source');
			if (src) lines.push(SOURCE_LABELS[src] ?? src);
			return lines;
		}
		case 'ASSIGNED': {
			if (who) {
				const resp = str('responsibleName');
				lines.push(`Cấp phát cho ${who}${resp ? `, ${resp} chịu trách nhiệm` : ''}`);
			}
			if (str('fromName')) lines.push(`Điều chuyển từ ${str('fromName')}`);
			if (isDateString(p.assignedAt)) lines.push(`Ngày cấp phát ${formatDate(p.assignedAt as string)}`);
			if (p.condition) lines.push(`Tình trạng khi cấp phát: ${fieldValue('condition', p.condition)}`);
			if (str('note')) lines.push(`Ghi chú: ${str('note')}`);
			if (str('source')) lines.push(SOURCE_LABELS[str('source')!] ?? '');
			return lines.filter(Boolean);
		}
		case 'RETURNED': {
			const reason = str('endReason');
			if (reason === 'TRANSFERRED' || p.transfer === true) {
				lines.push(
					str('toName')
						? `Điều chuyển từ ${who ?? 'người giữ cũ'} sang ${str('toName')}`
						: `Điều chuyển, người giữ cũ là ${who ?? 'không rõ'}`,
				);
			} else if (reason === 'LOST') {
				lines.push(who ? `Kết thúc vì tài sản mất khi ${who} đang giữ` : 'Kết thúc vì tài sản mất');
			} else if (who) {
				lines.push(`Thu hồi từ ${who}`);
			}
			if (isDateString(p.returnedAt)) lines.push(`Ngày thu hồi ${formatDate(p.returnedAt as string)}`);
			if (p.condition) lines.push(`Tình trạng khi thu hồi: ${fieldValue('condition', p.condition)}`);
			if (str('note')) lines.push(`Ghi chú: ${str('note')}`);
			return lines;
		}
		case 'ASSIGNMENT_CONFIRMED':
			return who ? [`${who} xác nhận đã nhận`] : [];
		case 'ASSIGNMENT_DISPUTED':
			return str('reason') ? [`Lý do người nhận báo chưa đúng: ${str('reason')}`] : [];
		case 'ASSIGNMENT_DISPUTE_RESOLVED': {
			if (str('reason')) lines.push(`Người nhận báo: ${str('reason')}`);
			if (str('response')) lines.push(`Trả lời: ${str('response')}`);
			return lines;
		}
		case 'REPAIR_OPENED': {
			// Một loại sự kiện dùng cho cả phiếu sửa và phiếu bảo dưỡng, nên phải nói rõ loại nào.
			const mType = str('maintenanceType');
			if (mType) lines.push(`Loại phiếu: ${ASSET_MAINTENANCE_TYPE_LABELS[mType as AssetMaintenanceType] ?? mType}`);
			if (str('description')) lines.push(`Nội dung: ${str('description')}`);
			return lines;
		}
		case 'REPAIR_CLOSED': {
			const mType = str('maintenanceType');
			if (mType) lines.push(`Loại phiếu: ${ASSET_MAINTENANCE_TYPE_LABELS[mType as AssetMaintenanceType] ?? mType}`);
			const outcome = str('outcome');
			if (outcome) lines.push(`Kết quả: ${OUTCOME_LABELS[outcome] ?? outcome}`);
			if (str('workDone')) lines.push(`Đã làm: ${str('workDone')}`);
			if (isDateString(p.doneAt)) lines.push(`Ngày xong ${formatDate(p.doneAt as string)}`);
			if (num('cost') !== null) lines.push(`Chi phí ${formatAssetMoney(num('cost'))}`);
			return lines;
		}
		case 'STATUS_CHANGED': {
			if (p.from || p.to) {
				lines.push(`Từ "${fieldValue('from', p.from)}" sang "${fieldValue('to', p.to)}"`);
			}
			if (isDateString(p.date)) lines.push(`Ngày ${formatDate(p.date as string)}`);
			if (str('reason')) lines.push(`Lý do: ${str('reason')}`);
			// Ghi mất khi còn người giữ thì lần cấp phát của người đó đóng luôn.
			if (str('holderName')) lines.push(`Đóng lần cấp phát của ${str('holderName')}`);
			return lines;
		}
		case 'RENEWED': {
			if (isDateString(p.periodStart) && isDateString(p.periodEnd)) {
				lines.push(`Kỳ ${formatDate(p.periodStart as string)} – ${formatDate(p.periodEnd as string)}`);
			}
			if (num('amount') !== null) {
				lines.push(`Số tiền ${formatAssetMoney(num('amount'), str('currency') ?? 'VND')}`);
			}
			if (isDateString(p.nextRenewalDate)) {
				lines.push(`Hạn kế tiếp ${formatDate(p.nextRenewalDate as string)}`);
			}
			return lines;
		}
		case 'SEATS_CHANGED':
			return [`Số ghế: ${p.from ?? 'không giới hạn'} → ${p.to ?? 'không giới hạn'}`];
		case 'LICENSE_KEY_CHANGED':
			return [str('action') === 'CLEAR' ? 'Đã xoá license key' : 'Đã đặt license key mới'];
		case 'INCIDENT_REPORTED': {
			const incidentType = str('incidentType');
			if (incidentType) {
				lines.push(incidentType === 'LOSS' ? 'Nhân viên báo mất' : 'Nhân viên báo hỏng');
			}
			if (str('description')) lines.push(`Nội dung: ${str('description')}`);
			if (isDateString(p.occurredOn)) {
				lines.push(`Ngày phát hiện ${formatDate(p.occurredOn as string)}`);
			}
			if (num('photoCount')) lines.push(`${num('photoCount')} ảnh kèm theo`);
			if (p.from || p.to) {
				lines.push(`Từ "${fieldValue('from', p.from)}" sang "${fieldValue('to', p.to)}"`);
			}
			return lines;
		}
		case 'INCIDENT_HANDLED': {
			const outcome = str('outcome');
			if (outcome) lines.push(INCIDENT_OUTCOME_LABELS[outcome] ?? outcome);
			const mOutcome = str('maintenanceOutcome');
			if (mOutcome) {
				lines.push(
					`Kết quả phiếu sửa: ${OUTCOME_LABELS[mOutcome] ?? ASSET_MAINTENANCE_STATUS_LABELS[mOutcome as AssetMaintenanceStatus] ?? mOutcome}`,
				);
			}
			if (isDateString(p.lostOn)) lines.push(`Ngày mất ${formatDate(p.lostOn as string)}`);
			if (p.from || p.to) {
				lines.push(`Từ "${fieldValue('from', p.from)}" sang "${fieldValue('to', p.to)}"`);
			}
			return lines;
		}
		case 'MAINTENANCE_SCHEDULED':
		case 'UPDATED':
		case 'VALUE_CHANGED':
			return diffLines(p);
		default:
			// Loại sự kiện chưa dịch: im lặng còn hơn đổ mã kỹ thuật ra màn hình.
			return [];
	}
}
