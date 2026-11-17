/**
 * Hàm thuần của lô 4a phê duyệt điện tử.
 *
 * Ba chỗ dễ sai nhất được kiểm ở đây: payload luồng duyệt gửi lên máy chủ (gửi thừa khoá là
 * `APPROVAL_FLOW_INVALID`), giá trị điều kiện phải đúng kiểu (so chuỗi thì `"80" >= "100"` lại
 * đúng), và escape giá trị trước khi ghép vào HTML xem trước mẫu in.
 */
import { describe, it, expect } from 'vitest';

import {
	buildFlowPayload,
	conditionText,
	conditionValueInput,
	dueText,
	fieldErrorSentences,
	mapFieldErrors,
	parseConditionValue,
	pickText,
	printCodeHeader,
	requestCodeText,
	roundHeading,
	timelineByRound,
	validateFlowDraft,
} from '~/utils/general-request.utils';
import { buildPreviewHtml } from '~/utils/print-template';
import type { FieldDefinition, FlowStep, TimelineEntry } from '~/types/general-request.types';

const FIELDS: FieldDefinition[] = [
	{ key: 'noi_dung', label: 'Nội dung', type: 'textarea', required: true },
	{ key: 'so_tien', label: 'Số tiền', type: 'number', required: true },
	{ key: 'phong_ban', label: 'Phòng ban', type: 'select', required: false },
	{ key: 'phong_ban_de_nghi', label: 'Phòng ban đề nghị', type: 'select', required: false },
	{ key: 'gap', label: 'Việc gấp', type: 'checkbox', required: false },
];

function step(partial: Partial<FlowStep>): FlowStep {
	return {
		name: 'Bước thử',
		mode: 'ANY',
		approver: { kind: 'DEPARTMENT_HEAD' },
		...partial,
	} as FlowStep;
}

describe('buildFlowPayload', () => {
	it('chỉ gửi tham số của kiểu người duyệt đang chọn', () => {
		const draft = step({
			approver: {
				kind: 'ROLE',
				role: 'HR',
				// Những khoá dưới đây là thứ màn cấu hình giữ lại khi người dùng đổi kiểu qua lại.
				level: 3,
				employeeIds: [7, 8],
				pick: { roles: ['MANAGER'], min: 1, max: 2, sequential: true },
			},
		});
		const [out] = buildFlowPayload([draft]);
		expect(out!.approver).toEqual({ kind: 'ROLE', role: 'HR' });
	});

	it('kiểu người gửi chọn luôn gửi đủ roles, min, max, sequential', () => {
		const [out] = buildFlowPayload([
			step({ approver: { kind: 'SUBMITTER_PICK', pick: { roles: ['MANAGER', 'DIRECTOR'], min: 1, max: 3, sequential: true } } }),
		]);
		expect(out!.approver.pick).toEqual({ roles: ['MANAGER', 'DIRECTOR'], min: 1, max: 3, sequential: true });
	});

	it('kiểu người cụ thể gửi danh sách id, kiểu bậc quản lý gửi level', () => {
		const payload = buildFlowPayload([
			step({ approver: { kind: 'EMPLOYEES', employeeIds: [9, 10], role: 'HR' } }),
			step({ approver: { kind: 'MANAGER_LEVEL', level: 2, employeeIds: [1] } }),
		]);
		expect(payload[0]!.approver).toEqual({ kind: 'EMPLOYEES', employeeIds: [9, 10] });
		expect(payload[1]!.approver).toEqual({ kind: 'MANAGER_LEVEL', level: 2 });
	});

	it('đánh lại thứ tự bước từ 1 theo thứ tự mảng và cắt khoảng trắng tên', () => {
		const payload = buildFlowPayload([step({ name: '  Trưởng phòng  ' }), step({ name: 'Giám đốc' })]);
		expect(payload.map(s => [s.order, s.name])).toEqual([
			[1, 'Trưởng phòng'],
			[2, 'Giám đốc'],
		]);
	});

	it('bỏ hẳn điều kiện rỗng, giữ điều kiện có trường', () => {
		const payload = buildFlowPayload([
			step({ condition: { all: [], any: [] } }),
			step({ condition: { all: [{ field: 'so_tien', op: '>=', value: 100000000 }], any: [] } }),
		]);
		expect(payload[0]!.condition).toBeUndefined();
		expect(payload[1]!.condition).toEqual({ all: [{ field: 'so_tien', op: '>=', value: 100000000 }] });
	});

	it('không gửi hạn xử lý khi để trống', () => {
		const payload = buildFlowPayload([step({ slaHours: undefined }), step({ slaHours: 16 })]);
		expect(payload[0]!.slaHours).toBeUndefined();
		expect(payload[1]!.slaHours).toBe(16);
	});
});

