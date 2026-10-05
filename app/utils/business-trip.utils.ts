// ─── Số tiền thanh toán phương tiện (TripTransport.paymentAmount) ────────────
// BE enforce: số nguyên, 0..2_000_000_000 (VNĐ). Gửi lên là number thuần —
// phần phân cách nghìn chỉ tồn tại ở tầng hiển thị.

/** Trần BE chấp nhận cho `paymentAmount`; vượt → 400. */
export const TRIP_PAYMENT_AMOUNT_MAX = 2_000_000_000;

// Khớp `fmtCurrency` của trang chi tiết (Chi phí dự kiến / Chi phí thực tế) để trên cùng
// một trang không có hai kiểu phân cách nghìn khác nhau.
const PAYMENT_AMOUNT_DISPLAY = new Intl.NumberFormat('vi-VN', {
	style: 'currency',
	currency: 'VND',
});

// Bản chỉ phân cách nghìn, KHÔNG ký hiệu tiền — dành riêng cho ô nhập. Nhồi "₫" vào input
// đang gõ thì caret phải nhảy qua nó và người dùng dễ xoá mất ký hiệu.
const PAYMENT_AMOUNT_INPUT = new Intl.NumberFormat('vi-VN', {
	maximumFractionDigits: 0,
});

/** Hiển thị `paymentAmount` cho người đọc — ví dụ `1.850.000 ₫`. */
export function formatTripPaymentAmount(amount: number): string {
	return PAYMENT_AMOUNT_DISPLAY.format(amount);
}

/** Giá trị cho ô nhập — chỉ phân cách nghìn, ví dụ `1.850.000`. */
export function formatTripPaymentAmountInput(amount: number): string {
	return PAYMENT_AMOUNT_INPUT.format(amount);
}

/**
 * Chuẩn hoá chuỗi người dùng gõ vào ô tiền → số nguyên không âm trong khoảng BE cho phép.
 * Bỏ mọi ký tự không phải chữ số: dấu chấm phân cách, ký hiệu ₫, dấu trừ, dấu thập phân.
 */
export function parseTripPaymentAmount(raw: string): number {
	const digits = raw.replace(/\D/g, '');
	if (digits.length === 0) return 0;
	const value = Number(digits);
	if (!Number.isFinite(value)) return 0;
	return Math.min(value, TRIP_PAYMENT_AMOUNT_MAX);
}
