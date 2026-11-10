import * as z from 'zod';
import {
	ASSET_CONDITION_LABELS,
	ASSET_STATUS_LABELS,
	type AssetAssignmentConfirmation,
	type AssetCondition,
	type AssetMaintenanceStatus,
	type AssetStatus,
} from '~/types/asset.types';
import { formatDate } from '~/utils/date';

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
	BROKEN: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
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
	vendorId: 'Nhà cung cấp',
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
	salvageValue: 'Giá trị thu hồi',
	accountingClass: 'Phân loại kế toán',
	plan: 'Gói',
	billingCycle: 'Chu kỳ thanh toán',
	nextRenewalDate: 'Hạn gia hạn',
	anchorDay: 'Ngày neo',
	seatCount: 'Số ghế',
	unitPrice: 'Đơn giá',
	pricingUnit: 'Cách tính giá',
	autoRenew: 'Tự động gia hạn',
	ownerId: 'Người phụ trách',
	adminAccount: 'Tài khoản quản trị',
	adminUrl: 'Trang quản trị',
	passwordManagerUrl: 'Link password manager',
	paymentMethodNote: 'Ghi chú thanh toán',
	technicalInfo: 'Thông tin kỹ thuật',
};

const DATE_FIELDS = new Set([
	'purchaseDate', 'warrantyEndDate', 'depreciationStartDate', 'depreciationStopDate',
	'nextRenewalDate', 'assignedAt', 'returnedAt', 'doneAt', 'date', 'periodStart', 'periodEnd',
]);
const MONEY_FIELDS = new Set(['cost', 'costVnd', 'salvageValue', 'unitPrice', 'amount', 'amountVnd']);

const OUTCOME_LABELS: Record<string, string> = {
	DONE: 'Sửa xong',
	UNREPAIRABLE: 'Không sửa được',
	CANCELLED: 'Huỷ phiếu',
};
const SOURCE_LABELS: Record<string, string> = {
	MANUAL: 'Tạo thủ công',
	IMPORT: 'Nhập từ file Excel',
};

const isDateString = (v: unknown): v is string =>
	typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);

/** Một giá trị trong payload → chuỗi đọc được, theo tên trường mà nó thuộc về. */
function fieldValue(field: string, value: unknown): string {
	if (value === null || value === undefined || value === '') return 'để trống';
	if (typeof value === 'boolean') return value ? 'Có' : 'Không';
	if (MONEY_FIELDS.has(field) && typeof value === 'number') return formatAssetMoney(value);
	if (DATE_FIELDS.has(field) && isDateString(value)) return formatDate(value);
	if (field === 'condition' && typeof value === 'string') {
		return ASSET_CONDITION_LABELS[value as AssetCondition] ?? value;
	}
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
				lines.push(`Giao cho ${who}${resp ? ` (người chịu trách nhiệm: ${resp})` : ''}`);
			}
			if (isDateString(p.assignedAt)) lines.push(`Ngày giao ${formatDate(p.assignedAt as string)}`);
			if (p.condition) lines.push(`Tình trạng khi giao: ${fieldValue('condition', p.condition)}`);
			if (str('source')) lines.push(SOURCE_LABELS[str('source')!] ?? '');
			return lines.filter(Boolean);
		}
		case 'RETURNED': {
			if (who) lines.push(`Thu hồi từ ${who}`);
			if (isDateString(p.returnedAt)) lines.push(`Ngày thu ${formatDate(p.returnedAt as string)}`);
			if (p.condition) lines.push(`Tình trạng khi thu: ${fieldValue('condition', p.condition)}`);
			if (str('note')) lines.push(`Ghi chú: ${str('note')}`);
			if (p.transfer === true) lines.push('Nằm trong một lần điều chuyển');
			return lines;
		}
		case 'ASSIGNMENT_CONFIRMED':
			return who ? [`${who} xác nhận đã nhận`] : [];
		case 'ASSIGNMENT_DISPUTED':
			return str('reason') ? [`Lý do báo không đúng: ${str('reason')}`] : [];
		case 'REPAIR_OPENED':
			return str('description') ? [`Hỏng hóc: ${str('description')}`] : [];
		case 'REPAIR_CLOSED': {
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
		case 'UPDATED':
		case 'VALUE_CHANGED':
			return diffLines(p);
		default:
			// Loại sự kiện chưa dịch: im lặng còn hơn đổ mã kỹ thuật ra màn hình.
			return [];
	}
}
