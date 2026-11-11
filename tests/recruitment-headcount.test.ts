import { describe, expect, it } from 'vitest';
import {
	canDeleteHeadcountRow,
	canEditHeadcountProposal,
	canWithdrawHeadcountProposal,
	headcountUsageText,
	isHeadcountRowInUse,
	overCommittedExplanation,
	recruitErrorMessage,
	type HeadcountRights,
	type HeadcountRowActionInput,
} from '~/utils/recruitment.utils';

/**
 * Nút trên một dòng định biên.
 *
 * Vì sao test thay vì chỉ bấm thử: điều kiện hiện nút phụ thuộc vào ba thứ cùng lúc — dòng đã
 * từng chốt chưa, đề xuất đang ở trạng thái nào, người xem có quyền nào — nên có 3 × 4 × 4 tổ
 * hợp. Sandbox chỉ dựng được vài dòng, mà bấm sai một nút thì backend trả 409 và người dùng
 * gặp một lỗi họ không gây ra. Bảng dưới đây chốt đúng những ô mà backend cho phép.
 */

const HR: HeadcountRights = { canPropose: true, canConfirm: false };
const DIRECTOR: HeadcountRights = { canPropose: false, canConfirm: true };
const ADMIN: HeadcountRights = { canPropose: true, canConfirm: true };
const VIEWER: HeadcountRights = { canPropose: false, canConfirm: false };

function row(over: Partial<HeadcountRowActionInput> = {}): HeadcountRowActionInput {
	return {
		confirmedQuantity: null,
		proposalStatus: null,
		current: 0,
		recruiting: 0,
		requisitionCount: 0,
		...over,
	};
}

describe('canEditHeadcountProposal', () => {
	it('chỉ người có quyền nhập đề xuất mới sửa được', () => {
		expect(canEditHeadcountProposal(row(), HR)).toBe(true);
		expect(canEditHeadcountProposal(row(), ADMIN)).toBe(true);
		expect(canEditHeadcountProposal(row(), DIRECTOR)).toBe(false);
		expect(canEditHeadcountProposal(row(), VIEWER)).toBe(false);
	});

	it('đề xuất đang chờ chốt thì không sửa được, kể cả admin', () => {
		const pending = row({ proposalStatus: 'PENDING' });
		expect(canEditHeadcountProposal(pending, HR)).toBe(false);
		expect(canEditHeadcountProposal(pending, ADMIN)).toBe(false);
	});

	it('bị trả lại thì sửa lại được rồi gửi vòng mới', () => {
		expect(canEditHeadcountProposal(row({ proposalStatus: 'REJECTED' }), HR)).toBe(true);
	});
});

describe('canWithdrawHeadcountProposal', () => {
	it('rút được đề xuất Nháp và Bị trả lại của dòng ĐÃ CHỐT', () => {
		for (const status of ['DRAFT', 'REJECTED'] as const) {
			const r = row({ confirmedQuantity: 1, proposalStatus: status });
			expect(canWithdrawHeadcountProposal(r, HR)).toBe(true);
			expect(canWithdrawHeadcountProposal(r, DIRECTOR)).toBe(true);
		}
	});

	it('dòng chưa từng chốt thì không có gì để rút — phải xoá cả dòng', () => {
		// BE trả 409 RECRUIT_HEADCOUNT_NEVER_CONFIRMED cho trường hợp này.
		expect(canWithdrawHeadcountProposal(row({ proposalStatus: 'DRAFT' }), HR)).toBe(false);
		expect(canWithdrawHeadcountProposal(row({ proposalStatus: 'REJECTED' }), ADMIN)).toBe(false);
	});

	it('không có đề xuất, hoặc đề xuất đang chờ chốt, thì không rút', () => {
		expect(canWithdrawHeadcountProposal(row({ confirmedQuantity: 3 }), HR)).toBe(false);
		expect(
			canWithdrawHeadcountProposal(row({ confirmedQuantity: 3, proposalStatus: 'PENDING' }), ADMIN),
		).toBe(false);
	});

	it('người chỉ xem thì không', () => {
		expect(
			canWithdrawHeadcountProposal(row({ confirmedQuantity: 1, proposalStatus: 'DRAFT' }), VIEWER),
		).toBe(false);
	});
});

describe('canDeleteHeadcountRow', () => {
	it('dòng chưa từng chốt: người nhập hoặc người chốt đều xoá được', () => {
		expect(canDeleteHeadcountRow(row({ proposalStatus: 'DRAFT' }), HR)).toBe(true);
		expect(canDeleteHeadcountRow(row({ proposalStatus: 'DRAFT' }), DIRECTOR)).toBe(true);
		expect(canDeleteHeadcountRow(row({ proposalStatus: 'REJECTED' }), HR)).toBe(true);
	});

	it('dòng đã chốt: CHỈ người có quyền chốt', () => {
		const confirmed = row({ confirmedQuantity: 2 });
		expect(canDeleteHeadcountRow(confirmed, HR)).toBe(false);
		expect(canDeleteHeadcountRow(confirmed, DIRECTOR)).toBe(true);
		expect(canDeleteHeadcountRow(confirmed, ADMIN)).toBe(true);
	});

	it('đã chốt 0 vẫn là đã chốt, không phải chưa chốt', () => {
		// `confirmedQuantity: 0` là "đã chốt là không tuyển ai", khác hẳn `null`.
		expect(canDeleteHeadcountRow(row({ confirmedQuantity: 0 }), HR)).toBe(false);
	});

	it('đề xuất đang chờ chốt thì không ai xoá được', () => {
		expect(canDeleteHeadcountRow(row({ proposalStatus: 'PENDING' }), ADMIN)).toBe(false);
		expect(
			canDeleteHeadcountRow(row({ confirmedQuantity: 5, proposalStatus: 'PENDING' }), DIRECTOR),
		).toBe(false);
	});

	it('dòng đang dùng vẫn xoá được, chỉ là phải nhập lý do', () => {
		expect(canDeleteHeadcountRow(row({ confirmedQuantity: 6, current: 5 }), DIRECTOR)).toBe(true);
		expect(canDeleteHeadcountRow(row({ confirmedQuantity: 6, requisitionCount: 2 }), DIRECTOR)).toBe(true);
	});

	it('người chỉ xem thì không', () => {
		expect(canDeleteHeadcountRow(row({ proposalStatus: 'DRAFT' }), VIEWER)).toBe(false);
	});
});

