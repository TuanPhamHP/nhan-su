import type { LeaveCode } from '~/types/leave.types';

/**
 * Types cho 2 tool sửa dữ liệu phép năm.
 * Bridge doc: `docs/backend/bridges/tools/_fe-prompt-leave-tools.md`.
 *
 * THỨ TỰ BẮT BUỘC: bước 1 (`recalculate-requests`) luôn chạy trước bước 2 (`recalculate`)
 * — `usedDays` ở bước 2 được cộng từ `paidDays` mà bước 1 vừa ghi.
 */

// ─── Bước 1 — tính lại P/KL của đơn đã duyệt ──────────────────────────────────

export interface RecalculateLeaveSplitPayload {
	/** 2020–2100. */
	year: number;
	/** 1–12. Chỉ giới hạn phần GHI; việc phát lại quỹ luôn chạy trên cả năm. */
	month?: number;
	/** Bỏ trống → toàn bộ nhân sự. */
	employeeIds?: number[];
	/** Mặc định true ở backend — luôn truyền tường minh để tránh ghi nhầm. */
	dryRun?: boolean;
}

export interface LeaveSplitRecalcItem {
	leaveRequestId: number;
	employeeId: number;
	employeeCode: string;
	fullName: string;
	/** 'YYYY-MM-DD' — ngày nghỉ. */
	date: string;
	leaveTypeCode: 'ANNUAL' | 'HALF_DAY';
	totalDays: number;
	paidBefore: number;
	paidAfter: number;
	unpaidBefore: number;
	unpaidAfter: number;
	leaveCodeBefore: string | null;
	leaveCodeAfter: LeaveCode;
}

export interface LeaveSplitRecalcResult {
	dryRun: boolean;
	year: number;
	/** Tháng được áp dụng; null = cả năm. */
	month: number | null;
	/** Số đơn đã quét — LUÔN là cả năm. */
	scanned: number;
	/** Số đơn có thay đổi trong phạm vi áp dụng. */
	changed: number;
	/** Số đơn lệch nhưng nằm ngoài tháng đã chọn — cảnh báo nếu > 0. */
	skippedOutsideMonth: number;
	paidBefore: number;
	paidAfter: number;
	items: LeaveSplitRecalcItem[];
	/** Câu nhắc chạy bước 2 — hiển thị nguyên văn được. */
	nextStep: string;
}

// ─── Bước 2 — cộng lại usedDays của sổ quỹ ────────────────────────────────────

export interface RecalculateLeaveBalancePayload {
	/** 2020–2100. */
	year: number;
	/** 1–12. Ở bước này `month` chỉ THU HẸP DANH SÁCH NHÂN SỰ — `usedDays` vẫn cộng cả năm. */
	month?: number;
	/** Bỏ trống → toàn bộ nhân viên có số dư trong năm. */
	employeeIds?: number[];
	dryRun?: boolean;
}

export interface LeaveBalanceRecalcItem {
	employeeId: number;
	employeeCode: string;
	fullName: string;
	leaveTypeCode: string;
	/** Tích luỹ TỚI HIỆN TẠI (theo tháng), không phải hạn mức cả năm. */
	accruedDays: number;
	usedBefore: number;
	usedAfter: number;
	delta: number;
	/** Đã dùng quá số ngày tích luỹ tới hiện tại → số dư âm. */
	exceedsAccrued: boolean;
}

/** Nhân sự có đơn trừ quỹ nhưng chưa được cấp phát số dư → không có bản ghi để ghi vào. */
export interface LeaveBalanceRecalcSkipped {
	employeeId: number;
	fullName: string;
	leaveTypeCode: string;
	untrackedDays: number;
}

export interface LeaveBalanceRecalcResult {
	dryRun: boolean;
	year: number;
	month: number | null;
	scanned: number;
	changed: number;
	/** Tổng trị tuyệt đối các chênh lệch. */
	totalDelta: number;
	items: LeaveBalanceRecalcItem[];
	skipped: LeaveBalanceRecalcSkipped[];
}
