import * as z from 'zod';
import {
	ASSET_ACCOUNTING_CLASS_LABELS,
	ASSET_BILLING_CYCLE_LABELS,
	ASSET_CONDITION_LABELS,
	ASSET_DISPOSAL_METHOD_LABELS,
	ASSET_KIND_LABELS,
	ASSET_MAINTENANCE_STATUS_LABELS,
	ASSET_MAINTENANCE_TYPE_LABELS,
	ASSET_PRICING_UNIT_LABELS,
	ASSET_STATUS_LABELS,
	ASSET_STOCKTAKE_RESOLUTION_LABELS,
	ASSET_STOCKTAKE_RESULT_LABELS,
	type Asset,
	type AssetAssignment,
	type AssetAssignmentConfirmation,
	type AssetCondition,
	type AssetDisposalItemError,
	type AssetDisposalMethod,
	type AssetDisposalStatus,
	type AssetIncidentStatus,
	type AssetIncidentType,
	type AssetMaintenanceStatus,
	type AssetMaintenanceType,
	type AssetStatus,
	type AssetStocktakeResolution,
	type AssetStocktakeResult,
	type AssetStocktakeStatus,
} from '~/types/asset.types';
import { format } from 'date-fns';
import { formatDate, todayYmd, vnCalendarDaysBetween } from '~/utils/date';
import { ASSET_FULL_SCOPE_ROLES } from '~/utils/permission';

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

// ─── Lô 2b: thanh lý, tem, kiểm kê ────────────────────────────────────────────

