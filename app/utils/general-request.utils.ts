/**
 * Hàm thuần của phiếu đề xuất (lô 4a): dựng câu tiếng Việt cho màn hình, kiểm luồng duyệt
 * trước khi gửi, và ghép số hiệu vào bản in.
 *
 * Mọi nhãn trạng thái của một phiếu thật đều lấy từ máy chủ. Những hàm ở đây chỉ dựng chữ cho
 * thứ máy chủ không trả: luồng duyệt người dùng đang soạn trên màn cấu hình, hạn xử lý, và
 * tiêu đề nhóm vòng duyệt.
 */
import { formatDate, formatDateTime } from '~/utils/date';
import { escapePrintValue } from '~/utils/print-template';
import {
	APPROVAL_MODE_LABELS,
	APPROVER_KIND_LABELS,
	CONDITION_OP_LABELS,
	FLOW_ROLE_LABELS,
	type FieldDefinition,
	type FlowCondition,
	type FlowConditionGroup,
	type FlowStep,
	type GeneralRequestResponse,
	type Person,
	type SubmitterPick,
	type TimelineEntry,
} from '~/types/general-request.types';

/** Số hiệu để hiện trên màn; phiếu chưa gửi thì chưa có số. */
export function requestCodeText(code: string | null): string {
	return code ?? 'Chưa có số hiệu';
}

/** "vòng 2" chỉ hiện khi phiếu đã bị trả lại và nộp lại, vì vòng 1 là chuyện thường. */
export function roundText(round: number): string | null {
	return round > 1 ? `vòng ${round}` : null;
}

/**
 * Câu về hạn xử lý của một bước.
 *
 * Hạn tính theo giờ làm việc nên luôn hiện cả giờ, không chỉ ngày: một phiếu gửi chiều muộn có
 * hạn vào sáng hôm sau, mà chỉ hiện ngày thì người duyệt tưởng còn cả ngày.
 */
export function dueText(dueAt: string | null, overdue: boolean): string | null {
	if (!dueAt) return null;
	return overdue ? `Quá hạn từ ${formatDateTime(dueAt)}` : `Hạn xử lý ${formatDateTime(dueAt)}`;
}

/** Người đang giữ lượt, ghép thành một câu cho dòng danh sách. */
export function holderText(approvers: Person[] | undefined): string {
	if (!approvers?.length) return '—';
	return approvers.map(p => p.fullName).join(', ');
}

/** "Lê Văn Dũng duyệt thay Đỗ Thị Lan" cho bước và cho dòng nhật ký. */
export function onBehalfText(actor: Person | null, onBehalfOf: Person | null): string | null {
	if (!onBehalfOf) return null;
	return actor ? `${actor.fullName} duyệt thay ${onBehalfOf.fullName}` : `duyệt thay ${onBehalfOf.fullName}`;
}

