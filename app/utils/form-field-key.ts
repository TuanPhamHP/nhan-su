import type { FieldDefinition } from '~/types/general-request.types';

/**
 * Mã của một trường trong loại phiếu: là tên chỗ chèn `{{mã}}` trong mẫu in và là khoá lưu giá trị
 * của phiếu. Người soạn chỉ gõ câu hỏi, nên mã được sinh từ câu hỏi thành camelCase không dấu,
 * VD "Số tiền đề xuất" thành `soTienDeXuat`, trùng mã có sẵn thì thêm số `soTienDeXuat2`.
 */
export const FIELD_KEY_PATTERN = /^[A-Za-z0-9_]+$/;

export function fieldKeyFromLabel(label: string, taken: Set<string>): string {
	const words = label
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[đĐ]/g, ch => (ch === 'đ' ? 'd' : 'D'))
		.split(/[^A-Za-z0-9]+/)
		.filter(Boolean)
		.map(w => w.toLowerCase());
	let base = words.map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1))).join('').slice(0, 40);
	if (!base || /^\d/.test(base)) base = `truong${base}`;
	let key = base;
	for (let n = 2; taken.has(key); n++) key = `${base}${n}`;
	return key;
}

/** Chỉ giữ chữ không dấu, số và gạch dưới khi người soạn tự gõ mã. */
export function sanitizeFieldKey(raw: string): string {
	return raw.replace(/[^A-Za-z0-9_]/g, '');
}

/**
 * Lỗi đầu tiên của danh sách trường, hoặc `null` khi lưu được. Máy chủ cũng chặn thiếu trường và trùng
 * mã, nhưng báo ở đây thì người soạn biết đúng câu nào sai.
 */
export function fieldsError(fields: FieldDefinition[]): string | null {
	if (fields.length === 0) return 'Loại phiếu cần ít nhất một câu hỏi';
	const keys = new Set<string>();
	for (const [i, f] of fields.entries()) {
		const name = `Câu ${i + 1}`;
		if (!f.label.trim()) return `${name} chưa có tiêu đề`;
		if (!f.key) return `${name} chưa có mã chèn mẫu in`;
		if (/[{}\s]/.test(f.key)) return `Mã của ${name.toLowerCase()} không được có dấu cách hay ngoặc nhọn`;
		if (keys.has(f.key)) return `Mã {{${f.key}}} của ${name.toLowerCase()} bị trùng với câu khác`;
		keys.add(f.key);
		if (f.type === 'select' && (!f.dataSource || f.dataSource === 'custom')) {
			const opts = (f.options ?? []).map(o => o.trim()).filter(Boolean);
			if (opts.length === 0) return `${name} cần ít nhất một lựa chọn`;
			if (new Set(opts).size !== opts.length) return `${name} có hai lựa chọn trùng nhau`;
		}
	}
	return null;
}

/** Bỏ phần thừa trước khi gửi: lựa chọn trống, và lựa chọn của câu không còn là danh sách tự nhập. */
export function cleanFields(fields: FieldDefinition[]): FieldDefinition[] {
	return fields.map(f => {
		const custom = f.type === 'select' && (!f.dataSource || f.dataSource === 'custom');
		const out: FieldDefinition = {
			...f,
			label: f.label.trim(),
			options: custom ? (f.options ?? []).map(o => o.trim()).filter(Boolean) : [],
		};
		if (f.type !== 'select') delete out.dataSource;
		return out;
	});
}
