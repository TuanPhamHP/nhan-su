import type {
	HeadcountRowStatus,
	OfferTermError,
	RecruitmentApplicationStatus,
	RecruitmentApprovalStepStatus,
	RecruitmentEmailStatus,
	RecruitmentInterviewStatus,
	RecruitmentJobStatus,
	RecruitmentOfferStatus,
	RecruitmentProposalStatus,
	RecruitmentRequisitionStatus,
	RecruitmentScorecardStatus,
	RecruitmentStageKind,
	RecruitmentVerdict,
} from '~/types/recruitment.types';

/**
 * Tải blob về máy.
 *
 * `$fetch` với `responseType: 'blob'` không đưa header ra, nên tên file do nơi gọi đặt —
 * cùng cách module Tài sản, Hợp đồng và Vi phạm đang làm.
 */
export function downloadRecruitmentBlob(blob: Blob, fileName: string): void {
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
 * Hiện tiền, hoặc dấu gạch khi người xem không được xem lương.
 *
 * `null` ở trường tiền của module này nghĩa là "bạn không có quyền xem" HOẶC "chưa nhập",
 * KHÔNG phải "bằng 0" — hai thứ đó mà hiện giống nhau thì người dùng tưởng offer không có
 * lương. Phân biệt hai nghĩa bằng cờ `canViewSalary` của bản ghi.
 */
export function formatRecruitMoney(value: number | null | undefined): string {
	if (value == null) return '—';
	return `${MONEY.format(value)} ₫`;
}

/** Số nguyên có dấu phân cách, cho ô nhập tiền. */
export function formatRecruitNumber(value: number | null | undefined): string {
	return value == null ? '—' : MONEY.format(value);
}

/** Phần trăm của báo cáo: BE trả số như `62.5`, `null` khi không tính được. */
export function formatPercent(value: number | null | undefined): string {
	return value == null ? '—' : `${value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;
}

/** Kích thước file cho danh sách CV và tài liệu. */
export function formatFileSizeVn(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Điểm phiếu đánh giá, một chữ số thập phân (BR-07). */
export function formatScore(value: number | null | undefined): string {
	return value == null ? '—' : value.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
}

// ─── Màu chip trạng thái ──────────────────────────────────────────────────────

const GRAY = 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
const SLATE = 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
const AMBER = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
const BLUE = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
const GREEN = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
const ROSE = 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
const VIOLET = 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400';

export const REQUISITION_STATUS_CLASS: Record<RecruitmentRequisitionStatus, string> = {
	DRAFT: GRAY,
	PENDING: AMBER,
	APPROVED: BLUE,
	REJECTED: ROSE,
	RECRUITING: VIOLET,
	FILLED: GREEN,
	CANCELLED: SLATE,
};

export const JOB_STATUS_CLASS: Record<RecruitmentJobStatus, string> = {
	DRAFT: GRAY,
	OPEN: GREEN,
	PAUSED: AMBER,
	CLOSED: SLATE,
};

export const APPLICATION_STATUS_CLASS: Record<RecruitmentApplicationStatus, string> = {
	ACTIVE: BLUE,
	REJECTED: ROSE,
	WITHDRAWN: SLATE,
	HIRED: GREEN,
};

export const OFFER_STATUS_CLASS: Record<RecruitmentOfferStatus, string> = {
	DRAFT: GRAY,
	PENDING_APPROVAL: AMBER,
	APPROVED: BLUE,
	APPROVAL_REJECTED: ROSE,
	SENT: VIOLET,
	ACCEPTED: GREEN,
	DECLINED: ROSE,
	EXPIRED: SLATE,
	NO_SHOW: ROSE,
	CANCELLED: SLATE,
	SUPERSEDED: GRAY,
};

export const HEADCOUNT_STATUS_CLASS: Record<HeadcountRowStatus, string> = {
	CONFIRMED: GREEN,
	DRAFT: GRAY,
	PENDING: AMBER,
	REJECTED: ROSE,
	NONE: SLATE,
};

export const APPROVAL_STEP_CLASS: Record<RecruitmentApprovalStepStatus, string> = {
	WAITING: GRAY,
	PENDING: AMBER,
	APPROVED: GREEN,
	REJECTED: ROSE,
};

export const INTERVIEW_STATUS_CLASS: Record<RecruitmentInterviewStatus, string> = {
	SCHEDULED: BLUE,
	DONE: GREEN,
	NO_SHOW: AMBER,
	CANCELLED: SLATE,
};

export const SCORECARD_STATUS_CLASS: Record<RecruitmentScorecardStatus, string> = {
	PENDING: AMBER,
	SUBMITTED: GREEN,
};

export const VERDICT_CLASS: Record<RecruitmentVerdict, string> = {
	PASS: GREEN,
	FAIL: ROSE,
	CONSIDER: AMBER,
};

export const EMAIL_STATUS_CLASS: Record<RecruitmentEmailStatus, string> = {
	PENDING: AMBER,
	SENT: GREEN,
	FAILED: ROSE,
	CANCELLED: SLATE,
	SKIPPED: GRAY,
};

/** Màu cột trong kanban, theo loại vòng. */
export const STAGE_KIND_CLASS: Record<RecruitmentStageKind, string> = {
	APPLIED: 'border-t-gray-400',
	SCREENING: 'border-t-sky-400',
	TEST: 'border-t-violet-400',
	INTERVIEW: 'border-t-blue-500',
	OFFER: 'border-t-amber-500',
	HIRED: 'border-t-emerald-500',
};

// ─── Lỗi của API ──────────────────────────────────────────────────────────────

type ApiErrorShape = { error?: { code?: string; message?: string; errors?: unknown } };

/** Mã lỗi của BE, để trang phân nhánh theo mã thay vì so chuỗi `message`. */
export function recruitErrorCode(e: unknown): string | null {
	const data = (e as { data?: ApiErrorShape } | null)?.data;
	return data?.error?.code ?? null;
}

/**
 * Các lỗi điều khoản offer trong `error.errors[]`.
 *
 * Tạo và sửa offer là chỗ DUY NHẤT của module trả nhiều lỗi validate cùng lúc, và `min`,
 * `max` chỉ sống được ở đây vì chúng nằm trong từng phần tử; bộ lọc lỗi của API cắt mọi
 * trường lạ ở mức ngoài. Lỗi sai kiểu dữ liệu (DTO) thì không có `errors[]`, nên hàm này
 * trả mảng rỗng và nơi gọi rơi về `toast.error(message)`.
 */
export function offerTermErrors(e: unknown): OfferTermError[] {
	const raw = (e as { data?: ApiErrorShape } | null)?.data?.error?.errors;
	if (!Array.isArray(raw)) return [];
	return raw.filter(
		(x): x is OfferTermError =>
			!!x && typeof x === 'object' && typeof (x as OfferTermError).code === 'string',
	);
}

/**
 * Câu tiếng Việt của lỗi, đã được `auth.fetch.ts` gói vào `Error.message`.
 *
 * Mạng đứt hay server không trả lời thì không có câu nào của backend, và `ofetch` dựng một
 * `message` kiểu `[DELETE] "http://.../headcount-plans/5": <no response> Failed to fetch` —
 * người dùng đọc không hiểu gì. Những lúc đó dùng câu dự phòng của nơi gọi, vì nó nói đúng
 * việc vừa thất bại.
 */
export function recruitErrorMessage(e: unknown, fallback: string): string {
	if (!(e instanceof Error) || !e.message) return fallback;
	const hasApiMessage = !!(e as { data?: ApiErrorShape }).data?.error?.message;
	if (hasApiMessage) return e.message;
	return /^\[[A-Z]+\]\s/.test(e.message) ? fallback : e.message;
}

// ─── Giá trị ô nhập ───────────────────────────────────────────────────────────

/**
 * Giá trị ô `<select>` về lại kiểu enum.
 *
 * Ô chọn trả chuỗi rỗng khi người dùng chọn "tất cả"; hàm này đổi thành `undefined` mà vẫn
 * giữ kiểu, thay vì ép bừa bằng `as` — ép bừa thì sau này đổi tên mã enum sẽ không có chỗ
 * nào báo lỗi.
 */
export function asRecruitEnum<T extends string>(
	value: string | number | undefined | null,
	allowed: readonly T[],
): T | undefined {
	if (value == null || value === '') return undefined;
	const s = String(value);
	return (allowed as readonly string[]).includes(s) ? (s as T) : undefined;
}

/**
 * Giá trị ô số về `number | undefined`.
 *
 * `<input type="number">` qua vee-validate trả về SỐ, không phải chuỗi, nên form phải nhận
 * cả hai kiểu rồi quy đổi lúc gửi đi.
 */
export function toRecruitNumber(v: string | number | null | undefined): number | undefined {
	if (v == null || v === '') return undefined;
	const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''));
	return Number.isFinite(n) ? n : undefined;
}

/** Giá trị ô chữ về `string | undefined`, bỏ qua chuỗi rỗng. */
export function toRecruitText(v: string | number | null | undefined): string | undefined {
	if (v == null) return undefined;
	const s = String(v).trim();
	return s === '' ? undefined : s;
}

/** Lương thử việc tối thiểu theo BR-02: `ceil(lương × 0,85 / 1000) × 1000`. */
export function minProbationSalary(baseSalary: number | null | undefined): number | null {
	if (!baseSalary || baseSalary <= 0) return null;
	return Math.ceil((baseSalary * 0.85) / 1000) * 1000;
}

// ─── SMTP công ty ─────────────────────────────────────────────────────────────

/**
 * Bốn cổng backend nhận. Máy chủ thư chạy chung tiến trình với mọi công ty, nên cổng nào
 * cũng cho gõ thì form thành một công cụ dò cổng mạng nội bộ; cổng khác bị trả 400.
 */
export const SMTP_ALLOWED_PORTS = [25, 465, 587, 2525] as const;

export function isAllowedSmtpPort(port: number | null | undefined): boolean {
	return !!port && (SMTP_ALLOWED_PORTS as readonly number[]).includes(port);
}

/**
 * Bốn trường dính tới việc mật khẩu đã lưu sẽ được gửi đi đâu. Đổi bất kỳ trường nào trong
 * số này thì backend bắt nhập lại mật khẩu, để mật khẩu của máy chủ cũ không bị gửi sang một
 * máy chủ khác do người dùng vừa gõ vào.
 */
export function smtpTargetChanged(
	saved: { host: string | null; port: number | null; security: string | null; username: string | null } | null,
	draft: { host: string; port: number; security: string; username: string },
): boolean {
	if (!saved) return true;
	return (
		(saved.host ?? '') !== draft.host.trim() ||
		(saved.port ?? 0) !== draft.port ||
		(saved.security ?? '') !== draft.security ||
		(saved.username ?? '') !== draft.username.trim()
	);
}

/** Danh sách năm cho ô chọn năm định biên: năm nay ± 2. */
export function headcountYearOptions(): { value: number; label: string }[] {
	const now = new Date().getFullYear();
	return [now - 2, now - 1, now, now + 1, now + 2].map(y => ({ value: y, label: `Năm ${y}` }));
}

// ─── Nút trên một dòng định biên ──────────────────────────────────────────────

/** Phần của một dòng định biên đủ để quyết định hiện nút. */
export interface HeadcountRowActionInput {
	confirmedQuantity: number | null;
	proposalStatus: RecruitmentProposalStatus | null;
	current: number;
	recruiting: number;
	/** Yêu cầu tuyển chưa kết thúc của (năm, vị trí); không tính Đã huỷ, Đã đủ và đã xoá. */
	requisitionCount: number;
}

/** Hai quyền ghi của màn định biên, tách riêng vì backend cũng kiểm riêng. */
export interface HeadcountRights {
	/** `recruitment:manage`: nhập nháp, đề xuất, gửi chốt, rút đề xuất, xoá dòng chưa chốt. */
	canPropose: boolean;
	/** `recruitment:headcount:confirm`: chốt, trả lại, sửa số đã chốt, xoá dòng đã chốt. */
	canConfirm: boolean;
}

/**
 * Đề xuất `PENDING` là trạng thái đóng băng: người chốt đã nhận thông báo N-15 và phải chốt
 * hoặc trả lại trước, nên sửa, rút và xoá đều bị backend trả 409 `RECRUIT_HEADCOUNT_PENDING`.
 */
function isFrozen(row: HeadcountRowActionInput): boolean {
	return row.proposalStatus === 'PENDING';
}

/** Đã từng chốt thì số đã chốt đang có hiệu lực, và mọi thao tác lên dòng đổi sang luật khác. */
function isConfirmed(row: HeadcountRowActionInput): boolean {
	return row.confirmedQuantity !== null;
}

/** Sửa hoặc mở đề xuất mới. */
export function canEditHeadcountProposal(
	row: HeadcountRowActionInput,
	rights: HeadcountRights,
): boolean {
	return rights.canPropose && !isFrozen(row);
}

/**
 * Rút đề xuất: chỉ có nghĩa với dòng ĐÃ CHỐT, vì rút xong còn lại số đã chốt. Dòng chưa từng
 * chốt mà rút thì còn lại một dòng rỗng vô nghĩa, nên backend trả 409
 * `RECRUIT_HEADCOUNT_NEVER_CONFIRMED` và hướng người dùng sang xoá cả dòng.
 */
export function canWithdrawHeadcountProposal(
	row: HeadcountRowActionInput,
	rights: HeadcountRights,
): boolean {
	if (!rights.canPropose && !rights.canConfirm) return false;
	if (!isConfirmed(row)) return false;
	return row.proposalStatus === 'DRAFT' || row.proposalStatus === 'REJECTED';
}

/**
 * Xoá cả dòng. Dòng chưa từng chốt là nháp của người phụ trách tuyển dụng nên họ tự xoá được;
 * dòng đã chốt là con số có hiệu lực nên chỉ người có quyền chốt xoá được.
 *
 * Dòng đang dùng vẫn xoá được, chỉ bắt nhập lý do — xem `isHeadcountRowInUse`.
 */
export function canDeleteHeadcountRow(
	row: HeadcountRowActionInput,
	rights: HeadcountRights,
): boolean {
	if (isFrozen(row)) return false;
	return isConfirmed(row) ? rights.canConfirm : rights.canPropose || rights.canConfirm;
}

/**
 * Dòng "đang dùng": đã chốt và đang có người hoặc còn yêu cầu tuyển chưa kết thúc.
 *
 * Xoá dòng này không bị chặn, nhưng backend bắt nhập lý do, nên frontend mở hộp cảnh báo kèm ô
 * lý do thay vì hộp xác nhận thường. Dùng `requisitionCount` chứ không dùng `recruiting`:
 * `recruiting` chỉ đếm phần còn thiếu của yêu cầu đã gửi, nên một dòng vướng yêu cầu nháp vẫn
 * có `recruiting = 0` và nếu xét theo nó thì frontend mở sai hộp rồi ăn 400.
 */
export function isHeadcountRowInUse(row: HeadcountRowActionInput): boolean {
	return isConfirmed(row) && (row.current > 0 || row.requisitionCount > 0);
}

/**
 * "đang có 5 người và 2 yêu cầu tuyển", bỏ vế bằng 0.
 *
 * Giữ 0 thì câu đọc thành "đang có 1 người và 0 yêu cầu tuyển", nghe như vừa đếm thiếu cái gì.
 * Backend cũng bỏ vế 0 trong `message` của 400, nên hai bên nói giống nhau.
 */
export function headcountUsageText(row: HeadcountRowActionInput): string {
	const parts: string[] = [];
	if (row.current > 0) parts.push(`${row.current} người`);
	if (row.requisitionCount > 0) parts.push(`${row.requisitionCount} yêu cầu tuyển`);
	if (!parts.length) return 'chưa có ai và chưa có yêu cầu tuyển nào';
	return `đang có ${parts.join(' và ')}`;
}

/**
 * Hậu quả của việc xoá một dòng đang dùng, theo mục "Luồng trạng thái → Định biên" của tài
 * liệu. Người bấm xoá cần đọc đủ bốn điều này trước khi quyết, vì ba trong số đó không thể
 * nhìn thấy ngay sau khi xoá.
 */
export function headcountDeleteConsequences(): string[] {
	return [
		'Nhân viên đang làm ở vị trí này không bị ảnh hưởng gì.',
		'Yêu cầu tuyển đã duyệt hoặc đang tuyển vẫn chạy tiếp.',
		'Yêu cầu nháp sẽ không gửi duyệt được và yêu cầu chờ duyệt sẽ không duyệt được, cho tới khi vị trí có định biên Đã chốt lại.',
		'Lịch sử thay đổi của dòng bị xoá theo; nhật ký hệ thống vẫn giữ bản chụp kèm lý do bạn nhập.',
	];
}

/**
 * Câu giải thích cho dòng `overCommitted`, thay cho mỗi chữ "Vượt định biên".
 *
 * Người dùng cần biết ba điều: đang dùng bao nhiêu trên bao nhiêu, yêu cầu đã duyệt không bị
 * huỷ, và cái gì sẽ bị chặn từ giờ. Thiếu câu thứ hai thì người xem tưởng những yêu cầu đang
 * tuyển vừa mất hiệu lực.
 */
export function overCommittedExplanation(row: HeadcountRowActionInput): string {
	const used = row.current + row.recruiting;
	return (
		`Đang dùng ${used} trên ${row.confirmedQuantity ?? 0} đã chốt. ` +
		'Yêu cầu đã duyệt giữ nguyên, yêu cầu mới bị chặn.'
	);
}

// ─── Giờ gửi thư từ chối (BR-09) ──────────────────────────────────────────────

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Giờ treo tường Việt Nam của một mốc thời gian. Việt Nam không đổi giờ mùa nên lệch cố định +7. */
function vnWallClock(at: Date): { y: number; m: number; d: number; h: number; min: number; dow: number } {
	const shifted = new Date(at.getTime() + VN_OFFSET_MS);
	return {
		y: shifted.getUTCFullYear(),
		m: shifted.getUTCMonth(),
		d: shifted.getUTCDate(),
		h: shifted.getUTCHours(),
		min: shifted.getUTCMinutes(),
		dow: shifted.getUTCDay(),
	};
}

function fromVnWallClock(y: number, m: number, d: number, h: number, min: number): Date {
	return new Date(Date.UTC(y, m, d, h, min) - VN_OFFSET_MS);
}

/**
 * Giờ hệ thống sẽ gửi thư từ chối nếu người dùng chọn "hẹn giờ" mà không tự đặt giờ (BR-09).
 *
 * Luật: 24 giờ sau lúc bấm; rơi vào thứ Bảy, Chủ nhật hoặc ngoài 08:00–18:00 giờ Việt Nam
 * thì dời sang 08:00 ngày làm việc kế tiếp. Tính lại ở FE chỉ để HIỂN THỊ cho người dùng
 * biết trước; giờ thật vẫn do BE chốt, nên đừng gửi con số này lên.
 */
export function defaultRejectEmailAt(now: Date = new Date()): Date {
	let at = new Date(now.getTime() + 24 * 60 * 60 * 1000);
	// Nhiều nhất vài vòng: cuối tuần dài nhất cũng chỉ đẩy sang thứ Hai.
	for (let i = 0; i < 7; i++) {
		const { y, m, d, h, dow } = vnWallClock(at);
		if (dow === 0 || dow === 6) {
			at = fromVnWallClock(y, m, d + 1, 8, 0);
			continue;
		}
		if (h < 8) {
			at = fromVnWallClock(y, m, d, 8, 0);
			continue;
		}
		if (h >= 18) {
			at = fromVnWallClock(y, m, d + 1, 8, 0);
			continue;
		}
		return at;
	}
	return at;
}

/**
 * Mở file bằng presigned URL.
 *
 * URL hết hạn sau 10 phút nên phải lấy ngay lúc bấm và mở luôn; đừng gắn sẵn vào `href`
 * lúc tải trang. `window.open` gọi sau `await` có thể bị popup blocker chặn, nên dùng
 * `location.assign` trên một tab mở trước khi chờ.
 */
export async function openPresignedUrl(fetchUrl: () => Promise<string | null>): Promise<void> {
	const tab = window.open('', '_blank');
	try {
		const url = await fetchUrl();
		if (!url) {
			tab?.close();
			throw new Error('Không có file để mở');
		}
		if (tab) tab.location.assign(url);
		else window.open(url, '_blank');
	} catch (e) {
		tab?.close();
		throw e;
	}
}
