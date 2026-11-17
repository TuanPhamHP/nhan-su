/**
 * Ô nhập số kiểu Việt Nam: dấu chấm là dấu nhóm nghìn, dấu phẩy là phần thập phân.
 *
 * Phần khó của ô số không phải việc định dạng mà là việc GÕ: người dùng sửa giữa chuỗi, dán từ
 * Excel, gõ dấu chấm vì bàn phím số chỉ có dấu chấm. Mọi quy tắc đó nằm ở đây dưới dạng hàm
 * thuần để kiểm bằng test, còn `UiNumberInput` chỉ lo con trỏ và sự kiện.
 *
 * Giá trị gửi lên API luôn là số JSON (`80000`), không bao giờ là chuỗi đã định dạng
 * (`"80.000"`), vì máy chủ đọc `"80.000"` thành 80.
 */

const GROUPING = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

export interface NumberInputState {
	/** Chữ hiện trong ô, đã có dấu nhóm nghìn. */
	text: string;
	/** Giá trị số để gửi lên API; `undefined` khi ô trống. */
	value: number | undefined;
}

/** Số nguyên đã nhóm nghìn: `1234567` → `"1.234.567"`. */
function groupDigits(digits: string): string {
	if (!digits) return '';
	const trimmed = digits.replace(/^0+(?=\d)/, '');
	return GROUPING.format(BigInt(trimmed || '0'));
}

/**
 * Cắt bớt chữ số phần nguyên cho tới khi số không vượt `Number.MAX_SAFE_INTEGER`.
 *
 * Quá ngưỡng đó thì JavaScript làm tròn âm thầm, nên thà không cho gõ thêm còn hơn để người dùng
 * nhập 9.007.199.254.740.993 rồi hệ thống lưu một số khác.
 */
function capDigits(digits: string): string {
	let out = digits.replace(/^0+(?=\d)/, '');
	while (out.length && Number(out) > Number.MAX_SAFE_INTEGER) out = out.slice(0, -1);
	return out;
}

/**
 * Chữ đang có trong ô, sau mỗi lần gõ, đưa về dạng chuẩn.
 *
 * Mọi dấu chấm bị bỏ, vì dấu chấm trong ô là dấu nhóm do chính ô chèn vào: `UiNumberInput` đổi
 * phím dấu chấm thành dấu phẩy trước khi chữ tới đây, nên người dùng vẫn gõ được số lẻ bằng bàn
 * phím số. Chữ cái, dấu trừ, khoảng trắng đều bị bỏ. Phần lẻ dài quá `decimals` thì cắt.
 *
 * Giữ nguyên dấu phẩy người dùng vừa gõ (`"1.234,"`) để họ gõ tiếp được phần lẻ.
 */
export function formatNumberTyping(raw: string, decimals = 0): NumberInputState {
	const cleaned = String(raw ?? '').replace(/[^\d,]/g, '');
	if (!cleaned) return { text: '', value: undefined };

	if (decimals <= 0) {
		const digits = capDigits(cleaned.replace(/,/g, ''));
		return { text: groupDigits(digits), value: digits ? Number(digits) : undefined };
	}

	const commaAt = cleaned.indexOf(',');
	const intDigits = capDigits((commaAt === -1 ? cleaned : cleaned.slice(0, commaAt)).replace(/\D/g, ''));
	const hasComma = commaAt !== -1;
	const fracDigits = hasComma ? cleaned.slice(commaAt + 1).replace(/\D/g, '').slice(0, decimals) : '';

	const text = hasComma ? `${groupDigits(intDigits) || '0'},${fracDigits}` : groupDigits(intDigits);
	const numeric = `${intDigits || '0'}${fracDigits ? `.${fracDigits}` : ''}`;
	const value = intDigits || fracDigits ? Number(numeric) : undefined;
	return { text, value };
}

/**
 * Chuỗi dán vào ô, đọc theo quy ước Việt Nam nhưng chịu được cả chuỗi kiểu Anh Mỹ.
 *
 * - Có dấu phẩy thì dấu phẩy là phần thập phân và mọi dấu chấm là dấu nhóm: `1.234.567,89`.
 * - Không có dấu phẩy mà nhiều dấu chấm thì đều là dấu nhóm: `1.234.567`.
 * - Một dấu chấm với đúng ba chữ số phía sau cũng là dấu nhóm, vì `1.234` người Việt gõ là 1234.
 * - Còn lại một dấu chấm là dấu thập phân: `1234.59` là 1234,59.
 */
export function parsePastedNumber(text: string, decimals = 0): NumberInputState {
	const raw = String(text ?? '').replace(/[^\d.,]/g, '');
	if (!raw) return { text: '', value: undefined };

	let intPart = raw;
	let fracPart = '';

	const commaAt = raw.lastIndexOf(',');
	if (commaAt !== -1) {
		intPart = raw.slice(0, commaAt);
		fracPart = raw.slice(commaAt + 1);
	} else {
		const dots = raw.split('.').length - 1;
		const lastDot = raw.lastIndexOf('.');
		const afterDot = lastDot === -1 ? '' : raw.slice(lastDot + 1);
		const isDecimalDot = dots === 1 && afterDot.length !== 3;
		if (isDecimalDot) {
			intPart = raw.slice(0, lastDot);
			fracPart = afterDot;
		}
	}

	const intDigits = capDigits(intPart.replace(/\D/g, ''));
	const fracDigits = decimals > 0 ? fracPart.replace(/\D/g, '').slice(0, decimals) : '';
	if (!intDigits && !fracDigits) return { text: '', value: undefined };

	const value = Number(`${intDigits || '0'}${fracDigits ? `.${fracDigits}` : ''}`);
	return { text: formatNumberValue(value, decimals), value };
}

/** Giá trị số → chữ hiện trong ô, VD `18500000.5` với hai số lẻ → `"18.500.000,5"`. */
export function formatNumberValue(value: number | undefined | null, decimals = 0): string {
	if (value == null || !Number.isFinite(value)) return '';
	return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: Math.max(0, decimals) }).format(value);
}

/** Số chữ số tính từ đầu chuỗi tới vị trí con trỏ; dùng để đặt lại con trỏ sau khi định dạng. */
export function digitsBefore(text: string, caret: number): number {
	let count = 0;
	for (let i = 0; i < Math.min(caret, text.length); i++) {
		if (/[\d,]/.test(text[i]!)) count++;
	}
	return count;
}

/**
 * Vị trí con trỏ trong chuỗi mới sao cho phía trước nó vẫn là `count` chữ số.
 *
 * Nhờ vậy sửa giữa `1.234.567` không làm con trỏ nhảy về cuối ô.
 */
export function caretAfterDigits(text: string, count: number): number {
	if (count <= 0) return 0;
	let seen = 0;
	for (let i = 0; i < text.length; i++) {
		if (/[\d,]/.test(text[i]!)) {
			seen++;
			if (seen === count) return i + 1;
		}
	}
	return text.length;
}