describe('validateFlowDraft', () => {
	it('luồng rỗng và luồng quá mười bước đều báo lỗi', () => {
		expect(validateFlowDraft([])).toContain('Luồng duyệt phải có ít nhất một bước.');
		const eleven = Array.from({ length: 11 }, () => step({}));
		expect(validateFlowDraft(eleven)).toContain('Luồng duyệt chỉ có nhiều nhất mười bước.');
	});

	it('bắt được bước thiếu tên, thiếu người, thiếu vai trò', () => {
		const errors = validateFlowDraft([
			step({ name: '   ' }),
			step({ approver: { kind: 'EMPLOYEES', employeeIds: [] } }),
			step({ approver: { kind: 'ROLE' } }),
		]);
		expect(errors).toContain('Bước 1 chưa có tên.');
		expect(errors).toContain('Bước 2 chưa chọn người duyệt nào.');
		expect(errors).toContain('Bước 3 chưa chọn vai trò người duyệt.');
	});

	it('bắt được bậc quản lý, số người chọn và hạn xử lý ngoài khoảng', () => {
		const errors = validateFlowDraft([
			step({ approver: { kind: 'MANAGER_LEVEL', level: 9 } }),
			step({ approver: { kind: 'SUBMITTER_PICK', pick: { roles: [], min: 3, max: 1 } } }),
			step({ slaHours: 999 }),
		]);
		expect(errors).toContain('Bậc quản lý ở bước 1 phải từ một đến năm.');
		expect(errors).toContain('Bước 2 có số người chọn nhiều nhất ít hơn số người chọn ít nhất.');
		expect(errors).toContain('Hạn xử lý ở bước 3 phải từ một đến bốn trăm giờ làm việc.');
	});

	it('điều kiện chưa chọn trường hoặc chưa nhập giá trị đều báo', () => {
		const errors = validateFlowDraft([
			step({ condition: { all: [{ field: '', op: '=', value: 'x' }] } }),
			step({ condition: { all: [{ field: 'so_tien', op: '>=', value: '' }] } }),
		]);
		expect(errors).toContain('Bước 1 còn một điều kiện chưa chọn trường.');
		expect(errors).toContain('Bước 2 còn một điều kiện chưa nhập giá trị để so sánh.');
	});

	it('luồng đúng thì không có lỗi nào', () => {
		expect(
			validateFlowDraft([
				step({ name: 'Trưởng phòng', slaHours: 16 }),
				step({
					name: 'Giám đốc',
					approver: { kind: 'ROLE', role: 'DIRECTOR' },
					condition: { all: [{ field: 'so_tien', op: '>=', value: 100000000 }] },
				}),
			]),
		).toEqual([]);
	});
});

describe('parseConditionValue', () => {
	it('trường số thành số, không để so sánh kiểu chuỗi', () => {
		expect(parseConditionValue('100000000', '>=', 'number')).toBe(100000000);
		// Đây chính là cái bẫy: so chuỗi thì "80000000" >= "100000000" lại đúng.
		expect('80000000' >= '100000000').toBe(true);
		expect(80000000 >= 100000000).toBe(false);
	});

	it('phép nằm trong danh sách tách bằng dấu chấm phẩy, giữ kiểu theo trường', () => {
		// Dấu phẩy là dấu thập phân của ô số, nên danh sách tách bằng dấu chấm phẩy.
		expect(parseConditionValue('1; 2; 3', 'in', 'department')).toEqual([1, 2, 3]);
		expect(parseConditionValue('HR; MANAGER', 'in', 'text')).toEqual(['HR', 'MANAGER']);
		expect(parseConditionValue(' ; ', 'in', 'text')).toEqual([]);
		// Số có dấu nhóm nghìn vẫn ra số, không rơi về chuỗi.
		expect(parseConditionValue('1.000; 2.000', 'in', 'number')).toEqual([1000, 2000]);
	});

	it('số có dấu nhóm nghìn và dấu phẩy thập phân đều đọc đúng', () => {
		expect(parseConditionValue('100.000.000', '>=', 'number')).toBe(100000000);
		expect(parseConditionValue('1.234,5', '>=', 'number')).toBe(1234.5);
	});

	it('trường đúng sai thành boolean, trường chữ giữ nguyên chuỗi', () => {
		expect(parseConditionValue('true', '=', 'checkbox')).toBe(true);
		expect(parseConditionValue('false', '=', 'checkbox')).toBe(false);
		expect(parseConditionValue(' Kinh doanh ', '=', 'text')).toBe('Kinh doanh');
	});

	it('chữ không phải số thì giữ nguyên chứ không thành NaN', () => {
		expect(parseConditionValue('một trăm', '>=', 'number')).toBe('một trăm');
	});

	it('đưa về ô nhập rồi đọc lại vẫn ra giá trị cũ', () => {
		expect(conditionValueInput(parseConditionValue('1, 2', 'in', 'number'))).toBe('1, 2');
		expect(conditionValueInput(parseConditionValue('true', '=', 'checkbox'))).toBe('true');
		expect(conditionValueInput(undefined)).toBe('');
	});
});