/** Nhật ký chia theo vòng, vòng mới nhất lên trước, trong mỗi vòng thì cũ trước. */
export function timelineByRound(entries: TimelineEntry[]): Array<{ round: number; entries: TimelineEntry[] }> {
	const groups = new Map<number, TimelineEntry[]>();
	for (const entry of entries) {
		const list = groups.get(entry.round) ?? [];
		list.push(entry);
		groups.set(entry.round, list);
	}
	return [...groups.entries()]
		.sort((a, b) => b[0] - a[0])
		.map(([round, list]) => ({
			round,
			entries: [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
		}));
}

/**
 * Tiêu đề nhóm vòng trong nhật ký; chuỗi rỗng nghĩa là không cần tiêu đề.
 *
 * Phiếu chưa bị trả lại thì chỉ có một vòng, lúc đó tiêu đề mục "Nhật ký duyệt" ở ngoài đã đủ,
 * thêm một dòng nữa là lặp lại chính nó.
 */
export function roundHeading(round: number, currentRound: number): string {
	if (round === currentRound) return currentRound > 1 ? `Vòng ${round} đang duyệt` : '';
	return `Vòng ${round}`;
}

// ─── Luồng duyệt ──────────────────────────────────────────────────────────────

/** "Chọn 1 đến 3 người, duyệt lần lượt" — câu mô tả bước người gửi chọn. */
export function pickText(pick: SubmitterPick | null | undefined): string {
	if (!pick) return '';
	const count = pick.min === pick.max ? `đúng ${pick.min} người` : `${pick.min} đến ${pick.max} người`;
	const roles = pick.roles.length
		? ` trong nhóm ${pick.roles.map(r => FLOW_ROLE_LABELS[r] ?? r).join(', ')}`
		: '';
	const order = pick.sequential ? ', duyệt lần lượt theo thứ tự chọn' : '';
	return `Chọn ${count}${roles}${order}`;
}

/** Người duyệt của một bước luồng, viết thành câu để hiện trong bảng cấu hình. */
export function approverText(step: FlowStep, employeeName: (id: number) => string): string {
	const approver = step.approver;
	switch (approver.kind) {
		case 'MANAGER_LEVEL':
			return `${APPROVER_KIND_LABELS.MANAGER_LEVEL}, bậc ${approver.level ?? 1}`;
		case 'EMPLOYEES': {
			const names = (approver.employeeIds ?? []).map(employeeName).filter(Boolean);
			return names.length ? names.join(', ') : 'Chưa chọn người nào';
		}
		case 'ROLE':
			return approver.role ? FLOW_ROLE_LABELS[approver.role] : 'Chưa chọn vai trò';
		case 'SUBMITTER_PICK':
			return pickText(approver.pick);
		default:
			return APPROVER_KIND_LABELS[approver.kind];
	}
}

const NUMBER_FORMAT = new Intl.NumberFormat('vi-VN');

/**
 * Giá trị điều kiện viết lại thành chữ: mảng thành danh sách, true/false thành có/không, số có
 * dấu nhóm nghìn.
 *
 * Số tiền viết liền như `100000000` buộc người đọc đếm chữ số để biết là một trăm triệu hay mười
 * triệu, mà điều kiện này quyết định phiếu có phải qua giám đốc hay không.
 */
function conditionValueText(value: FlowCondition['value']): string {
	if (Array.isArray(value)) return value.map(v => (typeof v === 'number' ? NUMBER_FORMAT.format(v) : String(v))).join(', ');
	if (typeof value === 'boolean') return value ? 'có' : 'không';
	if (typeof value === 'number') return NUMBER_FORMAT.format(value);
	return String(value);
}

/** Tên trường trong câu điều kiện; hai khoá đặc biệt là thuộc tính của người gửi. */
export function conditionFieldLabel(field: string, fields: FieldDefinition[]): string {
	if (field === 'submitter.departmentId') return 'Phòng ban của người gửi';
	if (field === 'submitter.role') return 'Vai trò của người gửi';
	return fields.find(f => f.key === field)?.label ?? field;
}

/** Cả nhóm điều kiện thành một câu, VD "Số tiền lớn hơn hoặc bằng 100000000". */
export function conditionText(
	group: FlowConditionGroup | null | undefined,
	fields: FieldDefinition[],
): string | null {
	if (!group) return null;
	const all = group.all ?? [];
	const any = group.any ?? [];
	if (!all.length && !any.length) return null;
	const one = (c: FlowCondition) =>
		`${conditionFieldLabel(c.field, fields)} ${CONDITION_OP_LABELS[c.op] ?? c.op} ${conditionValueText(c.value)}`;
	if (all.length && !any.length) return all.map(one).join(' và ');
	if (any.length && !all.length) return any.map(one).join(' hoặc ');
	return `${all.map(one).join(' và ')}, đồng thời ${any.map(one).join(' hoặc ')}`;
}

export function modeText(step: FlowStep): string {
	return APPROVAL_MODE_LABELS[step.mode];
}

/**
 * Bỏ những khoá không thuộc kiểu người duyệt đang chọn trước khi gửi luồng lên máy chủ.
 *
 * Màn cấu hình giữ cả `level`, `employeeIds`, `role`, `pick` trong một đối tượng để người dùng
 * đổi kiểu qua lại mà không mất thứ vừa nhập. Gửi nguyên đối tượng đó thì máy chủ nhận thừa
 * khoá và trả `APPROVAL_FLOW_INVALID`, nên lọc ở đây. Điều kiện rỗng cũng bỏ hẳn, vì nhóm rỗng
 * nghĩa là "không có điều kiện" chứ không phải "điều kiện không khớp".
 */
export function buildFlowPayload(steps: FlowStep[]): FlowStep[] {
	return steps.map((step, index) => {
		const approver = step.approver;
		const out: FlowStep = {
			order: index + 1,
			name: step.name.trim(),
			mode: step.mode,
			approver: { kind: approver.kind },
		};
		if (approver.kind === 'MANAGER_LEVEL') out.approver.level = approver.level ?? 1;
		if (approver.kind === 'EMPLOYEES') out.approver.employeeIds = [...(approver.employeeIds ?? [])];
		if (approver.kind === 'ROLE' && approver.role) out.approver.role = approver.role;
		if (approver.kind === 'SUBMITTER_PICK') {
			const pick = approver.pick;
			out.approver.pick = {
				roles: [...(pick?.roles ?? [])],
				min: pick?.min ?? 1,
				max: pick?.max ?? 1,
				sequential: pick?.sequential ?? false,
			};
		}
		if (step.slaHours) out.slaHours = step.slaHours;
		const all = step.condition?.all?.filter(c => c.field) ?? [];
		const any = step.condition?.any?.filter(c => c.field) ?? [];
		if (all.length || any.length) {
			out.condition = {};
			if (all.length) out.condition.all = all;
			if (any.length) out.condition.any = any;
		}
		return out;
	});
}

/**
 * Lỗi của luồng người dùng đang soạn, nói bằng câu tiếng Việt trước khi gọi máy chủ.
 *
 * Máy chủ vẫn là nơi quyết định (`APPROVAL_FLOW_INVALID`), nhưng những lỗi hiển nhiên thì nói
 * ngay cạnh bước đang sai sẽ nhanh hơn một toast đỏ sau khi bấm Lưu.
 */
export function validateFlowDraft(steps: FlowStep[]): string[] {
	const errors: string[] = [];
	if (!steps.length) errors.push('Luồng duyệt phải có ít nhất một bước.');
	if (steps.length > 10) errors.push('Luồng duyệt chỉ có nhiều nhất mười bước.');
	steps.forEach((step, index) => {
		const where = `Bước ${index + 1}`;
		const ordinal = index + 1;
		if (!step.name.trim()) errors.push(`${where} chưa có tên.`);
		if (step.name.trim().length > 100) errors.push(`Tên bước ${ordinal} dài quá một trăm ký tự.`);
		const approver = step.approver;
		if (approver.kind === 'EMPLOYEES' && !approver.employeeIds?.length) {
			errors.push(`${where} chưa chọn người duyệt nào.`);
		}
		if (approver.kind === 'ROLE' && !approver.role) {
			errors.push(`${where} chưa chọn vai trò người duyệt.`);
		}
		if (approver.kind === 'MANAGER_LEVEL') {
			const level = approver.level ?? 0;
			if (level < 1 || level > 5) errors.push(`Bậc quản lý ở bước ${ordinal} phải từ một đến năm.`);
		}
		if (approver.kind === 'SUBMITTER_PICK') {
			const pick = approver.pick;
			const min = pick?.min ?? 0;
			const max = pick?.max ?? 0;
			if (min < 1) errors.push(`${where} phải cho người gửi chọn ít nhất một người.`);
			if (max < min) {
				errors.push(`Bước ${ordinal} có số người chọn nhiều nhất ít hơn số người chọn ít nhất.`);
			}
		}
		if (step.slaHours !== undefined && step.slaHours !== null) {
			if (step.slaHours < 1 || step.slaHours > 400) {
				errors.push(`Hạn xử lý ở bước ${ordinal} phải từ một đến bốn trăm giờ làm việc.`);
			}
		}
		const conditions = [...(step.condition?.all ?? []), ...(step.condition?.any ?? [])];
		conditions.forEach(c => {
			if (!c.field) errors.push(`${where} còn một điều kiện chưa chọn trường.`);
			if (c.value === '' || c.value === undefined || c.value === null) {
				errors.push(`${where} còn một điều kiện chưa nhập giá trị để so sánh.`);
			}
		});
	});
	return errors;
}

/**
 * Chữ người dùng gõ ở ô giá trị điều kiện, đổi thành kiểu máy chủ chờ đợi.
 *
 * Máy chủ so sánh theo kiểu của trường: trường số thì `"100000000"` phải thành số, nếu không
 * thì phép `>=` so chuỗi và `"80000000" >= "100000000"` lại đúng. Phép `in` nhận mảng, người
 * dùng gõ các giá trị cách nhau bằng dấu phẩy. Trường `submitter.departmentId` là id phòng nên
 * cũng là số.
 */
export function parseConditionValue(
	raw: string,
	op: FlowConditionOp,
	fieldType?: FieldDefinition['type'] | 'department',
): FlowCondition['value'] {
	const text = raw.trim();
	const isNumeric = fieldType === 'number' || fieldType === 'department';
	/**
	 * Chữ người dùng gõ → số, sau khi bỏ dấu nhóm nghìn và đổi dấu phẩy thập phân thành dấu chấm.
	 *
	 * Thiếu bước bỏ dấu nhóm thì `Number("100.000.000")` ra `NaN`, giá trị rơi về chuỗi và máy chủ
	 * đem so chuỗi với số: `"80000000" >= "100.000.000"` lại đúng.
	 */
	const asNumber = (value: string): string | number => {
		const cleaned = value.replace(/\./g, '').replace(',', '.');
		const n = Number(cleaned);
		return cleaned !== '' && Number.isFinite(n) ? n : value;
	};
	if (op === 'in') {
		// Tách bằng dấu chấm phẩy, vì dấu phẩy đã là dấu thập phân của ô số.
		return text
			.split(';')
			.map(part => part.trim())
			.filter(Boolean)
			.map(part => (isNumeric ? asNumber(part) : part));
	}
	if (fieldType === 'checkbox') return text === 'true' || text === 'có';
	if (isNumeric) return asNumber(text);
	return text;
}

/**
 * Giá trị điều kiện đã lưu, đưa về chữ để hiện lại trong ô nhập.
 *
 * Danh sách của phép "nằm trong" ghép bằng dấu chấm phẩy, khớp với cách `parseConditionValue`
 * tách, và số giữ nguyên chữ số thô vì ô số dùng chung sẽ tự thêm dấu nhóm nghìn.
 */
export function conditionValueInput(value: FlowCondition['value'] | undefined): string {
	if (value === undefined || value === null) return '';
	if (Array.isArray(value)) return value.join('; ');
	if (typeof value === 'boolean') return value ? 'true' : 'false';
	return String(value);
}

/** Trường của mẫu dùng được trong điều kiện, cộng hai thuộc tính của người gửi. */
export function conditionFieldOptions(fields: FieldDefinition[]): Array<{ value: string; label: string }> {
	return [
		...fields
			.filter(f => ['number', 'select', 'date', 'checkbox', 'text'].includes(f.type))
			.map(f => ({ value: f.key, label: f.label })),
		{ value: 'submitter.departmentId', label: 'Phòng ban của người gửi' },
		{ value: 'submitter.role', label: 'Vai trò của người gửi' },
	];
}

// ─── Lỗi biểu mẫu ─────────────────────────────────────────────────────────────

/** Danh sách câu lỗi kèm `REQUEST_FIELDS_INVALID`; mảng rỗng khi lỗi thuộc loại khác. */
export function fieldErrorSentences(e: unknown): string[] {
	const list = (e as { data?: { error?: { errors?: unknown } } } | null)?.data?.error?.errors;
	return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
}

export interface MappedFieldErrors {
	/** Lỗi gắn được vào một ô, khoá là `key` của trường. */
	byKey: Record<string, string>;
	/** Lỗi không gắn được ô nào, hiện ở đầu biểu mẫu. */
	rest: string[];
}

/**
 * Gắn từng câu lỗi của máy chủ vào đúng ô nhập.
 *
 * Máy chủ trả câu hoàn chỉnh có nhãn trường trong ngoặc kép, VD `"Số tiền" phải là số.`, nên
 * tìm nhãn trong câu là đủ để biết câu đó thuộc ô nào — và giữ nguyên câu của máy chủ thay vì
 * tự viết lại. Câu không khớp nhãn nào (VD lỗi về key lạ) vẫn phải hiện, nên gom vào `rest`.
 *
 * So nhãn dài trước nhãn ngắn: mẫu có cả "Phòng ban" và "Phòng ban đề nghị" thì câu về trường
 * dài sẽ bị trường ngắn nhận trước nếu so theo thứ tự khai báo.
 */
export function mapFieldErrors(sentences: string[], fields: FieldDefinition[]): MappedFieldErrors {
	const byLabel = [...fields].sort((a, b) => b.label.length - a.label.length);
	const byKey: Record<string, string> = {};
	const rest: string[] = [];
	for (const sentence of sentences) {
		const field = byLabel.find(f => sentence.includes(`"${f.label}"`) || sentence.includes(`“${f.label}”`));
		if (field && !byKey[field.key]) byKey[field.key] = sentence;
		else if (field) byKey[field.key] = `${byKey[field.key]} ${sentence}`;
		else rest.push(sentence);
	}
	return { byKey, rest };
}

// ─── Bản in ───────────────────────────────────────────────────────────────────

/**
 * Dòng số hiệu chèn lên đầu bản in.
 *
 * Số hiệu do máy chủ cấp nên không phải dữ liệu người dùng, nhưng vẫn escape: bản in mở bằng
 * `document.write` ở cùng origin, và một quy ước "chỉ dữ liệu của máy chủ thì khỏi escape" rất
 * dễ bị sao chép sang chỗ khác không còn đúng.
 */
export function printCodeHeader(code: string | null, submittedAt: string | null): string {
	if (!code) return '';
	const date = submittedAt ? ` · ngày ${escapePrintValue(formatDate(submittedAt))}` : '';
	return `<p style="text-align:right;margin:0 0 12px">Số hiệu: <b>${escapePrintValue(code)}</b>${date}</p>`;
}

/** Số file đính kèm trên dòng danh sách, bỏ hẳn khi không có file. */
export function attachmentCountText(count: number): string | null {
	return count > 0 ? `${count} tệp đính kèm` : null;
}

/** Dung lượng tệp cho danh sách đính kèm. */
export function fileSizeText(size: number): string {
	if (size < 1024) return `${size} B`;
	if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
	return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

/** Người xem được phiếu, dùng cho ô nhắc tên trong bình luận. */
export function mentionableFrom(req: GeneralRequestResponse & { watchers?: { employeeId: number; fullName: string }[] }): Array<{
	id: number;
	fullName: string;
	avatarUrl: string | null;
}> {
	const seen = new Map<number, string>();
	seen.set(req.employee.id, req.employee.fullName);
	for (const watcher of req.watchers ?? []) seen.set(watcher.employeeId, watcher.fullName);
	for (const step of req.steps) {
		for (const assignment of step.assignments) seen.set(assignment.employee.id, assignment.employee.fullName);
	}
	return [...seen.entries()].map(([id, fullName]) => ({ id, fullName, avatarUrl: null }));
}