export const DISPOSAL_STATUS_CLASS: Record<AssetDisposalStatus, string> = {
	PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
	APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
	REJECTED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
	CANCELLED: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

export const STOCKTAKE_STATUS_CLASS: Record<AssetStocktakeStatus, string> = {
	OPEN: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
	CLOSED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
	CANCELLED: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

/** Đúng là xanh, chưa kiểm là xám; các kết quả lệch đều nổi màu để người kiểm thấy ngay. */
export const STOCKTAKE_RESULT_CLASS: Record<AssetStocktakeResult, string> = {
	PENDING: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
	OK: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
	WRONG_LOCATION: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
	WRONG_HOLDER: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
	DAMAGED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
	NOT_FOUND: 'bg-rose-200 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300',
};

export const STOCKTAKE_RESOLUTION_CLASS: Record<AssetStocktakeResolution, string> = {
	NONE: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
	UPDATED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
	REPAIR_OPENED: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
	MARKED_LOST: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
	IGNORED: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

/**
 * Câu L13 cạnh nút "Mở đợt kiểm kê" và ở đầu trang chi tiết đợt. Theo thiết kế, sửa sau bài nhập
 * vai đổi "hãy đóng" thành "bạn đóng" cho đúng giọng xưng "bạn" của cả app.
 */
export const STOCKTAKE_ONE_OPEN_HINT =
	'Mỗi lúc chỉ mở được một đợt kiểm kê, để mỗi lần quét luôn ghi vào đúng một đợt. Muốn mở đợt mới, bạn đóng hoặc huỷ đợt đang mở.';

/**
 * Người dùng không thấy chữ "vòng": phiếu gửi lần đầu không ghi gì, gửi lại thì "Gửi lại lần {n}".
 * Trả chuỗi rỗng cho lần đầu để nơi gọi bỏ qua.
 */
export function disposalResubmitText(round: number): string {
	return round > 1 ? `Gửi lại lần ${round}` : '';
}

/** Tên file tem có ngày giờ, để hai lần in trong ngày không đè tên nhau: `tem-tai-san-20261115-0912.pdf`. */
export function labelsFileName(now: Date = new Date()): string {
	return `tem-tai-san-${format(now, 'yyyyMMdd-HHmm')}.pdf`;
}

/**
 * Câu báo sau khi quét một tem vào đợt kiểm kê: mã, tên, serial và người giữ theo sổ, để người
 * đi kiểm nhìn câu là biết đã quét đúng máy chưa.
 */
export function scanResultText(line: {
	inScope: boolean;
	resultLabel: string;
	expectedHolderName: string | null;
	expectedDepartmentName: string | null;
	asset: { code: string; name: string; serialNumber: string | null };
}): string {
	const a = line.asset;
	const what = `${a.code} · ${a.name}${a.serialNumber ? ` (serial ${a.serialNumber})` : ''}`;
	if (!line.inScope) {
		return `${what} nằm ngoài phạm vi đợt này, chỉ ghi tham khảo và không đổi gì trên sổ.`;
	}
	return `Đã ghi ${line.resultLabel} cho ${what}${holderClause(line)}.`;
}

/**
 * Vế người giữ theo sổ. Cấp cho phòng ban thì BE ghi "Kho vận, Lan chịu trách nhiệm" (hoặc chỉ
 * tên phòng), nên nói "đang giao cho …" thay vì "… đang giữ".
 */
function holderClause(line: { expectedHolderName: string | null; expectedDepartmentName: string | null }): string {
	const name = line.expectedHolderName;
	if (!name) return ', theo sổ chưa cấp phát cho ai';
	const toDepartment = name.endsWith('chịu trách nhiệm') || name === line.expectedDepartmentName;
	return toDepartment ? `, theo sổ đang giao cho ${name}` : `, ${name} đang giữ`;
}

/** Trạng thái thiết bị thanh lý được (BR-16). */
export const DISPOSABLE_STATUSES: AssetStatus[] = ['AVAILABLE', 'BROKEN', 'LOST'];

/**
 * Hiện nút "Đề nghị thanh lý" ở trang tài sản: thiết bị Sẵn sàng, Hỏng hoặc Mất, không có người
 * giữ và chưa nằm trong phiếu chờ duyệt nào. Đây chỉ là luật hiện nút theo bảng màn hình của
 * bridge doc; BE vẫn kiểm lại và trả 409 kèm lý do khi không đủ điều kiện.
 */
export function canProposeDisposal(asset: Pick<Asset, 'kind' | 'status' | 'holders' | 'pendingDisposalId'>): boolean {
	return (
		asset.kind === 'PHYSICAL' &&
		DISPOSABLE_STATUSES.includes(asset.status) &&
		asset.holders.length === 0 &&
		asset.pendingDisposalId == null
	);
}

/**
 * Ai xem được đợt kiểm kê (vòng 3): người có `asset:manage`, hoặc người có `asset:read` với phạm
 * vi toàn công ty (ADMIN, HR, DIRECTOR, CHIEF), khớp BE. Trưởng phòng nhận 403 nên không thấy.
 * `hasPermission` truyền vào để hàm thuần, test được.
 */
export function canViewStocktakes(role: string | null | undefined, hasPermission: (code: string) => boolean): boolean {
	if (hasPermission('asset:manage')) return true;
	return !!role && (ASSET_FULL_SCOPE_ROLES as string[]).includes(role) && hasPermission('asset:read');
}

/**
 * Cách xử lý chọn sẵn trong hộp xử lý chênh lệch, người dùng vẫn đổi được. Dòng Không tìm thấy thì
 * KHÔNG chọn sẵn (vòng 3): thiết bị thường chỉ đi vắng lúc kiểm, chọn sẵn Xác nhận mất dễ làm bấm
 * nhầm một thao tác dừng khấu hao không hoàn tác được.
 */
export function suggestedResolution(
	result: AssetStocktakeResult,
): Exclude<AssetStocktakeResolution, 'NONE'> | undefined {
	switch (result) {
		case 'DAMAGED':
			return 'REPAIR_OPENED';
		case 'NOT_FOUND':
			return undefined;
		default:
			return 'UPDATED';
	}
}

/**
 * Nhãn của lựa chọn "không lọc trạng thái" ở danh sách tài sản (vòng 3). Không gõ từ khoá thì BE
 * ẩn thiết bị Đã thanh lý nên ghi rõ "trừ Đã thanh lý"; có từ khoá thì BE trả cả tài sản Đã thanh
 * lý; lọc riêng dịch vụ thì không có trạng thái này.
 */
export function defaultStatusLabel(kind: string | null | undefined, search: string | null | undefined): string {
	if (kind === 'SERVICE' || search?.trim()) return 'Tất cả trạng thái';
	return 'Tất cả, trừ Đã thanh lý';
}

/**
 * Dòng "đã đổi gì" của lần gửi lại (`history[].changes`, vòng 3). BE trả sẵn câu hoàn chỉnh, ví dụ
 * "Bỏ CTA000011 khỏi phiếu. Sửa lý do." hoặc "Gửi lại, không đổi nội dung phiếu.", nên web hiện
 * nguyên văn, không thêm tiền tố.
 */
export function disposalChangesText(changes: string | null | undefined): string {
	return changes?.trim() ?? '';
}

/**
 * Câu ngày dừng khấu hao cho hộp duyệt phiếu, lấy từ `items[].depreciationStopDate` (vòng 3).
 * Mọi thiết bị cùng ngày thì nêu ngày đó. Khác ngày thì nêu ngày thanh lý cho phần còn lại và kể
 * riêng thiết bị đã Mất giữ ngày ghi nhận mất.
 */
export function disposalStopDateText(d: {
	disposalDate: string;
	items: { code: string; depreciationStopDate: string }[];
}): string {
	const dates = [...new Set(d.items.map(i => i.depreciationStopDate))];
	if (dates.length <= 1) return `dừng khấu hao từ ngày ${formatDate(dates[0] ?? d.disposalDate)}`;
	const kept = d.items.filter(i => i.depreciationStopDate !== d.disposalDate);
	const list = kept.map(i => `${i.code} từ ngày ${formatDate(i.depreciationStopDate)}`).join(', ');
	return `dừng khấu hao từ ngày ${formatDate(d.disposalDate)}, riêng thiết bị đã Mất giữ ngày ghi nhận mất (${list})`;
}

/**
 * Số phiếu ghép vào câu, VD "phiếu thanh lý số 12", không dùng dạng "#12". Đứng riêng một ô thì
 * nơi gọi thêm chữ "Phiếu" phía trước.
 */
export function disposalNumber(id: number): string {
	return `số ${id}`;
}

/** Mã lỗi `error.code` của BE trong lỗi `authFetch` ném ra, để rẽ nhánh theo mã chứ không dò câu. */
export function apiErrorCode(e: unknown): string | undefined {
	return (e as { data?: { error?: { code?: string } } } | null)?.data?.error?.code;
}

/** Danh sách tài sản lỗi kèm 409 `ASSET_DISPOSAL_NOT_ALLOWED`; mảng rỗng khi lỗi khác. */
export function disposalItemErrors(e: unknown): AssetDisposalItemError[] {
	const list = (e as { data?: { error?: { errors?: unknown } } } | null)?.data?.error?.errors;
	if (!Array.isArray(list)) return [];
	return list.filter(
		(x): x is AssetDisposalItemError =>
			!!x && typeof x === 'object' && typeof (x as AssetDisposalItemError).assetId === 'number',
	);
}

const VND_INPUT = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

/** Số tiền nguyên VND → chữ trong ô nhập, VD `1500000` → `"1.500.000"`. */
export function formatVndInput(value: number | string | null | undefined): string {
	if (value == null || value === '') return '';
	const n = typeof value === 'number' ? value : Number(String(value).replace(/\D/g, ''));
	return Number.isFinite(n) ? VND_INPUT.format(n) : '';
}

/** Chữ người dùng gõ vào ô tiền nguyên VND → số; bỏ mọi ký tự không phải chữ số. Rỗng là `undefined`. */
export function parseVndInput(text: string | null | undefined): number | undefined {
	const digits = String(text ?? '').replace(/\D/g, '');
	if (!digits) return undefined;
	const n = Number(digits);
	return Number.isSafeInteger(n) ? n : undefined;
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
		// ─── Lô 2b: thanh lý ───
		// Người dùng không thấy chữ "vòng": lần đầu là "Gửi phiếu", gửi lại thì "lần {n}".
		case 'DISPOSAL_REQUESTED': {
			const id = num('disposalId');
			const round = num('round') ?? 1;
			if (id !== null) {
				lines.push(
					p.resubmitted === true || round > 1
						? `Sửa và gửi lại phiếu thanh lý ${disposalNumber(id)}, lần ${round}`
						: `Gửi phiếu thanh lý ${disposalNumber(id)}`,
				);
			}
			const method = str('method');
			if (method) lines.push(`Hình thức: ${ASSET_DISPOSAL_METHOD_LABELS[method as AssetDisposalMethod] ?? method}`);
			if (isDateString(p.disposalDate)) lines.push(`Ngày thanh lý: ${formatDate(p.disposalDate as string)}`);
			if (str('reason')) lines.push(`Lý do: ${str('reason')}`);
			return lines;
		}
		case 'DISPOSAL_REJECTED':
		case 'DISPOSAL_CANCELLED': {
			const id = num('disposalId');
			const round = num('round') ?? 1;
			if (id !== null) lines.push(`Phiếu thanh lý ${disposalNumber(id)}${round > 1 ? `, gửi lại lần ${round}` : ''}`);
			if (str('note')) lines.push(`${type === 'DISPOSAL_REJECTED' ? 'Lý do từ chối' : 'Lý do huỷ'}: ${str('note')}`);
			return lines;
		}
		case 'DISPOSED': {
			const id = num('disposalId');
			if (id !== null) lines.push(`Theo phiếu thanh lý ${disposalNumber(id)}`);
			const method = str('method');
			if (method) lines.push(`Hình thức: ${ASSET_DISPOSAL_METHOD_LABELS[method as AssetDisposalMethod] ?? method}`);
			if (p.from || p.to) {
				lines.push(`Từ "${fieldValue('from', p.from)}" sang "${fieldValue('to', p.to)}"`);
			}
			if (isDateString(p.disposalDate)) lines.push(`Ngày thanh lý: ${formatDate(p.disposalDate as string)}`);
			if (isDateString(p.depreciationStopDate)) {
				lines.push(`Dừng khấu hao từ ${formatDate(p.depreciationStopDate as string)}`);
			}
			if (str('note')) lines.push(`Ghi chú khi duyệt: ${str('note')}`);
			return lines;
		}
		// ─── Lô 2b: kiểm kê ───
		case 'STOCKTAKE_CHECKED': {
			const result = str('result');
			const resultLabel = result ? (ASSET_STOCKTAKE_RESULT_LABELS[result as AssetStocktakeResult] ?? result) : null;
			if (str('stocktakeName')) {
				lines.push(`Đợt "${str('stocktakeName')}"${resultLabel ? `, kết quả ${resultLabel}` : ''}`);
			} else if (resultLabel) {
				lines.push(`Kết quả ${resultLabel}`);
			}
			if (str('observedLocation')) lines.push(`Vị trí thực tế: ${str('observedLocation')}`);
			if (str('note')) lines.push(`Ghi chú: ${str('note')}`);
			if (p.byScan === true) lines.push('Ghi bằng cách quét tem');
			return lines;
		}
		case 'STOCKTAKE_RESOLVED': {
			const result = str('result');
			const resolution = str('resolution');
			const resultLabel = result ? (ASSET_STOCKTAKE_RESULT_LABELS[result as AssetStocktakeResult] ?? result) : null;
			if (str('stocktakeName')) {
				lines.push(`Đợt "${str('stocktakeName')}"${resultLabel ? `, kết quả ${resultLabel}` : ''}`);
			}
			if (resolution) {
				lines.push(
					`Cách xử lý: ${ASSET_STOCKTAKE_RESOLUTION_LABELS[resolution as AssetStocktakeResolution] ?? resolution}`,
				);
			}
			const loc = p.location;
			if (loc && typeof loc === 'object' && !Array.isArray(loc)) {
				const l = loc as { from?: unknown; to?: unknown };
				const to = fieldValue('location', l.to);
				// Sổ chưa ghi vị trí thì "từ "để trống"" đọc rất gượng: nói là ghi vị trí mới.
				lines.push(
					l.from == null || l.from === ''
						? `Vị trí: ghi mới "${to}"`
						: `Vị trí: từ "${fieldValue('location', l.from)}" sang "${to}"`,
				);
			}
			if (num('assignmentId') !== null) lines.push('Đổi người giữ theo kết quả kiểm kê');
			if (isDateString(p.lostDate)) lines.push(`Ngày mất ${formatDate(p.lostDate as string)}`);
			if (str('note')) lines.push(`Ghi chú: ${str('note')}`);
			return lines;
		}
		// Vòng 3: giấy tờ đính vào phiếu thanh lý nói rõ phiếu nào.
		case 'DOCUMENT_ADDED': {
			const file = str('fileName');
			if (!file) return [];
			const id = num('disposalId');
			return [id !== null ? `Thêm giấy tờ vào phiếu thanh lý ${disposalNumber(id)}: ${file}` : `Thêm giấy tờ: ${file}`];
		}
		case 'DOCUMENT_REMOVED':
			return str('fileName') ? [`Gỡ giấy tờ: ${str('fileName')}`] : [];
		case 'MAINTENANCE_SCHEDULED':
		case 'UPDATED':
		case 'VALUE_CHANGED':
			return diffLines(p);
		default:
			// Loại sự kiện chưa dịch: im lặng còn hơn đổ mã kỹ thuật ra màn hình.
			return [];
	}
}