describe('conditionText', () => {
	it('viết điều kiện thành câu tiếng Việt, dùng nhãn trường của mẫu', () => {
		// Số có dấu nhóm nghìn: điều kiện này quyết định phiếu có phải qua giám đốc hay không, nên
		// người đọc không nên phải đếm chữ số.
		expect(conditionText({ all: [{ field: 'so_tien', op: '>=', value: 100000000 }] }, FIELDS)).toBe(
			'Số tiền lớn hơn hoặc bằng 100.000.000',
		);
		expect(conditionText({ any: [{ field: 'submitter.role', op: 'in', value: ['HR', 'MANAGER'] }] }, FIELDS)).toBe(
			'Vai trò của người gửi nằm trong danh sách HR, MANAGER',
		);
		expect(conditionText(null, FIELDS)).toBeNull();
		expect(conditionText({ all: [], any: [] }, FIELDS)).toBeNull();
	});
});

describe('mapFieldErrors', () => {
	it('gắn câu lỗi của máy chủ vào đúng ô theo nhãn trong ngoặc kép', () => {
		const sentences = ['"Nội dung" là bắt buộc.', '"Số tiền" phải là số.'];
		const mapped = mapFieldErrors(sentences, FIELDS);
		expect(mapped.byKey).toEqual({ noi_dung: '"Nội dung" là bắt buộc.', so_tien: '"Số tiền" phải là số.' });
		expect(mapped.rest).toEqual([]);
	});

	it('nhãn dài được ưu tiên để không bị nhãn ngắn trùng chữ nhận trước', () => {
		const mapped = mapFieldErrors(['"Phòng ban đề nghị" là bắt buộc.'], FIELDS);
		expect(mapped.byKey.phong_ban_de_nghi).toBeDefined();
		expect(mapped.byKey.phong_ban).toBeUndefined();
	});

	it('câu không khớp nhãn nào vẫn được giữ để hiện ở đầu biểu mẫu', () => {
		const mapped = mapFieldErrors(['Biểu mẫu có khoá lạ: ghi_chu.'], FIELDS);
		expect(mapped.byKey).toEqual({});
		expect(mapped.rest).toEqual(['Biểu mẫu có khoá lạ: ghi_chu.']);
	});

	it('đọc được danh sách câu lỗi từ lỗi của authFetch, lỗi khác thì mảng rỗng', () => {
		const apiError = { data: { error: { code: 'REQUEST_FIELDS_INVALID', errors: ['"Số tiền" phải là số.'] } } };
		expect(fieldErrorSentences(apiError)).toEqual(['"Số tiền" phải là số.']);
		expect(fieldErrorSentences(new Error('mạng lỗi'))).toEqual([]);
		expect(fieldErrorSentences(null)).toEqual([]);
	});
});