describe('overCommittedExplanation', () => {
	it('đếm cả người đang có lẫn chỉ tiêu đang tuyển', () => {
		expect(overCommittedExplanation(row({ confirmedQuantity: 6, current: 5, recruiting: 3 }))).toBe(
			'Đang dùng 8 trên 6 đã chốt. Yêu cầu đã duyệt giữ nguyên, yêu cầu mới bị chặn.',
		);
	});

	it('dòng chưa từng chốt tính là 0, không in ra "null"', () => {
		expect(overCommittedExplanation(row({ current: 2 }))).toContain('trên 0 đã chốt');
	});
});

/**
 * Dòng "đang dùng" quyết định bấm Xoá mở hộp nào. Đoán sai thì người dùng mở hộp xác nhận
 * thường, bấm Xoá rồi ăn 400 vì thiếu lý do — đúng cái vòng ba bước mà đợt này đi bỏ.
 */
describe('isHeadcountRowInUse', () => {
	it('đã chốt và đang có người', () => {
		expect(isHeadcountRowInUse(row({ confirmedQuantity: 6, current: 5 }))).toBe(true);
	});

	it('đã chốt và có yêu cầu tuyển, kể cả khi không còn ai đang tuyển', () => {
		// `recruiting: 0` mà `requisitionCount: 1` là trường hợp yêu cầu nháp: xét theo
		// `recruiting` thì frontend mở sai hộp.
		expect(isHeadcountRowInUse(row({ confirmedQuantity: 1, recruiting: 0, requisitionCount: 1 }))).toBe(true);
	});

	it('đã chốt nhưng chưa ai dùng thì không', () => {
		expect(isHeadcountRowInUse(row({ confirmedQuantity: 2 }))).toBe(false);
	});

	it('chưa từng chốt thì không, dù vị trí đang có người', () => {
		// Dòng chưa chốt xoá được không cần lý do, bất kể vị trí đó có bao nhiêu nhân viên.
		expect(isHeadcountRowInUse(row({ current: 5, requisitionCount: 2 }))).toBe(false);
	});
});

describe('headcountUsageText', () => {
	it('đủ hai vế', () => {
		expect(headcountUsageText(row({ confirmedQuantity: 6, current: 5, requisitionCount: 2 }))).toBe(
			'đang có 5 người và 2 yêu cầu tuyển',
		);
	});

	it('bỏ vế bằng 0, không đọc thành "và 0 yêu cầu tuyển"', () => {
		expect(headcountUsageText(row({ confirmedQuantity: 2, current: 1 }))).toBe('đang có 1 người');
		expect(headcountUsageText(row({ confirmedQuantity: 1, requisitionCount: 3 }))).toBe(
			'đang có 3 yêu cầu tuyển',
		);
	});

	it('không vế nào thì nói thẳng là chưa có gì', () => {
		expect(headcountUsageText(row({ confirmedQuantity: 2 }))).toBe('chưa có ai và chưa có yêu cầu tuyển nào');
	});
});

/**
 * Câu lỗi hiện cho người dùng. Mọi trang của module đều toast qua hàm này, nên nó là chỗ duy
 * nhất quyết định người dùng đọc được câu của backend hay một dòng kỹ thuật của `ofetch`.
 */
describe('recruitErrorMessage', () => {
	function apiError(message: string, code = 'RECRUIT_HEADCOUNT_IN_USE') {
		const e = new Error(message) as Error & { data?: unknown };
		e.data = { error: { code, message } };
		return e;
	}

	it('giữ nguyên câu của backend', () => {
		const msg = 'Backend Developer năm 2026 đang có 5 người và 2 yêu cầu tuyển nên không xoá được.';
		expect(recruitErrorMessage(apiError(msg), 'Xoá thất bại')).toBe(msg);
	});

	it('mạng đứt thì dùng câu dự phòng, không khạc URL ra cho người dùng', () => {
		const netErr = new Error(
			'[DELETE] "http://127.0.0.1:3180/v1/recruitment/headcount-plans/5": <no response> Failed to fetch',
		);
		expect(recruitErrorMessage(netErr, 'Thao tác thất bại')).toBe('Thao tác thất bại');
	});

	it('không phải Error thì cũng dùng câu dự phòng', () => {
		expect(recruitErrorMessage('ối', 'Thao tác thất bại')).toBe('Thao tác thất bại');
		expect(recruitErrorMessage(null, 'Thao tác thất bại')).toBe('Thao tác thất bại');
	});
});