describe('buildPreviewHtml', () => {
	const TEMPLATE = '<h1>TỜ TRÌNH</h1><p>Nội dung: {{noi_dung}}</p><p title="{{ghi_chu}}">Ghi chú</p>';

	it('escape giá trị mẫu nên nhãn trường chứa HTML không thành thẻ', () => {
		const out = buildPreviewHtml(TEMPLATE, { noi_dung: '<img src=x onerror=alert(1)>' });
		expect(out).toContain('&lt;img src=x onerror=alert(1)&gt;');
		expect(out).not.toContain('<img');
		const doc = new DOMParser().parseFromString(out, 'text/html');
		expect(doc.querySelector('img')).toBeNull();
		expect(doc.querySelector('[onerror]')).toBeNull();
	});

	it('không thoát được khỏi thuộc tính có nháy của mẫu', () => {
		const out = buildPreviewHtml(TEMPLATE, { ghi_chu: '" onmouseover="alert(1)' });
		const doc = new DOMParser().parseFromString(out, 'text/html');
		expect(doc.querySelectorAll('p')[1]?.getAttribute('onmouseover')).toBeNull();
	});

	it('tô vàng chỗ ghép giá trị, giữ nguyên markup của mẫu và placeholder không có giá trị', () => {
		const out = buildPreviewHtml(TEMPLATE, { noi_dung: 'Mua máy tính' });
		expect(out).toContain('<h1>TỜ TRÌNH</h1>');
		expect(out).toContain('<span style="background:#fef9c3;padding:0 2px;">Mua máy tính</span>');
		expect(out).toContain('{{ghi_chu}}');
	});
});

describe('câu hiện trên màn', () => {
	it('số hiệu và vòng duyệt', () => {
		expect(requestCodeText('TT-0012/2026')).toBe('TT-0012/2026');
		expect(requestCodeText(null)).toBe('Chưa có số hiệu');
		expect(roundHeading(2, 2)).toBe('Vòng 2 đang duyệt');
		expect(roundHeading(1, 2)).toBe('Vòng 1');
		// Phiếu một vòng thì không cần tiêu đề nhóm, vì mục "Nhật ký duyệt" ở ngoài đã nói đủ.
		expect(roundHeading(1, 1)).toBe('');
	});

	it('hạn xử lý nói rõ quá hạn, và không có hạn thì không có câu nào', () => {
		expect(dueText(null, false)).toBeNull();
		expect(dueText('2026-11-18T10:00:00.000Z', false)).toMatch(/^Hạn xử lý /);
		expect(dueText('2026-11-18T10:00:00.000Z', true)).toMatch(/^Quá hạn từ /);
	});

	it('bước người gửi chọn nói đúng số người và thứ tự duyệt', () => {
		expect(pickText({ roles: [], min: 1, max: 1 })).toBe('Chọn đúng 1 người');
		expect(pickText({ roles: ['MANAGER'], min: 1, max: 3, sequential: true })).toBe(
			'Chọn 1 đến 3 người trong nhóm Trưởng phòng, duyệt lần lượt theo thứ tự chọn',
		);
		expect(pickText(null)).toBe('');
	});

	it('số hiệu trên bản in được escape', () => {
		expect(printCodeHeader(null, null)).toBe('');
		const header = printCodeHeader('TT-0012/2026<script>', '2026-11-16T03:00:00.000Z');
		expect(header).toContain('TT-0012/2026&lt;script&gt;');
		expect(header).not.toContain('<script>');
	});
});

describe('timelineByRound', () => {
	const entry = (id: number, round: number, createdAt: string): TimelineEntry => ({
		id,
		round,
		action: 'APPROVE',
		actionLabel: 'Đồng ý',
		actor: { id: 7, fullName: 'Lê Văn Dũng' },
		onBehalfOf: null,
		stepOrder: 1,
		note: null,
		detail: null,
		createdAt,
	});

	it('vòng mới nhất lên trước, trong mỗi vòng thì việc cũ trước', () => {
		const groups = timelineByRound([
			entry(1, 1, '2026-11-16T02:00:00.000Z'),
			entry(3, 2, '2026-11-16T05:00:00.000Z'),
			entry(2, 1, '2026-11-16T01:00:00.000Z'),
			entry(4, 2, '2026-11-16T04:00:00.000Z'),
		]);
		expect(groups.map(g => g.round)).toEqual([2, 1]);
		expect(groups[0]!.entries.map(e => e.id)).toEqual([4, 3]);
		expect(groups[1]!.entries.map(e => e.id)).toEqual([2, 1]);
	});

	it('nhật ký rỗng thì không có nhóm nào', () => {
		expect(timelineByRound([])).toEqual([]);
	});
});
